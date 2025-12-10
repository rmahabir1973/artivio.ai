import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Timeline, TimelineRow, TimelineAction, TimelineState, TimelineEffect } from '@xzdarcy/react-timeline-editor';
import { useDroppable } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { TransitionSelector, TransitionBadge, type TransitionConfig } from './transition-selector';
import { 
  Play, 
  Pause, 
  SkipBack, 
  ZoomIn, 
  ZoomOut, 
  Trash2, 
  Volume2, 
  VolumeX,
  Type,
  Music,
  Video,
  Image,
  Layers,
  Sparkles,
  Scissors
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MultiTrackTimelineItem {
  id: string;
  type: 'video' | 'image' | 'text' | 'audio';
  track: number;
  startTime: number;
  duration: number;
  originalDuration?: number;
  url: string;
  thumbnailUrl?: string | null;
  name?: string;
  zIndex?: number;
  trim?: { start: number; end: number };
  transition?: {
    type: string;
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
  fadeIn?: number;
  fadeOut?: number;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  opacity?: number;
  muted?: boolean;
  speed?: number;
}

export interface DroppedMediaItem {
  id: string;
  type: 'video' | 'image' | 'audio';
  url: string;
  thumbnailUrl?: string | null;
  name?: string;
  duration?: number;
}

interface MultiTrackTimelineProps {
  items: MultiTrackTimelineItem[];
  onItemsChange: (items: MultiTrackTimelineItem[]) => void;
  onItemSelect?: (item: MultiTrackTimelineItem | null) => void;
  onTimeChange?: (time: number) => void;
  onDropMedia?: (media: DroppedMediaItem, trackId: string, dropTime: number) => void;
  totalDuration?: number;
  className?: string;
  onTransitionChange?: (itemId: string, transition: TransitionConfig | undefined) => void;
}

const TRACK_CONFIGS = [
  { id: 'video-0', name: 'Main Video', type: 'video' as const, icon: Video },
  { id: 'video-1', name: 'Overlay', type: 'video' as const, icon: Layers },
  { id: 'text-0', name: 'Text', type: 'text', icon: Type },
  { id: 'audio-0', name: 'Music', type: 'audio', icon: Music },
  { id: 'audio-1', name: 'Voiceover', type: 'audio', icon: Volume2 },
];

const getTrackId = (item: MultiTrackTimelineItem): string => {
  if (item.type === 'video' || item.type === 'image') {
    return item.track === 0 ? 'video-0' : 'video-1';
  }
  if (item.type === 'text') {
    return 'text-0';
  }
  if (item.type === 'audio') {
    return item.track === 3 ? 'audio-0' : 'audio-1';
  }
  return 'video-0';
};

const getTrackNumber = (trackId: string): number => {
  switch (trackId) {
    case 'video-0': return 0;
    case 'video-1': return 1;
    case 'text-0': return 2;
    case 'audio-0': return 3;
    case 'audio-1': return 4;
    default: return 0;
  }
};

function DroppableTrackLabel({ track }: { track: typeof TRACK_CONFIGS[0] }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `track-drop-${track.id}`,
    data: { trackId: track.id, trackType: track.type }
  });
  
  const Icon = track.icon;
  
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-16 flex items-center gap-2 px-2 border-b text-sm transition-colors",
        isOver && "bg-primary/20 ring-2 ring-primary ring-inset"
      )}
      data-testid={`track-label-${track.id}`}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="truncate">{track.name}</span>
    </div>
  );
}

export function MultiTrackTimeline({
  items,
  onItemsChange,
  onItemSelect,
  onTimeChange,
  totalDuration = 60,
  className,
  onTransitionChange,
}: MultiTrackTimelineProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scale, setScale] = useState(10);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const timelineStateRef = useRef<TimelineState | null>(null);

  const timelineData: TimelineRow[] = useMemo(() => {
    return TRACK_CONFIGS.map(track => {
      const trackItems = items.filter(item => getTrackId(item) === track.id);
      
      const actions: TimelineAction[] = trackItems.map(item => ({
        id: item.id,
        start: item.startTime,
        end: item.startTime + item.duration,
        effectId: item.type,
        data: item,
      }));

      return {
        id: track.id,
        actions,
      };
    });
  }, [items]);

  const effects: Record<string, TimelineEffect> = useMemo(() => ({
    video: {
      id: 'video',
      name: 'Video',
    },
    image: {
      id: 'image',
      name: 'Image',
    },
    text: {
      id: 'text',
      name: 'Text',
    },
    audio: {
      id: 'audio',
      name: 'Audio',
    },
  }), []);

  const handleTimeChange = useCallback((time: number) => {
    setCurrentTime(time);
    onTimeChange?.(time);
  }, [onTimeChange]);

  const handleActionMoveEnd = useCallback((params: {
    action: TimelineAction;
    row: TimelineRow;
    start: number;
    end: number;
  }) => {
    const updatedItems = items.map(item => {
      if (item.id === params.action.id) {
        return {
          ...item,
          startTime: params.start,
          duration: params.end - params.start,
          track: getTrackNumber(params.row.id),
        };
      }
      return item;
    });
    onItemsChange(updatedItems);
  }, [items, onItemsChange]);

  const handleActionResizeEnd = useCallback((params: {
    action: TimelineAction;
    row: TimelineRow;
    start: number;
    end: number;
    dir: 'right' | 'left';
  }) => {
    const updatedItems = items.map(item => {
      if (item.id === params.action.id) {
        const speed = item.speed || 1;
        
        const originalDuration = item.originalDuration || item.duration * speed;
        
        const prevTrim = item.trim || { start: 0, end: originalDuration };
        let newTrimStart = prevTrim.start;
        let newTrimEnd = prevTrim.end;
        
        if (params.dir === 'left') {
          const timelineDelta = item.startTime - params.start;
          const sourceDelta = timelineDelta * speed;
          newTrimStart = Math.max(0, prevTrim.start - sourceDelta);
        } else {
          const requestedTimelineDelta = (params.end - params.start) - item.duration;
          const sourceDelta = requestedTimelineDelta * speed;
          newTrimEnd = prevTrim.end + sourceDelta;
        }
        
        newTrimEnd = Math.min(newTrimEnd, originalDuration);
        newTrimStart = Math.max(0, newTrimStart);
        
        const effectiveSourceSpan = newTrimEnd - newTrimStart;
        const correctedDuration = effectiveSourceSpan / speed;
        
        let correctedStart = params.start;
        if (params.dir === 'left') {
          correctedStart = item.startTime + item.duration - correctedDuration;
        }
        correctedStart = Math.max(0, correctedStart);
        
        return {
          ...item,
          startTime: correctedStart,
          duration: correctedDuration,
          originalDuration,
          trim: { start: newTrimStart, end: newTrimEnd },
        };
      }
      return item;
    });
    onItemsChange(updatedItems);
  }, [items, onItemsChange]);

  const handleActionClick = useCallback((action: TimelineAction) => {
    setSelectedActionId(action.id);
    const item = items.find(i => i.id === action.id);
    onItemSelect?.(item || null);
  }, [items, onItemSelect]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedActionId) return;
    const updatedItems = items.filter(item => item.id !== selectedActionId);
    onItemsChange(updatedItems);
    setSelectedActionId(null);
    onItemSelect?.(null);
  }, [selectedActionId, items, onItemsChange, onItemSelect]);

  const handleTransitionChange = useCallback((transition: TransitionConfig | undefined) => {
    if (!selectedActionId) return;
    const updatedItems = items.map(item => {
      if (item.id === selectedActionId) {
        return {
          ...item,
          transition: transition ? { type: transition.type, duration: transition.duration } : undefined,
        };
      }
      return item;
    });
    onItemsChange(updatedItems);
    onTransitionChange?.(selectedActionId, transition);
  }, [selectedActionId, items, onItemsChange, onTransitionChange]);

  const handleVolumeChange = useCallback((volume: number) => {
    if (!selectedActionId) return;
    const updatedItems = items.map(item => {
      if (item.id === selectedActionId) {
        return {
          ...item,
          volume,
          muted: volume === 0,
        };
      }
      return item;
    });
    onItemsChange(updatedItems);
  }, [selectedActionId, items, onItemsChange]);

  const handleFadeChange = useCallback((type: 'in' | 'out', value: number) => {
    if (!selectedActionId) return;
    const updatedItems = items.map(item => {
      if (item.id === selectedActionId) {
        return {
          ...item,
          [type === 'in' ? 'fadeIn' : 'fadeOut']: value,
        };
      }
      return item;
    });
    onItemsChange(updatedItems);
  }, [selectedActionId, items, onItemsChange]);

  const handleSpeedChange = useCallback((speed: number) => {
    if (!selectedActionId) return;
    const updatedItems = items.map(item => {
      if (item.id === selectedActionId) {
        const previousSpeed = item.speed || 1;
        const effectiveMediaSpan = item.trim 
          ? (item.trim.end - item.trim.start) 
          : (item.originalDuration || item.duration * previousSpeed);
        const newDuration = effectiveMediaSpan / speed;
        return {
          ...item,
          speed,
          duration: newDuration,
          originalDuration: item.originalDuration || item.duration * previousSpeed,
        };
      }
      return item;
    });
    onItemsChange(updatedItems);
  }, [selectedActionId, items, onItemsChange]);

  const handleSplitAtPlayhead = useCallback(() => {
    if (!selectedActionId) return;
    
    const selectedItem = items.find(i => i.id === selectedActionId);
    if (!selectedItem) return;
    
    const splitTime = currentTime;
    const itemStart = selectedItem.startTime;
    const itemEnd = selectedItem.startTime + selectedItem.duration;
    
    if (splitTime <= itemStart || splitTime >= itemEnd) {
      return;
    }
    
    const speed = selectedItem.speed || 1;
    const firstDuration = splitTime - itemStart;
    const secondDuration = itemEnd - splitTime;
    
    const firstSourceDuration = firstDuration * speed;
    const secondSourceDuration = secondDuration * speed;
    
    const currentTrimStart = selectedItem.trim?.start ?? 0;
    const currentTrimEnd = selectedItem.trim?.end ?? (selectedItem.originalDuration || selectedItem.duration * speed);
    const originalDuration = selectedItem.originalDuration || selectedItem.duration * speed;
    
    const firstPart: MultiTrackTimelineItem = {
      ...selectedItem,
      id: `${selectedItem.id}-a`,
      duration: firstDuration,
      originalDuration,
      trim: {
        start: currentTrimStart,
        end: currentTrimStart + firstSourceDuration,
      },
    };
    
    const secondPart: MultiTrackTimelineItem = {
      ...selectedItem,
      id: `${selectedItem.id}-b`,
      startTime: splitTime,
      duration: secondDuration,
      originalDuration,
      trim: {
        start: currentTrimStart + firstSourceDuration,
        end: currentTrimEnd,
      },
      transition: undefined,
    };
    
    const updatedItems = items.filter(i => i.id !== selectedActionId);
    updatedItems.push(firstPart, secondPart);
    onItemsChange(updatedItems);
    setSelectedActionId(null);
    onItemSelect?.(null);
  }, [selectedActionId, items, currentTime, onItemsChange, onItemSelect]);

  const canSplit = useMemo(() => {
    if (!selectedActionId) return false;
    const item = items.find(i => i.id === selectedActionId);
    if (!item) return false;
    return currentTime > item.startTime && currentTime < item.startTime + item.duration;
  }, [selectedActionId, items, currentTime]);

  const selectedItem = useMemo(() => {
    return selectedActionId ? items.find(i => i.id === selectedActionId) : null;
  }, [selectedActionId, items]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      timelineStateRef.current?.pause();
    } else {
      timelineStateRef.current?.play({ autoEnd: true });
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleRestart = useCallback(() => {
    timelineStateRef.current?.setTime(0);
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * 1.5, 100));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev / 1.5, 1));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedActionId && document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
      if (e.key === ' ') {
        if (document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          handlePlayPause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedActionId, handleDeleteSelected, handlePlayPause]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const calculatedDuration = useMemo(() => {
    if (items.length === 0) return totalDuration;
    const maxEnd = Math.max(...items.map(i => i.startTime + i.duration));
    return Math.max(maxEnd + 5, totalDuration);
  }, [items, totalDuration]);

  return (
    <div className={cn("flex flex-col bg-background border-t", className)} data-testid="multi-track-timeline">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRestart}
            data-testid="timeline-restart"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePlayPause}
            data-testid="timeline-play-pause"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <span className="text-sm font-mono text-muted-foreground min-w-[80px]">
            {formatTime(currentTime)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedItem && (selectedItem.type === 'video' || selectedItem.type === 'image') && (
            <>
              <TransitionSelector
                value={selectedItem.transition ? {
                  type: selectedItem.transition.type,
                  duration: selectedItem.transition.duration,
                } : undefined}
                onChange={handleTransitionChange}
              />
              {selectedItem.type === 'video' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded text-xs" data-testid="speed-controls">
                  <span className="text-muted-foreground">Speed:</span>
                  <select
                    value={selectedItem.speed ?? 1}
                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                    className="bg-background border rounded px-1.5 py-0.5 text-xs"
                    data-testid="speed-selector"
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1}>1x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                </div>
              )}
            </>
          )}
          
          {selectedItem && selectedItem.type === 'audio' && (
            <div className="flex items-center gap-3 px-2 py-1 bg-muted/50 rounded" data-testid="audio-controls">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleVolumeChange(selectedItem.muted ? 100 : 0)}
                  data-testid="audio-mute-toggle"
                >
                  {selectedItem.muted || selectedItem.volume === 0 ? (
                    <VolumeX className="h-3 w-3" />
                  ) : (
                    <Volume2 className="h-3 w-3" />
                  )}
                </Button>
                <Slider
                  value={[selectedItem.volume ?? 100]}
                  onValueChange={([v]) => handleVolumeChange(v)}
                  min={0}
                  max={100}
                  step={1}
                  className="w-16"
                  data-testid="audio-volume-slider"
                />
                <span className="text-xs text-muted-foreground w-8">{selectedItem.volume ?? 100}%</span>
              </div>
              
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Fade In:</span>
                <Slider
                  value={[selectedItem.fadeIn ?? 0]}
                  onValueChange={([v]) => handleFadeChange('in', v)}
                  min={0}
                  max={5}
                  step={0.1}
                  className="w-12"
                  data-testid="audio-fade-in-slider"
                />
                <span className="text-muted-foreground w-6">{(selectedItem.fadeIn ?? 0).toFixed(1)}s</span>
              </div>
              
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Out:</span>
                <Slider
                  value={[selectedItem.fadeOut ?? 0]}
                  onValueChange={([v]) => handleFadeChange('out', v)}
                  min={0}
                  max={5}
                  step={0.1}
                  className="w-12"
                  data-testid="audio-fade-out-slider"
                />
                <span className="text-muted-foreground w-6">{(selectedItem.fadeOut ?? 0).toFixed(1)}s</span>
              </div>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSplitAtPlayhead}
            disabled={!canSplit}
            title="Split clip at playhead"
            data-testid="timeline-split"
          >
            <Scissors className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDeleteSelected}
            disabled={!selectedActionId}
            data-testid="timeline-delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleZoomOut} data-testid="timeline-zoom-out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Slider
              value={[scale]}
              onValueChange={([v]) => setScale(v)}
              min={1}
              max={100}
              step={1}
              className="w-24"
            />
            <Button variant="ghost" size="icon" onClick={handleZoomIn} data-testid="timeline-zoom-in">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-32 shrink-0 border-r bg-muted/20">
          {TRACK_CONFIGS.map(track => (
            <DroppableTrackLabel key={track.id} track={track} />
          ))}
        </div>

        <div className="flex-1 overflow-x-auto min-h-0">
          <Timeline
            editorData={timelineData}
            effects={effects}
            scale={scale}
            scaleWidth={50}
            startLeft={20}
            autoScroll={true}
            dragLine={true}
            getActionRender={(action) => {
              const item = items.find(i => i.id === action.id);
              const isSelected = action.id === selectedActionId;
              
              if (!item) {
                return <div className="h-full bg-muted rounded-sm" />;
              }
              
              const isTrimmed = item.trim && item.originalDuration && 
                (item.trim.start > 0 || item.trim.end < item.originalDuration);
              const trimPercent = item.originalDuration && item.duration < item.originalDuration
                ? ((item.originalDuration - item.duration) / item.originalDuration * 100).toFixed(0)
                : null;
              
              return (
                <div
                  className={cn(
                    "h-full rounded-sm flex items-center justify-center text-xs font-medium overflow-hidden cursor-pointer transition-all relative group",
                    isSelected && "ring-2 ring-primary ring-offset-1",
                    item.type === 'video' && "bg-blue-500/80 text-white",
                    item.type === 'image' && "bg-green-500/80 text-white",
                    item.type === 'text' && "bg-yellow-500/80 text-black",
                    item.type === 'audio' && "bg-purple-500/80 text-white"
                  )}
                  onClick={() => handleActionClick(action)}
                  data-testid={`timeline-action-${action.id}`}
                >
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1 bg-white/30 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-30 hover:bg-white/60" 
                    data-testid={`trim-handle-left-${action.id}`}
                  />
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 bg-white/30 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-30 hover:bg-white/60" 
                    data-testid={`trim-handle-right-${action.id}`}
                  />
                  
                  {item.thumbnailUrl && (item.type === 'video' || item.type === 'image') && (
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-60"
                    />
                  )}
                  
                  {isTrimmed && (
                    <div 
                      className="absolute bottom-0.5 left-0.5 z-20 bg-orange-500/90 text-white rounded px-1 py-0.5 text-[9px] flex items-center gap-0.5"
                      title={`Trimmed ${trimPercent}% (${item.trim?.start.toFixed(1)}s - ${item.trim?.end.toFixed(1)}s)`}
                    >
                      {trimPercent}% trimmed
                    </div>
                  )}
                  
                  {item.type === 'audio' && (item.fadeIn || item.fadeOut) && (
                    <>
                      {item.fadeIn && item.fadeIn > 0 && (
                        <div 
                          className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-black/60 to-transparent pointer-events-none z-10"
                          style={{ width: `${Math.min(30, item.fadeIn / item.duration * 100)}%` }}
                          title={`Fade in: ${item.fadeIn.toFixed(1)}s`}
                        />
                      )}
                      {item.fadeOut && item.fadeOut > 0 && (
                        <div 
                          className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-black/60 to-transparent pointer-events-none z-10"
                          style={{ width: `${Math.min(30, item.fadeOut / item.duration * 100)}%` }}
                          title={`Fade out: ${item.fadeOut.toFixed(1)}s`}
                        />
                      )}
                    </>
                  )}
                  
                  {item.type === 'audio' && item.volume !== undefined && item.volume < 100 && (
                    <div 
                      className="absolute top-0.5 left-0.5 z-20 bg-purple-700/90 text-white rounded px-1 py-0.5 text-[9px]"
                      data-testid={`volume-badge-${item.id}`}
                    >
                      {item.volume}%
                    </div>
                  )}
                  
                  {(item.type === 'video') && item.speed && item.speed !== 1 && (
                    <div 
                      className="absolute bottom-0.5 right-0.5 z-20 bg-blue-700/90 text-white rounded px-1 py-0.5 text-[9px]"
                      data-testid={`speed-badge-${item.id}`}
                    >
                      {item.speed}x
                    </div>
                  )}
                  
                  <span className="relative z-10 px-1 truncate">
                    {item.name || item.text?.content || `${item.type} clip`}
                  </span>
                  {item.transition && (
                    <TransitionBadge
                      type={item.transition.type}
                      className="absolute top-0.5 right-0.5 z-20 text-[10px] px-1 py-0.5"
                    />
                  )}
                </div>
              );
            }}
            onActionMoveEnd={handleActionMoveEnd}
            onActionResizeEnd={handleActionResizeEnd}
            onCursorDragEnd={handleTimeChange}
            ref={timelineStateRef}
          />
        </div>
      </div>
    </div>
  );
}

export default MultiTrackTimeline;
