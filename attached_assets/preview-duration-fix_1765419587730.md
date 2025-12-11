# Preview Duration Limit Issue

## Problem
Preview only shows first 24 seconds even with 4 clips in timeline (should show ~40 seconds total).

## Root Cause

Looking at the code around line 719-850 (generatePreview function), the preview has restrictions:

### Issue 1: First 3 Clips Only
```typescript
const previewClips = orderedClips.slice(0, 3); // Line ~749
```
Only previews the first 3 clips instead of all 4.

### Issue 2: Lambda Preview Mode Has Duration Cap
```typescript
previewMode: true,
maxDuration: 15, // Line in multi-track payload
```
Or for single-track mode, Lambda might be applying a duration cap.

### Issue 3: Backend Preview Endpoint May Trim
The `/api/video-editor/preview` endpoint might have server-side limits.

## Solutions

### Solution 1: Remove 3-Clip Limit (Recommended)

**Find line ~749** in the preview generation code:
```typescript
// OLD (limits to 3 clips):
const previewClips = orderedClips.slice(0, 3);

// NEW (preview all clips):
const previewClips = orderedClips; // Preview all clips, not just first 3
```

### Solution 2: Remove Duration Cap in Payload

**Find around line 825** where preview payload is built:
```typescript
// OLD:
previewMode: true,
maxDuration: 15, // Remove or increase this

// NEW:
previewMode: true,
// maxDuration: 15, // Remove duration limit for preview
```

Or increase it significantly:
```typescript
previewMode: true,
maxDuration: 120, // 2 minutes
```

### Solution 3: Update Description Text

If keeping the 3-clip limit, update the UI to be honest:
```typescript
<p className="text-xs text-muted-foreground">
  Preview shows first 3 clips only (full export includes all clips)
</p>
```

## Recommended Fix

Replace the preview generation section with this:

```typescript
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
      // Multi-track mode: preview ALL items (no limit)
      const previewItems = multiTrackItems; // CHANGED: was .slice(0, 10)
      
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
          quality: 'preview',
          resolution: '720p',
        },
        enhancements: {
          aspectRatio: enhancements.aspectRatio,
        },
        previewMode: true,
        // NO maxDuration limit - let backend decide
      };
    } else {
      // Single-track mode: preview ALL clips (no 3-clip limit)
      const previewClips = orderedClips; // CHANGED: was .slice(0, 3)
      
      const project = {
        clips: previewClips.map((clip, index) => ({
          id: clip.id,
          sourceUrl: clip.url,
          order: index,
        })),
      };

      const clipSettingsArray = previewClips.map((clip, index) => {
        const localSettings = getClipSettings(clip.id);
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
          backgroundMusic: enhancements.backgroundMusic ? {
            audioUrl: enhancements.backgroundMusic.audioUrl,
            volume: enhancements.backgroundMusic.volume,
          } : undefined,
          audioTrack: enhancements.audioTrack ? {
            audioUrl: enhancements.audioTrack.audioUrl,
            type: enhancements.audioTrack.type,
            volume: enhancements.audioTrack.volume,
            startAtSeconds: 0,
          } : undefined,
        },
        previewMode: true,
        // Full preview - all clips, no arbitrary duration cap
      };
    }

    toast({
      title: "Generating Preview",
      description: "Processing all clips on server...",
    });

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
      toast({
        title: "Processing",
        description: "Preview is being generated, this may take a few moments...",
      });
      setPreviewStatus('idle');
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
}, [orderedClips, multiTrackItems, useMultiTrack, getClipSettings, enhancements, toast]);
```

## Key Changes

1. **Line ~749**: `const previewClips = orderedClips;` (was `.slice(0, 3)`)
2. **Line ~703**: `const previewItems = multiTrackItems;` (was `.slice(0, 10)`)
3. **Removed**: `maxDuration: 15` from payload
4. **Updated toast**: "Processing all clips" instead of "first 3 clips"

## Result

✅ Preview will show ALL 4 clips (~40 seconds)
✅ All enhancements/transitions applied
✅ Full-length preview before export

## Backend Consideration

If Lambda has memory/timeout issues with long previews:
- Keep quality at '720p' (not 1080p)
- Keep preview mode flag (uses faster encoding)
- Backend can apply reasonable limits (e.g., 5 minutes max)

But for 4 clips (~40 seconds), this should work perfectly fine!
