# Video Editor Issues - Analysis & Fixes

## Issue Analysis & Solutions

### 1. ✅ Disable Multi-Track Toggle
**Status:** Simple - just hide the UI element

**Fix:**
```tsx
// Around line 2420 in video-editor.tsx
// COMMENT OUT OR REMOVE this section:
/*
<div className="flex items-center gap-2">
  <Label htmlFor="multi-track-toggle" className="text-xs text-muted-foreground">
    Multi-Track
  </Label>
  <Switch
    id="multi-track-toggle"
    checked={useMultiTrack}
    onCheckedChange={handleMultiTrackToggle}
    data-testid="switch-multi-track-mode"
  />
</div>
*/
```

This will force single-track mode and avoid the multi-track drag-and-drop issues we discussed earlier.

---

### 2. ⚠️ Music Volume Issue
**Problem:** Music tracks added to timeline but no audio heard and settings show 50% volume

**Root Cause Analysis:**
Looking at the code, when music is added (around line 1798):
```tsx
setEnhancements(prev => ({
  ...prev,
  backgroundMusic: {
    audioUrl: track.resultUrl!,
    volume: 0.5,  // ← Set to 0.5 (50%)
    name: track.prompt || 'Music Track',
  },
}));
```

The volume is set correctly to 0.5, but there are TWO separate issues:

**Issue 2a: Export Payload Missing Audio Volume**
The export mutation payload (around line 1203) includes:
```tsx
backgroundMusic: enhancements.backgroundMusic ? {
  audioUrl: enhancements.backgroundMusic.audioUrl,
  volume: enhancements.backgroundMusic.volume,  // ← This IS included
} : undefined,
```
✅ Volume IS being sent to backend.

**Issue 2b: Preview Payload Missing Background Music Entirely!**
The preview mutation (around line 1281) has:
```tsx
const enhancementsPayload = {
  transitions: ...,
  fadeIn: ...,
  fadeOut: ...,
  fadeDuration: ...,
  aspectRatio: ...,
  speed: ...,
  clipSettings: ...,
  watermark: ...,
  captions: ...,
  // ❌ backgroundMusic is MISSING!
  // ❌ audioTrack is MISSING!
};
```

**The Fix - Add Background Music to Preview:**
```tsx
// Around line 1281 - previewMutation.mutationFn
const enhancementsPayload = {
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
    cs.muted || cs.volume !== 1 || cs.trimStartSeconds !== undefined || cs.trimEndSeconds !== undefined || cs.isImage
  ),
  
  // ✅ ADD THESE:
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
  
  watermark: enhancements.watermark ? {
    imageUrl: enhancements.watermark.imageUrl,
    position: enhancements.watermark.position,
    size: enhancements.watermark.size,
    opacity: enhancements.watermark.opacity,
  } : undefined,
  captions: enhancements.captions.filter(c => c.text.trim()).map(c => ({
    id: c.id,
    startSeconds: c.startSeconds,
    endSeconds: c.endSeconds,
    text: c.text,
    style: c.style,
  })),
};
```

**Issue 2c: Music Track Volume Control UI**
When clicking on a music track in the timeline, there's no volume control shown. The code shows:
```tsx
// Around line 1792 - when music is clicked
onClick={() => {
  const trackId = `music_${track.id}_${Date.now()}`;
  setAudioTracks(prev => [...prev, {
    id: trackId,
    url: track.resultUrl!,
    name: track.prompt || 'Music Track',
    type: 'music',
    volume: 0.5,  // Set to 0.5
  }]);
  // ... also sets enhancements.backgroundMusic
}}
```

But `audioTracks` state is used only in the TimelineTrack component, and there's no UI for adjusting individual audio track volumes after they're added.

**Additional UI Fix Needed:**
Add a volume slider for background music in the Export panel:

```tsx
// In the Export Category Content section (around line 2157)
{/* After Fade Out section */}

{enhancements.backgroundMusic && (
  <div className="pt-4 border-t space-y-2">
    <div className="flex items-center justify-between mb-2">
      <Label className="text-xs">Background Music</Label>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setEnhancements(prev => ({ ...prev, backgroundMusic: undefined }))}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
    <p className="text-xs text-muted-foreground truncate">{enhancements.backgroundMusic.name}</p>
    <div className="space-y-1">
      <Label className="text-xs flex justify-between">
        Volume
        <span className="text-muted-foreground">
          {Math.round(enhancements.backgroundMusic.volume * 100)}%
        </span>
      </Label>
      <Slider
        value={[enhancements.backgroundMusic.volume]}
        min={0}
        max={1}
        step={0.05}
        onValueChange={([v]) => 
          setEnhancements(prev => ({
            ...prev,
            backgroundMusic: prev.backgroundMusic ? {
              ...prev.backgroundMusic,
              volume: v,
            } : undefined,
          }))
        }
      />
    </div>
  </div>
)}
```

---

### 3. ⚠️ Failed Generations Still Displaying
**Problem:** Library shows failed generations

**Root Cause:**
The filter at line 662 checks:
```tsx
return items.filter(
  (g) => g.status === "completed" && g.resultUrl && g.resultUrl.trim() !== ''
);
```

But server-side query params at line 620 include:
```tsx
params.set('completedOnly', 'true');
```

**This means the backend should already be filtering!** But you're still seeing failed generations.

**Possible Backend Issue:**
The backend `/api/generations` endpoint might not be respecting the `completedOnly=true` parameter properly, OR the `status` field is not being set correctly.

**Frontend Double-Check Fix:**
Add an extra filter to be absolutely sure:

```tsx
// Around line 662 (and similar for music/audio/images)
const allVideos = useMemo(() => {
  const items = videoData?.pages.flatMap(page => page.items) ?? [];
  return items.filter(
    (g) => g.status === "completed" && 
           g.resultUrl && 
           g.resultUrl.trim() !== '' &&
           g.status !== 'failed' &&  // ✅ Explicit failed check
           g.status !== 'pending'    // ✅ Explicit pending check
  );
}, [videoData]);
```

Apply this same pattern to:
- `musicTracks` (line ~674)
- `voiceTracks` (line ~681)
- `allImages` (line ~688)
- `avatarVideos` (line ~695)

**Backend Investigation Needed:**
You should check your backend code to ensure:
1. The `completedOnly=true` query param is being processed
2. Failed generations are not being returned
3. Generations without `resultUrl` are being filtered out

---

### 4. ⚠️ Speed Changes Not Reflected in Preview
**Problem:** Changing clip speed and regenerating preview shows no difference

**Investigation:**
Looking at the `generatePreview` function (around line 886), speed IS included:

```tsx
const perClipSpeeds = clipSettingsArray
  .filter(cs => cs.speed !== 1.0 && !cs.isImage)
  .map(cs => ({ clipIndex: cs.clipIndex, factor: cs.speed }));

const speedConfig = perClipSpeeds.length > 0 
  ? { mode: 'perClip' as const, perClip: perClipSpeeds }
  : { mode: 'none' as const };

payload = {
  // ...
  enhancements: {
    // ...
    speed: speedConfig,  // ✅ Speed IS included
    clipSettings: clipSettingsArray.filter(cs => 
      cs.muted || 
      cs.volume !== 1 || 
      cs.speed !== 1.0 ||  // ✅ Speed filter IS included
      cs.trimStartSeconds !== undefined || 
      cs.trimEndSeconds !== undefined || 
      cs.isImage
    ),
  },
  // ...
};
```

**The frontend code is CORRECT!** The issue is likely in the **backend Lambda**.

**Backend Requirements - What Lambda MUST Do:**

The Lambda `/api/video-editor/preview` endpoint must:

1. **Parse the speed config from the payload:**
```typescript
const speedConfig = payload.enhancements?.speed;
```

2. **Apply FFmpeg speed filters for each clip:**
```bash
# For each clip with speed !== 1.0:

# Video speed (changes frame rate):
-filter:v "setpts=PTS/SPEED_FACTOR"

# Audio speed (pitch-preserving):
-filter:a "atempo=SPEED_FACTOR"

# Example for 0.5x (slow motion):
ffmpeg -i input.mp4 -filter:v "setpts=PTS/0.5" -filter:a "atempo=0.5" output.mp4

# Example for 2x (double speed):
ffmpeg -i input.mp4 -filter:v "setpts=PTS/2" -filter:a "atempo=2.0" output.mp4
```

**Important Notes:**
- `atempo` only accepts values between 0.5 and 2.0
- For speeds outside this range, chain multiple atempo filters
- Example for 0.25x: `-filter:a "atempo=0.5,atempo=0.5"`
- Example for 4x: `-filter:a "atempo=2.0,atempo=2.0"`

3. **Handle per-clip speed correctly:**
```typescript
if (speedConfig.mode === 'perClip') {
  speedConfig.perClip.forEach(({ clipIndex, factor }) => {
    const clip = clips[clipIndex];
    // Apply speed filter to this clip's video/audio
  });
}
```

**Backend Lambda Documentation Check:**
Unfortunately, I don't have access to your backend Lambda code or its documentation. You need to:

1. Check if `/api/video-editor/preview` endpoint accepts `speed` in the enhancements payload
2. Verify the Lambda applies FFmpeg speed filters correctly
3. Test with a simple 2x speed clip to see if it works
4. Check CloudWatch logs for any errors when processing speed

**Debugging Steps:**

1. Add console logging in frontend to verify payload:
```tsx
// In generatePreview function, before the fetch:
console.log('[PREVIEW PAYLOAD]', JSON.stringify(payload, null, 2));
```

2. Check browser Network tab to see actual request payload

3. Check Lambda CloudWatch logs to see if speed is being processed

4. Try a simple test: Set one clip to 2x speed, generate preview, and check if it's actually faster

---

### 5. 🔍 Bonus Issue: "Could not load duration" Errors

**Error:**
```
Could not load duration for clip 8d1c4371-0c0f-4f5e-aaf3-e732c689d70c_1765345368399_0ezec1nv7
```

**Root Cause:**
The `loadClipDuration` function (line 496) tries to load video metadata:

```tsx
const loadClipDuration = useCallback((clipId: string, url: string) => {
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.src = url;
  video.onloadedmetadata = () => {
    const duration = video.duration;
    if (duration && isFinite(duration)) {
      updateClipSettings(clipId, { originalDuration: duration });
    }
    video.src = ''; // Clean up
  };
  video.onerror = () => {
    console.warn(`Could not load duration for clip ${clipId}`);  // ← This error
  };
}, [updateClipSettings]);
```

**Possible Causes:**
1. **CORS issues** - Video URL doesn't allow cross-origin access
2. **Invalid URL** - The resultUrl is malformed or doesn't exist
3. **Network timeout** - Video takes too long to load metadata
4. **Video codec unsupported** - Browser can't decode the video

**Fix - Add Better Error Handling:**
```tsx
const loadClipDuration = useCallback((clipId: string, url: string) => {
  // Skip if URL is invalid
  if (!url || !url.startsWith('http')) {
    console.warn(`[DURATION] Invalid URL for clip ${clipId}:`, url);
    return;
  }
  
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.crossOrigin = 'anonymous'; // ✅ Try to handle CORS
  video.src = url;
  
  // ✅ Add timeout
  const timeoutId = setTimeout(() => {
    console.warn(`[DURATION] Timeout loading metadata for clip ${clipId}`);
    video.src = '';
  }, 10000); // 10 second timeout
  
  video.onloadedmetadata = () => {
    clearTimeout(timeoutId);
    const duration = video.duration;
    if (duration && isFinite(duration)) {
      console.log(`[DURATION] Loaded ${duration}s for clip ${clipId}`);
      updateClipSettings(clipId, { originalDuration: duration });
    } else {
      console.warn(`[DURATION] Invalid duration for clip ${clipId}:`, duration);
      // ✅ Set default duration
      updateClipSettings(clipId, { originalDuration: 10 });
    }
    video.src = '';
  };
  
  video.onerror = (e) => {
    clearTimeout(timeoutId);
    console.error(`[DURATION] Error loading clip ${clipId}:`, e);
    console.error(`[DURATION] URL was:`, url);
    // ✅ Set default duration on error
    updateClipSettings(clipId, { originalDuration: 10 });
    video.src = '';
  };
}, [updateClipSettings]);
```

**This error is usually non-critical** - it just means clip durations won't be accurate, but the editor should still work with default 10-second durations.

---

## Summary of Required Changes

### Immediate Fixes (Frontend):
1. ✅ Hide multi-track toggle (comment out lines ~2415-2425)
2. ✅ Add backgroundMusic & audioTrack to preview payload (lines ~1281-1310)
3. ✅ Add background music volume slider UI (Export panel, lines ~2157+)
4. ✅ Add stricter failed generation filtering (lines ~662, 674, 681, 688, 695)
5. ✅ Improve loadClipDuration error handling (line ~496)

### Backend Investigation Required:
1. ⚠️ Check if Lambda `/api/video-editor/preview` supports `speed` in enhancements
2. ⚠️ Verify FFmpeg speed filters are being applied correctly
3. ⚠️ Check if `completedOnly=true` query param is working on `/api/generations`
4. ⚠️ Verify background music volume is being applied in Lambda processing

### Testing Checklist:
- [ ] Multi-track toggle is hidden
- [ ] Music can be added and volume adjusted
- [ ] Music is audible in preview
- [ ] Failed generations don't appear in library
- [ ] Speed changes (2x) are visible in preview
- [ ] Duration errors don't break the editor
- [ ] Preview includes background music at correct volume

Would you like me to create the complete updated video-editor.tsx file with all these fixes applied?
