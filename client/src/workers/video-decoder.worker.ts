/**
 * Video Decoder Web Worker
 * Based on W3C WebCodecs samples: https://github.com/w3c/webcodecs/tree/main/samples/video-decode-display
 * Uses MP4Box.js for demuxing and WebCodecs VideoDecoder for hardware-accelerated decoding
 */

// @ts-ignore - MP4Box types not available
import * as MP4Box from 'mp4box';

interface DecoderMessage {
  type: 'load' | 'seek' | 'buffer' | 'destroy' | 'reset';
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
  codec: string;
  description?: Uint8Array;
  timescale: number;
}

interface VideoState {
  decoder: VideoDecoder | null;
  mp4boxFile: any | null;
  metadata: VideoMetadata | null;
  chunks: EncodedVideoChunk[];
  isReady: boolean;
  isConfigured: boolean;
  isExtracting: boolean;
  pendingFrames: number;
  decoderConfig: VideoDecoderConfig | null;
  // Track decode progress for continuous playback
  lastDecodedIndex: number;
  lastDecodedTimestamp: number;
  isDecoding: boolean;
}

class VideoDecoderWorker {
  private videos: Map<string, VideoState> = new Map();

  constructor() {
    self.addEventListener('message', this.handleMessage.bind(this));
    console.log('[VideoDecoderWorker] Worker initialized');
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

        case 'reset':
          if (videoId) {
            this.resetDecoder(videoId);
          }
          break;
      }
    } catch (error) {
      console.error(`[VideoDecoderWorker] Error handling ${type}:`, error);
      this.sendMessage({
        type: 'error',
        videoId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Extract codec description from MP4Box track
   */
  private getDescription(mp4boxFile: any, track: any): Uint8Array | undefined {
    try {
      const trak = mp4boxFile.getTrackById(track.id);
      if (!trak) return undefined;

      for (const entry of trak.mdia.minf.stbl.stsd.entries) {
        const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
        if (box) {
          const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
          box.write(stream);
          return new Uint8Array(stream.buffer, 8);
        }
      }
      return undefined;
    } catch (error) {
      console.warn('[VideoDecoderWorker] Failed to extract codec description:', error);
      return undefined;
    }
  }

  /**
   * Initialize decoder for a video
   */
  private async initializeDecoder(videoId: string, metadata: VideoMetadata, description?: Uint8Array): Promise<VideoDecoder> {
    return new Promise((resolve, reject) => {
      const config: VideoDecoderConfig = {
        codec: metadata.codec,
        codedWidth: metadata.width,
        codedHeight: metadata.height,
        optimizeForLatency: true,
        description,
      };

      // Check config support
      VideoDecoder.isConfigSupported(config)
        .then(support => {
          if (!support.supported) {
            reject(new Error(`Codec "${metadata.codec}" not supported`));
            return;
          }

          const decoder = new VideoDecoder({
            output: (frame: VideoFrame) => {
              this.handleFrameOutput(videoId, frame);
            },
            error: (error: Error) => {
              console.error(`[VideoDecoderWorker] ${videoId} decoder error:`, error);
              this.sendMessage({
                type: 'error',
                videoId,
                error: `Decoder error: ${error.message}`
              });
            }
          });

          decoder.configure(config);

          const video = this.videos.get(videoId);
          if (video) {
            video.decoderConfig = config;
            video.isConfigured = true;
          }

          resolve(decoder);
        })
        .catch(reject);
    });
  }

  /**
   * Handle frame output from decoder
   */
  private handleFrameOutput(videoId: string, frame: VideoFrame): void {
    const video = this.videos.get(videoId);
    if (!video) {
      frame.close();
      return;
    }

    // Validate frame
    if (frame.displayWidth === 0 || frame.displayHeight === 0) {
      console.warn(`[VideoDecoderWorker] ${videoId}: Received invalid frame`);
      frame.close();
      return;
    }

    // Check decoder state
    if (!video.decoder || video.decoder.state !== 'configured') {
      console.warn(`[VideoDecoderWorker] ${videoId}: Decoder not ready for frame output`);
      frame.close();
      return;
    }

    video.pendingFrames++;
    const timestamp = frame.timestamp / 1_000_000; // Convert to seconds

    try {
      this.sendMessage({
        type: 'frame',
        videoId,
        timestamp,
        frame,
      }, [frame]);

      video.pendingFrames--;
    } catch (error) {
      console.error(`[VideoDecoderWorker] ${videoId}: Failed to send frame:`, error);
      frame.close();
      video.pendingFrames--;
    }
  }

  /**
   * Load and decode a video
   */
  private async loadVideo(videoId: string, url: string): Promise<void> {
    // Clean up existing video if present
    if (this.videos.has(videoId)) {
      this.destroyVideo(videoId);
    }

    this.sendMessage({ type: 'loading', videoId, progress: 0 });

    // Initialize video state
    const videoState: VideoState = {
      decoder: null,
      mp4boxFile: null,
      metadata: null,
      chunks: [],
      isReady: false,
      isConfigured: false,
      isExtracting: false,
      pendingFrames: 0,
      decoderConfig: null,
      lastDecodedIndex: -1,
      lastDecodedTimestamp: -1,
      isDecoding: false,
    };
    this.videos.set(videoId, videoState);

    try {
      // Fetch video data
      console.log(`[VideoDecoderWorker] ${videoId}: Fetching video from ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      this.sendMessage({ type: 'loading', videoId, progress: 50 });

      // Create MP4Box file
      const mp4boxFile = MP4Box.createFile();
      videoState.mp4boxFile = mp4boxFile;

      // Extract metadata and samples in one pass
      // MP4Box processes samples during appendBuffer, so we must set up extraction
      // options in onReady BEFORE calling flush()
      const { metadata, track, chunks, description } = await new Promise<{
        metadata: VideoMetadata;
        track: any;
        chunks: EncodedVideoChunk[];
        description?: Uint8Array;
      }>((resolve, reject) => {
        let resolved = false;
        let videoTrack: any = null;
        let videoMetadata: VideoMetadata | null = null;
        let codecDescription: Uint8Array | undefined = undefined;
        const extractedChunks: EncodedVideoChunk[] = [];
        let trackTimescale = 1;

        const cleanup = () => {
          mp4boxFile.onReady = null;
          mp4boxFile.onError = null;
          mp4boxFile.onSamples = null;
        };

        mp4boxFile.onReady = (info: any) => {
          videoTrack = info.videoTracks[0];
          if (!videoTrack) {
            resolved = true;
            cleanup();
            reject(new Error('No video track found'));
            return;
          }

          // Use track timescale for sample timestamps, not movie timescale
          trackTimescale = videoTrack.timescale || info.timescale;

          videoMetadata = {
            duration: info.duration / info.timescale,
            width: videoTrack.video.width,
            height: videoTrack.video.height,
            frameRate: videoTrack.nb_samples / (info.duration / info.timescale),
            hasVideo: info.videoTracks.length > 0,
            hasAudio: info.audioTracks.length > 0,
            codec: videoTrack.codec,
            timescale: trackTimescale,
          };

          console.log(`[VideoDecoderWorker] ${videoId}: Found track - ${videoMetadata.width}x${videoMetadata.height}, codec: ${videoMetadata.codec}, duration: ${videoMetadata.duration}s, track timescale: ${trackTimescale}`);

          // Extract codec description
          codecDescription = this.getDescription(mp4boxFile, videoTrack);
          if (codecDescription) {
            console.log(`[VideoDecoderWorker] ${videoId}: Codec description extracted, ${codecDescription.length} bytes`);
          }

          // Set up sample extraction BEFORE processing continues
          // This is critical - extraction options must be set in onReady
          mp4boxFile.setExtractionOptions(videoTrack.id, null, { nbSamples: Infinity });
          mp4boxFile.start();
        };

        mp4boxFile.onSamples = (trackId: number, ref: any, samples: any[]) => {
          if (!videoTrack || trackId !== videoTrack.id) return;

          console.log(`[VideoDecoderWorker] ${videoId}: Received ${samples.length} samples`);

          for (const sample of samples) {
            try {
              extractedChunks.push(new EncodedVideoChunk({
                type: sample.is_sync ? 'key' : 'delta',
                timestamp: (sample.cts * 1_000_000) / trackTimescale,
                duration: (sample.duration * 1_000_000) / trackTimescale,
                data: sample.data,
              }));
            } catch (error) {
              console.warn(`[VideoDecoderWorker] ${videoId}: Failed to create chunk:`, error);
            }
          }

          // Release samples to free memory
          mp4boxFile.releaseUsedSamples(trackId, samples.length);
        };

        mp4boxFile.onError = (error: any) => {
          if (resolved) return;
          resolved = true;
          cleanup();
          reject(new Error(`MP4Box error: ${error}`));
        };

        // Feed data to MP4Box
        (arrayBuffer as any).fileStart = 0;
        try {
          mp4boxFile.appendBuffer(arrayBuffer);
          mp4boxFile.flush();

          // Give MP4Box time to process all samples
          setTimeout(() => {
            if (resolved) return;
            resolved = true;
            cleanup();

            if (!videoMetadata || !videoTrack) {
              reject(new Error('Failed to extract video metadata'));
              return;
            }

            console.log(`[VideoDecoderWorker] ${videoId}: Extracted ${extractedChunks.length} chunks total`);
            resolve({
              metadata: videoMetadata,
              track: videoTrack,
              chunks: extractedChunks,
              description: codecDescription
            });
          }, 100);
        } catch (error) {
          reject(new Error(`Failed to parse MP4: ${error}`));
        }
      });

      videoState.metadata = metadata;
      videoState.chunks = chunks;
      this.sendMessage({ type: 'loading', videoId, progress: 75 });

      // Initialize decoder
      console.log(`[VideoDecoderWorker] ${videoId}: Initializing decoder...`);
      const decoder = await this.initializeDecoder(videoId, metadata, description);
      videoState.decoder = decoder;

      // Stop MP4Box processing
      mp4boxFile.stop();
      videoState.mp4boxFile = null;

      if (chunks.length === 0) {
        throw new Error('No video chunks extracted');
      }

      // Mark as ready
      videoState.isReady = true;
      console.log(`[VideoDecoderWorker] ${videoId}: Video loaded successfully with ${chunks.length} chunks`);

      // Send loaded message
      this.sendMessage({
        type: 'loaded',
        videoId,
        metadata,
      });

      // Decode first keyframe for preview
      await this.decodeFirstKeyframe(videoId);

    } catch (error) {
      console.error(`[VideoDecoderWorker] ${videoId} load error:`, error);

      // Clean up on error
      this.destroyVideo(videoId);

      this.sendMessage({
        type: 'error',
        videoId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Decode first keyframe for immediate preview
   */
  private async decodeFirstKeyframe(videoId: string): Promise<void> {
    const video = this.videos.get(videoId);
    if (!video?.isReady || !video.decoder || video.chunks.length === 0) {
      return;
    }

    try {
      // Find first keyframe index
      const keyframeIndex = video.chunks.findIndex(chunk => chunk.type === 'key');
      if (keyframeIndex === -1) {
        console.warn(`[VideoDecoderWorker] ${videoId}: No keyframe found`);
        return;
      }

      const firstKeyframe = video.chunks[keyframeIndex];
      console.log(`[VideoDecoderWorker] ${videoId}: Decoding first keyframe for preview`);

      // Reset decoder to ensure clean state
      if (video.decoder.state === 'configured') {
        video.decoder.reset();
        if (video.decoderConfig) {
          video.decoder.configure(video.decoderConfig);
        }
      }

      // Decode the keyframe
      video.decoder.decode(firstKeyframe);
      await video.decoder.flush();

      // Initialize tracking (but don't prevent re-decode of these frames for buffer)
      video.lastDecodedIndex = keyframeIndex;
      video.lastDecodedTimestamp = firstKeyframe.timestamp / 1_000_000;

      console.log(`[VideoDecoderWorker] ${videoId}: First keyframe decoded at ${video.lastDecodedTimestamp}s`);
    } catch (error) {
      console.warn(`[VideoDecoderWorker] ${videoId}: Failed to decode first keyframe:`, error);
    }
  }

  /**
   * Seek to specific time and decode frames
   * Supports continuous playback by continuing from last decoded position
   */
  private async seekVideo(videoId: string, time: number): Promise<void> {
    const video = this.videos.get(videoId);
    if (!video?.isReady || !video.decoder || !video.metadata || video.chunks.length === 0) {
      console.warn(`[VideoDecoderWorker] ${videoId}: Not ready for seek`);
      return;
    }

    // Prevent concurrent decode operations - but log when skipped
    if (video.isDecoding) {
      console.log(`[VideoDecoderWorker] ${videoId}: Skipping seek to ${time}s - already decoding`);
      return;
    }
    video.isDecoding = true;
    console.log(`[VideoDecoderWorker] ${videoId}: seekVideo called for time ${time}s, lastDecoded: idx=${video.lastDecodedIndex}, ts=${video.lastDecodedTimestamp}`);

    try {
      // Check decoder state
      if (video.decoder.state !== 'configured') {
        console.warn(`[VideoDecoderWorker] ${videoId}: Decoder not configured, resetting...`);
        video.decoder.reset();
        if (video.decoderConfig) {
          video.decoder.configure(video.decoderConfig);
        }
        video.lastDecodedIndex = -1;
        video.lastDecodedTimestamp = -1;
      }

      const targetTimestamp = time * 1_000_000; // Convert to microseconds
      const bufferAhead = 2_000_000; // Buffer 2 seconds ahead
      const targetEndTimestamp = targetTimestamp + bufferAhead;

      let startIndex = -1;
      let needsKeyframeReset = false;

      // Check if we can continue from last decoded position
      if (video.lastDecodedIndex >= 0 && video.lastDecodedTimestamp >= 0) {
        const lastDecodedUs = video.lastDecodedTimestamp * 1_000_000;

        // If target is close to or ahead of last decoded, continue forward
        if (targetTimestamp >= lastDecodedUs - 500_000 && targetTimestamp <= lastDecodedUs + bufferAhead) {
          // Continue from next frame after last decoded
          startIndex = video.lastDecodedIndex + 1;
        } else if (targetTimestamp < lastDecodedUs - 500_000) {
          // Seeking backward - need to reset to keyframe
          needsKeyframeReset = true;
        }
      } else {
        needsKeyframeReset = true;
      }

      // Find keyframe if needed
      if (needsKeyframeReset || startIndex < 0) {
        let keyframeIndex = -1;

        // Find the nearest keyframe before target time
        for (let i = 0; i < video.chunks.length; i++) {
          const chunk = video.chunks[i];
          if (chunk.type === 'key' && chunk.timestamp <= targetTimestamp) {
            keyframeIndex = i;
          } else if (chunk.timestamp > targetTimestamp) {
            break;
          }
        }

        if (keyframeIndex === -1) {
          // Fall back to first keyframe
          keyframeIndex = video.chunks.findIndex(chunk => chunk.type === 'key');
          if (keyframeIndex === -1) keyframeIndex = 0;
        }

        // Reset decoder for seeking backward
        if (needsKeyframeReset && video.decoder.state === 'configured') {
          video.decoder.reset();
          if (video.decoderConfig) {
            video.decoder.configure(video.decoderConfig);
          }
        }

        startIndex = keyframeIndex;
      }

      // Ensure startIndex is valid
      if (startIndex < 0 || startIndex >= video.chunks.length) {
        console.log(`[VideoDecoderWorker] ${videoId}: Invalid startIndex ${startIndex}, chunks length: ${video.chunks.length}`);
        video.isDecoding = false;
        return;
      }

      // Calculate how many frames to decode to reach target + buffer
      let framesToDecode = 0;
      for (let i = startIndex; i < video.chunks.length; i++) {
        framesToDecode++;
        if (video.chunks[i].timestamp >= targetEndTimestamp) {
          break;
        }
        // Limit batch size to prevent blocking
        if (framesToDecode >= 60) break;
      }

      console.log(`[VideoDecoderWorker] ${videoId}: Will decode ${framesToDecode} frames from index ${startIndex}, needsKeyframeReset: ${needsKeyframeReset}`);

      if (framesToDecode === 0) {
        console.log(`[VideoDecoderWorker] ${videoId}: No frames to decode`);
        video.isDecoding = false;
        return;
      }

      // Decode frames
      let decodedCount = 0;
      let lastIndex = startIndex - 1;
      let lastTimestamp = video.lastDecodedTimestamp;

      for (let i = startIndex; i < startIndex + framesToDecode && i < video.chunks.length; i++) {
        if (video.decoder.state !== 'configured') {
          console.warn(`[VideoDecoderWorker] ${videoId}: Decoder state changed to ${video.decoder.state} during decode`);
          break;
        }

        const chunk = video.chunks[i];
        video.decoder.decode(chunk);
        decodedCount++;
        lastIndex = i;
        lastTimestamp = chunk.timestamp / 1_000_000;
      }

      console.log(`[VideoDecoderWorker] ${videoId}: Decoded ${decodedCount} frames, decoder state: ${video.decoder.state}`);

      if (video.decoder.state === 'configured' && decodedCount > 0) {
        await video.decoder.flush();

        // Update tracking
        video.lastDecodedIndex = lastIndex;
        video.lastDecodedTimestamp = lastTimestamp;
        console.log(`[VideoDecoderWorker] ${videoId}: Flush complete, lastDecodedIndex: ${lastIndex}, lastDecodedTimestamp: ${lastTimestamp}`);
      }

      this.sendMessage({ type: 'seeked', videoId, time, success: true });

    } catch (error) {
      console.error(`[VideoDecoderWorker] ${videoId}: Seek failed:`, error);
      // Reset tracking on error
      video.lastDecodedIndex = -1;
      video.lastDecodedTimestamp = -1;
      this.sendMessage({
        type: 'seeked',
        videoId,
        time,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      video.isDecoding = false;
    }
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
    console.log(`[VideoDecoderWorker] bufferFrames called for time ${time}s with ${items.length} items`);

    const bufferPromises = items.map(async (item) => {
      const video = this.videos.get(item.id);
      if (!video?.isReady) {
        console.log(`[VideoDecoderWorker] ${item.id}: Not ready for buffering`);
        return;
      }

      const timeInClip = time - item.startTime;
      if (timeInClip < -1 || timeInClip > item.duration + 1) {
        console.log(`[VideoDecoderWorker] ${item.id}: Outside clip range (timeInClip: ${timeInClip})`);
        return;
      }

      const speed = item.speed || 1;
      const trimStart = item.trim?.start || 0;
      const localTime = trimStart + (timeInClip * speed);

      await this.seekVideo(item.id, localTime);
    });

    await Promise.all(bufferPromises);
  }

  /**
   * Reset decoder for a video
   */
  private resetDecoder(videoId: string): void {
    const video = this.videos.get(videoId);
    if (!video) return;

    if (video.decoder && video.decoder.state !== 'closed') {
      video.decoder.reset();
      if (video.decoderConfig) {
        video.decoder.configure(video.decoderConfig);
      }
      // Reset tracking
      video.lastDecodedIndex = -1;
      video.lastDecodedTimestamp = -1;
      video.isDecoding = false;
      console.log(`[VideoDecoderWorker] ${videoId}: Decoder reset`);
    }
  }

  /**
   * Destroy a video and its resources
   */
  private destroyVideo(videoId: string): void {
    const video = this.videos.get(videoId);
    if (!video) return;

    console.log(`[VideoDecoderWorker] ${videoId}: Destroying video resources`);

    // Close decoder
    if (video.decoder && video.decoder.state !== 'closed') {
      video.decoder.close();
    }

    // Stop MP4Box file
    if (video.mp4boxFile) {
      try {
        video.mp4boxFile.stop();
      } catch (error) {
        console.warn(`[VideoDecoderWorker] ${videoId}: Error stopping MP4Box:`, error);
      }
    }

    // Clear chunks
    video.chunks = [];

    // Remove from map
    this.videos.delete(videoId);

    console.log(`[VideoDecoderWorker] ${videoId}: Resources destroyed`);
    this.sendMessage({ type: 'destroyed', videoId });
  }
}

// Initialize worker
new VideoDecoderWorker();