import { useRef, useState, useEffect } from "react";
import { Play, Pause, SkipForward, SkipBack, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

interface VideoClip {
  id: string;
  url: string;
  duration?: number; // Optional - will be loaded from metadata
  trim?: {
    startSeconds: number;
    endSeconds: number;
  };
  speedFactor?: number;
}

interface TimelinePreviewProps {
  clips: VideoClip[];
  className?: string;
}

interface ClipMetadata {
  id: string;
  duration: number;
  loaded: boolean;
}

export function TimelinePreview({ clips, className = "" }: TimelinePreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [clipMetadata, setClipMetadata] = useState<Map<string, ClipMetadata>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load metadata for all clips with cancellation support
  useEffect(() => {
    if (clips.length === 0) {
      setIsLoading(false);
      return;
    }

    // Cancel previous metadata loading if still in progress
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setIsLoading(true);
    const metadata = new Map<string, ClipMetadata>();

    const loadClipMetadata = async () => {
      const promises = clips.map((clip) => {
        return new Promise<void>((resolve) => {
          if (abortController.signal.aborted) {
            resolve();
            return;
          }

          const video = document.createElement('video');
          video.preload = 'metadata';
          
          const cleanup = () => {
            video.src = '';
            video.load();
          };

          video.onloadedmetadata = () => {
            if (!abortController.signal.aborted) {
              metadata.set(clip.id, {
                id: clip.id,
                duration: video.duration,
                loaded: true,
              });
            }
            cleanup();
            resolve();
          };

          video.onerror = () => {
            if (!abortController.signal.aborted) {
              // Fallback to provided duration or default to 10s
              metadata.set(clip.id, {
                id: clip.id,
                duration: clip.duration || 10,
                loaded: false,
              });
            }
            cleanup();
            resolve();
          };

          video.src = clip.url;
        });
      });

      await Promise.all(promises);
      
      if (!abortController.signal.aborted) {
        setClipMetadata(metadata);
        setIsLoading(false);
      }
    };

    loadClipMetadata();

    return () => {
      abortController.abort();
      abortControllerRef.current = null;
    };
  }, [clips]);

  // Get clip duration from metadata or fallback
  const getClipDuration = (clip: VideoClip): number => {
    const meta = clipMetadata.get(clip.id);
    return meta?.duration || clip.duration || 10;
  };

  // Get effective trim with proper defaults (handle endSeconds=0 case)
  const getEffectiveTrim = (clip: VideoClip): { startSeconds: number; endSeconds: number } => {
    const clipDuration = getClipDuration(clip);
    
    if (!clip.trim) {
      return { startSeconds: 0, endSeconds: clipDuration };
    }
    
    // If endSeconds is 0 or not set, default to clip duration
    const endSeconds = clip.trim.endSeconds > 0 ? clip.trim.endSeconds : clipDuration;
    
    return {
      startSeconds: clip.trim.startSeconds || 0,
      endSeconds: endSeconds,
    };
  };

  // Calculate total timeline duration accounting for trims and speed
  useEffect(() => {
    if (clipMetadata.size === 0) return;

    const total = clips.reduce((sum, clip) => {
      const trim = getEffectiveTrim(clip);
      const trimmedDuration = Math.max(0, trim.endSeconds - trim.startSeconds);
      const adjustedDuration = trimmedDuration / (clip.speedFactor || 1);
      return sum + adjustedDuration;
    }, 0);
    
    setTotalDuration(total);
  }, [clips, clipMetadata]);

  // Handle video playback
  const togglePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Handle timeline scrubbing
  const handleSeek = (value: number[]) => {
    const targetTime = value[0];
    setCurrentTime(targetTime);
    
    // Find which clip this time falls into
    let accumulatedTime = 0;
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const trim = getEffectiveTrim(clip);
      const trimmedDuration = Math.max(0, trim.endSeconds - trim.startSeconds);
      const adjustedDuration = trimmedDuration / (clip.speedFactor || 1);
      
      if (targetTime <= accumulatedTime + adjustedDuration) {
        // This is the clip we want
        if (currentClipIndex !== i) {
          setCurrentClipIndex(i);
        }
        
        // Calculate the position within this clip
        const timeIntoClip = targetTime - accumulatedTime;
        const actualVideoTime = trim.startSeconds + (timeIntoClip * (clip.speedFactor || 1));
        
        if (videoRef.current) {
          videoRef.current.currentTime = actualVideoTime;
        }
        break;
      }
      
      accumulatedTime += adjustedDuration;
    }
  };

  // Advance to next clip
  const advanceToNextClip = () => {
    if (currentClipIndex < clips.length - 1) {
      setCurrentClipIndex(currentClipIndex + 1);
    } else {
      // End of timeline
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
      setCurrentTime(totalDuration);
    }
  };

  // Update currentTime as video plays
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const clip = clips[currentClipIndex];
      if (!clip) return;

      const trim = getEffectiveTrim(clip);
      const videoTime = video.currentTime;
      
      // Check if we've reached the end of the trimmed section
      if (videoTime >= trim.endSeconds - 0.1) { // Small tolerance
        advanceToNextClip();
        return;
      }
      
      // Calculate timeline position
      let accumulatedTime = 0;
      for (let i = 0; i < currentClipIndex; i++) {
        const c = clips[i];
        const t = getEffectiveTrim(c);
        const trimmedDuration = Math.max(0, t.endSeconds - t.startSeconds);
        accumulatedTime += trimmedDuration / (c.speedFactor || 1);
      }
      
      const timeIntoCurrentClip = (videoTime - trim.startSeconds) / (clip.speedFactor || 1);
      setCurrentTime(accumulatedTime + timeIntoCurrentClip);
    };

    const handleEnded = () => {
      // Handle natural end of video (in case timeupdate doesn't catch it)
      advanceToNextClip();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [clips, currentClipIndex, clipMetadata, totalDuration]);

  // Update video source and playback rate when clip changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clips[currentClipIndex]) return;

    const clip = clips[currentClipIndex];
    const trim = getEffectiveTrim(clip);
    
    video.src = clip.url;
    video.currentTime = trim.startSeconds;
    video.playbackRate = clip.speedFactor || 1; // Set playback speed
    
    if (isPlaying) {
      video.play().catch(console.error);
    }
  }, [currentClipIndex, clips, clipMetadata]);

  // Update playback rate when speed changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clips[currentClipIndex]) return;

    const clip = clips[currentClipIndex];
    video.playbackRate = clip.speedFactor || 1;
  }, [clips, currentClipIndex]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (clips.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Timeline Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 bg-muted rounded-md">
            <p className="text-muted-foreground">Select videos to preview timeline</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Timeline Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 bg-muted rounded-md">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading video metadata...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentClip = clips[currentClipIndex];
  const currentClipDuration = getClipDuration(currentClip);
  const currentClipTrim = getEffectiveTrim(currentClip);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Timeline Preview</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              Clip {currentClipIndex + 1}/{clips.length}
            </Badge>
            <Badge variant="secondary">
              {formatTime(totalDuration)} total
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Player */}
        <div className="relative bg-black rounded-md overflow-hidden aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full"
            data-testid="video-preview"
          />
        </div>

        {/* Timeline Scrubber */}
        <div className="space-y-2">
          <Slider
            value={[currentTime]}
            min={0}
            max={totalDuration}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
            data-testid="timeline-scrubber"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span data-testid="text-current-time">{formatTime(currentTime)}</span>
            <span data-testid="text-total-duration">{formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              if (currentClipIndex > 0) {
                setCurrentClipIndex(currentClipIndex - 1);
              }
            }}
            disabled={currentClipIndex === 0}
            data-testid="button-previous-clip"
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          
          <Button
            size="icon"
            onClick={togglePlayPause}
            data-testid="button-play-pause"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              if (currentClipIndex < clips.length - 1) {
                setCurrentClipIndex(currentClipIndex + 1);
              }
            }}
            disabled={currentClipIndex === clips.length - 1}
            data-testid="button-next-clip"
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        {/* Current Clip Info */}
        {currentClip && (
          <div className="p-3 bg-muted rounded-md space-y-1">
            <p className="text-sm font-medium truncate">
              Currently playing: Clip #{currentClipIndex + 1}
            </p>
            <p className="text-xs text-muted-foreground">
              Duration: {formatTime(currentClipDuration)}
            </p>
            {currentClip.trim && currentClip.trim.endSeconds > 0 && (
              <p className="text-xs text-muted-foreground">
                Trimmed: {currentClipTrim.startSeconds}s - {currentClipTrim.endSeconds}s
                {' '}({formatTime(Math.max(0, currentClipTrim.endSeconds - currentClipTrim.startSeconds))})
              </p>
            )}
            {currentClip.speedFactor && currentClip.speedFactor !== 1 && (
              <p className="text-xs text-muted-foreground">
                Speed: {currentClip.speedFactor}x
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
