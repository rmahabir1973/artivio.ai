import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

interface DraggableClipProps {
  id: string;
  index: number;
  video: {
    id: string;
    model: string;
    prompt: string;
    resultUrl: string;
    thumbnailUrl?: string;
  };
  trim: {
    startSeconds: number;
    endSeconds: number;
  };
  onRemove: () => void;
  onTrimChange: (trim: { startSeconds: number; endSeconds: number }) => void;
}

export function DraggableClip({
  id,
  index,
  video,
  trim,
  onRemove,
  onTrimChange,
}: DraggableClipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group"
      data-testid={`draggable-clip-${index}`}
    >
      <Card className="overflow-hidden hover-elevate">
        <div className="flex items-start gap-3 p-3">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="flex items-center justify-center cursor-grab active:cursor-grabbing pt-1"
            data-testid={`drag-handle-${index}`}
          >
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </div>

          {/* Thumbnail */}
          <div className="relative w-24 h-14 rounded-md bg-muted overflow-hidden flex-shrink-0">
            {video.thumbnailUrl ? (
              <img
                src={video.thumbnailUrl}
                alt={`Clip ${index + 1} thumbnail`}
                className="w-full h-full object-cover"
                data-testid={`thumbnail-${index}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Badge variant="outline" className="text-xs">
                  #{index + 1}
                </Badge>
              </div>
            )}
            <div className="absolute top-1 left-1">
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {index + 1}
              </Badge>
            </div>
          </div>

          {/* Clip Info */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" data-testid={`text-model-${index}`}>
                  {video.model}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-prompt-${index}`}>
                  {video.prompt}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={onRemove}
                className="h-7 w-7 flex-shrink-0"
                data-testid={`button-remove-clip-${index}`}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Trim Controls */}
            <div className="pt-2 space-y-2 border-t">
              <div className="flex items-center gap-2">
                <Scissors className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs font-medium">Trim Controls</Label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Start (s)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={trim.startSeconds}
                    onChange={(e) => {
                      onTrimChange({
                        ...trim,
                        startSeconds: parseFloat(e.target.value) || 0,
                      });
                    }}
                    className="h-8 text-sm"
                    data-testid={`input-trim-start-${index}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">End (s)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={trim.endSeconds}
                    onChange={(e) => {
                      onTrimChange({
                        ...trim,
                        endSeconds: parseFloat(e.target.value) || 0,
                      });
                    }}
                    className="h-8 text-sm"
                    data-testid={`input-trim-end-${index}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
