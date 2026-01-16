/**
 * Worker Manager
 * Coordinates Web Workers for video decoding and FFmpeg processing
 * Manages communication between main thread and workers
 */

import VideoDecoderWorker from '@/workers/video-decoder.worker?worker';
import FFmpegWorker from '@/workers/ffmpeg.worker?worker';

// Limit frame cache to prevent memory exhaustion (~10 seconds at 30fps per video)
const MAX_FRAMES_PER_VIDEO = 300;

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

  // Frame cache for quick access
  private frameCache: Map<string, Map<number, VideoFrame>> = new Map();

  constructor(config: WorkerManagerConfig = {}) {
    this.config = config;
    this.initialize();
  }

  /**
   * Initialize workers
   */
  private initialize(): void {
    // Create video decoder worker
    this.videoDecoderWorker = new VideoDecoderWorker();
    this.videoDecoderWorker.addEventListener('message', this.handleDecoderMessage.bind(this));
    this.videoDecoderWorker.addEventListener('error', (error) => {
      console.error('Video decoder worker error:', error);
    });

    // Create FFmpeg worker
    this.ffmpegWorker = new FFmpegWorker();
    this.ffmpegWorker.addEventListener('message', this.handleFFmpegMessage.bind(this));
    this.ffmpegWorker.addEventListener('error', (error) => {
      console.error('FFmpeg worker error:', error);
    });

    // Initialize FFmpeg worker
    this.ffmpegWorker.postMessage({ type: 'init' });
  }

  /**
   * Handle messages from video decoder worker
   */
  private handleDecoderMessage(event: MessageEvent): void {
    const { type, videoId, frame, timestamp, metadata, error, progress } = event.data;

    switch (type) {
      case 'ready':
        console.log('Video decoder worker ready');
        break;

      case 'loading':
        this.config.onProgress?.(videoId, progress || 0);
        break;

      case 'loaded':
        console.log(`[WorkerManager] Video loaded: ${videoId}`, metadata);
        this.loadedVideos.add(videoId);
        if (metadata) {
          this.videoMetadata.set(videoId, metadata);
          this.config.onMetadata?.(videoId, metadata);
        }
        break;

      case 'frame':
        // Cache frame with size limits to prevent memory exhaustion
        if (!this.frameCache.has(videoId)) {
          this.frameCache.set(videoId, new Map());
        }
        const cache = this.frameCache.get(videoId)!;

        // Store frame with timestamp as key (rounded to nearest 0.033s for 30fps resolution)
        const timeKey = Math.round(timestamp * 30);

        // Close old frame at this time if exists
        const oldFrame = cache.get(timeKey);
        if (oldFrame) {
          oldFrame.close();
        }

        // Evict oldest frames if over limit (FIFO eviction)
        while (cache.size >= MAX_FRAMES_PER_VIDEO) {
          const firstKey = cache.keys().next().value;
          if (firstKey !== undefined) {
            const evictFrame = cache.get(firstKey);
            if (evictFrame) evictFrame.close();
            cache.delete(firstKey);
          } else {
            break;
          }
        }

        cache.set(timeKey, frame);

        // Notify callback
        this.config.onFrame?.(videoId, frame, timestamp);
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
      console.log(`[WorkerManager] bufferFrames called at time ${time.toFixed(2)}s for ${items.length} items`);
    }
    this.videoDecoderWorker?.postMessage({
      type: 'buffer',
      time,
      items,
    });
  }

  /**
   * Get cached frame for a video at specific time
   * Uses fuzzy matching to find nearest frame within tolerance
   */
  getFrame(videoId: string, time: number): VideoFrame | null {
    const cache = this.frameCache.get(videoId);
    if (!cache || cache.size === 0) {
      return null;
    }

    // Match resolution used in cache storage (30fps = 0.033s per key)
    const timeKey = Math.round(time * 30);
    let frame = cache.get(timeKey);

    // If exact match not found, try nearby keys (within ~0.1s = 3 keys at 30fps)
    if (!frame) {
      for (let offset = 1; offset <= 3; offset++) {
        frame = cache.get(timeKey - offset) || cache.get(timeKey + offset);
        if (frame) break;
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
      }
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
   * Apply effect to video using FFmpeg
   */
  applyEffect(
    taskId: string,
    inputUrl: string,
    effect: {
      type: 'blur' | 'brightness' | 'contrast' | 'saturation' | 'crop' | 'rotate';
      params: Record<string, number>;
    }
  ): void {
    this.ffmpegWorker?.postMessage({
      type: 'apply-effect',
      taskId,
      inputUrl,
      effect,
    });
  }

  /**
   * Extract frame using FFmpeg
   */
  extractFrame(taskId: string, inputUrl: string, time: number): void {
    this.ffmpegWorker?.postMessage({
      type: 'extract-frame',
      taskId,
      inputUrl,
      time,
    });
  }

  /**
   * Process video using FFmpeg
   */
  processVideo(taskId: string, inputUrl: string, outputFormat: string): void {
    this.ffmpegWorker?.postMessage({
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

    // Terminate workers
    this.videoDecoderWorker?.terminate();
    this.ffmpegWorker?.terminate();

    this.videoDecoderWorker = null;
    this.ffmpegWorker = null;

    this.loadedVideos.clear();
    this.videoMetadata.clear();
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
