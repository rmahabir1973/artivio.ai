/**
 * Canvas Compositor for Real-Time Video Preview
 * Handles multi-layer video compositing at 30fps with transitions
 */

export interface CompositorLayer {
  id: string;
  type: 'video' | 'image' | 'text';
  element: HTMLVideoElement | HTMLImageElement | VideoFrame | null;
  startTime: number;
  duration: number;
  zIndex: number;

  // Visual properties
  position?: { x: number; y: number; width: number; height: number };
  opacity?: number;

  // Text properties
  text?: {
    content: string;
    fontSize: number;
    color: string;
    position: { x: number; y: number };
    fontFamily?: string;
  };

  // Transition properties
  transition?: {
    type: 'fade' | 'dissolve' | 'wipeLeft' | 'wipeRight' | 'wipeUp' | 'wipeDown';
    duration: number;
  };

  // Trim properties
  trim?: { start: number; end: number };
  speed?: number;

  // WebCodecs support
  useWebCodecs?: boolean; // If true, element should be VideoFrame
}

export interface CompositorConfig {
  width: number;
  height: number;
  fps: number;
  backgroundColor?: string;
}

export class CanvasCompositor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: CompositorConfig;
  private layers: Map<string, CompositorLayer> = new Map();
  private sortedLayersCache: CompositorLayer[] | null = null;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private lastRenderTime: number = 0;
  private lastSyncTimes: Map<string, number> = new Map();
  private currentTime: number = 0;
  private isPlaying: boolean = false;
  private onTimeUpdate?: (time: number) => void;
  private frameInterval: number;
  private syncInterval: number = 100; // Sync each video every 100ms instead of every frame

  constructor(canvas: HTMLCanvasElement, config: CompositorConfig) {
    this.canvas = canvas;
    this.config = config;
    this.frameInterval = 1000 / config.fps; // ms between frames (e.g., 33.33ms for 30fps)

    // Set canvas dimensions
    this.canvas.width = config.width;
    this.canvas.height = config.height;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;

    // Set default styles (use 'low' for better performance)
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'low';
  }

  /**
   * Add or update a layer
   */
  addLayer(layer: CompositorLayer): void {
    this.layers.set(layer.id, layer);
    this.sortedLayersCache = null; // Invalidate cache
  }

  /**
   * Remove a layer
   */
  removeLayer(layerId: string): void {
    this.layers.delete(layerId);
    this.lastSyncTimes.delete(layerId); // Clean up sync time tracking
    this.sortedLayersCache = null; // Invalidate cache
  }

  /**
   * Update all layers
   */
  setLayers(layers: CompositorLayer[]): void {
    this.layers.clear();
    this.lastSyncTimes.clear(); // Clear sync times when layers change
    layers.forEach(layer => this.layers.set(layer.id, layer));
    this.sortedLayersCache = null; // Invalidate cache

    // Render a frame immediately to show something even when paused
    this.renderFrame();
  }

  /**
   * Get layers sorted by z-index (cached)
   */
  private getSortedLayers(): CompositorLayer[] {
    if (!this.sortedLayersCache) {
      this.sortedLayersCache = Array.from(this.layers.values())
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    }
    return this.sortedLayersCache;
  }

  /**
   * Check if a layer is active at the current time
   */
  private isLayerActive(layer: CompositorLayer): boolean {
    const endTime = layer.startTime + layer.duration;
    return this.currentTime >= layer.startTime && this.currentTime < endTime;
  }

  /**
   * Get the local time within a layer (accounting for trim and speed)
   */
  private getLayerLocalTime(layer: CompositorLayer): number {
    const timeInLayer = this.currentTime - layer.startTime;
    const speed = layer.speed || 1;
    const trimStart = layer.trim?.start || 0;
    return trimStart + (timeInLayer * speed);
  }

  /**
   * Calculate transition opacity for a layer
   */
  private getTransitionOpacity(layer: CompositorLayer): number {
    if (!layer.transition) return 1;

    const timeInLayer = this.currentTime - layer.startTime;
    const transitionDuration = layer.transition.duration;

    // Fade in at the start
    if (timeInLayer < transitionDuration) {
      return timeInLayer / transitionDuration;
    }

    // Fade out at the end
    const timeUntilEnd = layer.duration - timeInLayer;
    if (timeUntilEnd < transitionDuration) {
      return timeUntilEnd / transitionDuration;
    }

    return 1;
  }

  /**
   * Draw a video layer
   */
  private drawVideoLayer(layer: CompositorLayer): void {
    if (!layer.element) {
      return;
    }

    // Handle VideoFrame (WebCodecs)
    if (layer.useWebCodecs && 'displayWidth' in layer.element) {
      this.drawVideoFrame(layer, layer.element as VideoFrame);
      return;
    }

    // Handle traditional HTMLVideoElement
    if (!(layer.element instanceof HTMLVideoElement)) {
      return;
    }

    const video = layer.element;

    // Check if video is ready
    if (video.readyState < 2) {
      return;
    }

    // Sync video time only occasionally to reduce CPU load
    // Check when this specific video was last synced
    const now = performance.now();
    const lastSync = this.lastSyncTimes.get(layer.id) || 0;
    const shouldSync = (now - lastSync) >= this.syncInterval;

    if (shouldSync) {
      const localTime = this.getLayerLocalTime(layer);
      // Only seek if significantly out of sync (0.5 second threshold)
      if (Math.abs(video.currentTime - localTime) > 0.5) {
        video.currentTime = localTime;
      }
      this.lastSyncTimes.set(layer.id, now);
    }

    // Calculate position and size
    const pos = layer.position || {
      x: 0,
      y: 0,
      width: this.config.width,
      height: this.config.height,
    };

    // Calculate opacity (layer opacity * transition opacity)
    const layerOpacity = layer.opacity ?? 1;
    const transitionOpacity = this.getTransitionOpacity(layer);
    const finalOpacity = layerOpacity * transitionOpacity;

    // Save context state
    this.ctx.save();

    // Apply opacity
    this.ctx.globalAlpha = finalOpacity;

    // Apply transition effects
    if (layer.transition) {
      this.applyTransitionEffect(layer, pos);
    }

    // Draw video frame
    try {
      this.ctx.drawImage(
        video,
        pos.x,
        pos.y,
        pos.width,
        pos.height
      );
    } catch (error) {
      // Video might not be ready yet
      console.debug('Failed to draw video frame:', error);
    }

    // Restore context state
    this.ctx.restore();
  }

  /**
   * Draw a VideoFrame (WebCodecs)
   */
  private drawVideoFrame(layer: CompositorLayer, frame: VideoFrame): void {
    // Calculate position and size
    const pos = layer.position || {
      x: 0,
      y: 0,
      width: this.config.width,
      height: this.config.height,
    };

    // Calculate opacity (layer opacity * transition opacity)
    const layerOpacity = layer.opacity ?? 1;
    const transitionOpacity = this.getTransitionOpacity(layer);
    const finalOpacity = layerOpacity * transitionOpacity;

    // Save context state
    this.ctx.save();

    // Apply opacity
    this.ctx.globalAlpha = finalOpacity;

    // Apply transition effects
    if (layer.transition) {
      this.applyTransitionEffect(layer, pos);
    }

    // Draw video frame (VideoFrame supports drawImage directly)
    try {
      this.ctx.drawImage(
        frame,
        pos.x,
        pos.y,
        pos.width,
        pos.height
      );
    } catch (error) {
      console.debug('Failed to draw VideoFrame:', error);
    }

    // Restore context state
    this.ctx.restore();
  }

  /**
   * Draw an image layer
   */
  private drawImageLayer(layer: CompositorLayer): void {
    if (!layer.element || !(layer.element instanceof HTMLImageElement)) return;

    const image = layer.element;
    if (!image.complete) return;

    // Calculate position and size
    const pos = layer.position || {
      x: 0,
      y: 0,
      width: this.config.width,
      height: this.config.height,
    };

    // Calculate opacity
    const layerOpacity = layer.opacity ?? 1;
    const transitionOpacity = this.getTransitionOpacity(layer);
    const finalOpacity = layerOpacity * transitionOpacity;

    // Save context state
    this.ctx.save();

    // Apply opacity
    this.ctx.globalAlpha = finalOpacity;

    // Apply transition effects
    if (layer.transition) {
      this.applyTransitionEffect(layer, pos);
    }

    // Draw image
    this.ctx.drawImage(
      image,
      pos.x,
      pos.y,
      pos.width,
      pos.height
    );

    // Restore context state
    this.ctx.restore();
  }

  /**
   * Draw a text layer
   */
  private drawTextLayer(layer: CompositorLayer): void {
    if (!layer.text) return;

    const { content, fontSize, color, position, fontFamily } = layer.text;

    // Calculate opacity
    const layerOpacity = layer.opacity ?? 1;
    const transitionOpacity = this.getTransitionOpacity(layer);
    const finalOpacity = layerOpacity * transitionOpacity;

    // Save context state
    this.ctx.save();

    // Set text styles
    this.ctx.font = `${fontSize}px ${fontFamily || 'Arial'}`;
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = finalOpacity;
    this.ctx.textBaseline = 'top';

    // Draw text
    this.ctx.fillText(content, position.x, position.y);

    // Restore context state
    this.ctx.restore();
  }

  /**
   * Apply transition effects using clip paths
   */
  private applyTransitionEffect(
    layer: CompositorLayer,
    pos: { x: number; y: number; width: number; height: number }
  ): void {
    if (!layer.transition) return;

    const timeInLayer = this.currentTime - layer.startTime;
    const transitionDuration = layer.transition.duration;

    // Only apply wipe effects during fade-in
    if (timeInLayer > transitionDuration) return;

    const progress = timeInLayer / transitionDuration;

    switch (layer.transition.type) {
      case 'wipeLeft':
        this.ctx.beginPath();
        this.ctx.rect(pos.x, pos.y, pos.width * progress, pos.height);
        this.ctx.clip();
        break;

      case 'wipeRight':
        this.ctx.beginPath();
        this.ctx.rect(
          pos.x + pos.width * (1 - progress),
          pos.y,
          pos.width * progress,
          pos.height
        );
        this.ctx.clip();
        break;

      case 'wipeUp':
        this.ctx.beginPath();
        this.ctx.rect(
          pos.x,
          pos.y + pos.height * (1 - progress),
          pos.width,
          pos.height * progress
        );
        this.ctx.clip();
        break;

      case 'wipeDown':
        this.ctx.beginPath();
        this.ctx.rect(pos.x, pos.y, pos.width, pos.height * progress);
        this.ctx.clip();
        break;

      // fade and dissolve are handled by opacity
    }
  }

  /**
   * Render a single frame
   */
  private renderFrame(): void {
    // Clear canvas
    this.ctx.fillStyle = this.config.backgroundColor || '#000000';
    this.ctx.fillRect(0, 0, this.config.width, this.config.height);

    // Get active layers sorted by z-index
    const sortedLayers = this.getSortedLayers();
    const activeLayers = sortedLayers.filter(layer => this.isLayerActive(layer));

    // Draw each active layer
    for (const layer of activeLayers) {
      switch (layer.type) {
        case 'video':
          this.drawVideoLayer(layer);
          break;
        case 'image':
          this.drawImageLayer(layer);
          break;
        case 'text':
          this.drawTextLayer(layer);
          break;
      }
    }
  }

  /**
   * Animation loop with frame rate throttling
   */
  private animate = (timestamp: number): void => {
    if (!this.isPlaying) return;

    // Continue animation loop
    this.animationFrameId = requestAnimationFrame(this.animate);

    // Skip rendering if page is not visible (tab is in background)
    if (document.hidden) {
      return;
    }

    // Throttle rendering to target FPS
    const timeSinceLastRender = timestamp - this.lastRenderTime;
    if (timeSinceLastRender < this.frameInterval) {
      return; // Skip this frame
    }

    // Calculate time delta
    const deltaTime = this.lastFrameTime ? (timestamp - this.lastFrameTime) / 1000 : 0;
    this.lastFrameTime = timestamp;
    this.lastRenderTime = timestamp - (timeSinceLastRender % this.frameInterval);

    // Update current time
    if (deltaTime > 0) {
      this.currentTime += deltaTime;
      this.onTimeUpdate?.(this.currentTime);
    }

    // Render frame
    this.renderFrame();
  };

  /**
   * Start playback
   */
  play(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.lastFrameTime = 0;
    this.lastRenderTime = 0;

    // Start all video elements
    this.layers.forEach(layer => {
      if (layer.element instanceof HTMLVideoElement) {
        layer.element.play().catch(() => {});
      }
    });

    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.isPlaying) return;

    this.isPlaying = false;

    // Pause all video elements
    this.layers.forEach(layer => {
      if (layer.element instanceof HTMLVideoElement) {
        layer.element.pause();
      }
    });

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Seek to a specific time
   */
  seek(time: number): void {
    this.currentTime = Math.max(0, time);

    // Sync all video elements
    this.layers.forEach(layer => {
      if (layer.element instanceof HTMLVideoElement && this.isLayerActive(layer)) {
        const localTime = this.getLayerLocalTime(layer);
        layer.element.currentTime = localTime;
      }
    });

    // Render current frame
    this.renderFrame();

    this.onTimeUpdate?.(this.currentTime);
  }

  /**
   * Set time update callback
   */
  setOnTimeUpdate(callback: (time: number) => void): void {
    this.onTimeUpdate = callback;
  }

  /**
   * Get current time
   */
  getCurrentTime(): number {
    return this.currentTime;
  }

  /**
   * Check if playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.pause();
    this.layers.clear();
  }
}
