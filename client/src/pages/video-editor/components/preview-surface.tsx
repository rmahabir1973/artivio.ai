import { useRef, useEffect, useState } from "react";
import { Play, Loader2, Film, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type PreviewStatus = 'idle' | 'stale' | 'refreshing' | 'ready' | 'error';

interface PreviewSurfaceProps {
  previewUrl: string | null;
  status: PreviewStatus;
  clipCount: number;
  totalDuration: number;
  onForceRefresh?: () => void;
  errorMessage?: string;
  className?: string;
  timelineTime?: number;
  isTimelinePlaying?: boolean;
  onTimelineTimeChange?: (time: number) => void;
}

export function PreviewSurface({ 
  previewUrl, 
  status,
  clipCount, 
  totalDuration,
  onForceRefresh,
  errorMessage,
  className,
  timelineTime,
  isTimelinePlaying,
  onTimelineTimeChange,
}: PreviewSurfaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  
  // Preserve playback position when preview URL changes
  useEffect(() => {
    if (videoRef.current && previewUrl) {
      const video = videoRef.current;
      if (currentTime > 0 && currentTime < video.duration) {
        video.currentTime = currentTime;
      }
    }
  }, [previewUrl]);
  
  // Sync preview video to timeline time (when timeline scrubbing)
  useEffect(() => {
    if (videoRef.current && timelineTime !== undefined && !isSeeking) {
      const video = videoRef.current;
      if (Math.abs(video.currentTime - timelineTime) > 0.1) {
        video.currentTime = timelineTime;
      }
    }
  }, [timelineTime, isSeeking]);
  
  // Sync play/pause with timeline
  useEffect(() => {
    if (videoRef.current && isTimelinePlaying !== undefined) {
      const video = videoRef.current;
      if (isTimelinePlaying && video.paused) {
        video.play().catch(() => {});
      } else if (!isTimelinePlaying && !video.paused) {
        video.pause();
      }
    }
  }, [isTimelinePlaying]);
  
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      if (onTimelineTimeChange && !isSeeking) {
        onTimelineTimeChange(time);
      }
    }
  };
  
  const handleSeeking = () => setIsSeeking(true);
  const handleSeeked = () => setIsSeeking(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'refreshing':
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating...
          </Badge>
        );
      case 'stale':
        return (
          <Badge variant="outline" className="gap-1 text-yellow-600 dark:text-yellow-400">
            <RefreshCw className="h-3 w-3" />
            Pending update
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      case 'ready':
        return null;
      default:
        return null;
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-muted/20 rounded-lg", className)} data-testid="preview-surface">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Preview</span>
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {clipCount > 0 && (
            <>
              <span>{clipCount} clip{clipCount !== 1 ? 's' : ''}</span>
              <span className="text-muted-foreground/50">|</span>
              <span>{formatDuration(totalDuration)}</span>
            </>
          )}
          {previewUrl && onForceRefresh && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={onForceRefresh}
              disabled={status === 'refreshing'}
              data-testid="button-force-refresh"
            >
              <RefreshCw className={cn("h-3 w-3", status === 'refreshing' && "animate-spin")} />
            </Button>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {previewUrl ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center gap-3">
            <video
              ref={videoRef}
              src={previewUrl}
              controls
              className={cn(
                "max-w-full max-h-[calc(100%-48px)] rounded-lg shadow-lg transition-opacity",
                status === 'refreshing' && "opacity-70"
              )}
              onTimeUpdate={handleTimeUpdate}
              onSeeking={handleSeeking}
              onSeeked={handleSeeked}
              data-testid="preview-video"
            />
            {/* Always visible refresh button */}
            {onForceRefresh && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onForceRefresh}
                disabled={status === 'refreshing'}
                data-testid="button-refresh-preview"
              >
                {status === 'refreshing' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Preview
                  </>
                )}
              </Button>
            )}
            {status === 'refreshing' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm">Updating preview...</span>
                </div>
              </div>
            )}
          </div>
        ) : clipCount > 0 ? (
          <div className="text-center space-y-4">
            {status === 'refreshing' ? (
              <>
                <div className="h-32 w-48 mx-auto rounded-lg bg-muted/50 flex items-center justify-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary/50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Generating first preview...
                </p>
              </>
            ) : status === 'stale' ? (
              <>
                <div className="h-32 w-48 mx-auto rounded-lg bg-muted/50 flex items-center justify-center">
                  <RefreshCw className="h-12 w-12 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Preview will generate automatically...
                </p>
              </>
            ) : status === 'error' ? (
              <>
                <div className="h-32 w-48 mx-auto rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-12 w-12 text-destructive/50" />
                </div>
                <div>
                  <p className="text-sm text-destructive mb-2">
                    {errorMessage || "Failed to generate preview"}
                  </p>
                  {onForceRefresh && (
                    <Button 
                      onClick={onForceRefresh}
                      variant="outline"
                      size="sm"
                      data-testid="button-retry-preview"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="h-32 w-48 mx-auto rounded-lg bg-muted/50 flex items-center justify-center">
                  <Film className="h-12 w-12 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {clipCount} clip{clipCount !== 1 ? 's' : ''} ready
                  </p>
                  {onForceRefresh && (
                    <Button 
                      onClick={onForceRefresh}
                      data-testid="button-generate-preview"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Generate Preview
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center">
            <Film className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Add clips to preview your video
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
