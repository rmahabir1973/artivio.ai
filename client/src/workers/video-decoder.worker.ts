/**
 * Video Decoder Web Worker
 * Runs WebCodecs VideoDecoder off the main thread to prevent UI freezing
 * Handles video loading, demuxing with MP4Box, and frame decoding
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

// Limit video chunks to prevent memory exhaustion (~100 seconds at 30fps)
const MAX_VIDEO_CHUNKS = 3000;

class VideoDecoderWorker {
  private decoders: Map<string, {
    decoder: VideoDecoder;
    metadata: VideoMetadata | null;
    videoData: EncodedVideoChunk[];
    mp4boxFile: any;
    frameBuffer: Map<number, VideoFrame>;
    isReady: boolean;
  }> = new Map();

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
      this.sendMessage({
        type: 'error',
        videoId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Load and initialize a video
   */
  private async loadVideo(videoId: string, url: string): Promise<void> {
    // Check if already loaded - prevent duplicate loads
    if (this.decoders.has(videoId)) {
      const existing = this.decoders.get(videoId);
      if (existing?.isReady) {
        // Already loaded, just send the loaded message again
        this.sendMessage({
          type: 'loaded',
          videoId,
          metadata: existing.metadata,
        });
        return;
      }
    }

    this.sendMessage({ type: 'loading', videoId, progress: 0 });

    try {
      // Validate URL - must be absolute URL (http://, https://, blob:, or data:)
      const validProtocols = ['http://', 'https://', 'blob:', 'data:'];
      const hasValidProtocol = validProtocols.some(protocol => url.startsWith(protocol));
      if (!hasValidProtocol) {
        throw new Error(`Invalid URL: ${url} - must be an absolute URL (http://, https://, blob:, or data:)`);
      }

      // Fetch video data with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      let response: Response;
      let blob: Blob;
      let arrayBuffer: ArrayBuffer;
      
      try {
        response = await fetch(url, { signal: controller.signal });
        
        // Check for errors
        if (!response.ok) {
          throw new Error(`Failed to fetch video: ${response.status} ${response.statusText} for ${url}`);
        }
        
        blob = await response.blob();
        arrayBuffer = await blob.arrayBuffer();
      } finally {
        clearTimeout(timeoutId);
      }

      // Create MP4Box file for demuxing
      const mp4boxFile = MP4Box.createFile();

      // Extract metadata and setup decoder
      const metadata = await new Promise<VideoMetadata>((resolve, reject) => {
        mp4boxFile.onError = (e: any) => reject(e);

        mp4boxFile.onReady = async (info: any) => {
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

          resolve(metadata);
        };

        // Feed file data
        const buffer = arrayBuffer as any;
        buffer.fileStart = 0;
        mp4boxFile.appendBuffer(buffer);
        mp4boxFile.flush();
      });

      // Create decoder
      const videoData: EncodedVideoChunk[] = [];
      const frameBuffer = new Map<number, VideoFrame>();

      const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
          const timestamp = frame.timestamp / 1000000; // to seconds

          // Send frame to main thread (transfer ownership for zero-copy)
          // Note: Don't store in frameBuffer - frame becomes detached after transfer
          this.sendMessage({
            type: 'frame',
            videoId,
            timestamp,
            frame,
          }, [frame]);
        },
        error: (error: Error) => {
          this.sendMessage({
            type: 'error',
            videoId,
            error: error.message,
          });
        },
      });

      // Configure decoder
      const trackInfo = mp4boxFile.getTrackById(1);
      decoder.configure({
        codec: this.getCodecString(trackInfo),
        codedWidth: metadata.width,
        codedHeight: metadata.height,
        optimizeForLatency: true,
      });

      // Extract video samples
      mp4boxFile.onSamples = (trackId: number, ref: any, samples: any[]) => {
        for (const sample of samples) {
          const chunk = new EncodedVideoChunk({
            type: sample.is_sync ? 'key' : 'delta',
            timestamp: (sample.cts * 1000000) / sample.timescale,
            duration: (sample.duration * 1000000) / sample.timescale,
            data: sample.data,
          });
          videoData.push(chunk);
        }

        // Limit memory: remove oldest non-keyframe chunks when over limit
        if (videoData.length > MAX_VIDEO_CHUNKS) {
          const excess = videoData.length - MAX_VIDEO_CHUNKS;
          let removed = 0;
          for (let i = 0; i < videoData.length && removed < excess; i++) {
            if (videoData[i].type !== 'key') {
              videoData.splice(i, 1);
              removed++;
              i--; // Adjust index after splice
            }
          }
        }
      };

      mp4boxFile.setExtractionOptions(1, null, { nbSamples: 1000 });
      mp4boxFile.start();

      // Store decoder state
      this.decoders.set(videoId, {
        decoder,
        metadata,
        videoData,
        mp4boxFile,
        frameBuffer,
        isReady: true,
      });

      this.sendMessage({
        type: 'loaded',
        videoId,
        metadata,
      });

      // Decode first keyframe for instant preview
      if (videoData.length > 0) {
        decoder.decode(videoData[0]);
        await decoder.flush();
      }
    } catch (error) {
      this.sendMessage({
        type: 'error',
        videoId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Seek to specific time and decode surrounding frames
   */
  private async seekVideo(videoId: string, time: number): Promise<void> {
    const video = this.decoders.get(videoId);
    if (!video || !video.isReady) return;

    const { decoder, metadata, videoData, frameBuffer } = video;
    if (!metadata) return;

    // Find nearest keyframe before target
    const targetFrameIndex = Math.floor(time * metadata.frameRate);
    let keyframeIndex = 0;

    for (let i = 0; i < videoData.length; i++) {
      if (videoData[i].type === 'key') {
        const chunkTime = videoData[i].timestamp / 1000000;
        if (chunkTime <= time) {
          keyframeIndex = i;
        } else {
          break;
        }
      }
    }

    // Clear old frames
    frameBuffer.forEach(frame => frame.close());
    frameBuffer.clear();

    // Decode from keyframe to target + buffer
    const startIndex = keyframeIndex;
    const endIndex = Math.min(startIndex + 90, videoData.length);

    for (let i = startIndex; i < endIndex; i++) {
      if (decoder.state === 'closed') break;

      try {
        decoder.decode(videoData[i]);
      } catch (error) {
        console.error('Decode error:', error);
      }

      // Yield to worker thread every 2 frames (more responsive UI)
      if (i % 2 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    await decoder.flush();

    this.sendMessage({
      type: 'seeked',
      videoId,
      time,
    });
  }

  /**
   * Pre-buffer frames for smooth playback
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
      const video = this.decoders.get(item.id);
      if (!video || !video.isReady) continue;

      const timeInClip = time - item.startTime;
      if (timeInClip < -2 || timeInClip > item.duration + 2) continue;

      const speed = item.speed || 1;
      const trimStart = item.trim?.start || 0;
      const localTime = trimStart + (timeInClip * speed);

      await this.seekVideo(item.id, localTime);
    }
  }

  /**
   * Get codec string for VideoDecoder
   */
  private getCodecString(trackInfo: any): string {
    const codecMap: Record<string, string> = {
      'avc1': 'avc1.64001f', // H.264
      'hvc1': 'hvc1.1.6.L93.B0', // H.265
      'vp09': 'vp09.00.10.08', // VP9
      'av01': 'av01.0.04M.08', // AV1
    };

    const codecType = trackInfo?.codec || 'avc1';
    return codecMap[codecType] || codecType;
  }

  /**
   * Destroy a video decoder
   */
  private destroyVideo(videoId: string): void {
    const video = this.decoders.get(videoId);
    if (!video) return;

    // Close all frames
    video.frameBuffer.forEach(frame => frame.close());
    video.frameBuffer.clear();

    // Close decoder
    if (video.decoder.state !== 'closed') {
      video.decoder.close();
    }

    this.decoders.delete(videoId);

    this.sendMessage({
      type: 'destroyed',
      videoId,
    });
  }
}

// Initialize worker
new VideoDecoderWorker();
