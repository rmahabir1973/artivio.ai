import { useRef, useEffect, useCallback, useState } from 'react';
import { WebGLCompositor, WebGLLayer } from '@/lib/webgl-compositor';
import { WorkerManager, VideoMetadata } from '@/lib/worker-manager';
import { AudioMixer, AudioTrack } from '@/lib/audio-mixer';
import { cn } from '@/lib/utils';
import { MultiTrackTimelineItem } from '@/pages/video-editor/components/multi-track-timeline';
import { Loader2, Sparkles, Cpu } from 'lucide-react';

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
  const audioMixerRef = useRef<AudioMixer>(new AudioMixer());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const frameRequestRef = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ loaded: number; total: number }>({
    loaded: 0,
    total: 0,
  });
  const [videoMetadata, setVideoMetadata] = useState<Map<string, VideoMetadata>>(new Map());

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
    const audioMixer = audioMixerRef.current;
    const newImageElements = new Map<string, HTMLImageElement>();
    const newAudioElements = new Map<string, HTMLAudioElement>();

    // Extract video items
    const videoItems = items.filter(item => item.type === 'video');

    // Load videos in worker (non-blocking!)
    const loadVideos = async () => {
      if (videoItems.length === 0) {
        setLoadingProgress({ loaded: 0, total: 0 });
        return;
      }

      setLoadingProgress({ loaded: 0, total: videoItems.length });

      let loaded = 0;
      for (const item of videoItems) {
        try {
          await workerManager.loadVideo(item.id, item.url);
          loaded++;
          setLoadingProgress({ loaded, total: videoItems.length });
        } catch (error) {
          console.error('Failed to load video:', item.url, error);
        }
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

    // Handle audio tracks
    items.forEach(item => {
      if (item.type === 'audio') {
        let audio = audioElementsRef.current.get(item.id);
        if (!audio || audio.src !== item.url) {
          audio = document.createElement('audio');
          audio.src = item.url;
          audio.crossOrigin = 'anonymous';
          audio.preload = 'auto';
        }
        newAudioElements.set(item.id, audio);

        const audioTrack: AudioTrack = {
          id: item.id,
          element: audio,
          startTime: item.startTime,
          duration: item.duration,
          volume: item.volume ?? 100,
          fadeIn: item.fadeIn,
          fadeOut: item.fadeOut,
          muted: item.muted,
          trim: item.trim,
          speed: item.speed,
        };
        audioMixer.addTrack(audioTrack);
      }
    });

    audioElementsRef.current = newAudioElements;
  }, [items]);

  // Custom render loop - gets frames from worker and renders with WebGL
  const renderFrame = useCallback(() => {
    if (!compositorRef.current || !workerManagerRef.current) return;

    const workerManager = workerManagerRef.current;

    // Build WebGL layers from current timeline items
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
          transition: item.transition,
        };

        if (item.type === 'video') {
          // Get frame from worker manager
          const timeInClip = currentTime - item.startTime;
          if (timeInClip >= 0 && timeInClip <= item.duration) {
            const speed = item.speed || 1;
            const trimStart = item.trim?.start || 0;
            const localTime = trimStart + (timeInClip * speed);

            // Get cached frame from worker
            const frame = workerManager.getFrame(item.id, localTime);
            layer.frame = frame;
          }
        } else if (item.type === 'image') {
          layer.frame = imageElementsRef.current.get(item.id) || null;
        }

        return layer;
      });

    compositorRef.current.setLayers(layers);

    // Continue if playing
    if (isPlaying) {
      frameRequestRef.current = requestAnimationFrame(renderFrame);
    }
  }, [items, currentTime, isPlaying]);

  // Sync playback state
  useEffect(() => {
    if (!compositorRef.current) return;

    const audioMixer = audioMixerRef.current;

    if (isPlaying) {
      compositorRef.current.play();
      audioMixer.play();

      // Start render loop
      renderFrame();
    } else {
      compositorRef.current.pause();
      audioMixer.pause();

      // Cancel render loop
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
        frameRequestRef.current = null;
      }
    }

    return () => {
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
        frameRequestRef.current = null;
      }
    };
  }, [isPlaying, renderFrame]);

  // Sync current time (seeking)
  useEffect(() => {
    if (!compositorRef.current || !workerManagerRef.current || isPlaying) return;

    const compositor = compositorRef.current;
    const workerManager = workerManagerRef.current;
    const audioMixer = audioMixerRef.current;

    // Only seek when not playing
    if (Math.abs(compositor.getCurrentTime() - currentTime) > 0.1) {
      compositor.seek(currentTime);
      audioMixer.seek(currentTime);

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
