/**
 * Video Decoder Web Worker
 * Based on W3C WebCodecs samples: https://github.com/w3c/webcodecs/tree/main/samples/video-decode-display
 * Uses MP4Box.js for demuxing and WebCodecs VideoDecoder for hardware-accelerated decoding
 * BUILD_TIMESTAMP: 2025-01-18T16:00:00Z - v19-increased-buffer
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
  lastDecodedTimestamp: number; // Last timestamp SUBMITTED to decoder (may be in queue)
  lastOutputTimestamp: number;  // Last timestamp ACTUALLY OUTPUT from decoder (sent to main thread)
  // Next keyframe index after initial decode (for continuous playback after flush)
  nextKeyframeIndex?: number;
  // Promise-based decode tracking (replaces boolean isDecoding)
  // This ensures we can't get stuck - the promise always resolves/rejects
  currentDecodeTask: Promise<void> | null;
  // For logging rate limiting
  _lastSkipLogTime?: number;
  _lastAheadLogTime?: number;
}

class VideoDecoderWorker {
  private videos: Map<string, VideoState> = new Map();

  constructor() {
    self.addEventListener('message', this.handleMessage.bind(this));
    console.warn('[VideoDecoderWorker] *** NEW WORKER v19-increased-buffer ***');
    this.sendMessage({ type: 'ready' });
  }

  private sendMessage(message: any, transfer?: Transferable[]): void {
    if (transfer && transfer.length > 0) {
      self.postMessage(message, { transfer });
    } else {
      self.postMessage(message);
    }
  }

  // Send debug message to main thread (since worker console may not be visible)
  private debug(tag: string, ...args: any[]): void {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    this.sendMessage({ type: 'debug', tag, message: msg });
  }

  // Throttling for per-frame logs
  private lastMsgRecvLogTime = 0;
  private lastBufferLogTime = 0;

  private async handleMessage(event: MessageEvent<DecoderMessage>): Promise<void> {
    const { type, videoId, url, time, items } = event.data;

    // Throttle MSG_RECV debug log to once per second (was every frame = 30+ per second)
    const now = performance.now();
    if (type !== 'load' && type !== 'destroy' && now - this.lastMsgRecvLogTime < 1000) {
      // Skip logging for high-frequency messages
    } else {
      this.lastMsgRecvLogTime = now;
      this.debug('MSG_RECV', `type=${type} videoId=${videoId?.slice(0,8)} time=${time?.toFixed(2)} items=${items?.length}`);
    }

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
          // Don't log every buffer message - happens every frame (~30/sec)
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
        hardwareAcceleration: 'prefer-hardware', // Use GPU for faster decoding
        description,
      };

      // Check config support
      VideoDecoder.isConfigSupported(config)
        .then(support => {
          if (!support.supported) {
            reject(new Error(`Codec "${metadata.codec}" not supported`));
            return;
          }

          // Log hardware acceleration status for debugging
          const hwAccel = support.config?.hardwareAcceleration || 'unknown';
          const effectiveCodec = support.config?.codec || config.codec;
          this.debug('HW_ACCEL', `${videoId.slice(0,8)} hw=${hwAccel} codec=${effectiveCodec} ${support.config?.codedWidth}x${support.config?.codedHeight}`);
          
          // Send hardware acceleration status to main thread
          this.sendMessage({
            type: 'hwAccelStatus',
            videoId,
            hardwareAcceleration: hwAccel,
            codec: effectiveCodec,
            supported: support.supported
          });

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
      this.debug('FRAME_DROP', `${videoId.slice(0,8)} no video state`);
      frame.close();
      return;
    }

    // Validate frame
    if (frame.displayWidth === 0 || frame.displayHeight === 0) {
      this.debug('FRAME_DROP', `${videoId.slice(0,8)} invalid frame dims`);
      frame.close();
      return;
    }

    // Check decoder state
    if (!video.decoder || video.decoder.state !== 'configured') {
      this.debug('FRAME_DROP', `${videoId.slice(0,8)} decoder state=${video.decoder?.state}`);
      frame.close();
      return;
    }

    video.pendingFrames++;
    const timestamp = frame.timestamp / 1_000_000; // Convert to seconds

    // CRITICAL: Track the last OUTPUT timestamp (not last submitted)
    // This is what we actually have available for playback
    video.lastOutputTimestamp = timestamp;

    try {
      this.sendMessage({
        type: 'frame',
        videoId,
        timestamp,
        frame,
      }, [frame]);

      video.pendingFrames--;
    } catch (error) {
      this.debug('FRAME_DROP', `${videoId.slice(0,8)} send error: ${error}`);
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
      lastOutputTimestamp: -1, // Track what's actually available (output from decoder)
      currentDecodeTask: null,
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

      // Create a blob URL from the fetched data for audio playback
      // This eliminates network latency during audio playback - audio will play from local memory
      const videoBlob = new Blob([arrayBuffer], { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(videoBlob);
      
      // Send blob URL to main thread for audio elements
      this.sendMessage({
        type: 'blobUrl',
        videoId,
        blobUrl,
      });
      
      this.debug('BLOB_CREATED', `${videoId.slice(0,8)} blobUrl created, size=${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);

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

      console.log(`[VideoDecoderWorker] ${videoId}: Video loaded successfully with ${chunks.length} chunks`);

      // CRITICAL: Decode initial frames BEFORE marking as ready
      // This ensures frames are cached before playback starts
      await this.decodeFirstKeyframe(videoId, metadata);
      
      // NOW mark as ready - after initial frames are decoded
      videoState.isReady = true;

      // Send loaded message LAST - this triggers playback on main thread
      this.sendMessage({
        type: 'loaded',
        videoId,
        metadata,
      });

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
   * Uses Promise-based tracking to prevent stuck states
   * Called BEFORE isReady is set, so we check decoder directly
   */
  private async decodeFirstKeyframe(videoId: string, metadata: VideoMetadata): Promise<void> {
    const video = this.videos.get(videoId);
    // Note: Can't check isReady here since we're called before it's set
    if (!video?.decoder || video.chunks.length === 0) {
      this.debug('INIT_SKIP', `${videoId.slice(0,8)} no decoder or chunks`);
      return;
    }

    // Create the decode task as a Promise
    const decodeTask = this.performInitialDecode(videoId);
    video.currentDecodeTask = decodeTask;
    
    try {
      await decodeTask;
    } finally {
      // Clear the task when done (critical - this replaces the boolean flag)
      if (video.currentDecodeTask === decodeTask) {
        video.currentDecodeTask = null;
      }
    }
  }

  /**
   * Internal: perform the actual initial decode
   */
  private async performInitialDecode(videoId: string): Promise<void> {
    const video = this.videos.get(videoId);
    if (!video?.decoder) return;

    try {
      // Find first keyframe index
      const keyframeIndex = video.chunks.findIndex(chunk => chunk.type === 'key');
      if (keyframeIndex === -1) {
        this.debug('INIT_SKIP', `${videoId.slice(0,8)} no keyframe found`);
        return;
      }

      this.debug('INIT_START', `${videoId.slice(0,8)} keyframeIdx=${keyframeIndex} chunks=${video.chunks.length}`);

      // Decode first 90 frames (about 3 seconds at 30fps) for initial buffer
      // Increased from 30 frames to improve playback on slower connections
      const framesToDecode = Math.min(90, video.chunks.length - keyframeIndex);
      let lastIndex = keyframeIndex - 1;
      let lastTimestamp = -1;
      let decodedCount = 0;

      for (let i = keyframeIndex; i < keyframeIndex + framesToDecode; i++) {
        if (video.decoder.state !== 'configured') {
          this.debug('INIT_BREAK', `${videoId.slice(0,8)} decoder state=${video.decoder.state} at frame ${i}`);
          break;
        }

        const chunk = video.chunks[i];
        video.decoder.decode(chunk);
        lastIndex = i;
        lastTimestamp = chunk.timestamp / 1_000_000;
        decodedCount++;
      }

      // Update tracking IMMEDIATELY after decode
      video.lastDecodedIndex = lastIndex;
      video.lastDecodedTimestamp = lastTimestamp;

      this.debug('INIT_DECODED', `${videoId.slice(0,8)} count=${decodedCount} lastTs=${lastTimestamp.toFixed(2)}s queueSize=${video.decoder.decodeQueueSize}`);

      // DON'T flush() - we want continuous decoding
      // The decoder will output frames asynchronously via the callback
      // Flushing would force all frames out but is unnecessary for streaming playback
      // Instead, we'll continue decoding on demand via bufferFrames/seekVideo
      
      this.debug('INIT_DONE', `${videoId.slice(0,8)} ready for playback, will continue decoding on demand`);
    } catch (error) {
      this.debug('INIT_ERROR', `${videoId.slice(0,8)} ${error}`);
    }
  }

  /**
   * Seek to specific time and decode frames
   * Uses Promise-based tracking to prevent stuck states
   */
  private async seekVideo(videoId: string, time: number): Promise<void> {
    const video = this.videos.get(videoId);
    if (!video?.isReady || !video.decoder || !video.metadata || video.chunks.length === 0) {
      this.debug('SEEK_SKIP', `${videoId.slice(0,8)} not ready`);
      return;
    }

    const targetTimestamp = time * 1_000_000; // Convert to microseconds

    // CRITICAL: Use lastOutputTimestamp (what's actually available) not lastDecodedTimestamp (what's in decoder queue)
    // The decoder queues frames internally - they're not available until output callback fires
    const actualBuffer = video.lastOutputTimestamp; // What we actually have
    const bufferAhead = actualBuffer - time;
    // Target 3 seconds of buffer ahead (increased from 2.0 for slower connections)
    const needsMoreFrames = actualBuffer < 0 || bufferAhead < 3.0;
    
    if (!needsMoreFrames) {
      // Plenty of buffer, skip decoding (log once per second)
      if (Math.floor(time) !== Math.floor(video._lastAheadLogTime || -1)) {
        this.debug('SEEK_BUFFERED', `${videoId.slice(0,8)} t=${time.toFixed(2)}s output=${actualBuffer.toFixed(2)}s submitted=${video.lastDecodedTimestamp.toFixed(2)}s buffer=${bufferAhead.toFixed(2)}s`);
        video._lastAheadLogTime = time;
      }
      return;
    }

    // If there's a decode task running, don't block - just skip this call
    // The next RAF will try again
    if (video.currentDecodeTask) {
      // Don't spam logs - only log once per second
      if (Math.floor(time) !== Math.floor(video._lastSkipLogTime || -1)) {
        this.debug('SEEK_BUSY', `${videoId.slice(0,8)} decode in progress, will retry`);
        video._lastSkipLogTime = time;
      }
      return;
    }

    // Create and track the decode task
    const decodeTask = this.performSeekDecode(videoId, time, targetTimestamp);
    video.currentDecodeTask = decodeTask;

    try {
      await decodeTask;
    } finally {
      // Clear the task when done (critical - prevents stuck state)
      if (video.currentDecodeTask === decodeTask) {
        video.currentDecodeTask = null;
      }
    }
  }

  /**
   * Internal: perform the actual seek decode operation
   */
  private async performSeekDecode(videoId: string, time: number, targetTimestamp: number): Promise<void> {
    const video = this.videos.get(videoId);
    if (!video?.decoder) return;

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

      // Determine start index - continue from where we left off
      let startIndex: number;

      if (video.lastDecodedIndex >= 0 && video.lastDecodedIndex < video.chunks.length - 1) {
        // Continue from where we left off
        startIndex = video.lastDecodedIndex + 1;
        this.debug('SEEK_CONTINUE', `${videoId.slice(0,8)} continuing from idx=${startIndex}`);
      } else if (video.lastDecodedIndex < 0) {
        // Start from beginning (find first keyframe)
        startIndex = 0;
        const keyframeIndex = video.chunks.findIndex(chunk => chunk.type === 'key');
        if (keyframeIndex >= 0) {
          startIndex = keyframeIndex;
        }
        this.debug('SEEK_START', `${videoId.slice(0,8)} starting from keyframe at idx=${startIndex}`);
      } else {
        // Already decoded everything - don't log, this happens every frame
        return;
      }

      if (startIndex >= video.chunks.length) {
        return;
      }

      // Decode a batch of frames (up to 3 seconds worth or 90 frames)
      const targetEndTimestamp = targetTimestamp + 3_000_000; // 3 seconds ahead
      const maxFrames = 90;

      let decodedCount = 0;
      let lastIndex = video.lastDecodedIndex;
      let lastTimestamp = video.lastDecodedTimestamp;

      for (let i = startIndex; i < video.chunks.length && decodedCount < maxFrames; i++) {
        if (video.decoder.state !== 'configured') {
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

      // Update tracking IMMEDIATELY (before flush)
      video.lastDecodedIndex = lastIndex;
      video.lastDecodedTimestamp = lastTimestamp;

      if (decodedCount > 0) {
        this.debug('SEEK_DONE', `${videoId.slice(0,8)} decoded=${decodedCount} idx=${lastIndex}/${video.chunks.length} ts=${lastTimestamp.toFixed(2)}s`);
      }

      // DON'T flush - keep decoder ready for continuous decoding
      // Frames are output via the callback as they're decoded
      // Flushing would reset decoder state and require a keyframe for next decode

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
    // Log once per second (with debug to main thread)
    const shouldLog = Math.floor(time) !== Math.floor(this._lastBufferLogTime || -1);
    
    // ALWAYS log first few buffer calls for debugging
    const earlyLog = time < 0.2;
    
    if (shouldLog || earlyLog) {
      // Log video state for each item
      const videoStates = items.map(item => {
        const v = this.videos.get(item.id);
        return `${item.id.slice(0,8)}:ready=${v?.isReady},idx=${v?.lastDecodedIndex}`;
      }).join(', ');
      this.debug('BUFFER', `time=${time.toFixed(2)}s items=${items.length} videos=[${videoStates}]`);
      if (shouldLog) this._lastBufferLogTime = time;
    }

    const bufferPromises = items.map(async (item) => {
      const video = this.videos.get(item.id);
      if (!video?.isReady) {
        if (shouldLog || earlyLog) {
          this.debug('BUFFER_SKIP', `${item.id.slice(0,8)} not ready isReady=${video?.isReady} exists=${!!video}`);
        }
        return;
      }

      const timeInClip = time - item.startTime;
      if (timeInClip < -1 || timeInClip > item.duration + 1) {
        if (shouldLog || earlyLog) {
          this.debug('BUFFER_SKIP', `${item.id.slice(0,8)} out of range timeInClip=${timeInClip.toFixed(2)}`);
        }
        return;
      }

      const speed = item.speed || 1;
      const trimStart = item.trim?.start || 0;
      const localTime = trimStart + (timeInClip * speed);

      if (shouldLog || earlyLog) {
        this.debug('BUFFER_SEEK', `${item.id.slice(0,8)} localTime=${localTime.toFixed(2)}s lastDecoded=${video.lastDecodedTimestamp.toFixed(2)}s`);
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
      video.currentDecodeTask = null;
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