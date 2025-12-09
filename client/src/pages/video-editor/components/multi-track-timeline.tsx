import { useState, useCallback, useEffect, useMemo } from 'react';
import { Timeline, TimelineRow, TimelineAction, TimelineState, TimelineEffect } from '@xzdarcy/react-timeline-editor';
import { useDroppable } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
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
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MultiTrackTimelineItem {
  id: string;
  type: 'video' | 'image' | 'text' | 'audio';
  track: number;
  startTime: number;
  duration: number;
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
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  opacity?: number;
  muted?: boolean;
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
    return item.track <= 3 ? 'audio-0' : 'audio-1';
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
}: MultiTrackTimelineProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scale, setScale] = useState(10);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [timelineState, setTimelineState] = useState<TimelineState | null>(null);

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
        return {
          ...item,
          startTime: params.start,
          duration: params.end - params.start,
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

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      timelineState?.pause();
    } else {
      timelineState?.play({ autoEnd: true });
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, timelineState]);

  const handleRestart = useCallback(() => {
    timelineState?.setTime(0);
    setCurrentTime(0);
    setIsPlaying(false);
  }, [timelineState]);

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
              
              return (
                <div
                  className={cn(
                    "h-full rounded-sm flex items-center justify-center text-xs font-medium overflow-hidden cursor-pointer transition-all relative",
                    isSelected && "ring-2 ring-primary ring-offset-1",
                    item.type === 'video' && "bg-blue-500/80 text-white",
                    item.type === 'image' && "bg-green-500/80 text-white",
                    item.type === 'text' && "bg-yellow-500/80 text-black",
                    item.type === 'audio' && "bg-purple-500/80 text-white"
                  )}
                  onClick={() => handleActionClick(action)}
                  data-testid={`timeline-action-${action.id}`}
                >
                  {item.thumbnailUrl && (item.type === 'video' || item.type === 'image') && (
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-60"
                    />
                  )}
                  <span className="relative z-10 px-1 truncate">
                    {item.name || item.text?.content || `${item.type} clip`}
                  </span>
                </div>
              );
            }}
            onActionMoveEnd={handleActionMoveEnd}
            onActionResizeEnd={handleActionResizeEnd}
            onCursorDragEnd={handleTimeChange}
            ref={(ref) => setTimelineState(ref)}
          />
        </div>
      </div>
    </div>
  );
}

export default MultiTrackTimeline;
