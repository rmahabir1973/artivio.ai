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
  // For logging rate limiting
  _lastSkipLogTime?: number;
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

    // Unconditional log to verify worker receives ALL messages
    console.log(`[VideoDecoderWorker] handleMessage received: type=${type}`);

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
          console.log(`[VideoDecoderWorker] Received buffer message: time=${time}, items=${items?.length}`);
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

          console.log(`[VideoDecoderWorker] ${videoId}: Received ${samples.length} samples (total now: ${extractedChunks.length + samples.length})`);

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

          // Check if we've received all expected samples
          const expectedSamples = videoTrack?.nb_samples || 0;
          if (extractedChunks.length >= expectedSamples && !resolved) {
            resolved = true;
            cleanup();
            mp4boxFile.stop();

            console.log(`[VideoDecoderWorker] ${videoId}: All ${extractedChunks.length} samples extracted`);
            resolve({
              metadata: videoMetadata!,
              track: videoTrack,
              chunks: extractedChunks,
              description: codecDescription
            });
          }
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

          // Safety timeout - resolve with whatever we have after 2 seconds
          setTimeout(() => {
            if (resolved) return;
            resolved = true;
            cleanup();

            if (!videoMetadata || !videoTrack) {
              reject(new Error('Failed to extract video metadata'));
              return;
            }

            // Accept partial extraction if we have at least some chunks
            if (extractedChunks.length > 0) {
              console.log(`[VideoDecoderWorker] ${videoId}: Timeout - extracted ${extractedChunks.length} chunks (expected ${videoTrack.nb_samples})`);
              resolve({
                metadata: videoMetadata,
                track: videoTrack,
                chunks: extractedChunks,
                description: codecDescription
              });
            } else {
              reject(new Error('No video samples extracted'));
            }
          }, 2000);
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
   * Decode initial frames for immediate preview
   * Decodes first keyframe + some following frames for smoother start
   */
  private async decodeFirstKeyframe(videoId: string): Promise<void> {
    const video = this.videos.get(videoId);
    if (!video?.isReady || !video.decoder || video.chunks.length === 0) {
      return;
    }

    video.isDecoding = true;

    try {
      // Find first keyframe index
      const keyframeIndex = video.chunks.findIndex(chunk => chunk.type === 'key');
      if (keyframeIndex === -1) {
        console.warn(`[VideoDecoderWorker] ${videoId}: No keyframe found`);
        video.isDecoding = false;
        return;
      }

      console.log(`[VideoDecoderWorker] ${videoId}: Decoding initial frames for preview`);

      // Decode first 30 frames (about 1 second at 30fps) for initial buffer
      const framesToDecode = Math.min(30, video.chunks.length - keyframeIndex);
      let lastIndex = keyframeIndex - 1;
      let lastTimestamp = -1;

      for (let i = keyframeIndex; i < keyframeIndex + framesToDecode; i++) {
        if (video.decoder.state !== 'configured') break;

        const chunk = video.chunks[i];
        video.decoder.decode(chunk);
        lastIndex = i;
        lastTimestamp = chunk.timestamp / 1_000_000;
      }

      if (video.decoder.state === 'configured') {
        await video.decoder.flush();

        // Update tracking
        video.lastDecodedIndex = lastIndex;
        video.lastDecodedTimestamp = lastTimestamp;

        console.log(`[VideoDecoderWorker] ${videoId}: Initial decode complete, ${framesToDecode} frames, up to ${lastTimestamp.toFixed(2)}s`);
      }
    } catch (error) {
      console.warn(`[VideoDecoderWorker] ${videoId}: Failed to decode initial frames:`, error);
    } finally {
      video.isDecoding = false;
    }
  }

  /**
   * Seek to specific time and decode frames
   * Simpler approach: always decode from keyframe, track progress to avoid re-decoding
   */
  private async seekVideo(videoId: string, time: number): Promise<void> {
    const video = this.videos.get(videoId);
    if (!video?.isReady || !video.decoder || !video.metadata || video.chunks.length === 0) {
      console.log(`[VideoDecoderWorker] seekVideo(${videoId}, ${time.toFixed(2)}): Not ready - isReady=${video?.isReady}, hasDecoder=${!!video?.decoder}, chunks=${video?.chunks?.length || 0}`);
      return;
    }

    // Prevent concurrent decode operations
    if (video.isDecoding) {
      console.log(`[VideoDecoderWorker] seekVideo(${videoId}, ${time.toFixed(2)}): Already decoding, skipping`);
      return;
    }

    const targetTimestamp = time * 1_000_000; // Convert to microseconds

    // Check if we already have frames decoded past this point
    if (video.lastDecodedTimestamp >= 0) {
      const lastDecodedUs = video.lastDecodedTimestamp * 1_000_000;
      // If we've already decoded past the target + 1 second buffer, skip
      if (lastDecodedUs > targetTimestamp + 1_000_000) {
        // Only log occasionally to avoid spam
        if (Math.floor(time) !== Math.floor(video._lastSkipLogTime || -1)) {
          console.log(`[VideoDecoderWorker] seekVideo(${videoId}, ${time.toFixed(2)}): Already decoded to ${video.lastDecodedTimestamp.toFixed(2)}s, skipping`);
          video._lastSkipLogTime = time;
        }
        return;
      }
    }

    video.isDecoding = true;

    try {
      // Check decoder state
      if (video.decoder.state !== 'configured') {
        video.decoder.reset();
        if (video.decoderConfig) {
          video.decoder.configure(video.decoderConfig);
        }
        video.lastDecodedIndex = -1;
        video.lastDecodedTimestamp = -1;
      }

      // Determine start index
      let startIndex: number;

      if (video.lastDecodedIndex >= 0 && video.lastDecodedIndex < video.chunks.length - 1) {
        // Continue from where we left off
        startIndex = video.lastDecodedIndex + 1;
      } else if (video.lastDecodedIndex < 0) {
        // Start from beginning (keyframe)
        startIndex = 0;
      } else {
        // Already decoded everything
        video.isDecoding = false;
        return;
      }

      // Ensure we start from a keyframe if this is a fresh start
      if (video.lastDecodedIndex < 0) {
        const keyframeIndex = video.chunks.findIndex(chunk => chunk.type === 'key');
        if (keyframeIndex >= 0) {
          startIndex = keyframeIndex;
        }
      }

      if (startIndex >= video.chunks.length) {
        video.isDecoding = false;
        return;
      }

      // Decode a batch of frames (up to 3 seconds worth or 90 frames)
      const targetEndTimestamp = targetTimestamp + 3_000_000; // 3 seconds ahead
      const maxFrames = 90;

      console.log(`[VideoDecoderWorker] seekVideo(${videoId}, ${time.toFixed(2)}): Decoding from index ${startIndex}, target=${(targetTimestamp/1_000_000).toFixed(2)}s, chunks=${video.chunks.length}`);

      let decodedCount = 0;
      let lastIndex = video.lastDecodedIndex;
      let lastTimestamp = video.lastDecodedTimestamp;

      for (let i = startIndex; i < video.chunks.length && decodedCount < maxFrames; i++) {
        if (video.decoder.state !== 'configured') {
          console.warn(`[VideoDecoderWorker] seekVideo(${videoId}): Decoder not configured, state=${video.decoder.state}`);
          break;
        }

        const chunk = video.chunks[i];
        video.decoder.decode(chunk);
        decodedCount++;
        lastIndex = i;
        lastTimestamp = chunk.timestamp / 1_000_000;

        // Stop if we've decoded past target + buffer
        if (chunk.timestamp > targetEndTimestamp) {
          break;
        }
      }

      if (video.decoder.state === 'configured' && decodedCount > 0) {
        await video.decoder.flush();

        // Update tracking
        video.lastDecodedIndex = lastIndex;
        video.lastDecodedTimestamp = lastTimestamp;
        
        console.log(`[VideoDecoderWorker] seekVideo(${videoId}): Decoded ${decodedCount} frames, now at index ${lastIndex}/${video.chunks.length}, timestamp ${lastTimestamp.toFixed(2)}s`);
      } else {
        console.log(`[VideoDecoderWorker] seekVideo(${videoId}): No frames decoded, decoderState=${video.decoder.state}, count=${decodedCount}`);
      }

      this.sendMessage({ type: 'seeked', videoId, time, success: true });

    } catch (error) {
      console.error(`[VideoDecoderWorker] ${videoId}: Seek failed:`, error);
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
    // Log once per second
    const shouldLog = Math.floor(time) !== Math.floor(this._lastBufferLogTime || -1);
    if (shouldLog) {
      console.log(`[VideoDecoderWorker] bufferFrames(${time.toFixed(2)}s) for ${items.length} items`);
      this._lastBufferLogTime = time;
    }

    const bufferPromises = items.map(async (item) => {
      const video = this.videos.get(item.id);
      if (!video?.isReady) {
        if (shouldLog) {
          console.log(`[VideoDecoderWorker] bufferFrames: ${item.id} not ready (isReady=${video?.isReady}, hasVideo=${!!video})`);
        }
        return;
      }

      const timeInClip = time - item.startTime;
      if (timeInClip < -1 || timeInClip > item.duration + 1) {
        if (shouldLog) {
          console.log(`[VideoDecoderWorker] bufferFrames: ${item.id} out of range (timeInClip=${timeInClip.toFixed(2)}, startTime=${item.startTime}, duration=${item.duration})`);
        }
        return;
      }

      const speed = item.speed || 1;
      const trimStart = item.trim?.start || 0;
      const localTime = trimStart + (timeInClip * speed);

      if (shouldLog) {
        console.log(`[VideoDecoderWorker] bufferFrames: Calling seekVideo for ${item.id} at localTime=${localTime.toFixed(2)}s`);
      }
      await this.seekVideo(item.id, localTime);
    });

    await Promise.all(bufferPromises);
  }
  
  private _lastBufferLogTime?: number;

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