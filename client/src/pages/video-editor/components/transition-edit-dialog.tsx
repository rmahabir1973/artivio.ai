import { useState, useEffect } from "react";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { TransitionType } from "@shared/schema";

interface ClipTransitionLocal {
  afterClipIndex: number;
  type: string;
  durationSeconds: number;
}

interface TransitionEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: number;
  transition: ClipTransitionLocal;
  onSave: (position: number, updates: Partial<ClipTransitionLocal>) => void;
}

const TRANSITION_OPTIONS: { value: TransitionType; label: string; category: string }[] = [
  { value: 'fade', label: 'Fade', category: 'Fade' },
  { value: 'dissolve', label: 'Dissolve', category: 'Fade' },
  { value: 'fadeblack', label: 'Fade Black', category: 'Fade' },
  { value: 'fadewhite', label: 'Fade White', category: 'Fade' },
  { value: 'fadegrays', label: 'Fade Grays', category: 'Fade' },
  { value: 'wipeleft', label: 'Wipe Left', category: 'Wipe' },
  { value: 'wiperight', label: 'Wipe Right', category: 'Wipe' },
  { value: 'wipeup', label: 'Wipe Up', category: 'Wipe' },
  { value: 'wipedown', label: 'Wipe Down', category: 'Wipe' },
  { value: 'slideleft', label: 'Slide Left', category: 'Slide' },
  { value: 'slideright', label: 'Slide Right', category: 'Slide' },
  { value: 'slideup', label: 'Slide Up', category: 'Slide' },
  { value: 'slidedown', label: 'Slide Down', category: 'Slide' },
  { value: 'circleopen', label: 'Circle Open', category: 'Shape' },
  { value: 'circleclose', label: 'Circle Close', category: 'Shape' },
  { value: 'circlecrop', label: 'Circle Crop', category: 'Shape' },
  { value: 'rectcrop', label: 'Rect Crop', category: 'Shape' },
  { value: 'radial', label: 'Radial', category: 'Shape' },
  { value: 'pixelize', label: 'Pixelize', category: 'Shape' },
  { value: 'diagtl', label: 'Diagonal TL', category: 'Diagonal' },
  { value: 'diagtr', label: 'Diagonal TR', category: 'Diagonal' },
  { value: 'diagbl', label: 'Diagonal BL', category: 'Diagonal' },
  { value: 'diagbr', label: 'Diagonal BR', category: 'Diagonal' },
];

export function TransitionEditDialog({
  open,
  onOpenChange,
  position,
  transition,
  onSave,
}: TransitionEditDialogProps) {
  const [type, setType] = useState(transition.type);
  const [duration, setDuration] = useState(transition.durationSeconds);

  useEffect(() => {
    if (open) {
      setType(transition.type);
      setDuration(transition.durationSeconds);
    }
  }, [open, transition]);

  const handleSave = () => {
    onSave(position, { type, durationSeconds: duration });
    onOpenChange(false);
  };

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
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-transition-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSITION_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Duration</Label>
              <span className="text-sm text-muted-foreground">{duration.toFixed(2)}s</span>
            </div>
            <Slider
              value={[duration]}
              min={0.25}
              max={3}
              step={0.25}
              onValueChange={([v]) => setDuration(v)}
              data-testid="slider-transition-duration"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-transition">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
