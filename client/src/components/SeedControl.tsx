import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Shuffle, Lock, LockOpen, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface SeedControlProps {
  seed?: number;
  onSeedChange: (seed: number | undefined) => void;
  locked?: boolean;
  onLockChange?: (locked: boolean) => void;
  className?: string;
}

// FULLY CONTROLLED component - no internal state for seed or locked
// Parent component (generate-video.tsx) manages all state
export function SeedControl({
  seed,
  onSeedChange,
  locked = false,
  onLockChange,
  className = "",
}: SeedControlProps) {
  const generateRandomSeed = () => {
    const newSeed = Math.floor(Math.random() * 2147483647) + 1;
    onSeedChange(newSeed);
  };

  const handleLockToggle = (checked: boolean) => {
    onLockChange?.(checked);
  };

  const handleSeedInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "") {
      onSeedChange(undefined);
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue > 0 && numValue <= 2147483647) {
        onSeedChange(numValue);
      }
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="seed-input" className="text-sm font-medium">
            Seed
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                data-testid="button-seed-info"
              >
                <Info className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">About Seeds</h4>
                <p className="text-sm text-muted-foreground">
                  Seeds enable reproducible AI generation. Using the same seed with identical
                  parameters will generate similar results. Lock the seed to keep it the same
                  across multiple generations, or unlock to auto-generate new seeds each time.
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                {locked ? (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <LockOpen className="h-4 w-4 text-muted-foreground" />
                )}
                <Switch
                  checked={locked}
                  onCheckedChange={handleLockToggle}
                  data-testid="switch-lock-seed"
                  aria-label="Lock seed"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm">
                {locked
                  ? "Seed locked - will stay the same"
                  : "Seed unlocked - will auto-generate"}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          id="seed-input"
          type="number"
          value={seed || ""}
          onChange={handleSeedInputChange}
          placeholder="Auto-generate"
          min={1}
          max={2147483647}
          className="flex-1"
          data-testid="input-seed"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={generateRandomSeed}
              data-testid="button-generate-seed"
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">Generate random seed</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
