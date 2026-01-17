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
  clipIndex: number;
  transition: ClipTransitionLocal | null;
  onSave: (clipIndex: number, updates: Partial<ClipTransitionLocal>) => void;
  onRemove?: () => void;
}

const TRANSITION_OPTIONS: { value: TransitionType; label: string; category: string }[] = [
  { value: 'fade', label: 'Fade', category: 'Fade' },
  { value: 'dissolve', label: 'Dissolve', category: 'Fade' },
  { value: 'fadeblack', label: 'Fade Black', category: 'Fade' },
  { value: 'fadewhite', label: 'Fade White', category: 'Fade' },
  { value: 'wipeleft', label: 'Wipe Left', category: 'Wipe' },
  { value: 'wiperight', label: 'Wipe Right', category: 'Wipe' },
  { value: 'wipeup', label: 'Wipe Up', category: 'Wipe' },
  { value: 'wipedown', label: 'Wipe Down', category: 'Wipe' },
  { value: 'slideleft', label: 'Slide Left', category: 'Slide' },
  { value: 'slideright', label: 'Slide Right', category: 'Slide' },
  { value: 'slideup', label: 'Slide Up', category: 'Slide' },
  { value: 'slidedown', label: 'Slide Down', category: 'Slide' },
];

export function TransitionEditDialog({
  open,
  onOpenChange,
  clipIndex,
  transition,
  onSave,
  onRemove,
}: TransitionEditDialogProps) {
  const [type, setType] = useState(transition?.type ?? 'fade');
  const [duration, setDuration] = useState(transition?.durationSeconds ?? 1.0);

  useEffect(() => {
    if (open && transition) {
      setType(transition.type);
      setDuration(transition.durationSeconds);
    }
  }, [open, transition]);

  const handleSave = () => {
    onSave(clipIndex, { type, durationSeconds: duration });
    onOpenChange(false);
  };

  const handleRemove = () => {
    onRemove?.();
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
            Customize the transition between clips {clipIndex + 1} and {clipIndex + 2}
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
        
        <DialogFooter className="flex justify-between gap-2 sm:justify-between">
          <div>
            {onRemove && (
              <Button variant="destructive" onClick={handleRemove} data-testid="button-remove-transition">
                Remove
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} data-testid="button-save-transition">
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
