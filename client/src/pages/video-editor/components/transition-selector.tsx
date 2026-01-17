import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TransitionConfig {
  type: string;
  duration: number;
}

export interface TransitionSelectorProps {
  value?: TransitionConfig;
  onChange: (config: TransitionConfig | undefined) => void;
  className?: string;
  compact?: boolean;
}

export const TRANSITION_OPTIONS = [
  { value: 'none', label: 'None', category: 'basic' },
  { value: 'fade', label: 'Fade', category: 'basic' },
  { value: 'dissolve', label: 'Dissolve', category: 'basic' },
  { value: 'fadeblack', label: 'Fade to Black', category: 'fade' },
  { value: 'fadewhite', label: 'Fade to White', category: 'fade' },
  { value: 'wipeleft', label: 'Wipe Left', category: 'wipe' },
  { value: 'wiperight', label: 'Wipe Right', category: 'wipe' },
  { value: 'wipeup', label: 'Wipe Up', category: 'wipe' },
  { value: 'wipedown', label: 'Wipe Down', category: 'wipe' },
  { value: 'slideleft', label: 'Slide Left', category: 'slide' },
  { value: 'slideright', label: 'Slide Right', category: 'slide' },
  { value: 'slideup', label: 'Slide Up', category: 'slide' },
  { value: 'slidedown', label: 'Slide Down', category: 'slide' },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  basic: 'Basic',
  fade: 'Fade Effects',
  wipe: 'Wipe Effects',
  slide: 'Slide Effects',
};

export function TransitionSelector({
  value,
  onChange,
  className,
  compact = false,
}: TransitionSelectorProps) {
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState(value?.duration || 1.0);

  // Sync internal duration state when props change (e.g., selecting a different clip)
  useEffect(() => {
    setDuration(value?.duration || 1.0);
  }, [value?.duration]);

  const currentTransition = TRANSITION_OPTIONS.find(
    opt => opt.value === (value?.type || 'none')
  );

  const handleTransitionChange = (transitionType: string) => {
    if (transitionType === 'none') {
      onChange(undefined);
    } else {
      onChange({ type: transitionType, duration });
    }
  };

  const handleDurationChange = (newDuration: number) => {
    setDuration(newDuration);
    if (value?.type && value.type !== 'none') {
      onChange({ type: value.type, duration: newDuration });
    }
  };

  const groupedOptions = TRANSITION_OPTIONS.reduce((acc, option) => {
    if (!acc[option.category]) {
      acc[option.category] = [];
    }
    acc[option.category].push(option);
    return acc;
  }, {} as Record<string, typeof TRANSITION_OPTIONS[number][]>);

  if (compact) {
    return (
      <Select
        value={value?.type || 'none'}
        onValueChange={handleTransitionChange}
      >
        <SelectTrigger className={cn("w-32", className)} data-testid="select-transition-compact">
          <SelectValue placeholder="Transition" />
        </SelectTrigger>
        <SelectContent>
          {TRANSITION_OPTIONS.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
          data-testid="button-transition-selector"
        >
          <Sparkles className="h-4 w-4" />
          {currentTransition?.label || 'Transition'}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Transition Type</Label>
            <Select
              value={value?.type || 'none'}
              onValueChange={handleTransitionChange}
            >
              <SelectTrigger data-testid="select-transition-type">
                <SelectValue placeholder="Select transition" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {Object.entries(groupedOptions).map(([category, options]) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {CATEGORY_LABELS[category] || category}
                    </div>
                    {options.map(option => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        data-testid={`select-item-transition-${option.value}`}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {value?.type && value.type !== 'none' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Duration</Label>
                <span className="text-sm text-muted-foreground">
                  {duration.toFixed(1)}s
                </span>
              </div>
              <Slider
                value={[duration]}
                onValueChange={([v]) => handleDurationChange(v)}
                min={0.2}
                max={3.0}
                step={0.1}
                className="w-full"
                data-testid="slider-transition-duration"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0.2s</span>
                <span>3.0s</span>
              </div>
            </div>
          )}

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              {value?.type && value.type !== 'none'
                ? `${currentTransition?.label} transition will be applied between clips.`
                : 'No transition will be applied. Clips will cut directly.'}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TransitionBadge({
  type,
  onClick,
  className,
}: {
  type: string;
  onClick?: () => void;
  className?: string;
}) {
  const transition = TRANSITION_OPTIONS.find(opt => opt.value === type);

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
        "bg-primary/10 text-primary hover-elevate cursor-pointer",
        className
      )}
      data-testid={`badge-transition-${type}`}
    >
      <Sparkles className="h-3 w-3" />
      {transition?.label || type}
    </button>
  );
}

export default TransitionSelector;
