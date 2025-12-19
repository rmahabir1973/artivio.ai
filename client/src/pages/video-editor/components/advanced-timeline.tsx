import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  ZoomIn,
  ZoomOut,
  Scissors,
  Link,
  Zap,
  Bookmark,
  Magnet,
  Settings,
  Video,
  Music,
  Mic,
  Type,
  Layers,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Trash2,
  GripVertical,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface VideoClip {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  prompt: string;
  createdAt: string;
  type: 'video' | 'image';
}

interface ClipSettingsLocal {
  clipId: string;
  muted: boolean;
  volume: number;
  speed: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  originalDuration?: number;
  displayDuration?: number;
}

interface ClipTransitionLocal {
  afterClipIndex: number;
  type: string;
  durationSeconds: number;
}

interface AudioTrack {
  id: string;
  url: string;
  name: string;
  type: 'music' | 'voice' | 'sfx';
  volume: number;
}

interface AdvancedTimelineProps {
  clips: VideoClip[];
  audioTracks: AudioTrack[];
  getClipSettings: (clipId: string) => ClipSettingsLocal;
  clipTransitions: ClipTransitionLocal[];
  onClipSelect: (clip: VideoClip, index: number) => void;
  onClipRemove: (clipId: string) => void;
  onClipReorder: (fromIndex: number, toIndex: number) => void;
  onTransitionEdit: (index: number) => void;
  onTransitionRemove: (index: number) => void;
  onAudioRemove: (trackId: string) => void;
  selectedClipId: string | null;
  totalDuration: number;
  currentTime: number;
  onTimeChange: (time: number) => void;
  onPlayPause: () => void;
  isPlaying: boolean;
  className?: string;
}

interface Track {
  id: string;
  type: 'video' | 'audio' | 'text' | 'effects';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  locked: boolean;
  visible: boolean;
}

const DEFAULT_TRACKS: Track[] = [
  { id: 'video-1', type: 'video', label: 'Video 1', icon: Video, color: 'blue', locked: false, visible: true },
  { id: 'video-2', type: 'video', label: 'Video 2', icon: Layers, color: 'indigo', locked: false, visible: true },
  { id: 'audio', type: 'audio', label: 'Music', icon: Music, color: 'green', locked: false, visible: true },
  { id: 'voice', type: 'audio', label: 'Voice', icon: Mic, color: 'purple', locked: false, visible: true },
  { id: 'effects', type: 'effects', label: 'Effects', icon: Sparkles, color: 'yellow', locked: false, visible: true },
  { id: 'text', type: 'text', label: 'Text', icon: Type, color: 'pink', locked: false, visible: true },
];

function TimelineToolbar({
  zoom,
  onZoomChange,
  snapEnabled,
  onSnapToggle,
  currentTime,
  totalDuration,
  isPlaying,
  onPlayPause,
  onSkipBack,
  onSkipForward,
}: {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  snapEnabled: boolean;
  onSnapToggle: () => void;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
}) {
  return (
    <div className="h-10 bg-muted/30 border-b flex items-center px-3 gap-2" data-testid="timeline-toolbar">
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onZoomChange(Math.max(0.25, zoom - 0.25))}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>

        <div className="w-24">
          <Slider
            value={[zoom]}
            min={0.25}
            max={3}
            step={0.25}
            onValueChange={([v]) => onZoomChange(v)}
            className="cursor-pointer"
            data-testid="slider-zoom"
          />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onZoomChange(Math.min(3, zoom + 0.25))}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>

        <span className="text-xs text-muted-foreground w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      <div className="h-5 w-px bg-border" />

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="button-split">
              <Scissors className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Split Clip</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="button-link">
              <Link className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Link Clips</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="button-speed">
              <Zap className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Speed</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="button-marker">
              <Bookmark className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Marker</TooltipContent>
        </Tooltip>
      </div>

      <div className="h-5 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={snapEnabled ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onSnapToggle}
            data-testid="button-snap"
          >
            <Magnet className="h-3 w-3" />
            Snap
          </Button>
        </TooltipTrigger>
        <TooltipContent>Snap to Grid</TooltipContent>
      </Tooltip>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSkipBack} data-testid="button-skip-back">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          onClick={onPlayPause}
          data-testid="button-play-pause"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSkipForward} data-testid="button-skip-forward">
          <SkipForward className="h-4 w-4" />
        </Button>

        <span className="text-xs font-mono text-muted-foreground px-2">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
      </div>
    </div>
  );
}

function TrackHeaders({
  tracks,
  onToggleLock,
  onToggleVisibility,
}: {
  tracks: Track[];
  onToggleLock: (trackId: string) => void;
  onToggleVisibility: (trackId: string) => void;
}) {
  return (
    <div className="w-36 bg-muted/20 border-r shrink-0" data-testid="track-headers">
      {tracks.map((track) => {
        const Icon = track.icon;
        return (
          <div
            key={track.id}
            className={cn(
              "h-12 flex items-center justify-between px-2 border-b group hover:bg-muted/50 transition-colors",
              !track.visible && "opacity-50"
            )}
            data-testid={`track-header-${track.id}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Icon className={cn("h-4 w-4 shrink-0", `text-${track.color}-500`)} />
              <span className="text-xs font-medium truncate">{track.label}</span>
            </div>

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => onToggleLock(track.id)}
                data-testid={`button-lock-${track.id}`}
              >
                <Lock className={cn("h-3 w-3", track.locked && "text-primary")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => onToggleVisibility(track.id)}
                data-testid={`button-visibility-${track.id}`}
              >
                {track.visible ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <EyeOff className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineRuler({ zoom, duration, pixelsPerSecond }: { zoom: number; duration: number; pixelsPerSecond: number }) {
  const majorInterval = zoom < 0.5 ? 10 : zoom < 1 ? 5 : zoom < 2 ? 2 : 1;
  const markers = [];
  const totalWidth = Math.max(duration, 60) * pixelsPerSecond;

  for (let time = 0; time <= duration + majorInterval; time += majorInterval) {
    markers.push(
      <div
        key={time}
        className="absolute top-0 bottom-0 border-l border-border/50"
        style={{ left: `${time * pixelsPerSecond}px` }}
      >
        <span className="absolute top-0 left-1 text-[10px] text-muted-foreground">
          {formatTime(time)}
        </span>
      </div>
    );
  }

  return (
    <div
      className="h-6 bg-muted/20 border-b relative"
      style={{ width: `${totalWidth}px`, minWidth: '100%' }}
      data-testid="timeline-ruler"
    >
      {markers}
    </div>
  );
}

function TimelineCanvas({
  clips,
  audioTracks,
  getClipSettings,
  clipTransitions,
  zoom,
  totalDuration,
  currentTime,
  selectedClipId,
  onClipSelect,
  onClipRemove,
  onTransitionEdit,
  onTimeChange,
  tracks,
}: {
  clips: VideoClip[];
  audioTracks: AudioTrack[];
  getClipSettings: (clipId: string) => ClipSettingsLocal;
  clipTransitions: ClipTransitionLocal[];
  zoom: number;
  totalDuration: number;
  currentTime: number;
  selectedClipId: string | null;
  onClipSelect: (clip: VideoClip, index: number) => void;
  onClipRemove: (clipId: string) => void;
  onTransitionEdit: (index: number) => void;
  onTimeChange: (time: number) => void;
  tracks: Track[];
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const pixelsPerSecond = 100 * zoom;
  const totalWidth = Math.max(totalDuration, 60) * pixelsPerSecond;

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left + canvasRef.current.scrollLeft;
      const newTime = clickX / pixelsPerSecond;
      onTimeChange(Math.max(0, Math.min(newTime, totalDuration)));
    },
    [pixelsPerSecond, totalDuration, onTimeChange]
  );

  let runningPosition = 0;
  const clipPositions = clips.map((clip, index) => {
    const settings = getClipSettings(clip.id);
    let duration: number;

    if (clip.type === 'image') {
      duration = settings.displayDuration ?? 5;
    } else {
      const originalDuration = settings.originalDuration ?? 5;
      const trimStart = settings.trimStartSeconds ?? 0;
      const trimEnd = settings.trimEndSeconds ?? originalDuration;
      const speed = settings.speed ?? 1;
      duration = (trimEnd - trimStart) / speed;
    }

    const transition = clipTransitions.find((t) => t.afterClipIndex === index - 1);
    const overlap = transition ? transition.durationSeconds : 0;

    const position = {
      clip,
      index,
      startX: Math.max(0, runningPosition - overlap) * pixelsPerSecond,
      width: duration * pixelsPerSecond,
      transition: index > 0 ? clipTransitions.find((t) => t.afterClipIndex === index - 1) : undefined,
    };

    runningPosition += duration - (index < clips.length - 1 ? 0 : 0);
    return position;
  });

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden relative" data-testid="timeline-canvas">
      <div
        ref={canvasRef}
        className="relative"
        style={{ width: `${totalWidth}px`, minWidth: '100%' }}
        onClick={handleCanvasClick}
      >
        <TimelineRuler zoom={zoom} duration={totalDuration} pixelsPerSecond={pixelsPerSecond} />

        <div className="relative" style={{ height: `${tracks.length * 48}px` }}>
          {clipPositions.map(({ clip, index, startX, width, transition }) => {
            const settings = getClipSettings(clip.id);
            const isSelected = selectedClipId === clip.id;
            const trackIndex = 0;

            return (
              <div key={clip.id}>
                {transition && (
                  <div
                    className="absolute h-10 flex items-center justify-center z-20 cursor-pointer hover:opacity-80"
                    style={{
                      left: `${startX - (transition.durationSeconds * pixelsPerSecond) / 2}px`,
                      width: `${transition.durationSeconds * pixelsPerSecond}px`,
                      top: `${trackIndex * 48 + 4}px`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTransitionEdit(transition.afterClipIndex);
                    }}
                    data-testid={`transition-${transition.afterClipIndex}`}
                  >
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                      <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                      {transition.type}
                    </Badge>
                  </div>
                )}

                <div
                  className={cn(
                    "absolute h-10 rounded cursor-pointer overflow-hidden",
                    "border-2 transition-all group",
                    isSelected
                      ? "border-primary ring-2 ring-primary/30 z-10"
                      : "border-blue-500/50 hover:border-blue-500"
                  )}
                  style={{
                    left: `${startX}px`,
                    width: `${width}px`,
                    top: `${trackIndex * 48 + 4}px`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClipSelect(clip, index);
                  }}
                  data-testid={`timeline-clip-${clip.id}`}
                >
                  {clip.thumbnailUrl || clip.url ? (
                    <div className="absolute inset-0 flex">
                      {Array.from({ length: Math.ceil(width / 60) }).map((_, i) => (
                        <img
                          key={i}
                          src={clip.thumbnailUrl || clip.url}
                          alt=""
                          className="h-full w-[60px] object-cover opacity-60"
                          style={{ minWidth: '60px' }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-blue-500/20" />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  <div className="absolute bottom-0.5 left-1 right-1 flex items-center gap-1">
                    <Badge variant="outline" className="text-[9px] h-4 px-1 bg-background/80">
                      #{index + 1}
                    </Badge>
                    {settings.muted && <VolumeX className="h-3 w-3 text-red-400" />}
                    {settings.speed !== 1 && (
                      <span className="text-[9px] text-white/80">{settings.speed}x</span>
                    )}
                  </div>

                  {isSelected && (
                    <>
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary cursor-ew-resize hover:bg-primary/80" />
                      <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-primary cursor-ew-resize hover:bg-primary/80" />
                    </>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-0.5 right-0.5 h-5 w-5 opacity-0 group-hover:opacity-100 bg-black/50 hover:bg-red-500/80"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClipRemove(clip.id);
                    }}
                    data-testid={`remove-clip-${clip.id}`}
                  >
                    <Trash2 className="h-2.5 w-2.5 text-white" />
                  </Button>
                </div>
              </div>
            );
          })}

          {audioTracks.map((track, index) => {
            const settings = getClipSettings(track.id);
            const duration = settings.originalDuration ?? 30;
            const width = duration * pixelsPerSecond;
            const trackIndex = track.type === 'music' ? 2 : 3;
            const color = track.type === 'music' ? 'green' : 'purple';

            return (
              <div
                key={track.id}
                className={cn(
                  "absolute h-10 rounded cursor-pointer overflow-hidden",
                  "border-2 transition-all",
                  `border-${color}-500/50 hover:border-${color}-500 bg-${color}-500/10`
                )}
                style={{
                  left: 0,
                  width: `${width}px`,
                  top: `${trackIndex * 48 + 4}px`,
                }}
                data-testid={`audio-track-${track.id}`}
              >
                <div className="absolute inset-0 flex items-center px-2 gap-2">
                  {track.type === 'music' ? (
                    <Music className={`h-3 w-3 text-${color}-500`} />
                  ) : (
                    <Mic className={`h-3 w-3 text-${color}-500`} />
                  )}
                  <span className="text-xs truncate text-foreground/80">{track.name}</span>
                </div>
              </div>
            );
          })}

          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none"
            style={{ left: `${currentTime * pixelsPerSecond}px` }}
            data-testid="playhead"
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdvancedTimeline({
  clips,
  audioTracks,
  getClipSettings,
  clipTransitions,
  onClipSelect,
  onClipRemove,
  onClipReorder,
  onTransitionEdit,
  onTransitionRemove,
  onAudioRemove,
  selectedClipId,
  totalDuration,
  currentTime,
  onTimeChange,
  onPlayPause,
  isPlaying,
  className,
}: AdvancedTimelineProps) {
  const [zoom, setZoom] = useState(1);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [tracks, setTracks] = useState<Track[]>(DEFAULT_TRACKS);

  const handleToggleLock = useCallback((trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t))
    );
  }, []);

  const handleToggleVisibility = useCallback((trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, visible: !t.visible } : t))
    );
  }, []);

  const handleSkipBack = useCallback(() => {
    onTimeChange(0);
  }, [onTimeChange]);

  const handleSkipForward = useCallback(() => {
    onTimeChange(totalDuration);
  }, [onTimeChange, totalDuration]);

  return (
    <div className={cn("flex flex-col bg-background", className)} data-testid="advanced-timeline">
      <TimelineToolbar
        zoom={zoom}
        onZoomChange={setZoom}
        snapEnabled={snapEnabled}
        onSnapToggle={() => setSnapEnabled((prev) => !prev)}
        currentTime={currentTime}
        totalDuration={totalDuration}
        isPlaying={isPlaying}
        onPlayPause={onPlayPause}
        onSkipBack={handleSkipBack}
        onSkipForward={handleSkipForward}
      />

      <div className="flex-1 flex overflow-hidden">
        <TrackHeaders
          tracks={tracks}
          onToggleLock={handleToggleLock}
          onToggleVisibility={handleToggleVisibility}
        />

        <TimelineCanvas
          clips={clips}
          audioTracks={audioTracks}
          getClipSettings={getClipSettings}
          clipTransitions={clipTransitions}
          zoom={zoom}
          totalDuration={totalDuration}
          currentTime={currentTime}
          selectedClipId={selectedClipId}
          onClipSelect={onClipSelect}
          onClipRemove={onClipRemove}
          onTransitionEdit={onTransitionEdit}
          onTimeChange={onTimeChange}
          tracks={tracks}
        />
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export type { VideoClip, ClipSettingsLocal, ClipTransitionLocal, AudioTrack, AdvancedTimelineProps };
