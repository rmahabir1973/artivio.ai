import { useRef, useEffect, useCallback, useState } from 'react';
import { CanvasCompositor, CompositorLayer } from '@/lib/canvas-compositor';
import { WebCodecsVideoManager, VideoConfig } from '@/lib/webcodecs-video-manager';
import { AudioMixer, AudioTrack } from '@/lib/audio-mixer';
import { cn } from '@/lib/utils';
import { MultiTrackTimelineItem } from '@/pages/video-editor/components/multi-track-timeline';
import { Loader2 } from 'lucide-react';

interface CanvasPreviewWebCodecsProps {
  items: MultiTrackTimelineItem[];
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate?: (time: number) => void;
  width?: number;
  height?: number;
  className?: string;
}

export function CanvasPreviewWebCodecs({
  items,
  currentTime,
  isPlaying,
  onTimeUpdate,
  width = 1920,
  height = 1080,
  className,
}: CanvasPreviewWebCodecsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositorRef = useRef<CanvasCompositor | null>(null);
  const videoManagerRef = useRef<WebCodecsVideoManager>(new WebCodecsVideoManager());
  const audioMixerRef = useRef<AudioMixer>(new AudioMixer());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const frameRequestRef = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });

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

  // Load videos using WebCodecs
  useEffect(() => {
    if (!compositorRef.current) return;

    const videoManager = videoManagerRef.current;
    const audioMixer = audioMixerRef.current;
    const newImageElements = new Map<string, HTMLImageElement>();
    const newAudioElements = new Map<string, HTMLAudioElement>();

    // Extract video items
    const videoItems = items.filter(item => item.type === 'video');

    // Load videos in background
    const loadVideos = async () => {
      if (videoItems.length === 0) return;

      setLoadingProgress({ loaded: 0, total: videoItems.length });

      let loaded = 0;
      for (const item of videoItems) {
        try {
          const config: VideoConfig = {
            id: item.id,
            url: item.url,
            trimStart: item.trim?.start,
            trimEnd: item.trim?.end,
          };

          await videoManager.loadVideo(config);
          loaded++;
          setLoadingProgress({ loaded, total: videoItems.length });
        } catch (error) {
          console.error('Failed to load video with WebCodecs:', item.url, error);
        }
      }
    };

    loadVideos().catch(console.error);

    // Handle images
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

  // Custom render loop for WebCodecs frames
  const renderFrame = useCallback(() => {
    if (!compositorRef.current) return;

    const videoManager = videoManagerRef.current;

    // Get current frames from WebCodecs for each video
    const layers: CompositorLayer[] = items
      .filter(item => item.type !== 'audio')
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
          useWebCodecs: item.type === 'video',
        };

        if (item.type === 'video') {
          // Get current frame from WebCodecs
          const timeInClip = currentTime - item.startTime;
          if (timeInClip >= 0 && timeInClip <= item.duration) {
            const speed = item.speed || 1;
            const trimStart = item.trim?.start || 0;
            const localTime = trimStart + (timeInClip * speed);

            const frame = videoManager.getFrame(item.id, localTime);
            layer.element = frame;
          }
        } else if (item.type === 'image') {
          layer.element = imageElementsRef.current.get(item.id) || null;
        }

        return layer;
      });

    compositorRef.current.setLayers(layers);

    // Continue frame rendering loop if playing
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

      // Start custom render loop for WebCodecs frames
      renderFrame();
    } else {
      compositorRef.current.pause();
      audioMixer.pause();

      // Cancel frame rendering loop
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

  // Sync current time and buffer frames
  useEffect(() => {
    if (!compositorRef.current || isPlaying) return;

    const videoManager = videoManagerRef.current;
    const audioMixer = audioMixerRef.current;

    // Only seek when not playing to avoid conflicts
    if (Math.abs(compositorRef.current.getCurrentTime() - currentTime) > 0.1) {
      compositorRef.current.seek(currentTime);
      audioMixer.seek(currentTime);

      // Seek WebCodecs videos and buffer frames
      const videoItems = items
        .filter(item => item.type === 'video')
        .map(item => ({
          id: item.id,
          startTime: item.startTime,
          duration: item.duration,
          trim: item.trim,
          speed: item.speed,
        }));

      videoManager.seekAll(currentTime, videoItems).then(() => {
        // Trigger a render after seeking
        renderFrame();
      }).catch(console.error);

      // Pre-buffer frames for smooth playback
      videoManager.bufferAround(currentTime, videoItems).catch(console.error);
    }
  }, [currentTime, isPlaying, items, renderFrame]);

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
            <p className="text-white text-sm">Initializing WebCodecs canvas...</p>
          </div>
        </div>
      )}
      {isReady && loadingProgress.total > 0 && loadingProgress.loaded < loadingProgress.total && (
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              Loading videos: {loadingProgress.loaded}/{loadingProgress.total}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
