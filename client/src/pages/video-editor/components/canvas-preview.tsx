import { useRef, useEffect, useCallback, useState } from 'react';
import { CanvasCompositor, CompositorLayer } from '@/lib/canvas-compositor';
import { VideoManager } from '@/lib/video-manager';
import { AudioMixer, AudioTrack } from '@/lib/audio-mixer';
import { cn } from '@/lib/utils';
import { MultiTrackTimelineItem } from '@/pages/video-editor/components/multi-track-timeline';
import { Loader2 } from 'lucide-react';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositorRef = useRef<CanvasCompositor | null>(null);
  const videoManagerRef = useRef<VideoManager>(new VideoManager());
  const audioMixerRef = useRef<AudioMixer>(new AudioMixer());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const [isReady, setIsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0, percentage: 0 });

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
        fps: 30,
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

      videoManager.preloadVideos(videoItems).then(() => {
        const progress = videoManager.getLoadingProgress();
        setLoadingProgress(progress);
      }).catch((error) => {
        console.error('Error preloading videos:', error);
      });

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

    // Update loading progress periodically
    const progressInterval = setInterval(() => {
      const progress = videoManager.getLoadingProgress();
      setLoadingProgress(progress);
      if (progress.percentage === 100) {
        clearInterval(progressInterval);
      }
    }, 200);

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

      return () => {
        clearInterval(progressInterval);
      };
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-white mx-auto" />
            <p className="text-white text-sm">Initializing canvas...</p>
          </div>
        </div>
      )}
      {isReady && loadingProgress.percentage < 100 && loadingProgress.total > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-white mx-auto" />
            <p className="text-white text-sm">
              Loading videos: {loadingProgress.loaded} / {loadingProgress.total}
            </p>
            <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden mx-auto">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${loadingProgress.percentage}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
