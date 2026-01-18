/**
 * Worker Manager
 * Coordinates Web Workers for video decoding and FFmpeg processing
 * Manages communication between main thread and workers
 */

// Use dynamic worker imports with cache-busting to ensure fresh code loads
// Version must be updated when worker code changes significantly
const WORKER_VERSION = '2025-01-17T0600-v18-imagebitmap-fix';

import VideoDecoderWorker from '@/workers/video-decoder.worker?worker';
import FFmpegWorker from '@/workers/ffmpeg.worker?worker';

// Limit frame cache to prevent memory exhaustion (~10 seconds at 30fps per video)
const MAX_FRAMES_PER_VIDEO = 300;

// Track current playback time per video for time-aware cache eviction
// This ensures we don't evict frames we haven't played yet

// Log worker version for debugging
console.log(`[WorkerManager] Initializing with worker version: ${WORKER_VERSION}`);

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface WorkerManagerConfig {
  onFrame?: (videoId: string, frame: VideoFrame, timestamp: number) => void;
  onMetadata?: (videoId: string, metadata: VideoMetadata) => void;
  onProgress?: (videoId: string, progress: number) => void;
  onError?: (videoId: string, error: string) => void;
  onBlobUrl?: (videoId: string, blobUrl: string) => void;
}

/**
 * Manages video decoder and FFmpeg workers
 */
export class WorkerManager {
  private videoDecoderWorker: Worker | null = null;
  private ffmpegWorker: Worker | null = null;

  private config: WorkerManagerConfig;
  private loadedVideos: Set<string> = new Set();
  private loadingVideos: Set<string> = new Set(); // Track videos currently loading
  private videoMetadata: Map<string, VideoMetadata> = new Map();

  // Frame cache for quick access - stores ImageBitmap (not VideoFrame) to avoid decoder backpressure
  // VideoFrames hold onto decoder's internal buffer pool - must be closed immediately after conversion
  private frameCache: Map<string, Map<number, ImageBitmap>> = new Map();
  private currentPlaybackTimeKey: Map<string, number> = new Map(); // Track playback position per video
  
  // Blob URLs for preloaded videos - used for audio playback from local memory
  // This eliminates network latency during audio playback
  private blobUrls: Map<string, string> = new Map();

  constructor(config: WorkerManagerConfig = {}) {
    this.config = config;
    this.initialize();
  }

  /**
   * Initialize workers
   */
  private initialize(): void {
    // Create video decoder worker (required for live preview)
    this.videoDecoderWorker = new VideoDecoderWorker();
    this.videoDecoderWorker.addEventListener('message', this.handleDecoderMessage.bind(this));
    this.videoDecoderWorker.addEventListener('error', (error) => {
      console.error('Video decoder worker error:', error);
    });

    // NOTE: FFmpeg worker is NOT initialized here to avoid startup errors
    // It will be lazy-initialized only when needed for effects/processing
    // Live preview uses WebCodecs via video-decoder worker, not FFmpeg
  }

  /**
   * Lazily initialize FFmpeg worker (only when needed)
   */
  private initFFmpegWorker(): Worker | null {
    if (this.ffmpegWorker) return this.ffmpegWorker;
    
    try {
      this.ffmpegWorker = new FFmpegWorker();
      this.ffmpegWorker.addEventListener('message', this.handleFFmpegMessage.bind(this));
      this.ffmpegWorker.addEventListener('error', (error) => {
        console.error('FFmpeg worker error:', error);
      });
      this.ffmpegWorker.postMessage({ type: 'init' });
      return this.ffmpegWorker;
    } catch (err) {
      console.warn('[WorkerManager] FFmpeg worker not available:', err);
      return null;
    }
  }

  /**
   * Handle messages from video decoder worker
   */
  private handleDecoderMessage(event: MessageEvent): void {
    const { type, videoId, frame, timestamp, metadata, error, progress, tag, message } = event.data;

    switch (type) {
      case 'ready':
        console.log('Video decoder worker ready');
        break;

      case 'debug':
        // Debug messages from worker - log with special prefix
        console.log(`[WORKER:${tag}] ${message}`);
        break;

      case 'hwAccelStatus':
        // Hardware acceleration status from worker
        const hwAccel = event.data.hardwareAcceleration || 'unknown';
        const codec = event.data.codec || 'unknown';
        const isHardware = hwAccel === 'prefer-hardware';
        console.log(`%c[WorkerManager] HW ACCEL: ${videoId?.slice(0,8)} → ${isHardware ? '🟢 GPU' : '🔴 CPU'} (${hwAccel}) codec=${codec}`, 
          isHardware ? 'color: green; font-weight: bold' : 'color: red; font-weight: bold');
        break;

      case 'loading':
        this.config.onProgress?.(videoId, progress || 0);
        break;

      case 'loaded':
        console.log(`[WorkerManager] Video loaded: ${videoId}`, metadata);
        this.loadedVideos.add(videoId);
        this.loadingVideos.delete(videoId);
        if (metadata) {
          this.videoMetadata.set(videoId, metadata);
          this.config.onMetadata?.(videoId, metadata);
        }
        break;

      case 'blobUrl':
        // Store blob URL for audio playback from local memory
        const blobUrl = event.data.blobUrl;
        if (blobUrl && videoId) {
          this.blobUrls.set(videoId, blobUrl);
          console.log(`%c[WorkerManager] BLOB URL: ${videoId?.slice(0,8)} → Audio will play from local memory`, 
            'color: cyan; font-weight: bold');
          // Notify listeners so audio elements can be updated
          this.config.onBlobUrl?.(videoId, blobUrl);
        }
        break;

      case 'frame':
        // CRITICAL: Convert VideoFrame to ImageBitmap immediately and close VideoFrame!
        // VideoDecoder has a limited internal frame pool (~10 frames).
        // If we hold onto VideoFrames without closing them, the decoder stalls.
        // ImageBitmap is a copy that doesn't hold onto decoder resources.
        this.handleFrameAsync(videoId, frame, timestamp);
        break;

      case 'seeked':
        console.log('Video seeked:', videoId);
        break;

      case 'error':
        console.error('Video decoder error:', error);
        this.config.onError?.(videoId, error);
        break;
    }
  }

  /**
   * Handle frame from worker asynchronously
   * CRITICAL: Converts VideoFrame to ImageBitmap and immediately closes VideoFrame
   * This releases the decoder's internal frame buffer, preventing backpressure stall
   */
  private async handleFrameAsync(videoId: string, frame: VideoFrame, timestamp: number): Promise<void> {
    try {
      // Convert VideoFrame to ImageBitmap IMMEDIATELY
      // This copies the pixel data and allows us to close the VideoFrame
      const imageBitmap = await createImageBitmap(frame);
      
      // CRITICAL: Close the VideoFrame to release decoder's internal buffer
      // Without this, the decoder stalls after ~10 frames!
      frame.close();

      // Cache the ImageBitmap (not VideoFrame)
      if (!this.frameCache.has(videoId)) {
        this.frameCache.set(videoId, new Map());
      }
      const cache = this.frameCache.get(videoId)!;

      // Store frame with timestamp as key (rounded to nearest 0.033s for 30fps resolution)
      const timeKey = Math.round(timestamp * 30);

      // Log every 30th frame received (roughly 1 per second)
      if (timeKey % 30 === 0) {
        console.log(`[WorkerManager] FRAME CACHED: ${videoId.slice(0,8)} ts=${timestamp.toFixed(2)}s key=${timeKey} cacheSize=${cache.size}`);
      }

      // Close old ImageBitmap at this time if exists
      const oldBitmap = cache.get(timeKey);
      if (oldBitmap) {
        oldBitmap.close();
      }

      // TIME-AWARE EVICTION: Only evict frames BEFORE current playback position
      const currentTimeKey = this.currentPlaybackTimeKey.get(videoId) || 0;
      
      while (cache.size >= MAX_FRAMES_PER_VIDEO) {
        let evictKey: number | undefined = undefined;
        let oldestKey = Infinity;
        
        for (const key of cache.keys()) {
          if (key < currentTimeKey - 30 && key < oldestKey) {
            oldestKey = key;
            evictKey = key;
          }
        }
        
        if (evictKey !== undefined) {
          const evictBitmap = cache.get(evictKey);
          if (evictBitmap) evictBitmap.close();
          cache.delete(evictKey);
        } else {
          const firstKey = cache.keys().next().value;
          if (firstKey !== undefined) {
            console.warn(`[WorkerManager] EMERGENCY EVICT: key=${firstKey} currentTime=${currentTimeKey}`);
            const evictBitmap = cache.get(firstKey);
            if (evictBitmap) evictBitmap.close();
            cache.delete(firstKey);
          } else {
            break;
          }
        }
      }

      cache.set(timeKey, imageBitmap);

      // Notify callback (passing ImageBitmap as VideoFrame for backward compatibility)
      // Note: WebGL can use ImageBitmap directly via texImage2D
      this.config.onFrame?.(videoId, imageBitmap as unknown as VideoFrame, timestamp);
    } catch (error) {
      console.error(`[WorkerManager] Failed to convert frame to ImageBitmap:`, error);
      frame.close(); // Still close the frame on error!
    }
  }

  /**
   * Handle messages from FFmpeg worker
   */
  private handleFFmpegMessage(event: MessageEvent): void {
    const { type, taskId, outputUrl, frameUrl, error } = event.data;

    switch (type) {
      case 'ready':
        console.log('FFmpeg worker ready');
        break;

      case 'initializing':
        console.log('Initializing FFmpeg WASM...');
        break;

      case 'initialized':
        console.log('FFmpeg WASM initialized');
        break;

      case 'processing':
        console.log('FFmpeg processing:', taskId);
        break;

      case 'processed':
        console.log('FFmpeg processed:', taskId, outputUrl);
        break;

      case 'frame-extracted':
        console.log('Frame extracted:', taskId, frameUrl);
        break;

      case 'applying-effect':
        console.log('Applying effect:', taskId);
        break;

      case 'effect-applied':
        console.log('Effect applied:', taskId, outputUrl);
        break;

      case 'error':
        console.error('FFmpeg error:', error);
        break;
    }
  }

  /**
   * Load a video in the decoder worker
   */
  async loadVideo(videoId: string, url: string): Promise<VideoMetadata | null> {
    // Already loaded
    if (this.loadedVideos.has(videoId)) {
      return this.videoMetadata.get(videoId) || null;
    }

    // Already loading - don't start another load
    if (this.loadingVideos.has(videoId)) {
      console.log(`[WorkerManager] Video ${videoId} already loading, skipping duplicate request`);
      return null;
    }

    // Mark as loading
    this.loadingVideos.add(videoId);

    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (event.data.type === 'loaded' && event.data.videoId === videoId) {
          this.videoDecoderWorker?.removeEventListener('message', handler);
          this.loadingVideos.delete(videoId);
          resolve(event.data.metadata || null);
        } else if (event.data.type === 'error' && event.data.videoId === videoId) {
          this.videoDecoderWorker?.removeEventListener('message', handler);
          this.loadingVideos.delete(videoId);
          resolve(null);
        }
      };

      this.videoDecoderWorker?.addEventListener('message', handler);
      this.videoDecoderWorker?.postMessage({
        type: 'load',
        videoId,
        url,
      });
    });
  }

  /**
   * Seek a video to specific time
   */
  seekVideo(videoId: string, time: number): void {
    this.videoDecoderWorker?.postMessage({
      type: 'seek',
      videoId,
      time,
    });
  }

  /**
   * Buffer frames around playback position
   */
  bufferFrames(
    time: number,
    items: Array<{
      id: string;
      startTime: number;
      duration: number;
      trim?: { start: number; end: number };
      speed?: number;
    }>
  ): void {
    // Log every 30th call (roughly every second at 30fps)
    if (Math.floor(time * 30) % 30 === 0) {
      console.log(`[WorkerManager] bufferFrames called at time ${time.toFixed(2)}s for ${items.length} items, worker=${!!this.videoDecoderWorker}`);
    }
    if (!this.videoDecoderWorker) {
      console.error('[WorkerManager] bufferFrames: videoDecoderWorker is NULL!');
      return;
    }
    this.videoDecoderWorker.postMessage({
      type: 'buffer',
      time,
      items,
    });
  }

  /**
   * Get cached frame for a video at specific time
   * Uses fuzzy matching to find nearest frame within tolerance
   * Returns ImageBitmap (compatible with WebGL texImage2D)
   */
  getFrame(videoId: string, time: number): ImageBitmap | null {
    const cache = this.frameCache.get(videoId);
    
    // Match resolution used in cache storage (30fps = 0.033s per key)
    const timeKey = Math.round(time * 30);
    
    // CRITICAL: Track current playback position for time-aware cache eviction
    // This tells the cache which frames are safe to evict (those behind playback)
    this.currentPlaybackTimeKey.set(videoId, timeKey);
    
    if (!cache || cache.size === 0) {
      // Log cache miss periodically
      if (Math.floor(time) !== Math.floor(this._lastCacheMissLogTime || -1)) {
        console.log(`[WorkerManager] getFrame: ${videoId.slice(0,8)} t=${time.toFixed(2)} NO CACHE (empty)`);
        this._lastCacheMissLogTime = time;
      }
      return null;
    }
    let frame = cache.get(timeKey);
    let foundKey = timeKey;

    // If exact match not found, try nearby keys (within ~0.1s = 3 keys at 30fps)
    if (!frame) {
      for (let offset = 1; offset <= 3; offset++) {
        frame = cache.get(timeKey - offset);
        if (frame) { foundKey = timeKey - offset; break; }
        frame = cache.get(timeKey + offset);
        if (frame) { foundKey = timeKey + offset; break; }
      }
    }

    // Still no frame? Find the closest one in the cache
    if (!frame && cache.size > 0) {
      let closestKey = -1;
      let closestDistance = Infinity;

      for (const key of cache.keys()) {
        const distance = Math.abs(key - timeKey);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestKey = key;
        }
      }

      // Use closest frame if within 1 second (30 time keys at 30fps resolution)
      if (closestKey >= 0 && closestDistance <= 30) {
        frame = cache.get(closestKey);
        foundKey = closestKey;
      }
    }

    // Log cache status periodically
    if (Math.floor(time) !== Math.floor(this._lastGetFrameLogTime || -1)) {
      const keys = Array.from(cache.keys());
      const minKey = Math.min(...keys);
      const maxKey = Math.max(...keys);
      console.log(`[WorkerManager] getFrame: ${videoId.slice(0,8)} t=${time.toFixed(2)} key=${timeKey} cache=[${minKey}-${maxKey}] size=${cache.size} found=${!!frame}${frame ? ' at ' + foundKey : ''}`);
      this._lastGetFrameLogTime = time;
    }

    return frame || null;
  }

  private _lastGetFrameLogTime?: number;
  private _lastCacheMissLogTime?: number;

  /**
   * Get video metadata
   */
  getMetadata(videoId: string): VideoMetadata | null {
    return this.videoMetadata.get(videoId) || null;
  }

  /**
   * Check if video is loaded
   */
  isVideoLoaded(videoId: string): boolean {
    return this.loadedVideos.has(videoId);
  }

  /**
   * Check if video is currently loading
   */
  isVideoLoading(videoId: string): boolean {
    return this.loadingVideos.has(videoId);
  }

  /**
   * Get blob URL for video (for audio playback from local memory)
   * Returns null if video hasn't been preloaded yet
   */
  getBlobUrl(videoId: string): string | null {
    return this.blobUrls.get(videoId) || null;
  }

  /**
   * Get buffer depth stats for monitoring playback health
   * Returns info about cached frames and decode status
   */
  getBufferStats(videoId: string, currentTime: number): {
    cacheSize: number;
    cachedRange: { min: number; max: number } | null;
    bufferAhead: number;
    isHealthy: boolean;
  } {
    const cache = this.frameCache.get(videoId);
    const currentTimeKey = Math.round(currentTime * 30);
    
    if (!cache || cache.size === 0) {
      return { cacheSize: 0, cachedRange: null, bufferAhead: 0, isHealthy: false };
    }
    
    const keys = Array.from(cache.keys());
    const minKey = Math.min(...keys);
    const maxKey = Math.max(...keys);
    
    // Calculate how many frames are ahead of current playback
    const framesAhead = keys.filter(k => k > currentTimeKey).length;
    const bufferAhead = framesAhead / 30; // Convert to seconds
    
    // Consider buffer healthy if we have at least 0.5 seconds ahead
    const isHealthy = bufferAhead >= 0.5;
    
    return {
      cacheSize: cache.size,
      cachedRange: { min: minKey / 30, max: maxKey / 30 },
      bufferAhead,
      isHealthy
    };
  }

  /**
   * Apply effect to video using FFmpeg (lazy-loads FFmpeg worker)
   */
  applyEffect(
    taskId: string,
    inputUrl: string,
    effect: {
      type: 'blur' | 'brightness' | 'contrast' | 'saturation' | 'crop' | 'rotate';
      params: Record<string, number>;
    }
  ): void {
    const worker = this.initFFmpegWorker();
    worker?.postMessage({
      type: 'apply-effect',
      taskId,
      inputUrl,
      effect,
    });
  }

  /**
   * Extract frame using FFmpeg (lazy-loads FFmpeg worker)
   */
  extractFrame(taskId: string, inputUrl: string, time: number): void {
    const worker = this.initFFmpegWorker();
    worker?.postMessage({
      type: 'extract-frame',
      taskId,
      inputUrl,
      time,
    });
  }

  /**
   * Process video using FFmpeg (lazy-loads FFmpeg worker)
   */
  processVideo(taskId: string, inputUrl: string, outputFormat: string): void {
    const worker = this.initFFmpegWorker();
    worker?.postMessage({
      type: 'process',
      taskId,
      inputUrl,
      outputFormat,
    });
  }

  /**
   * Destroy a video from decoder
   */
  destroyVideo(videoId: string): void {
    this.videoDecoderWorker?.postMessage({
      type: 'destroy',
      videoId,
    });

    // Clear from cache
    const cache = this.frameCache.get(videoId);
    if (cache) {
      cache.forEach(frame => frame.close());
      cache.clear();
    }
    this.frameCache.delete(videoId);

    // Revoke blob URL to prevent memory leak
    const blobUrl = this.blobUrls.get(videoId);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      console.log(`[WorkerManager] Revoked blob URL for ${videoId.slice(0,8)}`);
    }
    this.blobUrls.delete(videoId);

    this.loadedVideos.delete(videoId);
    this.videoMetadata.delete(videoId);
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    // Clear all frame caches
    this.frameCache.forEach(cache => {
      cache.forEach(frame => frame.close());
      cache.clear();
    });
    this.frameCache.clear();

    // Revoke all blob URLs to prevent memory leaks
    this.blobUrls.forEach((url, videoId) => {
      URL.revokeObjectURL(url);
      console.log(`[WorkerManager] Revoked blob URL for ${videoId.slice(0,8)}`);
    });
    this.blobUrls.clear();

    // Terminate workers
    this.videoDecoderWorker?.terminate();
    this.ffmpegWorker?.terminate();

    this.videoDecoderWorker = null;
    this.ffmpegWorker = null;

    this.loadedVideos.clear();
    this.videoMetadata.clear();
    this.loadingVideos.clear();
  }

  /**
   * Check if workers are supported
   */
  static isSupported(): boolean {
    return (
      typeof Worker !== 'undefined' &&
      typeof VideoDecoder !== 'undefined' &&
      typeof VideoFrame !== 'undefined'
    );
  }
}
