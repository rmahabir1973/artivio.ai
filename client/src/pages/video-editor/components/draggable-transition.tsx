import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { TransitionType } from "@shared/schema";
import { cn } from "@/lib/utils";

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
  } = useDraggable({ 
    id: `transition-${type}`,
    data: { 
      type: 'transition',
      transitionType: type,
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "p-2 border rounded-md cursor-grab active:cursor-grabbing hover:bg-muted/50 text-center transition-colors",
        isDragging && "ring-2 ring-primary"
      )}
      data-testid={`draggable-transition-${type}`}
    >
      <div className="flex flex-col items-center gap-1">
        {icon}
        <span className="text-xs capitalize">{label}</span>
      </div>
    </div>
  );
}
