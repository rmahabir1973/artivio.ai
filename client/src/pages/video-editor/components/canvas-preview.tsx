import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { CanvasCompositor, CompositorLayer } from '@/lib/canvas-compositor';
import { VideoManager } from '@/lib/video-manager';
import { WebCodecsVideoManager } from '@/lib/webcodecs-video-manager';
import { WorkerManager } from '@/lib/worker-manager';
import { WebGLCompositor } from '@/lib/webgl-compositor';
import { AudioMixer, AudioTrack } from '@/lib/audio-mixer';
import { cn } from '@/lib/utils';
import { MultiTrackTimelineItem } from '@/pages/video-editor/components/multi-track-timeline';
import { Loader2, Sparkles } from 'lucide-react';
import { CanvasPreviewWebCodecs } from './canvas-preview-webcodecs';
import { CanvasPreviewPro } from './canvas-preview-pro';

interface CanvasPreviewProps {
  items: MultiTrackTimelineItem[];
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate?: (time: number) => void;
  width?: number;
  height?: number;
  className?: string;
}

export function CanvasPreview({
  items,
  currentTime,
  isPlaying,
  onTimeUpdate,
  width = 1920,
  height = 1080,
  className,
}: CanvasPreviewProps) {
  // Check capabilities in priority order
  const workerSupported = useMemo(() => WorkerManager.isSupported(), []);
  const webglSupported = useMemo(() => WebGLCompositor.isSupported(), []);
  const webCodecsSupported = useMemo(() => WebCodecsVideoManager.isSupported(), []);

  // BEST: Use professional architecture (Workers + WebGL + WebCodecs)
  if (workerSupported && webglSupported && webCodecsSupported) {
    return (
      <CanvasPreviewPro
        items={items}
        currentTime={currentTime}
        isPlaying={isPlaying}
        onTimeUpdate={onTimeUpdate}
        width={width}
        height={height}
        className={className}
      />
    );
  }

  // FALLBACK 1: WebCodecs without workers (still better than <video>)
  if (webCodecsSupported) {
    return (
      <div className="relative">
        <div className="absolute top-2 left-2 z-10 bg-primary/10 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-xs font-medium text-primary">WebCodecs (No Workers)</span>
        </div>
        <CanvasPreviewWebCodecs
          items={items}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onTimeUpdate={onTimeUpdate}
          width={width}
          height={height}
          className={className}
        />
      </div>
    );
  }

  // FALLBACK 2: Traditional <video> elements (slowest)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositorRef = useRef<CanvasCompositor | null>(null);
  const videoManagerRef = useRef<VideoManager>(new VideoManager());
  const audioMixerRef = useRef<AudioMixer>(new AudioMixer());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const [isReady, setIsReady] = useState(false);

  // Update callback ref when it changes
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  // Initialize compositor
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      const compositor = new CanvasCompositor(canvasRef.current, {
        width,
        height,
        fps: 30, // Smooth realtime preview at 30fps
        backgroundColor: '#000000',
      });

      compositor.setOnTimeUpdate(time => {
        onTimeUpdateRef.current?.(time);
      });

      compositorRef.current = compositor;
      setIsReady(true);

      return () => {
        compositor.destroy();
        compositorRef.current = null;
      };
    } catch (error) {
      console.error('Error initializing canvas compositor:', error);
      setIsReady(false);
    }
  }, [width, height]);

  // Create video/image/audio elements for each item
  useEffect(() => {
    if (!compositorRef.current) return;

    try {
      const videoManager = videoManagerRef.current;
      const audioMixer = audioMixerRef.current;
      const newImageElements = new Map<string, HTMLImageElement>();
      const newAudioElements = new Map<string, HTMLAudioElement>();

      // Preload videos using video manager
      const videoItems = items
        .filter(item => item.type === 'video')
        .map(item => ({ id: item.id, url: item.url }));

      // Start loading videos in background (don't await - let it be async)
      if (videoItems.length > 0) {
        // Videos will load in background and render when ready
        videoManager.preloadVideos(videoItems).catch((error) => {
          console.error('Error preloading videos:', error);
        });
      }

    // Handle images
    items.forEach(item => {
      if (item.type === 'image') {
        // Reuse existing image element if possible
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

    // Handle audio tracks (both video audio and standalone audio)
    items.forEach(item => {
      if (item.type === 'audio') {
        // Create audio element for standalone audio tracks
        let audio = audioElementsRef.current.get(item.id);
        if (!audio || audio.src !== item.url) {
          audio = document.createElement('audio');
          audio.src = item.url;
          audio.crossOrigin = 'anonymous';
          audio.preload = 'auto';
        }
        newAudioElements.set(item.id, audio);

        // Add to audio mixer
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
      } else if (item.type === 'video' && !item.muted) {
        // Add video audio to mixer
        const managedVideo = videoManager.getVideo(item.id);
        if (managedVideo) {
          const audioTrack: AudioTrack = {
            id: `${item.id}-audio`,
            element: managedVideo.element,
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
      }
    });

    audioElementsRef.current = newAudioElements;

    // Convert timeline items to compositor layers (visual only)
    const layers: CompositorLayer[] = items
      .filter(item => item.type !== 'audio') // Audio is handled separately
      .map(item => {
        const layer: CompositorLayer = {
          id: item.id,
          type: item.type as 'video' | 'image' | 'text',
          element: null,
          startTime: item.startTime,
          duration: item.duration,
          zIndex: item.zIndex || item.track,
          position: item.position,
          opacity: item.opacity,
          text: item.text,
          transition: item.transition,
          trim: item.trim,
          speed: item.speed,
        };

        if (item.type === 'video') {
          const managedVideo = videoManager.getVideo(item.id);
          layer.element = managedVideo?.element || null;
        } else if (item.type === 'image') {
          layer.element = imageElementsRef.current.get(item.id) || null;
        }

        return layer;
      });

      compositorRef.current.setLayers(layers);
    } catch (error) {
      console.error('Error updating canvas preview items:', error);
    }
  }, [items]);

  // Sync playback state
  useEffect(() => {
    if (!compositorRef.current) return;

    const audioMixer = audioMixerRef.current;

    if (isPlaying) {
      compositorRef.current.play();
      audioMixer.play();
    } else {
      compositorRef.current.pause();
      audioMixer.pause();
    }
  }, [isPlaying]);

  // Sync current time
  useEffect(() => {
    if (!compositorRef.current || isPlaying) return;

    const audioMixer = audioMixerRef.current;

    // Only seek when not playing to avoid conflicts
    if (Math.abs(compositorRef.current.getCurrentTime() - currentTime) > 0.1) {
      compositorRef.current.seek(currentTime);
      audioMixer.seek(currentTime);
    }
  }, [currentTime, isPlaying]);

  return (
    <div className={cn('relative', className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain bg-black"
        style={{ aspectRatio: `${width}/${height}` }}
      />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-none">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-white mx-auto" />
            <p className="text-white text-sm">Initializing canvas...</p>
          </div>
        </div>
      )}
    </div>
  );
}
