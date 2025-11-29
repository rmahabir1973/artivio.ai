import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Library, Sparkles, Clock, CheckCircle2, Loader2 } from "lucide-react";

interface GenerationProgressProps {
  isActive: boolean;
  modelId?: string;
  generationType: "video" | "image" | "audio" | "lip-sync";
  onComplete?: () => void;
}

const MODEL_TIMING_ESTIMATES: Record<string, number> = {
  "veo-3.1-fast": 120,
  "veo-3.1": 180,
  "veo-3.1-first-and-last-frames": 180,
  "veo-3.1-fast-reference-2-video": 150,
  "veo-3": 180,
  "runway-gen3-alpha-turbo": 150,
  "seedance-1-pro": 180,
  "seedance-1-lite": 120,
  "wan-2.5": 150,
  "kling-2.5-turbo": 120,
  "sora-2-pro": 240,
  "seedream-4.0": 60,
  "4o-image": 45,
  "flux-kontext": 60,
  "nano-banana": 30,
  "elevenlabs-sfx": 30,
  "lip-sync": 150,
  "default-video": 180,
  "default-image": 60,
  "default-audio": 30,
};

const STATUS_MESSAGES = [
  { threshold: 0, message: "Initializing your request..." },
  { threshold: 10, message: "Connecting to AI servers..." },
  { threshold: 20, message: "Processing your creative vision..." },
  { threshold: 35, message: "AI is working its magic..." },
  { threshold: 50, message: "Creating your masterpiece..." },
  { threshold: 65, message: "Adding finishing touches..." },
  { threshold: 80, message: "Almost there..." },
  { threshold: 90, message: "Final processing..." },
  { threshold: 95, message: "Wrapping up..." },
];

function getEstimatedTime(modelId: string | undefined, generationType: string): number {
  if (modelId && MODEL_TIMING_ESTIMATES[modelId]) {
    return MODEL_TIMING_ESTIMATES[modelId];
  }
  
  switch (generationType) {
    case "video":
      return MODEL_TIMING_ESTIMATES["default-video"];
    case "image":
      return MODEL_TIMING_ESTIMATES["default-image"];
    case "audio":
      return MODEL_TIMING_ESTIMATES["default-audio"];
    case "lip-sync":
      return MODEL_TIMING_ESTIMATES["lip-sync"];
    default:
      return 120;
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return secs > 0 ? `${mins} min ${secs} sec` : `${mins} min`;
  }
  return `${secs} sec`;
}

function getStatusMessage(progress: number): string {
  for (let i = STATUS_MESSAGES.length - 1; i >= 0; i--) {
    if (progress >= STATUS_MESSAGES[i].threshold) {
      return STATUS_MESSAGES[i].message;
    }
  }
  return STATUS_MESSAGES[0].message;
}

function getModelDisplayName(modelId: string | undefined): string {
  if (!modelId) return "AI Model";
  
  const names: Record<string, string> = {
    "veo-3.1-fast": "Veo 3.1 Fast",
    "veo-3.1": "Veo 3.1 Quality",
    "veo-3.1-first-and-last-frames": "Veo 3.1 F&L Frames",
    "veo-3.1-fast-reference-2-video": "Veo 3.1 Reference",
    "veo-3": "Veo 3",
    "runway-gen3-alpha-turbo": "Runway Gen-3",
    "seedance-1-pro": "Seedance Pro",
    "seedance-1-lite": "Seedance Lite",
    "wan-2.5": "Wan 2.5",
    "kling-2.5-turbo": "Kling 2.5 Turbo",
    "sora-2-pro": "Sora 2 Pro",
    "seedream-4.0": "Seedream 4.0",
    "4o-image": "4o Image",
    "flux-kontext": "Flux Kontext",
    "nano-banana": "Nano Banana",
    "elevenlabs-sfx": "ElevenLabs SFX",
  };
  
  return names[modelId] || modelId;
}

export function GenerationProgress({
  isActive,
  modelId,
  generationType,
  onComplete,
}: GenerationProgressProps) {
  const [, setLocation] = useLocation();
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  const estimatedTime = getEstimatedTime(modelId, generationType);

  const handleRedirect = useCallback(() => {
    setLocation("/history");
  }, [setLocation]);

  useEffect(() => {
    if (isActive && !startTime) {
      setStartTime(Date.now());
      setProgress(0);
      setHasCompleted(false);
      setTimeRemaining(estimatedTime);
    } else if (!isActive) {
      setStartTime(null);
      setProgress(0);
      setHasCompleted(false);
    }
  }, [isActive, startTime, estimatedTime]);

  useEffect(() => {
    if (!isActive || !startTime) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const newProgress = Math.min((elapsed / estimatedTime) * 100, 100);
      const remaining = Math.max(0, Math.ceil(estimatedTime - elapsed));

      setProgress(newProgress);
      setTimeRemaining(remaining);

      if (newProgress >= 100 && !hasCompleted) {
        setHasCompleted(true);
        onComplete?.();
        
        setTimeout(() => {
          handleRedirect();
        }, 2000);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, startTime, estimatedTime, hasCompleted, onComplete, handleRedirect]);

  if (!isActive) return null;

  const statusMessage = getStatusMessage(progress);
  const modelName = getModelDisplayName(modelId);

  return (
    <Card className="mt-6 border-purple-500/30 bg-gradient-to-br from-purple-900/20 via-violet-900/10 to-transparent overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-purple-500 blur-lg opacity-40 animate-pulse" />
            <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
              {hasCompleted ? (
                <CheckCircle2 className="w-6 h-6 text-white" />
              ) : (
                <Sparkles className="w-6 h-6 text-white animate-pulse" />
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4 mb-2">
              <div>
                <h3 className="text-base font-semibold text-white">
                  {hasCompleted ? "Generation Complete!" : "Creating Your Content"}
                </h3>
                <p className="text-sm text-purple-300/70">
                  {modelName}
                </p>
              </div>
              
              {!hasCompleted && (
                <div className="flex items-center gap-2 text-sm text-purple-300/70">
                  <Clock className="w-4 h-4" />
                  <span>~{formatTime(timeRemaining)} left</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Progress 
                  value={progress} 
                  className="h-3 bg-purple-900/30"
                />
                <div 
                  className="absolute inset-0 h-3 rounded-full overflow-hidden pointer-events-none"
                  style={{
                    background: `linear-gradient(90deg, transparent ${progress - 5}%, rgba(168, 85, 247, 0.4) ${progress}%, transparent ${progress + 5}%)`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {!hasCompleted && (
                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  )}
                  <span className="text-sm text-purple-200">
                    {hasCompleted ? "Redirecting to Library..." : statusMessage}
                  </span>
                </div>
                <span className="text-sm font-medium text-purple-300">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRedirect}
                className="border-purple-500/30 hover:bg-purple-500/20 text-purple-200"
                data-testid="button-view-library"
              >
                <Library className="w-4 h-4 mr-2" />
                View in Library
              </Button>
              
              {hasCompleted && (
                <span className="text-sm text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Your creation should be ready!
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
