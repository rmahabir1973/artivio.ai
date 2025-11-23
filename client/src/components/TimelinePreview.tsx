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
  url: string; // Cache by both ID and URL
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
  const [metadataError, setMetadataError] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load metadata for all clips with cancellation support - keyed by both ID and URL
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
    setMetadataError(false);
    const metadata = new Map<string, ClipMetadata>();

    const loadClipMetadata = async () => {
      const promises = clips.map((clip) => {
        // Create cache key from both ID and URL for better deduplication
        const cacheKey = `${clip.id}-${clip.url}`;
        
        return new Promise<void>((resolve) => {
          if (abortController.signal.aborted) {
            resolve();
            return;
          }

          const video = document.createElement('video');
          video.preload = 'metadata';
          video.crossOrigin = 'anonymous';
          
          const cleanup = () => {
            video.src = '';
            video.load();
          };

          const handleSuccess = () => {
            if (!abortController.signal.aborted && video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
              metadata.set(cacheKey, {
                id: clip.id,
                url: clip.url,
                duration: video.duration,
                loaded: true,
              });
            }
            cleanup();
            resolve();
          };

          const handleError = () => {
            if (!abortController.signal.aborted) {
              // Try to use provided duration first
              if (clip.duration && clip.duration > 0) {
                metadata.set(cacheKey, {
                  id: clip.id,
                  url: clip.url,
                  duration: clip.duration,
                  loaded: false,
                });
              } else {
                // Use a reasonable default fallback (8 seconds) for AI-generated videos
                // This allows the timeline to work even if metadata loading fails (CORS issues, etc)
                metadata.set(cacheKey, {
                  id: clip.id,
                  url: clip.url,
                  duration: 8, // Default duration for AI-generated videos
                  loaded: false,
                });
              }
            }
            cleanup();
            resolve();
          };

          video.onloadedmetadata = handleSuccess;
          video.onerror = handleError;
          
          // Add timeout to prevent hanging
          setTimeout(() => {
            if (!metadata.has(cacheKey)) {
              handleError();
            }
          }, 5000);

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

  // Get clip duration from metadata - no fallback to 10s
  const getClipDuration = (clip: VideoClip): number | null => {
    const cacheKey = `${clip.id}-${clip.url}`;
    const meta = clipMetadata.get(cacheKey);
    
    if (meta?.duration) {
      return meta.duration;
    }
    
    // Return provided duration if available
    if (clip.duration && clip.duration > 0) {
      return clip.duration;
    }
    
    // Return null if no duration available (will show error state)
    return null;
  };

  // Get effective trim with proper defaults (handle endSeconds=0 case)
  const getEffectiveTrim = (clip: VideoClip): { startSeconds: number; endSeconds: number } | null => {
    const clipDuration = getClipDuration(clip);
    
    // Can't determine trim if duration is unknown
    if (clipDuration === null) {
      return null;
    }
    
    if (!clip.trim) {
      return { startSeconds: 0, endSeconds: clipDuration };
    }
    
    // If endSeconds is 0 or not set, default to clip duration
    const endSeconds = clip.trim.endSeconds > 0 ? clip.trim.endSeconds : clipDuration;
    
    return {
      startSeconds: clip.trim.startSeconds || 0,
      endSeconds: Math.min(endSeconds, clipDuration), // Clamp to actual duration
    };
  };

  // Calculate total timeline duration accounting for trims and speed
  useEffect(() => {
    if (clipMetadata.size === 0 || isLoading) return;

    let total = 0;
    let hasInvalidClip = false;

    for (const clip of clips) {
      const trim = getEffectiveTrim(clip);
      if (!trim) {
        hasInvalidClip = true;
        break;
      }
      
      const trimmedDuration = Math.max(0, trim.endSeconds - trim.startSeconds);
      const adjustedDuration = trimmedDuration / (clip.speedFactor || 1);
      total += adjustedDuration;
    }
    
    if (!hasInvalidClip) {
      setTotalDuration(total);
    }
  }, [clips, clipMetadata, isLoading]);

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
      if (!trim) continue;
      
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

  // Advance to next clip with proper timeline synchronization
  const advanceToNextClip = () => {
    if (currentClipIndex < clips.length - 1) {
      // Calculate accumulated time up to the new clip
      let accumulatedTime = 0;
      for (let i = 0; i <= currentClipIndex; i++) {
        const clip = clips[i];
        const trim = getEffectiveTrim(clip);
        if (!trim) continue;
        
        const trimmedDuration = Math.max(0, trim.endSeconds - trim.startSeconds);
        const adjustedDuration = trimmedDuration / (clip.speedFactor || 1);
        accumulatedTime += adjustedDuration;
      }
      
      // Set currentTime to the start of the next clip
      setCurrentTime(accumulatedTime);
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
      if (!trim) return;
      
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
        if (!t) continue;
        
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
    if (!trim) return;
    
    // Pause first before changing source
    video.pause();
    video.currentTime = 0;
    
    // Clear any previous error state and reset video element
    video.error = null;
    video.src = '';
    
    // Wait a tick then set new src to ensure proper reset
    setTimeout(() => {
      video.src = clip.url;
      video.playbackRate = clip.speedFactor || 1;
      
      // Trigger load
      video.load();
      
      // Wait for metadata to load before seeking and playing
      const handleLoadedMetadata = () => {
        try {
          video.currentTime = trim.startSeconds;
          if (isPlaying) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise.catch((error) => {
                console.error("Playback error:", error);
              });
            }
          }
        } catch (e) {
          console.error("Error seeking or playing:", e);
        }
      };

      const handleError = () => {
        console.error("Video error event:", video.error, "for URL:", clip.url);
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      video.addEventListener('error', handleError, { once: true });
      
      // Fallback if metadata doesn't load
      const timeoutId = setTimeout(() => {
        if (video.readyState < 1) {
          console.warn("Video metadata failed to load after 3 seconds, attempting playback anyway");
          handleLoadedMetadata();
        }
      }, 3000);
      
      return () => {
        clearTimeout(timeoutId);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('error', handleError);
      };
    }, 0);
  }, [currentClipIndex, clips, clipMetadata, isPlaying]);

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

  if (metadataError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Timeline Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 bg-muted rounded-md">
            <div className="flex flex-col items-center gap-2 text-center p-4">
              <p className="text-sm text-destructive font-medium">Unable to load video metadata</p>
              <p className="text-xs text-muted-foreground">
                Some videos could not be loaded. Please check that all video URLs are valid and accessible.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentClip = clips[currentClipIndex];
  const currentClipDuration = getClipDuration(currentClip);
  const currentClipTrim = getEffectiveTrim(currentClip);

  // Don't render if we can't get duration for current clip
  if (!currentClipDuration || !currentClipTrim) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Timeline Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 bg-muted rounded-md">
            <p className="text-muted-foreground">Loading clip information...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
            preload="metadata"
            crossOrigin="anonymous"
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
                // Calculate accumulated time up to previous clip
                let accumulatedTime = 0;
                for (let i = 0; i < currentClipIndex - 1; i++) {
                  const c = clips[i];
                  const t = getEffectiveTrim(c);
                  if (!t) continue;
                  
                  const trimmedDuration = Math.max(0, t.endSeconds - t.startSeconds);
                  accumulatedTime += trimmedDuration / (c.speedFactor || 1);
                }
                
                setCurrentTime(accumulatedTime);
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
            onClick={advanceToNextClip}
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
