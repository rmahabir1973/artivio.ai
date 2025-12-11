// ============================================================================
// NEW TRANSITION SYSTEM - Drag & Drop Implementation
// ============================================================================
// Add these components to video-editor/components.tsx or similar file

import { useSortable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { TransitionType, ClipTransitionLocal } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shuffle, X, Sparkles, ArrowRight, Film, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// 1. DRAGGABLE TRANSITION COMPONENT
// ============================================================================

interface DraggableTransitionProps {
  type: TransitionType;
  icon: React.ReactNode;
  label: string;
}

export function DraggableTransition({ type, icon, label }: DraggableTransitionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ 
    id: `transition-${type}`,
    data: { 
      type: 'transition',
      transitionType: type,
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-2 border rounded-md cursor-grab active:cursor-grabbing hover:bg-muted/50 text-center transition-colors"
      data-testid={`draggable-transition-${type}`}
    >
      <div className="flex flex-col items-center gap-1">
        {icon}
        <span className="text-xs capitalize">{label}</span>
      </div>
    </div>
  );
}

// ============================================================================
// 2. TRANSITION DROP ZONE COMPONENT
// ============================================================================

interface TransitionDropZoneProps {
  position: number; // After which clip (0-based)
  currentTransition?: ClipTransitionLocal;
  onEdit: (position: number) => void;
  onRemove: (position: number) => void;
  clipCount: number; // Total number of clips
}

export function TransitionDropZone({
  position,
  currentTransition,
  onEdit,
  onRemove,
  clipCount,
}: TransitionDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `transition-drop-${position}`,
    data: {
      type: 'transition-zone',
      position,
    },
  });

  // Don't show drop zone after last clip
  if (position >= clipCount - 1) return null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col items-center justify-center shrink-0 relative",
        "transition-all duration-200",
        isOver ? "w-16 bg-primary/20 border-2 border-primary border-dashed rounded-md" : "w-8",
        currentTransition ? "w-12" : ""
      )}
      data-testid={`transition-zone-${position}`}
    >
      {/* Visual indicator */}
      {currentTransition ? (
        <div className="flex flex-col items-center gap-1 py-2">
          <div className="w-px h-6 bg-primary/70" />
          
          {/* Transition icon badge */}
          <div className="relative group">
            <Badge 
              variant="secondary" 
              className="cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => onEdit(position)}
              data-testid={`transition-badge-${position}`}
            >
              <Shuffle className="h-3 w-3" />
            </Badge>
            
            {/* Hover tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
              <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap border">
                <div className="font-medium capitalize">{currentTransition.type}</div>
                <div className="text-muted-foreground">{currentTransition.durationSeconds}s</div>
              </div>
            </div>
            
            {/* Remove button */}
            <Button
              size="icon"
              variant="ghost"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(position);
              }}
              data-testid={`transition-remove-${position}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="w-px h-6 bg-primary/70" />
        </div>
      ) : (
        <div className={cn(
          "flex flex-col items-center py-2",
          isOver && "animate-pulse"
        )}>
          <div className="w-px h-4 bg-border" />
          <div className={cn(
            "h-2 w-2 rounded-full border-2 transition-colors",
            isOver ? "border-primary bg-primary" : "border-border"
          )} />
          <div className="w-px h-4 bg-border" />
          
          {/* Hint text on hover */}
          {isOver && (
            <div className="absolute top-full mt-1 text-[10px] text-primary font-medium whitespace-nowrap">
              Drop here
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. UPDATED TIMELINE TRACK (with transition zones)
// ============================================================================

interface TimelineTrackProps {
  clips: VideoClip[];
  audioTracks: Array<{ id: string; url: string; name: string; type: 'music' | 'voice' | 'sfx'; volume: number }>;
  getClipSettings: (clipId: string) => ClipSettingsLocal;
  onMuteToggle: (clipId: string) => void;
  onRemoveClip: (clipId: string) => void;
  onRemoveAudioTrack: (trackId: string) => void;
  onOpenSettings: (clip: VideoClip, index: number) => void;
  totalDuration: number;
  // NEW: Transition props
  clipTransitions: ClipTransitionLocal[];
  onTransitionEdit: (position: number) => void;
  onTransitionRemove: (position: number) => void;
}

export function TimelineTrack({
  clips,
  audioTracks,
  getClipSettings,
  onMuteToggle,
  onRemoveClip,
  onRemoveAudioTrack,
  onOpenSettings,
  totalDuration,
  clipTransitions,
  onTransitionEdit,
  onTransitionRemove,
}: TimelineTrackProps) {
  const getTransitionAtPosition = (position: number): ClipTransitionLocal | undefined => {
    return clipTransitions.find(t => t.afterClipIndex === position);
  };

  return (
    <div className="space-y-3">
      {/* Video Track */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Video Track</span>
          <Badge variant="outline" className="text-[10px] h-5">
            {clips.length} clip{clips.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        
        {clips.length === 0 ? (
          <div className="h-32 flex items-center justify-center border-2 border-dashed rounded-md bg-muted/20">
            <div className="text-center">
              <Video className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Drag videos or images here</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="w-full">
            <div className="flex items-center gap-1 pb-4">
              {clips.map((clip, index) => (
                <React.Fragment key={clip.id}>
                  {/* The clip itself */}
                  <SortableClip
                    clip={clip}
                    clipIndex={index}
                    clipSettings={getClipSettings(clip.id)}
                    onRemove={onRemoveClip}
                    onToggleMute={onMuteToggle}
                    onOpenSettings={onOpenSettings}
                    onSplitClip={() => {}} // Add split handler if needed
                    isMobile={false}
                    showTransition={false}
                    transitionMode="none"
                  />
                  
                  {/* NEW: Transition drop zone (after each clip except the last) */}
                  <TransitionDropZone
                    position={index}
                    currentTransition={getTransitionAtPosition(index)}
                    onEdit={onTransitionEdit}
                    onRemove={onTransitionRemove}
                    clipCount={clips.length}
                  />
                </React.Fragment>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>
      
      {/* Audio Tracks */}
      {audioTracks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2">
            <Music className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Audio Tracks</span>
            <Badge variant="outline" className="text-[10px] h-5">
              {audioTracks.length} track{audioTracks.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          
          <div className="space-y-2 px-2">
            {audioTracks.map((track) => (
              <div 
                key={track.id} 
                className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border"
              >
                {track.type === 'music' ? (
                  <Music className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <Mic className="h-4 w-4 text-purple-500 shrink-0" />
                )}
                <span className="text-xs flex-1 truncate">{track.name}</span>
                <span className="text-xs text-muted-foreground">{Math.round(track.volume * 100)}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => onRemoveAudioTrack(track.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Timeline Duration */}
      <div className="flex items-center justify-between px-2 py-1 bg-muted/30 rounded text-xs text-muted-foreground">
        <span>Total Duration:</span>
        <span className="font-mono">{Math.floor(totalDuration / 60)}:{(totalDuration % 60).toFixed(1).padStart(4, '0')}</span>
      </div>
    </div>
  );
}

// ============================================================================
// 4. TRANSITION EDIT DIALOG
// ============================================================================

interface TransitionEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: number;
  transition: ClipTransitionLocal;
  onSave: (position: number, updates: Partial<ClipTransitionLocal>) => void;
}

export function TransitionEditDialog({
  open,
  onOpenChange,
  position,
  transition,
  onSave,
}: TransitionEditDialogProps) {
  const [type, setType] = useState(transition.type);
  const [duration, setDuration] = useState(transition.durationSeconds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shuffle className="h-5 w-5" />
            Edit Transition
          </DialogTitle>
          <DialogDescription>
            Customize the transition between clips {position + 1} and {position + 2}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Transition Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TransitionType)}>
              <SelectTrigger data-testid="select-transition-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fade">Fade</SelectItem>
                <SelectItem value="dissolve">Dissolve</SelectItem>
                <SelectItem value="fadeblack">Fade Black</SelectItem>
                <SelectItem value="fadewhite">Fade White</SelectItem>
                <SelectItem value="wipeleft">Wipe Left</SelectItem>
                <SelectItem value="wiperight">Wipe Right</SelectItem>
                <SelectItem value="wipeup">Wipe Up</SelectItem>
                <SelectItem value="wipedown">Wipe Down</SelectItem>
                <SelectItem value="slideleft">Slide Left</SelectItem>
                <SelectItem value="slideright">Slide Right</SelectItem>
                <SelectItem value="slideup">Slide Up</SelectItem>
                <SelectItem value="slidedown">Slide Down</SelectItem>
                <SelectItem value="circleopen">Circle Open</SelectItem>
                <SelectItem value="circleclose">Circle Close</SelectItem>
                <SelectItem value="diagtl">Diagonal TL</SelectItem>
                <SelectItem value="diagtr">Diagonal TR</SelectItem>
                <SelectItem value="diagbl">Diagonal BL</SelectItem>
                <SelectItem value="diagbr">Diagonal BR</SelectItem>
                <SelectItem value="radial">Radial</SelectItem>
                <SelectItem value="pixelize">Pixelize</SelectItem>
                <SelectItem value="distance">Distance</SelectItem>
                <SelectItem value="hblur">Horizontal Blur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="flex justify-between">
              <span>Duration</span>
              <span className="text-muted-foreground font-mono">{duration}s</span>
            </Label>
            <Slider
              value={[duration]}
              min={0.25}
              max={3}
              step={0.25}
              onValueChange={([v]) => setDuration(v)}
              data-testid="slider-transition-duration"
            />
            <p className="text-xs text-muted-foreground">
              Shorter = snappy, Longer = smooth
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => {
            onSave(position, { type, durationSeconds: duration });
            onOpenChange(false);
          }}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
