/**
 * Video Manager for handling multiple video elements
 * Manages preloading, buffering, and synchronization
 */

export interface ManagedVideo {
  id: string;
  url: string;
  element: HTMLVideoElement;
  isReady: boolean;
  duration: number;
}

export class VideoManager {
  private videos: Map<string, ManagedVideo> = new Map();
  private preloadPromises: Map<string, Promise<void>> = new Map();

  /**
   * Create or get a video element
   */
  async getOrCreateVideo(id: string, url: string): Promise<ManagedVideo> {
    // Return existing video if URL matches
    const existing = this.videos.get(id);
    if (existing && existing.url === url) {
      return existing;
    }

    // Create new video element
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = true; // Videos will be muted as audio is handled separately
    video.playsInline = true;

    const managedVideo: ManagedVideo = {
      id,
      url,
      element: video,
      isReady: false,
      duration: 0,
    };

    this.videos.set(id, managedVideo);

    // Start preloading
    this.preloadVideo(managedVideo);

    return managedVideo;
  }

  /**
   * Preload a video
   */
  private preloadVideo(managedVideo: ManagedVideo): Promise<void> {
    const existingPromise = this.preloadPromises.get(managedVideo.id);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const video = managedVideo.element;

      const onLoadedMetadata = () => {
        managedVideo.duration = video.duration;
        managedVideo.isReady = true;
        cleanup();
        resolve();
      };

      const onError = () => {
        console.error('Failed to load video:', managedVideo.url);
        cleanup();
        reject(new Error(`Failed to load video: ${managedVideo.url}`));
      };

      const onCanPlay = () => {
        // Video has enough data to start playing
        managedVideo.isReady = true;
      };

      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('error', onError);
        video.removeEventListener('canplay', onCanPlay);
      };

      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('error', onError);
      video.addEventListener('canplay', onCanPlay);

      // If already loaded
      if (video.readyState >= 1) {
        onLoadedMetadata();
      }

      // Start loading
      video.load();
    });

    this.preloadPromises.set(managedVideo.id, promise);
    return promise;
  }

  /**
   * Get a video by ID
   */
  getVideo(id: string): ManagedVideo | undefined {
    return this.videos.get(id);
  }

  /**
   * Remove a video
   */
  removeVideo(id: string): void {
    const video = this.videos.get(id);
    if (video) {
      video.element.pause();
      video.element.src = '';
      video.element.load();
    }
    this.videos.delete(id);
    this.preloadPromises.delete(id);
  }

  /**
   * Preload multiple videos
   */
  async preloadVideos(items: Array<{ id: string; url: string }>): Promise<void> {
    const promises = items.map(item => this.getOrCreateVideo(item.id, item.url));
    await Promise.allSettled(promises);
  }

  /**
   * Sync video to specific time
   */
  syncVideo(id: string, time: number, threshold: number = 0.1): void {
    const video = this.videos.get(id);
    if (!video || !video.isReady) return;

    const element = video.element;
    if (Math.abs(element.currentTime - time) > threshold) {
      element.currentTime = time;
    }
  }

  /**
   * Sync multiple videos to timeline time
   */
  syncVideos(
    items: Array<{
      id: string;
      startTime: number;
      trim?: { start: number; end: number };
      speed?: number;
    }>,
    timelineTime: number
  ): void {
    items.forEach(item => {
      const video = this.videos.get(item.id);
      if (!video || !video.isReady) return;

      // Calculate if video should be playing
      const endTime = item.startTime + (video.duration / (item.speed || 1));
      const isActive = timelineTime >= item.startTime && timelineTime < endTime;

      if (!isActive) {
        // Pause inactive videos
        if (!video.element.paused) {
          video.element.pause();
        }
        return;
      }

      // Calculate local time within the video
      const timeInClip = timelineTime - item.startTime;
      const speed = item.speed || 1;
      const trimStart = item.trim?.start || 0;
      const localTime = trimStart + (timeInClip * speed);

      // Sync time
      this.syncVideo(item.id, localTime);

      // Set playback rate
      if (video.element.playbackRate !== speed) {
        video.element.playbackRate = speed;
      }
    });
  }

  /**
   * Play all active videos
   */
  playVideos(videoIds: string[]): void {
    videoIds.forEach(id => {
      const video = this.videos.get(id);
      if (video && video.isReady && video.element.paused) {
        video.element.play().catch(() => {
          // Ignore play errors (can happen if video not ready)
        });
      }
    });
  }

  /**
   * Pause all videos
   */
  pauseVideos(videoIds?: string[]): void {
    const ids = videoIds || Array.from(this.videos.keys());
    ids.forEach(id => {
      const video = this.videos.get(id);
      if (video && !video.element.paused) {
        video.element.pause();
      }
    });
  }

  /**
   * Check if all videos are ready
   */
  areVideosReady(videoIds: string[]): boolean {
    return videoIds.every(id => {
      const video = this.videos.get(id);
      return video && video.isReady;
    });
  }

  /**
   * Get loading progress
   */
  getLoadingProgress(): { loaded: number; total: number; percentage: number } {
    const total = this.videos.size;
    const loaded = Array.from(this.videos.values()).filter(v => v.isReady).length;
    const percentage = total > 0 ? (loaded / total) * 100 : 100;

    return { loaded, total, percentage };
  }

  /**
   * Clear all videos
   */
  clear(): void {
    this.videos.forEach((video, id) => this.removeVideo(id));
    this.videos.clear();
    this.preloadPromises.clear();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clear();
  }
}
