import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragMoveEvent,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import {
  ZoomIn,
  ZoomOut,
  Scissors,
  Magnet,
  Video,
  Music,
  Mic,
  Type,
  Layers,
  Sparkles,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  Copy,
  ChevronLeft,
  ChevronRight,
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
  onClipSettingsChange?: (clipId: string, settings: Partial<ClipSettingsLocal>) => void;
  selectedClipId: string | null;
  totalDuration: number;
  currentTime: number;
  onTimeChange: (time: number) => void;
  onPlayPause: () => void;
  isPlaying: boolean;
  className?: string;
}

const TRACK_HEIGHT = 48;
const MIN_CLIP_WIDTH = 40;
const PIXELS_PER_SECOND_BASE = 100;

interface TrackConfig {
  id: string;
  type: 'video' | 'audio';
  label: string;
  icon: React.FC<{ className?: string }>;
  color: string;
}

const TRACK_CONFIG: TrackConfig[] = [
  { id: 'video-1', type: 'video', label: 'Video 1', icon: Video, color: 'bg-blue-500/20 border-blue-500/50' },
  { id: 'audio-music', type: 'audio', label: 'Music', icon: Music, color: 'bg-green-500/20 border-green-500/50' },
  { id: 'audio-voice', type: 'audio', label: 'Voice', icon: Mic, color: 'bg-purple-500/20 border-purple-500/50' },
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);
  return `${mins}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

function formatTimeShort(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface ClipPosition {
  clip: VideoClip;
  index: number;
  startTime: number;
  duration: number;
  left: number;
  width: number;
  settings: ClipSettingsLocal;
}

interface TimelineClipProps {
  position: ClipPosition;
  pixelsPerSecond: number;
  isSelected: boolean;
  onSelect: (clip: VideoClip, index: number, addToSelection: boolean) => void;
  onRemove: (clipId: string) => void;
  onDuplicate: (clip: VideoClip, index: number) => void;
  onTrimChange: (clipId: string, trimStart: number, trimEnd: number) => void;
}

function TimelineClipItem({
  position,
  pixelsPerSecond,
  isSelected,
  onSelect,
  onRemove,
  onDuplicate,
  onTrimChange,
}: TimelineClipProps) {
  const { clip, index, left, width, settings } = position;
  const [isTrimming, setIsTrimming] = useState<'left' | 'right' | null>(null);
  const trimStartRef = useRef({ x: 0, trimStart: 0, trimEnd: 0 });
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: clip.id,
    data: { clip, index, type: 'clip' },
    disabled: isTrimming !== null,
  });
  
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${left}px`,
    width: `${Math.max(MIN_CLIP_WIDTH, width)}px`,
    height: `${TRACK_HEIGHT - 8}px`,
    top: '4px',
    transform: transform ? `translate3d(${transform.x}px, 0, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isSelected ? 20 : isDragging ? 30 : 10,
    cursor: isTrimming ? 'ew-resize' : 'grab',
  };
  
  const handleTrimMouseDown = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    setIsTrimming(side);
    
    const originalDuration = settings.originalDuration ?? 5;
    trimStartRef.current = {
      x: e.clientX,
      trimStart: settings.trimStartSeconds ?? 0,
      trimEnd: settings.trimEndSeconds ?? originalDuration,
    };
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - trimStartRef.current.x;
      const deltaSeconds = deltaX / pixelsPerSecond;
      const originalDur = settings.originalDuration ?? 5;
      
      if (side === 'left') {
        const newTrimStart = Math.max(0, Math.min(
          trimStartRef.current.trimStart + deltaSeconds,
          trimStartRef.current.trimEnd - 0.1
        ));
        onTrimChange(clip.id, newTrimStart, trimStartRef.current.trimEnd);
      } else {
        const newTrimEnd = Math.max(
          trimStartRef.current.trimStart + 0.1,
          Math.min(trimStartRef.current.trimEnd + deltaSeconds, originalDur)
        );
        onTrimChange(clip.id, trimStartRef.current.trimStart, newTrimEnd);
      }
    };
    
    const handleMouseUp = () => {
      setIsTrimming(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(clip, index, e.shiftKey);
  };
  
  const thumbnailCount = Math.max(1, Math.ceil(width / 60));
  
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={cn(
            "rounded overflow-hidden border-2 transition-colors group",
            clip.type === 'video' ? "bg-blue-500/20 border-blue-500/50" : "bg-indigo-500/20 border-indigo-500/50",
            isSelected && "border-primary ring-2 ring-primary/30"
          )}
          onClick={handleClick}
          {...(isTrimming === null ? { ...listeners, ...attributes } : {})}
          data-testid={`timeline-clip-${clip.id}`}
        >
          {(clip.thumbnailUrl || clip.url) && (
            <div className="absolute inset-0 flex overflow-hidden">
              {Array.from({ length: thumbnailCount }).map((_, i) => (
                <img
                  key={i}
                  src={clip.thumbnailUrl || clip.url}
                  alt=""
                  className="h-full w-[60px] object-cover opacity-50 shrink-0"
                  draggable={false}
                />
              ))}
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between gap-1">
            <Badge variant="outline" className="text-[9px] h-4 px-1 bg-background/80">
              #{index + 1}
            </Badge>
            <div className="flex items-center gap-0.5">
              {settings.muted && <VolumeX className="h-2.5 w-2.5 text-red-400" />}
              {settings.speed !== 1 && (
                <span className="text-[9px] text-white/80 bg-black/40 px-0.5 rounded">
                  {settings.speed}x
                </span>
              )}
              <span className="text-[9px] text-white/70">
                {formatTimeShort(position.duration)}
              </span>
            </div>
          </div>
          
          {isSelected && clip.type === 'video' && (
            <>
              <div
                className="absolute left-0 top-0 bottom-0 w-2 bg-primary/80 cursor-ew-resize hover:bg-primary flex items-center justify-center"
                onMouseDown={(e) => handleTrimMouseDown(e, 'left')}
                data-testid={`trim-left-${clip.id}`}
              >
                <div className="w-0.5 h-3 bg-white/60 rounded-full" />
              </div>
              <div
                className="absolute right-0 top-0 bottom-0 w-2 bg-primary/80 cursor-ew-resize hover:bg-primary flex items-center justify-center"
                onMouseDown={(e) => handleTrimMouseDown(e, 'right')}
                data-testid={`trim-right-${clip.id}`}
              >
                <div className="w-0.5 h-3 bg-white/60 rounded-full" />
              </div>
            </>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-0.5 right-0.5 h-5 w-5 opacity-0 group-hover:opacity-100 bg-black/50 hover:bg-red-500/80"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(clip.id);
            }}
            data-testid={`delete-clip-${clip.id}`}
          >
            <Trash2 className="h-2.5 w-2.5 text-white" />
          </Button>
        </div>
      </ContextMenuTrigger>
      
      <ContextMenuContent data-testid={`context-menu-${clip.id}`}>
        <ContextMenuItem onClick={() => onDuplicate(clip, index)} data-testid="context-duplicate">
          <Copy className="h-4 w-4 mr-2" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onRemove(clip.id)} className="text-red-500" data-testid="context-delete">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface AudioTrackItemProps {
  track: AudioTrack;
  pixelsPerSecond: number;
  totalDuration: number;
  onRemove: (trackId: string) => void;
}

function AudioTrackItem({ track, pixelsPerSecond, totalDuration, onRemove }: AudioTrackItemProps) {
  const width = Math.max(MIN_CLIP_WIDTH, totalDuration * pixelsPerSecond);
  const color = track.type === 'music' ? 'bg-green-500/20 border-green-500/50' : 'bg-purple-500/20 border-purple-500/50';
  
  return (
    <div
      className={cn(
        "absolute top-1 rounded border-2 h-10 flex items-center px-2 gap-2 group",
        color
      )}
      style={{ left: 0, width: `${width}px` }}
      data-testid={`audio-track-${track.id}`}
    >
      {track.type === 'music' ? (
        <Music className="h-3 w-3 text-green-500 shrink-0" />
      ) : (
        <Mic className="h-3 w-3 text-purple-500 shrink-0" />
      )}
      <span className="text-xs truncate text-foreground/80">{track.name}</span>
      <span className="text-[9px] text-muted-foreground ml-auto">
        {Math.round(track.volume * 100)}%
      </span>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 group-hover:opacity-100 bg-black/50 hover:bg-red-500/80 shrink-0"
        onClick={() => onRemove(track.id)}
        data-testid={`delete-audio-${track.id}`}
      >
        <Trash2 className="h-2.5 w-2.5 text-white" />
      </Button>
    </div>
  );
}

interface TimelineRulerProps {
  duration: number;
  pixelsPerSecond: number;
  zoom: number;
}

function TimelineRuler({ duration, pixelsPerSecond, zoom }: TimelineRulerProps) {
  const majorInterval = zoom < 0.5 ? 10 : zoom < 1 ? 5 : zoom < 2 ? 2 : 1;
  const minorInterval = majorInterval / 4;
  const markers: JSX.Element[] = [];
  const totalWidth = Math.max(duration + 10, 60) * pixelsPerSecond;
  
  for (let time = 0; time <= duration + majorInterval; time += minorInterval) {
    const isMajor = Math.abs(time % majorInterval) < 0.01;
    markers.push(
      <div
        key={time}
        className={cn(
          "absolute top-0",
          isMajor ? "h-full border-l border-border/60" : "h-2 border-l border-border/30"
        )}
        style={{ left: `${time * pixelsPerSecond}px` }}
      >
        {isMajor && (
          <span className="absolute top-0.5 left-1 text-[10px] text-muted-foreground whitespace-nowrap">
            {formatTimeShort(time)}
          </span>
        )}
      </div>
    );
  }
  
  return (
    <div
      className="h-6 bg-muted/20 border-b relative shrink-0"
      style={{ width: `${totalWidth}px`, minWidth: '100%' }}
      data-testid="timeline-ruler"
    >
      {markers}
    </div>
  );
}

interface PlayheadProps {
  currentTime: number;
  pixelsPerSecond: number;
  onTimeChange: (time: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  totalDuration: number;
}

function Playhead({ currentTime, pixelsPerSecond, onTimeChange, containerRef, totalDuration }: PlayheadProps) {
  const [isDragging, setIsDragging] = useState(false);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scrollLeft = containerRef.current.scrollLeft;
      const x = moveEvent.clientX - rect.left + scrollLeft;
      const newTime = Math.max(0, Math.min(x / pixelsPerSecond, totalDuration));
      onTimeChange(newTime);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  return (
    <div
      className="absolute top-0 bottom-0 z-50 pointer-events-none"
      style={{ left: `${currentTime * pixelsPerSecond}px` }}
      data-testid="playhead"
    >
      <div
        className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 cursor-grab pointer-events-auto hover:scale-110 transition-transform"
        style={{
          clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)',
        }}
        onMouseDown={handleMouseDown}
        data-testid="playhead-handle"
      />
      <div className="w-0.5 h-full bg-red-500 -translate-x-1/2" />
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
  onClipSettingsChange,
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
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [trackVisibility, setTrackVisibility] = useState<Record<string, boolean>>({
    'video-1': true,
    'audio-music': true,
    'audio-voice': true,
  });
  const [trackLocked, setTrackLocked] = useState<Record<string, boolean>>({});
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );
  
  useEffect(() => {
    if (selectedClipId) {
      setSelectedClipIds(new Set([selectedClipId]));
    } else {
      setSelectedClipIds(new Set());
    }
  }, [selectedClipId]);
  
  const pixelsPerSecond = PIXELS_PER_SECOND_BASE * zoom;
  const effectiveDuration = Math.max(totalDuration, 10);
  const totalWidth = (effectiveDuration + 10) * pixelsPerSecond;
  
  const clipPositions = useMemo((): ClipPosition[] => {
    let runningTime = 0;
    return clips.map((clip, index) => {
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
      
      const transition = clipTransitions.find(t => t.afterClipIndex === index - 1);
      const overlap = transition ? transition.durationSeconds : 0;
      
      const startTime = Math.max(0, runningTime - overlap);
      const left = startTime * pixelsPerSecond;
      const width = duration * pixelsPerSecond;
      
      runningTime += duration;
      
      return { clip, index, startTime, duration, left, width, settings };
    });
  }, [clips, getClipSettings, clipTransitions, pixelsPerSecond]);
  
  const handleClipSelect = useCallback((clip: VideoClip, index: number, addToSelection: boolean) => {
    if (addToSelection) {
      setSelectedClipIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(clip.id)) {
          newSet.delete(clip.id);
        } else {
          newSet.add(clip.id);
        }
        return newSet;
      });
    } else {
      setSelectedClipIds(new Set([clip.id]));
    }
    onClipSelect(clip, index);
  }, [onClipSelect]);
  
  const handleDuplicate = useCallback((clip: VideoClip, index: number) => {
  }, []);
  
  const handleTrimChange = useCallback((clipId: string, trimStart: number, trimEnd: number) => {
    if (onClipSettingsChange) {
      onClipSettingsChange(clipId, {
        trimStartSeconds: trimStart,
        trimEndSeconds: trimEnd,
      });
    }
  }, [onClipSettingsChange]);
  
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveClipId(event.active.id as string);
  }, []);
  
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event;
    setActiveClipId(null);
    
    if (Math.abs(delta.x) < 5) return;
    
    const clipId = active.id as string;
    const clipIndex = clips.findIndex(c => c.id === clipId);
    if (clipIndex === -1) return;
    
    const currentPosition = clipPositions[clipIndex];
    if (!currentPosition) return;
    
    const deltaSeconds = delta.x / pixelsPerSecond;
    const newStartTime = Math.max(0, currentPosition.startTime + deltaSeconds);
    
    let targetIndex = clipIndex;
    for (let i = 0; i < clipPositions.length; i++) {
      if (i === clipIndex) continue;
      const pos = clipPositions[i];
      if (newStartTime < pos.startTime + pos.duration / 2) {
        targetIndex = i < clipIndex ? i : i;
        break;
      }
      targetIndex = i + 1;
    }
    
    if (targetIndex > clipIndex) targetIndex--;
    
    if (targetIndex !== clipIndex) {
      onClipReorder(clipIndex, targetIndex);
    }
  }, [clips, clipPositions, pixelsPerSecond, onClipReorder]);
  
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('[data-testid^="timeline-clip-"]') || 
        target.closest('[data-testid^="audio-track-"]')) {
      return;
    }
    
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    const x = e.clientX - rect.left + scrollLeft;
    
    const newTime = Math.max(0, Math.min(x / pixelsPerSecond, effectiveDuration));
    onTimeChange(newTime);
    
    setSelectedClipIds(new Set());
  }, [pixelsPerSecond, effectiveDuration, onTimeChange]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      
      switch (e.key) {
        case ' ':
          e.preventDefault();
          onPlayPause();
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          selectedClipIds.forEach(id => onClipRemove(id));
          setSelectedClipIds(new Set());
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onTimeChange(Math.max(0, currentTime - (e.shiftKey ? 1 : 1/30)));
          break;
        case 'ArrowRight':
          e.preventDefault();
          onTimeChange(Math.min(effectiveDuration, currentTime + (e.shiftKey ? 1 : 1/30)));
          break;
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setSelectedClipIds(new Set(clips.map(c => c.id)));
          }
          break;
        case 'Escape':
          setSelectedClipIds(new Set());
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPlayPause, onTimeChange, currentTime, effectiveDuration, selectedClipIds, onClipRemove, clips]);
  
  const activeClip = activeClipId ? clips.find(c => c.id === activeClipId) : null;
  const activeClipPosition = activeClipId ? clipPositions.find(p => p.clip.id === activeClipId) : null;
  
  const musicTracks = audioTracks.filter(t => t.type === 'music');
  const voiceTracks = audioTracks.filter(t => t.type === 'voice' || t.type === 'sfx');
  
  return (
    <div className={cn("flex flex-col bg-background h-full", className)} data-testid="advanced-timeline">
      <div className="h-10 bg-muted/30 border-b flex items-center px-3 gap-2 shrink-0" data-testid="timeline-toolbar">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
                data-testid="button-zoom-out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out</TooltipContent>
          </Tooltip>
          
          <div className="w-20">
            <Slider
              value={[zoom]}
              min={0.25}
              max={3}
              step={0.25}
              onValueChange={([v]) => setZoom(v)}
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
                onClick={() => setZoom(z => Math.min(3, z + 0.25))}
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
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={snapEnabled ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setSnapEnabled(!snapEnabled)}
              data-testid="button-snap"
            >
              <Magnet className="h-3 w-3" />
              Snap
            </Button>
          </TooltipTrigger>
          <TooltipContent>Magnetic Snapping</TooltipContent>
        </Tooltip>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onTimeChange(0)} data-testid="button-skip-back">
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onTimeChange(Math.max(0, currentTime - 1))} data-testid="button-step-back">
            <ChevronLeft className="h-4 w-4" />
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
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onTimeChange(currentTime + 1)} data-testid="button-step-forward">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onTimeChange(effectiveDuration)} data-testid="button-skip-forward">
            <SkipForward className="h-4 w-4" />
          </Button>
          
          <div className="h-5 w-px bg-border" />
          
          <span className="text-xs font-mono text-muted-foreground min-w-[100px] text-center">
            {formatTime(currentTime)} / {formatTime(effectiveDuration)}
          </span>
          
          <div className="h-5 w-px bg-border" />
          
          <Badge variant="secondary" className="text-xs">
            {clips.length} clips
          </Badge>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden" data-testid="timeline-content">
        <div className="w-28 bg-muted/20 border-r shrink-0 flex flex-col" data-testid="track-headers">
          <div className="h-6 border-b bg-muted/10 flex items-center px-2">
            <span className="text-[10px] text-muted-foreground">Tracks</span>
          </div>
          
          {TRACK_CONFIG.map((config) => {
            const Icon = config.icon;
            const isVisible = trackVisibility[config.id] !== false;
            const isLocked = trackLocked[config.id] === true;
            
            return (
              <div
                key={config.id}
                className={cn(
                  "flex items-center justify-between px-2 border-b group hover:bg-muted/50 transition-colors",
                  !isVisible && "opacity-50"
                )}
                style={{ height: TRACK_HEIGHT }}
                data-testid={`track-header-${config.id}`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium truncate">{config.label}</span>
                </div>
                
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => setTrackLocked(prev => ({ ...prev, [config.id]: !prev[config.id] }))}
                    data-testid={`button-lock-${config.id}`}
                  >
                    {isLocked ? <Lock className="h-3 w-3 text-primary" /> : <Unlock className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => setTrackVisibility(prev => ({ ...prev, [config.id]: !prev[config.id] }))}
                    data-testid={`button-visibility-${config.id}`}
                  >
                    {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-auto"
            onClick={handleCanvasClick}
            data-testid="timeline-scroll-container"
          >
            <div
              className="relative"
              style={{ width: `${totalWidth}px`, minWidth: '100%' }}
              data-testid="timeline-canvas"
            >
              <TimelineRuler
                duration={effectiveDuration}
                pixelsPerSecond={pixelsPerSecond}
                zoom={zoom}
              />
              
              <div className="relative">
                <div
                  className="relative border-b border-border/30"
                  style={{ height: TRACK_HEIGHT }}
                  data-testid="track-video-1"
                >
                  {trackVisibility['video-1'] !== false && clipPositions.map((position) => (
                    <TimelineClipItem
                      key={position.clip.id}
                      position={position}
                      pixelsPerSecond={pixelsPerSecond}
                      isSelected={selectedClipIds.has(position.clip.id)}
                      onSelect={handleClipSelect}
                      onRemove={onClipRemove}
                      onDuplicate={handleDuplicate}
                      onTrimChange={handleTrimChange}
                    />
                  ))}
                  
                  {clipTransitions.map((transition, idx) => {
                    const afterClip = clipPositions[transition.afterClipIndex];
                    const nextClip = clipPositions[transition.afterClipIndex + 1];
                    if (!afterClip || !nextClip) return null;
                    
                    const transitionCenter = afterClip.left + afterClip.width;
                    const transitionWidth = transition.durationSeconds * pixelsPerSecond;
                    
                    return (
                      <div
                        key={`transition-${idx}`}
                        className="absolute h-6 flex items-center justify-center cursor-pointer hover:opacity-80 z-30"
                        style={{
                          left: `${transitionCenter - transitionWidth / 2}px`,
                          width: `${transitionWidth}px`,
                          top: `${TRACK_HEIGHT / 2 - 12}px`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTransitionEdit(transition.afterClipIndex);
                        }}
                        data-testid={`transition-${transition.afterClipIndex}`}
                      >
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5 gap-0.5">
                          <Sparkles className="h-2.5 w-2.5" />
                          {transition.type}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
                
                <div
                  className="relative border-b border-border/30"
                  style={{ height: TRACK_HEIGHT }}
                  data-testid="track-audio-music"
                >
                  {trackVisibility['audio-music'] !== false && musicTracks.map((track) => (
                    <AudioTrackItem
                      key={track.id}
                      track={track}
                      pixelsPerSecond={pixelsPerSecond}
                      totalDuration={effectiveDuration}
                      onRemove={onAudioRemove}
                    />
                  ))}
                </div>
                
                <div
                  className="relative border-b border-border/30"
                  style={{ height: TRACK_HEIGHT }}
                  data-testid="track-audio-voice"
                >
                  {trackVisibility['audio-voice'] !== false && voiceTracks.map((track) => (
                    <AudioTrackItem
                      key={track.id}
                      track={track}
                      pixelsPerSecond={pixelsPerSecond}
                      totalDuration={effectiveDuration}
                      onRemove={onAudioRemove}
                    />
                  ))}
                </div>
                
                <Playhead
                  currentTime={currentTime}
                  pixelsPerSecond={pixelsPerSecond}
                  onTimeChange={onTimeChange}
                  containerRef={scrollContainerRef}
                  totalDuration={effectiveDuration}
                />
              </div>
            </div>
          </div>
          
          <DragOverlay>
            {activeClip && activeClipPosition && (
              <div
                className="rounded overflow-hidden border-2 border-primary bg-primary/20 backdrop-blur-sm"
                style={{
                  width: `${activeClipPosition.width}px`,
                  height: `${TRACK_HEIGHT - 8}px`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-foreground">
                    #{activeClipPosition.index + 1}
                  </span>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

export type { VideoClip, ClipSettingsLocal, ClipTransitionLocal, AudioTrack, AdvancedTimelineProps };
