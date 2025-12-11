import { GripVertical, Volume2, VolumeX, Trash2, Settings, Music, Mic, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TransitionDropZone, ClipTransitionLocal } from "./transition-drop-zone";

interface VideoClip {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  prompt: string;
  createdAt: string;
  type: 'video' | 'image';
}

interface AudioTrackItem {
  id: string;
  url: string;
  name: string;
  type: 'music' | 'voice' | 'sfx';
  volume: number;
}

interface ClipSettings {
  muted: boolean;
  volume: number;
  speed: number;
  originalDuration?: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  displayDuration?: number; // For images: how long to display
}

interface TimelineClipProps {
  clip: VideoClip;
  index: number;
  settings: ClipSettings;
  onMuteToggle: () => void;
  onRemove: () => void;
  onOpenSettings: () => void;
  // Transition drop zone props (optional - only shown if not last clip)
  showTransitionZone?: boolean;
  transitionData?: ClipTransitionLocal;
  onTransitionEdit?: (position: number) => void;
  onTransitionRemove?: (position: number) => void;
  clipCount?: number;
}

function TimelineClip({ 
  clip, 
  index, 
  settings, 
  onMuteToggle, 
  onRemove, 
  onOpenSettings,
  showTransitionZone,
  transitionData,
  onTransitionEdit,
  onTransitionRemove,
  clipCount = 0,
}: TimelineClipProps) {
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

  // For images, use displayDuration; for videos, calculate from trim/speed
  const isImage = clip.type === 'image';
  const duration = settings.originalDuration ?? 5;
  const trimStart = settings.trimStartSeconds ?? 0;
  const trimEnd = settings.trimEndSeconds ?? duration;
  const effectiveDuration = isImage 
    ? (settings.displayDuration ?? 5) 
    : (trimEnd - trimStart) / (settings.speed ?? 1);

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
        {isImage ? (
          <img
            src={clip.url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : clip.thumbnailUrl ? (
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
        {isImage && (
          <div className="absolute top-1 left-1 bg-blue-500/80 text-white p-0.5 rounded">
            <ImageIcon className="h-3 w-3" />
          </div>
        )}
        {settings.muted && !isImage && (
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
          {!isImage && (
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
          )}
          
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
      
      {/* Transition drop zone - positioned after the clip card */}
      {showTransitionZone && onTransitionEdit && onTransitionRemove && (
        <TransitionDropZone
          position={index}
          clipId={clip.id}
          currentTransition={transitionData}
          clipCount={clipCount}
          onEdit={onTransitionEdit}
          onRemove={onTransitionRemove}
        />
      )}
    </div>
  );
}

interface AudioTrackClipProps {
  track: AudioTrackItem;
  onRemove: () => void;
}

function AudioTrackClip({ track, onRemove }: AudioTrackClipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const Icon = track.type === 'music' ? Music : Mic;
  const bgColor = track.type === 'music' ? 'bg-purple-500/20 border-purple-500/50' : 'bg-blue-500/20 border-blue-500/50';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 shrink-0",
        bgColor,
        isDragging && "opacity-60 ring-2 ring-primary"
      )}
      data-testid={`timeline-audio-${track.id}`}
    >
      <div
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm truncate max-w-[120px]">{track.name}</span>
      <span className="text-xs text-muted-foreground">{Math.round(track.volume * 100)}%</span>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 text-destructive hover:text-destructive ml-auto"
        onClick={onRemove}
        data-testid={`timeline-remove-audio-${track.id}`}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

interface TimelineTrackProps {
  clips: VideoClip[];
  audioTracks?: AudioTrackItem[];
  getClipSettings: (clipId: string) => ClipSettings;
  onMuteToggle: (clipId: string) => void;
  onRemoveClip: (clipId: string) => void;
  onRemoveAudioTrack?: (trackId: string) => void;
  onOpenSettings: (clip: VideoClip, index: number) => void;
  totalDuration: number;
  children?: React.ReactNode;
  // Transition support
  clipTransitions?: ClipTransitionLocal[];
  onTransitionEdit?: (position: number) => void;
  onTransitionRemove?: (position: number) => void;
}

export function TimelineTrack({
  clips,
  audioTracks = [],
  getClipSettings,
  onMuteToggle,
  onRemoveClip,
  onRemoveAudioTrack,
  onOpenSettings,
  totalDuration,
  children,
  clipTransitions = [],
  onTransitionEdit,
  onTransitionRemove,
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
            {audioTracks.filter(t => t.type === 'music').length > 0 && `, ${audioTracks.filter(t => t.type === 'music').length} music`}
            {audioTracks.filter(t => t.type === 'voice' || t.type === 'sfx').length > 0 && `, ${audioTracks.filter(t => t.type === 'voice' || t.type === 'sfx').length} voice`}
          </span>
        </div>
        <span className="text-sm font-mono text-muted-foreground">
          {formatDuration(totalDuration)}
        </span>
      </div>
      
      {/* Video Track */}
      <div className="border-b">
        <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground bg-muted/50">
          <Volume2 className="h-3 w-3" />
          <span>Video</span>
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 p-3 min-h-[100px]">
            {clips.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Add clips from the media panel to get started
              </div>
            ) : (
              children || clips.map((clip, index) => {
                const existingTransition = clipTransitions.find(
                  t => t.afterClipIndex === index
                );
                const isLastClip = index === clips.length - 1;
                
                return (
                  <TimelineClip
                    key={clip.id}
                    clip={clip}
                    index={index}
                    settings={getClipSettings(clip.id)}
                    onMuteToggle={() => onMuteToggle(clip.id)}
                    onRemove={() => onRemoveClip(clip.id)}
                    onOpenSettings={() => onOpenSettings(clip, index)}
                    showTransitionZone={!isLastClip && !!onTransitionEdit && !!onTransitionRemove}
                    transitionData={existingTransition}
                    onTransitionEdit={onTransitionEdit}
                    onTransitionRemove={onTransitionRemove}
                    clipCount={clips.length}
                  />
                );
              })
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
      
      {/* Background Music Track */}
      <div>
        <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground bg-muted/50">
          <Music className="h-3 w-3" />
          <span>Background Music</span>
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 p-3 min-h-[50px]">
            {audioTracks.filter(t => t.type === 'music').length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                Add music from the Music category
              </div>
            ) : (
              audioTracks.filter(t => t.type === 'music').map((track) => (
                <AudioTrackClip
                  key={track.id}
                  track={track}
                  onRemove={() => onRemoveAudioTrack?.(track.id)}
                />
              ))
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
      
      {/* Voice / Audio Track */}
      <div>
        <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground bg-muted/50">
          <Mic className="h-3 w-3" />
          <span>Voice / Audio</span>
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 p-3 min-h-[50px]">
            {audioTracks.filter(t => t.type === 'voice' || t.type === 'sfx').length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                Add voice or audio from the Audio category
              </div>
            ) : (
              audioTracks.filter(t => t.type === 'voice' || t.type === 'sfx').map((track) => (
                <AudioTrackClip
                  key={track.id}
                  track={track}
                  onRemove={() => onRemoveAudioTrack?.(track.id)}
                />
              ))
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
}

export { TimelineClip, AudioTrackClip };
export type { VideoClip, ClipSettings, AudioTrackItem };
