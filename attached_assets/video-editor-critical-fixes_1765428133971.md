# Video Editor Critical Fixes

## Issue 1: Audio/Music Causes Preview/Export to Fail

### Problem
Error: `[DURATION] Error loading clip xxx: Event {isTrusted: true, type: 'error'...}`

**Root Cause:**
The duration detection code is trying to load **audio files as video elements**, which fails. Audio files (MP3, WAV) cannot be loaded into `<video>` elements - they need `<audio>` elements.

The error shows it's trying to get duration for music/audio clips using a video element, which throws an error event.

### Solution

**FIND the `getVideoDuration` or duration detection function** (likely in video-editor component around line 1406 based on error):

```typescript
// CURRENT BROKEN CODE:
async function getClipDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = url;
    video.onloadedmetadata = () => resolve(video.duration);
    video.onerror = (e) => {
      console.error('[DURATION] Error loading clip:', e);
      reject(e);
    };
  });
}
```

**REPLACE WITH:**

```typescript
async function getClipDuration(url: string, type: 'video' | 'audio' | 'music'): Promise<number> {
  return new Promise((resolve, reject) => {
    // Use correct element type for media
    const element = type === 'video' 
      ? document.createElement('video')
      : document.createElement('audio');
    
    element.src = url;
    element.preload = 'metadata';
    
    element.onloadedmetadata = () => {
      const duration = element.duration || 0;
      console.log(`[DURATION] Loaded ${type} clip: ${duration}s`);
      resolve(duration);
      // Clean up
      element.src = '';
      element.load();
    };
    
    element.onerror = (e) => {
      console.error(`[DURATION] Error loading ${type} clip:`, e);
      // Fallback to default duration instead of rejecting
      const fallbackDuration = type === 'video' ? 10 : 30;
      console.warn(`[DURATION] Using fallback duration: ${fallbackDuration}s`);
      resolve(fallbackDuration);
      // Clean up
      element.src = '';
      element.load();
    };
  });
}
```

**UPDATE ALL CALLS to pass the type:**

```typescript
// When getting duration for timeline items
for (const item of timelineItems) {
  const duration = await getClipDuration(item.url, item.type); // Pass type!
  // ...
}
```

---

## Issue 2: Missing Volume Controls in Timeline

### Problem
Volume sliders only appear in Export panel, not on individual audio/music timeline items.

### Solution

**FIND the timeline item render code** (where video clips show volume/mute icons):

**ADD volume controls for audio/music items:**

```typescript
{/* Timeline Item Actions */}
{item.type === 'audio' || item.type === 'music' ? (
  <div className="flex items-center gap-1">
    {/* Volume Control */}
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          data-testid={`button-volume-${index}`}
        >
          {item.volume === 0 || item.muted ? (
            <VolumeX className="h-3 w-3" />
          ) : item.volume < 0.5 ? (
            <Volume1 className="h-3 w-3" />
          ) : (
            <Volume2 className="h-3 w-3" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48" align="center">
        <div className="space-y-2">
          <Label className="text-xs">Volume</Label>
          <Slider
            value={[item.muted ? 0 : (item.volume || 1) * 100]}
            onValueChange={(value) => {
              updateTimelineItem(item.id, {
                volume: value[0] / 100,
                muted: value[0] === 0,
              });
            }}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>{Math.round((item.muted ? 0 : (item.volume || 1)) * 100)}%</span>
            <span>100%</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <Label htmlFor={`mute-${item.id}`} className="text-xs">Mute</Label>
            <Switch
              id={`mute-${item.id}`}
              checked={item.muted || false}
              onCheckedChange={(checked) => {
                updateTimelineItem(item.id, { muted: checked });
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>

    {/* Settings */}
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={() => {/* Open settings */}}
      data-testid={`button-settings-${index}`}
    >
      <Settings className="h-3 w-3" />
    </Button>

    {/* Delete */}
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-destructive"
      onClick={() => removeTimelineItem(item.id)}
      data-testid={`button-delete-${index}`}
    >
      <Trash2 className="h-3 w-3" />
    </Button>
  </div>
) : (
  /* Existing video controls */
  // ...
)}
```

**ADD IMPORTS:**

```typescript
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
```

**UPDATE TimelineItem type to include volume:**

```typescript
interface TimelineItem {
  id: string;
  type: 'video' | 'image' | 'music' | 'audio';
  url: string;
  duration: number;
  volume?: number; // ADD THIS
  muted?: boolean; // ADD THIS
  // ... other properties
}
```

---

## Issue 3: Transitions Not Previewing

### Problem
Transitions show in timeline but don't appear in the preview video.

### Root Cause
The **preview generation doesn't include transition parameters** in the Lambda payload, or the Lambda code isn't applying transitions during preview.

### Solution A: Ensure Transitions in Preview Payload

**FIND the preview generation function:**

```typescript
const handleGeneratePreview = async () => {
  const payload = {
    jobId: `preview-${Date.now()}`,
    userId: user?.id,
    outputBucket: PREVIEW_BUCKET,
    previewMode: true, // ✓ Good
    maxDuration: 15,   // ✗ REMOVE THIS - we fixed this earlier
    project: {
      clips: timelineItems.filter(i => i.type === 'video').map(item => ({
        sourceUrl: item.url,
        duration: item.duration,
      })),
    },
    enhancements: {
      aspectRatio: aspectRatio,
      backgroundMusic: backgroundMusic ? {
        audioUrl: backgroundMusic.url,
        volume: backgroundMusic.volume || 0.3,
      } : undefined,
      audioTrack: voiceTrack ? {
        audioUrl: voiceTrack.url,
        volume: voiceTrack.volume || 1.0,
      } : undefined,
      // ❌ MISSING: transitions!
    },
  };
  
  // Send to Lambda...
};
```

**ADD transitions to payload:**

```typescript
const handleGeneratePreview = async () => {
  // Convert timeline transitions to Lambda format
  const clipTransitions = enhancements.clipTransitions || [];
  
  const payload = {
    jobId: `preview-${Date.now()}`,
    userId: user?.id,
    outputBucket: PREVIEW_BUCKET,
    previewMode: true,
    project: {
      clips: timelineItems.filter(i => i.type === 'video').map(item => ({
        sourceUrl: item.url,
        duration: item.duration,
      })),
    },
    enhancements: {
      aspectRatio: aspectRatio,
      backgroundMusic: backgroundMusic ? {
        audioUrl: backgroundMusic.url,
        volume: backgroundMusic.volume || 0.3,
      } : undefined,
      audioTrack: voiceTrack ? {
        audioUrl: voiceTrack.url,
        volume: voiceTrack.volume || 1.0,
      } : undefined,
      transitions: {
        mode: 'perClip',
        perClip: clipTransitions.map(t => ({
          afterClipIndex: t.afterClipIndex,
          type: t.type,
          durationSeconds: t.durationSeconds,
        })),
      },
    },
  };
  
  console.log('[PREVIEW] Sending payload with transitions:', payload.enhancements.transitions);
  
  // Send to Lambda...
};
```

### Solution B: Verify Lambda Has Fixed Code

Make sure you've deployed the **complete-lambda-with-transitions.js** file we created earlier. The Lambda needs:

1. ✅ `getVideoDuration()` function
2. ✅ `buildTransitionsFilterChain()` function
3. ✅ Transition-aware FFmpeg command building

Without the Lambda fix, transitions won't work even if the frontend sends them correctly.

---

## Testing Checklist

### Test 1: Audio Duration Detection
1. Add music track to timeline
2. Click "Generate Preview"
3. **Should NOT error** - check console for `[DURATION] Loaded audio clip: Xs`
4. Preview should generate successfully

### Test 2: Volume Controls
1. Add music/audio to timeline
2. **Should see volume icon** on timeline item
3. Click volume icon
4. **Should see slider** with mute toggle
5. Adjust volume
6. Generate preview with audio at different volumes

### Test 3: Transition Preview
1. Add 2+ video clips
2. Drag transition between clips (diagtl, distance, etc.)
3. Click "Generate Preview"
4. **Should see transition effect** in preview at clip boundaries
5. Check console for: `[PREVIEW] Sending payload with transitions:...`
6. Check Lambda logs for: `Transition filter chain: [0:v][1:v]xfade=...`

---

## Summary of Fixes

| Issue | Location | Fix |
|-------|----------|-----|
| Audio duration error | `getClipDuration()` | Use `<audio>` element for audio/music types |
| No volume controls | Timeline item render | Add Popover with Slider for audio items |
| Transitions not previewing | Preview payload | Include transitions in `enhancements` object |
| Transitions backend | Lambda | Deploy fixed Lambda code with xfade support |

---

## Priority Order

1. **CRITICAL**: Fix audio duration detection (blocks all audio features)
2. **HIGH**: Add volume controls (UX issue)
3. **HIGH**: Fix transition preview (feature broken)

All three fixes are independent and can be applied separately.
