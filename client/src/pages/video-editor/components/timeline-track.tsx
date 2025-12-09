import { GripVertical, Volume2, VolumeX, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface VideoClip {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  prompt: string;
  createdAt: string;
}

interface ClipSettings {
  muted: boolean;
  volume: number;
  speed: number;
  originalDuration?: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
}

interface TimelineClipProps {
  clip: VideoClip;
  index: number;
  settings: ClipSettings;
  onMuteToggle: () => void;
  onRemove: () => void;
  onOpenSettings: () => void;
}

function TimelineClip({ clip, index, settings, onMuteToggle, onRemove, onOpenSettings }: TimelineClipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const duration = settings.originalDuration ?? 5;
  const trimStart = settings.trimStartSeconds ?? 0;
  const trimEnd = settings.trimEndSeconds ?? duration;
  const effectiveDuration = (trimEnd - trimStart) / (settings.speed ?? 1);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col rounded-md border bg-card overflow-hidden shrink-0",
        isDragging && "opacity-60 ring-2 ring-primary"
      )}
      data-testid={`timeline-clip-${clip.id}`}
    >
      <div className="relative aspect-video w-32 bg-muted">
        {clip.thumbnailUrl ? (
          <img
            src={clip.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            src={clip.url}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <span className="text-white text-sm font-medium bg-black/60 px-2 py-0.5 rounded">
            {Math.round(effectiveDuration)}s
          </span>
        </div>
        {settings.muted && (
          <div className="absolute top-1 right-1 bg-red-500/80 text-white p-0.5 rounded">
            <VolumeX className="h-3 w-3" />
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between gap-1 p-1 border-t bg-muted/30">
        <div
          className="h-6 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none rounded-md hover:bg-muted"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={settings.muted ? "destructive" : "ghost"}
                size="icon"
                className="h-6 w-6"
                onClick={onMuteToggle}
                data-testid={`timeline-mute-${clip.id}`}
              >
                {settings.muted ? (
                  <VolumeX className="h-3 w-3" />
                ) : (
                  <Volume2 className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {settings.muted ? 'Unmute' : 'Mute'}
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onOpenSettings}
                data-testid={`timeline-settings-${clip.id}`}
              >
                <Settings className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Settings</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={onRemove}
                data-testid={`timeline-remove-${clip.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Remove</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

interface TimelineTrackProps {
  clips: VideoClip[];
  getClipSettings: (clipId: string) => ClipSettings;
  onMuteToggle: (clipId: string) => void;
  onRemoveClip: (clipId: string) => void;
  onOpenSettings: (clip: VideoClip, index: number) => void;
  totalDuration: number;
  children?: React.ReactNode; // For SortableContext wrapper
}

export function TimelineTrack({
  clips,
  getClipSettings,
  onMuteToggle,
  onRemoveClip,
  onOpenSettings,
  totalDuration,
  children,
}: TimelineTrackProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  return (
    <div className="border-t bg-muted/30" data-testid="timeline-track">
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Timeline</span>
          <span className="text-xs text-muted-foreground">
            {clips.length} clip{clips.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-sm font-mono text-muted-foreground">
          {formatDuration(totalDuration)}
        </span>
      </div>
      
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 p-3 min-h-[120px]">
          {clips.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Add clips from the media panel to get started
            </div>
          ) : (
            children || clips.map((clip, index) => (
              <TimelineClip
                key={clip.id}
                clip={clip}
                index={index}
                settings={getClipSettings(clip.id)}
                onMuteToggle={() => onMuteToggle(clip.id)}
                onRemove={() => onRemoveClip(clip.id)}
                onOpenSettings={() => onOpenSettings(clip, index)}
              />
            ))
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

export { TimelineClip };
export type { VideoClip, ClipSettings };
