import { useDroppable } from "@dnd-kit/core";
import { Shuffle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ClipTransitionLocal {
  afterClipIndex: number;
  type: string;
  durationSeconds: number;
}

interface TransitionDropZoneProps {
  position: number;
  clipId: string; // Stable identifier for the drop zone
  currentTransition?: ClipTransitionLocal;
  onEdit: (position: number) => void;
  onRemove: (position: number) => void;
  clipCount: number;
}

export function TransitionDropZone({
  position,
  clipId,
  currentTransition,
  onEdit,
  onRemove,
  clipCount,
}: TransitionDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `transition-drop-${clipId}`,
    data: {
      type: 'transition-zone',
      position,
      clipId,
    },
  });

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
      {currentTransition ? (
        <div className="flex flex-col items-center gap-1 py-2">
          <div className="w-px h-6 bg-primary/70" />
          
          <div className="relative group">
            <Badge 
              variant="secondary" 
              className="cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => onEdit(position)}
              data-testid={`transition-badge-${position}`}
            >
              <Shuffle className="h-3 w-3" />
            </Badge>
            
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
              <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap border">
                <div className="font-medium capitalize">{currentTransition.type}</div>
                <div className="text-muted-foreground">{currentTransition.durationSeconds}s</div>
              </div>
            </div>
            
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
