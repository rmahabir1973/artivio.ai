/**
 * Video Decoder Web Worker
 * Based on W3C WebCodecs samples: https://github.com/w3c/webcodecs/tree/main/samples/video-decode-display
 * Uses MP4Box.js for demuxing and WebCodecs VideoDecoder for hardware-accelerated decoding
 */

// @ts-ignore - MP4Box types not available
import * as MP4Box from 'mp4box';

interface DecoderMessage {
  type: 'load' | 'seek' | 'buffer' | 'destroy';
  videoId?: string;
  url?: string;
  time?: number;
  items?: Array<{
    id: string;
    startTime: number;
    duration: number;
    trim?: { start: number; end: number };
    speed?: number;
  }>;
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

interface VideoState {
  decoder: VideoDecoder | null;
  metadata: VideoMetadata | null;
  chunks: EncodedVideoChunk[];
  isReady: boolean;
  isConfigured: boolean;
}

class VideoDecoderWorker {
  private videos: Map<string, VideoState> = new Map();

  constructor() {
    self.addEventListener('message', this.handleMessage.bind(this));
    this.sendMessage({ type: 'ready' });
  }

  private sendMessage(message: any, transfer?: Transferable[]): void {
    if (transfer && transfer.length > 0) {
      self.postMessage(message, { transfer });
    } else {
      self.postMessage(message);
    }
  }

  private async handleMessage(event: MessageEvent<DecoderMessage>): Promise<void> {
    const { type, videoId, url, time, items } = event.data;

    try {
      switch (type) {
        case 'load':
          if (videoId && url) {
            await this.loadVideo(videoId, url);
          }
          break;

        case 'seek':
          if (videoId && time !== undefined) {
            await this.seekVideo(videoId, time);
          }
          break;

        case 'buffer':
          if (time !== undefined && items) {
            await this.bufferFrames(time, items);
          }
          break;

        case 'destroy':
          if (videoId) {
            this.destroyVideo(videoId);
          }
          break;
      }
    } catch (error) {
      console.error(`[VideoDecoder] Error handling ${type}:`, error);
      this.sendMessage({
        type: 'error',
        videoId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Extract codec description from MP4Box track
   * Based on W3C sample: https://github.com/w3c/webcodecs/blob/main/samples/video-decode-display/demuxer_mp4.js
   */
  private getDescription(mp4boxFile: any, track: any): Uint8Array | undefined {
    const trak = mp4boxFile.getTrackById(track.id);
    if (!trak) return undefined;

    for (const entry of trak.mdia.minf.stbl.stsd.entries) {
      // Check for codec config boxes: avcC (H.264), hvcC (HEVC), vpcC (VP9), av1C (AV1)
      const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
      if (box) {
        // Use MP4Box's DataStream to serialize the box
        const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
        box.write(stream);
        // Return the box content, skipping the 8-byte header (4 bytes size + 4 bytes type)
        return new Uint8Array(stream.buffer, 8);
      }
    }
    return undefined;
  }

  /**
   * Load and decode a video
   */
  private async loadVideo(videoId: string, url: string): Promise<void> {
    // Check if already loaded
    if (this.videos.has(videoId)) {
      const existing = this.videos.get(videoId);
      if (existing?.isReady) {
        this.sendMessage({
          type: 'loaded',
          videoId,
          metadata: existing.metadata,
        });
        return;
      }
    }

    this.sendMessage({ type: 'loading', videoId, progress: 0 });

    // Initialize video state
    const videoState: VideoState = {
      decoder: null,
      metadata: null,
      chunks: [],
      isReady: false,
      isConfigured: false,
    };
    this.videos.set(videoId, videoState);

    try {
      // Fetch video data
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();

      // Create MP4Box file
      const mp4boxFile = MP4Box.createFile();

      // Promise to wait for ready
      const { metadata, track } = await new Promise<{ metadata: VideoMetadata; track: any }>((resolve, reject) => {
        mp4boxFile.onError = (e: any) => reject(new Error(`MP4Box error: ${e}`));

        mp4boxFile.onReady = (info: any) => {
          const videoTrack = info.videoTracks[0];
          if (!videoTrack) {
            reject(new Error('No video track found'));
            return;
          }

          const metadata: VideoMetadata = {
            duration: info.duration / info.timescale,
            width: videoTrack.video.width,
            height: videoTrack.video.height,
            frameRate: videoTrack.nb_samples / (info.duration / info.timescale),
            hasVideo: info.videoTracks.length > 0,
            hasAudio: info.audioTracks.length > 0,
          };

          resolve({ metadata, track: videoTrack });
        };

        // Feed file data
        (arrayBuffer as any).fileStart = 0;
        mp4boxFile.appendBuffer(arrayBuffer);
        mp4boxFile.flush();
      });

      videoState.metadata = metadata;

      // Get codec description
      const description = this.getDescription(mp4boxFile, track);
      console.log(`[VideoDecoder] ${videoId}: codec=${track.codec}, description=${description?.length || 0} bytes`);

      // Create decoder
      const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
          const timestamp = frame.timestamp / 1_000_000; // Convert microseconds to seconds
          this.sendMessage({
            type: 'frame',
            videoId,
            timestamp,
            frame,
          }, [frame]);
        },
        error: (error: Error) => {
          console.error(`[VideoDecoder] ${videoId} decode error:`, error.message);
        },
      });

      videoState.decoder = decoder;

      // Configure decoder
      const config: VideoDecoderConfig = {
        codec: track.codec,
        codedWidth: track.video.width,
        codedHeight: track.video.height,
        description,
      };

      // Check if config is supported
      const support = await VideoDecoder.isConfigSupported(config);
      if (!support.supported) {
        throw new Error(`Codec not supported: ${track.codec}`);
      }

      decoder.configure(config);
      videoState.isConfigured = true;
      console.log(`[VideoDecoder] ${videoId}: Decoder configured with codec ${track.codec}`);

      // Extract samples
      const chunks: EncodedVideoChunk[] = [];

      await new Promise<void>((resolve) => {
        mp4boxFile.onSamples = (trackId: number, ref: any, samples: any[]) => {
          for (const sample of samples) {
            chunks.push(new EncodedVideoChunk({
              type: sample.is_sync ? 'key' : 'delta',
              timestamp: (sample.cts * 1_000_000) / sample.timescale,
              duration: (sample.duration * 1_000_000) / sample.timescale,
              data: sample.data,
            }));
          }
        };

        mp4boxFile.setExtractionOptions(track.id, null, { nbSamples: Infinity });
        mp4boxFile.start();

        // Give mp4box time to extract samples
        setTimeout(resolve, 100);
      });

      videoState.chunks = chunks;
      videoState.isReady = true;
      console.log(`[VideoDecoder] ${videoId}: Extracted ${chunks.length} chunks`);

      // Send loaded message
      this.sendMessage({
        type: 'loaded',
        videoId,
        metadata,
      });

      // Decode first batch of frames for preview
      if (chunks.length > 0 && decoder.state === 'configured') {
        const framesToDecode = Math.min(chunks.length, 90); // ~3 seconds at 30fps
        for (let i = 0; i < framesToDecode; i++) {
          if (decoder.state !== 'configured') break;
          decoder.decode(chunks[i]);
        }
        await decoder.flush();
        console.log(`[VideoDecoder] ${videoId}: Pre-decoded ${framesToDecode} frames`);
      }

    } catch (error) {
      console.error(`[VideoDecoder] ${videoId} load error:`, error);
      this.sendMessage({
        type: 'error',
        videoId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Seek to specific time and decode frames
   */
  private async seekVideo(videoId: string, time: number): Promise<void> {
    const video = this.videos.get(videoId);
    if (!video?.isReady || !video.decoder || !video.metadata) return;

    const { decoder, chunks, metadata } = video;

    // Check decoder state
    if (decoder.state !== 'configured') {
      console.warn(`[VideoDecoder] ${videoId}: Cannot seek, decoder state is ${decoder.state}`);
      return;
    }

    // Find the nearest keyframe before target time
    const targetTimestamp = time * 1_000_000; // Convert to microseconds
    let keyframeIndex = 0;

    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].type === 'key' && chunks[i].timestamp <= targetTimestamp) {
        keyframeIndex = i;
      } else if (chunks[i].timestamp > targetTimestamp) {
        break;
      }
    }

    // Decode from keyframe to target + buffer
    const endIndex = Math.min(keyframeIndex + 90, chunks.length);

    for (let i = keyframeIndex; i < endIndex; i++) {
      if (decoder.state !== 'configured') break;
      decoder.decode(chunks[i]);
    }

    if (decoder.state === 'configured') {
      await decoder.flush();
    }

    this.sendMessage({ type: 'seeked', videoId, time });
  }

  /**
   * Buffer frames for playback
   */
  private async bufferFrames(
    time: number,
    items: Array<{
      id: string;
      startTime: number;
      duration: number;
      trim?: { start: number; end: number };
      speed?: number;
    }>
  ): Promise<void> {
    for (const item of items) {
      const video = this.videos.get(item.id);
      if (!video?.isReady) continue;

      const timeInClip = time - item.startTime;
      if (timeInClip < -1 || timeInClip > item.duration + 1) continue;

      const speed = item.speed || 1;
      const trimStart = item.trim?.start || 0;
      const localTime = trimStart + (timeInClip * speed);

      await this.seekVideo(item.id, localTime);
    }
  }

  /**
   * Destroy a video and its decoder
   */
  private destroyVideo(videoId: string): void {
    const video = this.videos.get(videoId);
    if (!video) return;

    if (video.decoder && video.decoder.state !== 'closed') {
      video.decoder.close();
    }

    this.videos.delete(videoId);
    this.sendMessage({ type: 'destroyed', videoId });
  }
}

// Initialize worker
new VideoDecoderWorker();
