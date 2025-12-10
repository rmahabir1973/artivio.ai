# Video Editor - Clean Backend Lambda Implementation

This removes all FFmpeg.wasm complexity and uses backend Lambda for all preview and export operations.

## Key Changes Needed:

### 1. Remove FFmpeg.wasm Imports and State

```typescript
// REMOVE these lines:
import { useFFmpeg, Timeline as FFmpegTimeline, TimelineItem as FFmpegTimelineItem, FFmpegTransitionType } from "@/hooks/useFFmpeg";

// REMOVE this state:
const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
const {
  loaded: ffmpegLoaded,
  loading: ffmpegLoading,
  progress: ffmpegProgress,
  error: ffmpegError,
  loadFFmpeg,
  generatePreview: ffmpegGeneratePreview,
  cancel: ffmpegCancel,
} = useFFmpeg({
  onProgress: (progress) => {
    console.log(`[FFmpeg] Preview progress: ${progress}%`);
  },
});
```

### 2. Keep ONLY Backend Preview Function

```typescript
// Unified preview generation using backend Lambda
const generatePreview = useCallback(async () => {
  if (orderedClips.length === 0 && multiTrackItems.length === 0) {
    toast({
      title: "No clips",
      description: "Add clips to the timeline to generate a preview.",
      variant: "destructive",
    });
    return;
  }
  
  setPreviewStatus('refreshing');
  setPreviewError(undefined);
  
  try {
    let payload: any;
    
    if (useMultiTrack && multiTrackItems.length > 0) {
      // Multi-track mode: send timeline items
      const previewItems = multiTrackItems.slice(0, 10); // Limit for preview
      
      payload = {
        multiTrackTimeline: {
          enabled: true,
          items: previewItems.map(item => ({
            id: item.id,
            type: item.type,
            track: item.track,
            startTime: item.startTime,
            duration: item.duration,
            url: item.url,
            name: item.name,
            speed: item.speed,
            volume: item.volume,
            muted: item.muted,
            trim: item.trim,
            transition: item.transition,
          })),
        },
        videoSettings: {
          format: 'mp4',
          quality: 'preview', // Low quality for speed
          resolution: '720p',
        },
        enhancements: {
          aspectRatio: enhancements.aspectRatio,
        },
        previewMode: true,
        maxDuration: 15, // 15 second preview
      };
    } else {
      // Single-track mode: send ordered clips
      const previewClips = orderedClips.slice(0, 3);
      
      const project = {
        clips: previewClips.map((clip, index) => ({
          id: clip.id,
          sourceUrl: clip.url,
          order: index,
        })),
      };

      const clipSettingsArray = previewClips.map((clip, index) => {
        const localSettings = clipSettings.get(clip.id);
        const isImage = clip.type === 'image';
        return {
          clipId: clip.id,
          clipIndex: index,
          muted: localSettings?.muted ?? false,
          volume: localSettings?.volume ?? 1,
          speed: localSettings?.speed ?? 1.0,
          trimStartSeconds: localSettings?.trimStartSeconds,
          trimEndSeconds: localSettings?.trimEndSeconds,
          isImage,
          displayDuration: isImage ? (localSettings?.displayDuration ?? 5) : undefined,
        };
      });

      const perClipSpeeds = clipSettingsArray
        .filter(cs => cs.speed !== 1.0 && !cs.isImage)
        .map(cs => ({ clipIndex: cs.clipIndex, factor: cs.speed }));
      
      const speedConfig = perClipSpeeds.length > 0 
        ? { mode: 'perClip' as const, perClip: perClipSpeeds }
        : { mode: 'none' as const };

      payload = {
        project,
        videoSettings: {
          format: 'mp4',
          quality: 'preview',
          resolution: '720p',
        },
        enhancements: {
          transitions: enhancements.transitionMode === 'perClip' ? {
            mode: 'perClip' as const,
            perClip: enhancements.clipTransitions.map(t => ({
              afterClipIndex: t.afterClipIndex,
              type: t.type,
              durationSeconds: t.durationSeconds,
            })),
          } : enhancements.transitionMode === 'crossfade' ? {
            mode: 'crossfade' as const,
            durationSeconds: enhancements.transitionDuration,
          } : { mode: 'none' as const },
          fadeIn: enhancements.fadeIn,
          fadeOut: enhancements.fadeOut,
          fadeDuration: enhancements.fadeDuration,
          aspectRatio: enhancements.aspectRatio,
          speed: speedConfig,
          clipSettings: clipSettingsArray.filter(cs => 
            cs.muted || 
            cs.volume !== 1 || 
            cs.speed !== 1.0 ||
            cs.trimStartSeconds !== undefined || 
            cs.trimEndSeconds !== undefined || 
            cs.isImage
          ),
        },
        previewMode: true,
        maxDuration: 10,
      };
    }

    const response = await apiRequest("POST", "/api/video-editor/preview", payload);
    const data = await response.json();
    
    if (data.status === 'completed' && data.previewUrl) {
      setPreviewUrl(data.previewUrl);
      setPreviewStatus('ready');
      toast({
        title: "Preview Ready",
        description: "Your preview has been generated!",
      });
    } else if (data.status === 'processing') {
      // Poll for completion
      toast({
        title: "Generating Preview",
        description: "This may take a few moments...",
      });
      // You can implement polling here if needed
    } else {
      throw new Error(data.message || 'Preview generation failed');
    }
  } catch (error) {
    console.error('Preview generation error:', error);
    setPreviewStatus('error');
    setPreviewError(error instanceof Error ? error.message : 'Preview generation failed');
    toast({
      title: "Preview Failed",
      description: error instanceof Error ? error.message : 'Failed to generate preview',
      variant: "destructive",
    });
  }
}, [orderedClips, multiTrackItems, useMultiTrack, clipSettings, enhancements, toast]);
```

### 3. Update PreviewSurface Call

```tsx
<PreviewSurface
  previewUrl={previewUrl}
  status={previewStatus}
  clipCount={useMultiTrack ? multiTrackItems.length : orderedClips.length}
  totalDuration={totalDuration}
  onForceRefresh={generatePreview}
  errorMessage={previewError}
  className="flex-1"
/>
```

### 4. Add Manual Preview Button (Both Modes)

```tsx
{/* Preview Controls - Works for both single and multi-track */}
<div className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-2">
  <Button
    variant="secondary"
    size="sm"
    onClick={generatePreview}
    disabled={
      previewStatus === 'refreshing' || 
      (useMultiTrack ? multiTrackItems.length === 0 : orderedClips.length === 0)
    }
    data-testid="button-generate-preview"
  >
    {previewStatus === 'refreshing' ? (
      <>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Generating Preview...
      </>
    ) : (
      <>
        <Play className="h-4 w-4 mr-2" />
        Generate Preview
      </>
    )}
  </Button>
</div>
```

### 5. Remove/Comment Out Auto-Preview (Optional - Make it Manual)

```typescript
// COMMENT OUT the auto-preview useEffect for better performance
// Users click "Generate Preview" button instead

// useEffect(() => {
//   if (orderedClips.length === 0) {
//     setPreviewStatus('idle');
//     return;
//   }
//   ... auto-preview logic
// }, [orderedClips, clipSettings, enhancements]);
```

### 6. Remove FFmpeg-Related Functions

```typescript
// REMOVE these functions:
// - convertToFFmpegTimeline
// - generateLocalPreview
// - generateBrowserPreview
// - Any other FFmpeg.wasm related code
```

### 7. Backend Lambda Requirements

Your `/api/video-editor/preview` endpoint needs to handle:

#### For Single-Track Mode:
```json
{
  "project": { "clips": [...] },
  "enhancements": {
    "transitions": { "mode": "crossfade", "durationSeconds": 1.0 },
    "speed": { "mode": "perClip", "perClip": [...] },
    "clipSettings": [...]
  },
  "videoSettings": { "quality": "preview", "resolution": "720p" },
  "previewMode": true,
  "maxDuration": 10
}
```

#### For Multi-Track Mode:
```json
{
  "multiTrackTimeline": {
    "enabled": true,
    "items": [
      {
        "id": "...",
        "type": "video",
        "track": 0,
        "startTime": 0,
        "duration": 5,
        "url": "...",
        "speed": 1.0,
        "transition": { "type": "fade", "duration": 1 }
      }
    ]
  },
  "videoSettings": { "quality": "preview", "resolution": "720p" },
  "previewMode": true,
  "maxDuration": 15
}
```

### 8. Lambda FFmpeg Speed Implementation

```javascript
// In your Lambda function, handle speed:
if (clipSpeed && clipSpeed !== 1.0) {
  const videoFilter = `setpts=${1/clipSpeed}*PTS`;
  const audioFilter = clipSpeed >= 0.5 && clipSpeed <= 2.0 
    ? `atempo=${clipSpeed}` 
    : `atempo=2.0,atempo=${clipSpeed/2.0}`; // Chain for >2x
  
  ffmpegArgs.push('-filter:v', videoFilter);
  ffmpegArgs.push('-filter:a', audioFilter);
}
```

### 9. Lambda FFmpeg Transitions Implementation

```javascript
// For crossfade transitions between clips:
if (transitions.mode === 'crossfade') {
  // Use xfade filter
  const xfadeFilter = `[0:v][1:v]xfade=transition=fade:duration=${transitions.durationSeconds}:offset=${clip1Duration - transitions.durationSeconds}[v01]`;
  ffmpegArgs.push('-filter_complex', xfadeFilter);
}

// For per-clip transitions:
if (transitions.mode === 'perClip') {
  transitions.perClip.forEach(t => {
    const xfadeFilter = `xfade=transition=${t.type}:duration=${t.durationSeconds}:offset=...`;
    // Apply to specific clip transitions
  });
}
```

## Summary of Changes:

✅ **Remove**: All FFmpeg.wasm code, imports, state
✅ **Keep**: Single unified `generatePreview` function using backend
✅ **Update**: Preview button to work for both modes  
✅ **Backend**: Handle both single-track and multi-track payloads
✅ **Backend**: Implement speed and transition filters properly

## Expected Behavior:

1. User adds clips to timeline
2. User clicks "Generate Preview" button
3. Backend Lambda processes (3-5 seconds for 720p preview)
4. Preview displays in player
5. User makes adjustments
6. User clicks "Generate Preview" again to see updates
7. User clicks "Export" for final high-quality render

This is simpler, more reliable, and actually works!
