import { useRef, useState, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export interface TimelineItem {
  id: string;
  type: 'video' | 'image' | 'text' | 'audio';
  track: number;
  startTime: number;
  duration: number;
  url: string;
  zIndex?: number;
  trim?: { start: number; end: number };
  transition?: {
    type: 'fade' | 'crossfade' | 'wipe' | 'dissolve' | 'radial' | 'circleopen' | 'slide' | 'pixelize';
    duration: number;
  };
  text?: {
    content: string;
    fontSize: number;
    color: string;
    position: { x: number; y: number };
    fontFamily?: string;
  };
  volume?: number;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  opacity?: number;
  rotation?: number;
  filter?: string;
}

export interface Timeline {
  items: TimelineItem[];
  duration: number;
  resolution: { width: number; height: number };
  fps: number;
}

interface UseFFmpegOptions {
  onLog?: (message: string) => void;
  onProgress?: (progress: number) => void;
}

export function useFFmpeg(options: UseFFmpegOptions = {}) {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadFFmpeg = useCallback(async () => {
    if (loaded || loading) return;
    
    setLoading(true);
    setError(null);

    try {
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      ffmpeg.on('log', ({ message }) => {
        options.onLog?.(message);
        console.log('[FFmpeg]', message);
      });

      ffmpeg.on('progress', ({ progress: p }) => {
        const progressPercent = Math.round(p * 100);
        setProgress(progressPercent);
        options.onProgress?.(progressPercent);
      });

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      setLoaded(true);
      console.log('[FFmpeg] Loaded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load FFmpeg';
      setError(errorMessage);
      console.error('[FFmpeg] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [loaded, loading, options]);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setProgress(0);
  }, []);

  const generatePreview = useCallback(async (
    timeline: Timeline,
    previewDuration: number = 10
  ): Promise<string | null> => {
    if (!ffmpegRef.current || !loaded) {
      console.error('[FFmpeg] Not loaded');
      return null;
    }

    const ffmpeg = ffmpegRef.current;
    abortControllerRef.current = new AbortController();

    try {
      setProgress(0);
      setError(null);

      const videoItems = timeline.items.filter(
        item => item.type === 'video' || item.type === 'image'
      ).slice(0, 5);

      if (videoItems.length === 0) {
        throw new Error('No video or image items in timeline');
      }

      for (let i = 0; i < videoItems.length; i++) {
        const item = videoItems[i];
        const ext = item.type === 'video' ? 'mp4' : 'png';
        const fileName = `input_${i}.${ext}`;
        
        console.log(`[FFmpeg] Downloading ${item.url}...`);
        const data = await fetchFile(item.url);
        await ffmpeg.writeFile(fileName, data);
        console.log(`[FFmpeg] Written ${fileName}`);
      }

      const { filterComplex, inputArgs, outputMap } = buildFilterComplex(
        videoItems,
        timeline.resolution,
        previewDuration
      );

      const args = [
        ...inputArgs,
        '-filter_complex', filterComplex,
        '-map', outputMap,
        '-t', String(previewDuration),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-vf', `scale=${Math.min(timeline.resolution.width, 1280)}:${Math.min(timeline.resolution.height, 720)}`,
        '-movflags', '+faststart',
        '-an',
        'preview.mp4'
      ];

      console.log('[FFmpeg] Running preview generation:', args.join(' '));
      await ffmpeg.exec(args);

      const data = await ffmpeg.readFile('preview.mp4');
      const blob = new Blob([data], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      for (let i = 0; i < videoItems.length; i++) {
        const ext = videoItems[i].type === 'video' ? 'mp4' : 'png';
        try {
          await ffmpeg.deleteFile(`input_${i}.${ext}`);
        } catch {}
      }
      try {
        await ffmpeg.deleteFile('preview.mp4');
      } catch {}

      console.log('[FFmpeg] Preview generated successfully');
      return url;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Preview generation failed';
      setError(errorMessage);
      console.error('[FFmpeg] Preview error:', err);
      return null;
    }
  }, [loaded]);

  const processTimeline = useCallback(async (
    timeline: Timeline,
    quality: 'preview' | 'high' = 'preview'
  ): Promise<string | null> => {
    if (!ffmpegRef.current || !loaded) {
      console.error('[FFmpeg] Not loaded');
      return null;
    }

    const ffmpeg = ffmpegRef.current;
    abortControllerRef.current = new AbortController();

    try {
      setProgress(0);
      setError(null);

      const videoItems = timeline.items.filter(
        item => item.type === 'video' || item.type === 'image'
      );

      if (videoItems.length === 0) {
        throw new Error('No video or image items in timeline');
      }

      for (let i = 0; i < videoItems.length; i++) {
        const item = videoItems[i];
        const ext = item.type === 'video' ? 'mp4' : 'png';
        const fileName = `input_${i}.${ext}`;
        
        console.log(`[FFmpeg] Downloading ${item.url}...`);
        const data = await fetchFile(item.url);
        await ffmpeg.writeFile(fileName, data);
      }

      const { filterComplex, inputArgs, outputMap } = buildFilterComplex(
        videoItems,
        timeline.resolution,
        timeline.duration
      );

      const preset = quality === 'high' ? 'slow' : 'ultrafast';
      const crf = quality === 'high' ? '18' : '28';

      const args = [
        ...inputArgs,
        '-filter_complex', filterComplex,
        '-map', outputMap,
        '-c:v', 'libx264',
        '-preset', preset,
        '-crf', crf,
        '-movflags', '+faststart',
        '-an',
        'output.mp4'
      ];

      console.log('[FFmpeg] Processing timeline:', args.join(' '));
      await ffmpeg.exec(args);

      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      for (let i = 0; i < videoItems.length; i++) {
        const ext = videoItems[i].type === 'video' ? 'mp4' : 'png';
        try {
          await ffmpeg.deleteFile(`input_${i}.${ext}`);
        } catch {}
      }
      try {
        await ffmpeg.deleteFile('output.mp4');
      } catch {}

      console.log('[FFmpeg] Timeline processed successfully');
      return url;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Timeline processing failed';
      setError(errorMessage);
      console.error('[FFmpeg] Process error:', err);
      return null;
    }
  }, [loaded]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    loaded,
    loading,
    progress,
    error,
    loadFFmpeg,
    generatePreview,
    processTimeline,
    cancel,
  };
}

function buildFilterComplex(
  items: TimelineItem[],
  resolution: { width: number; height: number },
  _duration: number
): { filterComplex: string; inputArgs: string[]; outputMap: string } {
  const filters: string[] = [];
  const inputArgs: string[] = [];

  items.forEach((item, idx) => {
    const ext = item.type === 'video' ? 'mp4' : 'png';
    inputArgs.push('-i', `input_${idx}.${ext}`);

    if (item.type === 'image') {
      filters.push(
        `[${idx}:v]loop=loop=-1:size=1:start=0,` +
        `trim=duration=${item.duration},` +
        `scale=${resolution.width}:${resolution.height}:` +
        `force_original_aspect_ratio=decrease,` +
        `pad=${resolution.width}:${resolution.height}:(ow-iw)/2:(oh-ih)/2,` +
        `setsar=1,fps=30[v${idx}]`
      );
    } else {
      const trimFilter = item.trim
        ? `trim=start=${item.trim.start}:end=${item.trim.end},setpts=PTS-STARTPTS,`
        : '';
      
      filters.push(
        `[${idx}:v]${trimFilter}` +
        `scale=${resolution.width}:${resolution.height}:` +
        `force_original_aspect_ratio=decrease,` +
        `pad=${resolution.width}:${resolution.height}:(ow-iw)/2:(oh-ih)/2,` +
        `setsar=1,fps=30[v${idx}]`
      );
    }
  });

  if (items.length === 1) {
    filters.push(`[v0]format=yuv420p[outv]`);
  } else {
    let currentInput = 'v0';
    let offset = items[0].duration;

    for (let i = 1; i < items.length; i++) {
      const item = items[i];
      const outputLabel = i === items.length - 1 ? 'merged' : `m${i}`;
      
      if (item.transition?.type && item.transition.duration > 0) {
        const transitionType = mapTransitionType(item.transition.type);
        const transitionDuration = Math.min(item.transition.duration, offset, item.duration);
        const transitionOffset = Math.max(0, offset - transitionDuration);
        
        filters.push(
          `[${currentInput}][v${i}]xfade=transition=${transitionType}:` +
          `duration=${transitionDuration}:offset=${transitionOffset}[${outputLabel}]`
        );
        offset = transitionOffset + item.duration;
      } else {
        filters.push(
          `[${currentInput}][v${i}]concat=n=2:v=1:a=0[${outputLabel}]`
        );
        offset += item.duration;
      }
      
      currentInput = outputLabel;
    }

    filters.push(`[${currentInput}]format=yuv420p[outv]`);
  }

  return {
    filterComplex: filters.join(';'),
    inputArgs,
    outputMap: '[outv]',
  };
}

function mapTransitionType(type: string): string {
  const transitionMap: Record<string, string> = {
    'fade': 'fade',
    'crossfade': 'fade',
    'wipe': 'wipeleft',
    'dissolve': 'dissolve',
    'radial': 'radial',
    'circleopen': 'circleopen',
    'slide': 'slideleft',
    'pixelize': 'pixelize',
  };
  return transitionMap[type] || 'fade';
}

export default useFFmpeg;
