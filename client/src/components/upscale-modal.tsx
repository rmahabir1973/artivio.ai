import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

interface UpscaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: 'image' | 'video';
  sourceUrl: string;
  parentGenerationId?: string;
  onSuccess?: () => void;
}

const IMAGE_UPSCALE_COSTS = {
  '2': 10,
  '4': 20,
  '8': 40,
} as const;

const VIDEO_UPSCALE_COSTS = {
  '2': 80,
  '4': 150,
} as const;

export function UpscaleModal({ 
  open, 
  onOpenChange, 
  contentType, 
  sourceUrl, 
  parentGenerationId,
  onSuccess 
}: UpscaleModalProps) {
  const { toast } = useToast();
  const [selectedFactor, setSelectedFactor] = useState<string>('2');

  const { data: user } = useQuery<{ credits: number }>({
    queryKey: ['/api/auth/user'],
  });

  const costs = contentType === 'image' ? IMAGE_UPSCALE_COSTS : VIDEO_UPSCALE_COSTS;
  const currentCost = costs[selectedFactor as keyof typeof costs] || 0;
  const currentCredits = user?.credits || 0;
  const creditsAfter = currentCredits - currentCost;

  const getWarningLevel = () => {
    if (currentCredits < currentCost) return 'insufficient';
    if (creditsAfter < 100) return 'low';
    if (creditsAfter < 500) return 'moderate';
    return 'normal';
  };

  const warningLevel = getWarningLevel();

  const warningColors = {
    insufficient: 'text-destructive',
    low: 'text-orange-500',
    moderate: 'text-yellow-500',
    normal: 'text-primary',
  };

  const warningMessages = {
    insufficient: 'Insufficient credits',
    low: 'Low credits remaining',
    moderate: 'Moderate credits remaining',
    normal: 'Ready to upscale',
  };

  const upscaleMutation = useMutation({
    mutationFn: async () => {
      const endpoint = contentType === 'image' ? '/api/upscale/image' : '/api/upscale/video';
      return await apiRequest('POST', endpoint, {
        sourceUrl,
        upscaleFactor: selectedFactor,
        parentGenerationId,
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Upscaling Started",
        description: `Your ${contentType} is being upscaled. Check the generation queue for progress.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/generations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/generations/recent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Upscale Failed",
        description: error.message || "Failed to start upscaling",
        variant: "destructive",
      });
    },
  });

  const handleUpscale = () => {
    if (warningLevel === 'insufficient') {
      toast({
        title: "Insufficient Credits",
        description: `You need ${currentCost} credits but only have ${currentCredits}.`,
        variant: "destructive",
      });
      return;
    }
    upscaleMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Upscale {contentType === 'image' ? 'Image' : 'Video'}
          </DialogTitle>
          <DialogDescription>
            Choose an upscaling factor to enhance your {contentType} with Topaz AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Upscale Factor Selection */}
          <div className="space-y-3">
            <Label>Upscale Factor</Label>
            <RadioGroup value={selectedFactor} onValueChange={setSelectedFactor}>
              {Object.entries(costs).map(([factor, cost]) => (
                <div
                  key={factor}
                  className="flex items-center justify-between space-x-2 rounded-lg border p-4 hover-elevate"
                  data-testid={`upscale-option-${factor}x`}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={factor} id={`factor-${factor}`} data-testid={`radio-${factor}x`} />
                    <Label htmlFor={`factor-${factor}`} className="cursor-pointer font-medium">
                      {factor}x Upscale
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" data-testid={`cost-${factor}x`}>
                      {cost} credits
                    </Badge>
                    {contentType === 'image' && (
                      <span className="text-xs text-muted-foreground">
                        {factor === '2' && 'Up to 2K'}
                        {factor === '4' && '4K'}
                        {factor === '8' && '8K'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Credit Preview */}
          <div className="space-y-2 rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Credits:</span>
              <span className="font-medium" data-testid="credits-current">{currentCredits.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Upscale Cost:</span>
              <span className="font-medium" data-testid="credits-cost">-{currentCost.toLocaleString()}</span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${warningColors[warningLevel]}`}>
                {warningMessages[warningLevel]}
              </span>
              <span className={`font-bold ${warningColors[warningLevel]}`} data-testid="credits-after">
                {creditsAfter.toLocaleString()}
              </span>
            </div>
            {warningLevel !== 'insufficient' && currentCost > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {Math.floor(creditsAfter / currentCost)} more {contentType} upscale{Math.floor(creditsAfter / currentCost) !== 1 ? 's' : ''} at this rate
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={upscaleMutation.isPending}
            data-testid="button-cancel-upscale"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpscale}
            disabled={upscaleMutation.isPending || warningLevel === 'insufficient'}
            data-testid="button-confirm-upscale"
          >
            {upscaleMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Upscaling...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Upscale ({currentCost} credits)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
