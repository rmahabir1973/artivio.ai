import { useRef, useEffect, useCallback, useState } from 'react';
import { WebGLCompositor, WebGLLayer } from '@/lib/webgl-compositor';
import { WorkerManager, VideoMetadata } from '@/lib/worker-manager';
import { cn } from '@/lib/utils';
import { MultiTrackTimelineItem } from '@/pages/video-editor/components/multi-track-timeline';
import { Loader2, Cpu } from 'lucide-react';

// Note: Audio is disabled in real-time WebGL preview mode.
// WebAudio API causes errors when used with high-frequency WebGL RAF loops.
// Audio playback should use Server Preview mode which uses native video elements.

interface CanvasPreviewProProps {
  items: MultiTrackTimelineItem[];
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate?: (time: number) => void;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Professional Canvas Preview with Web Workers + WebGL + FFmpeg WASM
 * This is the CapCut-style architecture for professional video editing
 */
export function CanvasPreviewPro({
  items,
  currentTime,
  isPlaying,
  onTimeUpdate,
  width = 1920,
  height = 1080,
  className,
}: CanvasPreviewProProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositorRef = useRef<WebGLCompositor | null>(null);
  const workerManagerRef = useRef<WorkerManager | null>(null);
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const frameCounterRef = useRef(0); // Explicit frame counter for buffer cadence

  const [isReady, setIsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ loaded: number; total: number }>({
    loaded: 0,
    total: 0,
  });
  const [videoMetadata, setVideoMetadata] = useState<Map<string, VideoMetadata>>(new Map());
  
  // Track failed video loads with retry info - keyed by URL to reset when URL changes
  const failedVideosRef = useRef<Map<string, { attempts: number; lastAttempt: number; url: string }>>(new Map());
  const MAX_RETRY_ATTEMPTS = 3;
  const RETRY_COOLDOWN_MS = 5000; // 5 seconds between retries

  // Update callback ref
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  // Initialize compositor and worker manager
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      // Initialize WebGL compositor
      const compositor = new WebGLCompositor(canvasRef.current, {
        width,
        height,
        fps: 30,
        backgroundColor: '#000000',
      });

      compositor.setOnTimeUpdate(time => {
        onTimeUpdateRef.current?.(time);
      });

      compositorRef.current = compositor;

      // Initialize worker manager
      const workerManager = new WorkerManager({
        onFrame: (videoId, frame, timestamp) => {
          // Frame received from worker - will be used in render loop
          console.log(`Frame received for ${videoId} at ${timestamp}`);
        },
        onMetadata: (videoId, metadata) => {
          setVideoMetadata(prev => new Map(prev).set(videoId, metadata));
        },
        onProgress: (videoId, progress) => {
          console.log(`Loading ${videoId}: ${progress}%`);
        },
        onError: (videoId, error) => {
          console.error(`Error loading ${videoId}:`, error);
        },
      });

      workerManagerRef.current = workerManager;
      setIsReady(true);

      return () => {
        compositor.destroy();
        workerManager.destroy();
        compositorRef.current = null;
        workerManagerRef.current = null;
      };
    } catch (error) {
      console.error('Error initializing WebGL compositor:', error);
      setIsReady(false);
    }
  }, [width, height]);

  // Load videos using worker manager
  useEffect(() => {
    if (!compositorRef.current || !workerManagerRef.current) return;

    const workerManager = workerManagerRef.current;
    const newImageElements = new Map<string, HTMLImageElement>();

    // Extract video items
    const videoItems = items.filter(item => item.type === 'video');
    
    // Cleanup stale failure entries for removed clips
    const currentVideoIds = new Set(videoItems.map(item => item.id));
    Array.from(failedVideosRef.current.keys()).forEach(videoId => {
      if (!currentVideoIds.has(videoId)) {
        failedVideosRef.current.delete(videoId);
      }
    });

    // Helper to ensure URL is absolute
    const ensureAbsoluteUrl = (url: string): string => {
      // Already absolute (http, https, blob, data)
      if (url.startsWith('http://') || url.startsWith('https://') || 
          url.startsWith('blob:') || url.startsWith('data:')) {
        return url;
      }
      // For relative URLs, try to construct absolute URL from window.location
      if (typeof window !== 'undefined') {
        return new URL(url, window.location.origin).href;
      }
      return url;
    };

    // Check if we should attempt to load a video (respects retry limits)
    const shouldAttemptLoad = (videoId: string, url: string): boolean => {
      const failedInfo = failedVideosRef.current.get(videoId);
      
      if (!failedInfo) return true; // Never failed, go ahead
      
      // If URL changed, reset attempts
      if (failedInfo.url !== url) {
        failedVideosRef.current.delete(videoId);
        return true;
      }
      
      // Check if max attempts reached
      if (failedInfo.attempts >= MAX_RETRY_ATTEMPTS) {
        return false; // Too many failures
      }
      
      // Check cooldown period
      const now = Date.now();
      if (now - failedInfo.lastAttempt < RETRY_COOLDOWN_MS) {
        return false; // Still in cooldown
      }
      
      return true; // Retry allowed
    };

    // Record a failed load attempt
    const recordFailure = (videoId: string, url: string): void => {
      const existing = failedVideosRef.current.get(videoId);
      failedVideosRef.current.set(videoId, {
        attempts: (existing?.attempts || 0) + 1,
        lastAttempt: Date.now(),
        url,
      });
    };

    // Track if component is still mounted
    let isMounted = true;

    // Load videos in worker (non-blocking!)
    const loadVideos = async () => {
      if (videoItems.length === 0) {
        setLoadingProgress({ loaded: 0, total: 0 });
        return;
      }

      setLoadingProgress({ loaded: 0, total: videoItems.length });

      let loaded = 0;

      for (const item of videoItems) {
        // Check if still mounted
        if (!isMounted) return;

        const absoluteUrl = ensureAbsoluteUrl(item.url);

        // Check if already loaded or currently loading
        if (workerManager.isVideoLoaded(item.id) || workerManager.isVideoLoading(item.id)) {
          loaded++;
          if (isMounted) setLoadingProgress({ loaded, total: videoItems.length });
          continue;
        }

        // Check retry limits
        if (!shouldAttemptLoad(item.id, absoluteUrl)) {
          console.log(`[CanvasPreviewPro] Skipping ${item.id} (max retries exceeded or in cooldown)`);
          loaded++;
          if (isMounted) setLoadingProgress({ loaded, total: videoItems.length });
          continue;
        }

        try {
          console.log(`[CanvasPreviewPro] Loading video ${item.id}: ${absoluteUrl}`);

          const metadata = await workerManager.loadVideo(item.id, absoluteUrl);

          // Check if still mounted after async operation
          if (!isMounted) return;

          if (metadata) {
            // Success - clear any failure tracking
            failedVideosRef.current.delete(item.id);
          } else {
            // Loading failed
            recordFailure(item.id, absoluteUrl);
            console.warn(`[CanvasPreviewPro] Failed to load ${item.id}, attempt ${failedVideosRef.current.get(item.id)?.attempts || 1}`);
          }
        } catch (error) {
          if (!isMounted) return;
          console.error('Failed to load video:', absoluteUrl, error);
          recordFailure(item.id, absoluteUrl);
        }

        loaded++;
        if (isMounted) setLoadingProgress({ loaded, total: videoItems.length });
      }
    };

    // Start loading (non-blocking - runs in worker)
    loadVideos();

    // Handle images (still on main thread but lightweight)
    items.forEach(item => {
      if (item.type === 'image') {
        let image = imageElementsRef.current.get(item.id);
        if (!image || image.src !== item.url) {
          image = document.createElement('img');
          image.src = item.url;
          image.crossOrigin = 'anonymous';
        }
        newImageElements.set(item.id, image);
      }
    });

    imageElementsRef.current = newImageElements;

    // Note: Audio tracks are not handled in real-time WebGL preview mode
    // Audio playback should use Server Preview mode which uses native video elements

    // Cleanup: mark as unmounted to stop pending async operations
    return () => {
      isMounted = false;
    };
  }, [items]);

  // Layer provider callback - called synchronously by compositor before each render
  const buildLayers = useCallback((time: number): WebGLLayer[] => {
    const workerManager = workerManagerRef.current;
    if (!workerManager) return [];

    // Build WebGL layers from current timeline items
    const videoItems: Array<{
      id: string;
      startTime: number;
      duration: number;
      trim?: { start: number; end: number };
      speed?: number;
    }> = [];

    let hasAnyMissingFrame = false;

    const layers: WebGLLayer[] = items
      .filter(item => item.type !== 'audio')
      .map(item => {
        const layer: WebGLLayer = {
          id: item.id,
          type: item.type as 'video' | 'image' | 'text',
          frame: null,
          startTime: item.startTime,
          duration: item.duration,
          zIndex: item.zIndex || item.track,
          position: item.position,
          opacity: item.opacity,
          text: item.text,
          transition: item.transition as WebGLLayer['transition'],
        };

        if (item.type === 'video') {
          // Track video items for buffering
          videoItems.push({
            id: item.id,
            startTime: item.startTime,
            duration: item.duration,
            trim: item.trim,
            speed: item.speed,
          });
          
          // Get frame from worker manager
          const timeInClip = time - item.startTime;
          if (timeInClip >= 0 && timeInClip <= item.duration) {
            const speed = item.speed || 1;
            const trimStart = item.trim?.start || 0;
            const localTime = trimStart + (timeInClip * speed);

            // Get cached frame from worker
            const frame = workerManager.getFrame(item.id, localTime);
            layer.frame = frame;
            
            // Track if we're missing frames we should have
            if (!frame) {
              hasAnyMissingFrame = true;
            }
          }
        } else if (item.type === 'image') {
          layer.frame = imageElementsRef.current.get(item.id) || null;
        }

        return layer;
      });

    // Buffer frames more aggressively if any are missing, otherwise every 10 frames
    frameCounterRef.current++;
    const shouldBuffer = hasAnyMissingFrame || (frameCounterRef.current % 10 === 0);
    if (shouldBuffer && videoItems.length > 0) {
      workerManager.bufferFrames(time, videoItems);
    }

    return layers;
  }, [items]);

  // Render frame for seeking (when not playing) - reuses buildLayers for consistency
  const renderFrame = useCallback(() => {
    if (!compositorRef.current) return;

    const compositor = compositorRef.current;
    
    // Reuse buildLayers for consistent layer building
    const layers = buildLayers(currentTime);

    // Render immediately (for seeking when paused)
    compositor.setLayers(layers, true);
  }, [buildLayers, currentTime]);

  // Sync playback state - use layer provider for synchronous layer updates
  useEffect(() => {
    if (!compositorRef.current || !workerManagerRef.current) return;

    const workerManager = workerManagerRef.current;
    const compositor = compositorRef.current;

    if (isPlaying) {
      // Reset frame counter for new playback session
      frameCounterRef.current = 0;

      // Pre-buffer frames before starting playback
      const videoItems = items
        .filter(item => item.type === 'video')
        .map(item => ({
          id: item.id,
          startTime: item.startTime,
          duration: item.duration,
          trim: item.trim,
          speed: item.speed,
        }));
      
      if (videoItems.length > 0) {
        workerManager.bufferFrames(currentTime, videoItems);
      }

      // Set up layer provider for synchronous layer updates
      compositor.setLayerProvider(buildLayers);
      
      // Set up time callback to notify parent
      compositor.setOnTimeUpdate(time => {
        onTimeUpdateRef.current?.(time);
      });

      // Seek compositor to current position before starting
      compositor.seek(currentTime);
      
      // Start playback (compositor manages its own RAF loop)
      // Note: Audio is not played in real-time mode - use Server Preview for audio
      compositor.play();
    } else {
      compositor.pause();

      // Clear layer provider when paused
      compositor.setLayerProvider(undefined);
    }

    return () => {
      // Cleanup: remove layer provider
      if (compositorRef.current) {
        compositorRef.current.setLayerProvider(undefined);
      }
    };
  }, [isPlaying, buildLayers, items, currentTime]);

  // Sync current time (seeking)
  useEffect(() => {
    if (!compositorRef.current || !workerManagerRef.current || isPlaying) return;

    const compositor = compositorRef.current;
    const workerManager = workerManagerRef.current;

    // Only seek when not playing
    if (Math.abs(compositor.getCurrentTime() - currentTime) > 0.1) {
      compositor.seek(currentTime);

      // Seek workers to correct position
      const videoItems = items
        .filter(item => item.type === 'video')
        .map(item => ({
          id: item.id,
          startTime: item.startTime,
          duration: item.duration,
          trim: item.trim,
          speed: item.speed,
        }));

      // Seek videos in worker (non-blocking)
      videoItems.forEach(item => {
        const timeInClip = currentTime - item.startTime;
        if (timeInClip >= -2 && timeInClip <= item.duration + 2) {
          const speed = item.speed || 1;
          const trimStart = item.trim?.start || 0;
          const localTime = trimStart + (timeInClip * speed);

          workerManager.seekVideo(item.id, localTime);
        }
      });

      // Buffer frames around current position
      workerManager.bufferFrames(currentTime, videoItems);

      // Trigger render after seeking
      renderFrame();
    }
  }, [currentTime, isPlaying, items, renderFrame]);

  const isLoading = loadingProgress.total > 0 && loadingProgress.loaded < loadingProgress.total;

  return (
    <div className={cn('relative', className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain bg-black"
        style={{ aspectRatio: `${width}/${height}` }}
      />

      {/* Status badges */}
      <div className="absolute top-2 left-2 flex flex-col gap-2 z-10">
        <div className="bg-primary/10 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1.5">
          <Cpu className="h-3 w-3 text-primary" />
          <span className="text-xs font-medium text-primary">WebGL + Workers</span>
        </div>
        {!isReady && (
          <div className="bg-orange-500/10 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin text-orange-500" />
            <span className="text-xs font-medium text-orange-500">Initializing...</span>
          </div>
        )}
        {isLoading && (
          <div className="bg-blue-500/10 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
            <span className="text-xs font-medium text-blue-500">
              Loading {loadingProgress.loaded}/{loadingProgress.total}
            </span>
          </div>
        )}
      </div>

      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-none">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-white mx-auto" />
            <p className="text-white text-sm">Initializing WebGL compositor...</p>
            <p className="text-white/60 text-xs">Starting Web Workers...</p>
          </div>
        </div>
      )}
    </div>
  );
}
