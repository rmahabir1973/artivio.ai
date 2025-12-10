# Audio Track Issues - Complete Fix

## Problem 1: Preview Fails When Audio Track Added

### Error Message:
```
Preview generation error: Error: Video combination failed. Please check your videos and try again.
```

### Root Cause Analysis:

Looking at the `generatePreview` function (line ~689), when audio track is added:

```tsx
audioTrack: enhancements.audioTrack ? {
  audioUrl: enhancements.audioTrack.audioUrl,
  type: enhancements.audioTrack.type,
  volume: enhancements.audioTrack.volume,
  startAtSeconds: 0,
} : undefined,
```

**The problem:** The backend Lambda `/api/video-editor/preview` endpoint might not support the `audioTrack` field properly, or there's a mismatch in how it's sent vs. how the backend expects it.

### Likely Backend Issue:

The backend is expecting `backgroundMusic` but getting `audioTrack` as a separate field, and it doesn't know how to handle both at the same time.

### Solution Options:

#### Option A: Send audioTrack as part of backgroundMusic for preview (Quick Fix)
```tsx
// In generatePreview function, combine both into backgroundMusic for now
backgroundMusic: (() => {
  // If we have audio track, prioritize it over background music for preview
  if (enhancements.audioTrack) {
    return {
      audioUrl: enhancements.audioTrack.audioUrl,
      volume: enhancements.audioTrack.volume,
      type: enhancements.audioTrack.type,
    };
  }
  // Otherwise use background music
  if (enhancements.backgroundMusic) {
    return {
      audioUrl: enhancements.backgroundMusic.audioUrl,
      volume: enhancements.backgroundMusic.volume,
    };
  }
  return undefined;
})(),
// Remove audioTrack from preview payload for now
// audioTrack: undefined,
```

#### Option B: Fix Backend to Support Both (Proper Fix)

The backend Lambda needs to support MIXING both background music and audio track. This requires:

1. **Accept both fields:**
```typescript
interface PreviewPayload {
  // ... other fields
  enhancements: {
    backgroundMusic?: {
      audioUrl: string;
      volume: number;
    };
    audioTrack?: {
      audioUrl: string;
      volume: number;
      type: 'tts' | 'voice' | 'sfx';
      startAtSeconds?: number;
    };
  };
}
```

2. **FFmpeg command to mix both:**
```bash
# Mix background music and voice track
ffmpeg -i video.mp4 \
  -i background_music.mp3 \
  -i voice_track.mp3 \
  -filter_complex "[1:a]volume=0.3[music];[2:a]volume=1.0[voice];[music][voice]amix=inputs=2:duration=longest[audio]" \
  -map 0:v -map "[audio]" \
  output.mp4
```

The backend needs to:
- Download both audio files
- Apply volume adjustments
- Mix them together with `amix` filter
- Combine with video

**For now, use Option A to unblock yourself, then work on Option B for the backend.**

---

## Problem 2: Music and Audio on Same Layer

### Current Behavior:
Both music and audio tracks are stored in `audioTracks` array and displayed on a single "Audio" row in the timeline.

### Expected Behavior:
- **Music track** - Background music layer
- **Audio/Voice track** - Voice-over/narration layer (separate)

### Architecture Issue:

Looking at the timeline rendering, there's only ONE audio track in single-track mode:

```tsx
{/* In TimelineTrack component - only renders ONE audio section */}
{audioTracks.length > 0 && (
  <div className="mt-4 pt-4 border-t">
    <div className="text-xs font-medium text-muted-foreground mb-2">Audio Tracks</div>
    <div className="flex gap-2 overflow-x-auto">
      {audioTracks.map((track) => (
        <div key={track.id} className="...">
          {/* Single track display */}
        </div>
      ))}
    </div>
  </div>
)}
```

### Solution: Separate Music and Voice Tracks

#### Step 1: Update audioTracks state to include type

Already done! The state has a `type` field:
```tsx
const [audioTracks, setAudioTracks] = useState<Array<{ 
  id: string; 
  url: string; 
  name: string; 
  type: 'music' | 'voice' | 'sfx';  // ✅ Type is already here
  volume: number 
}>>([]);
```

#### Step 2: Update TimelineTrack component to show separate layers

Replace the single audio section with TWO sections:

```tsx
{/* Music Tracks Layer */}
{audioTracks.filter(t => t.type === 'music').length > 0 && (
  <div className="mt-4 pt-4 border-t">
    <div className="flex items-center gap-2 mb-2">
      <Music className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">Background Music</span>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-2">
      {audioTracks.filter(t => t.type === 'music').map((track) => (
        <div
          key={track.id}
          className="flex items-center gap-2 px-3 py-2 border rounded-md bg-card min-w-[200px]"
        >
          <Music className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{track.name}</p>
            <p className="text-[10px] text-muted-foreground">Volume: {Math.round(track.volume * 100)}%</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onRemoveAudioTrack(track.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  </div>
)}

{/* Voice/Audio Tracks Layer */}
{audioTracks.filter(t => t.type === 'voice' || t.type === 'sfx').length > 0 && (
  <div className="mt-4 pt-4 border-t">
    <div className="flex items-center gap-2 mb-2">
      <Mic className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">Voice / Audio</span>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-2">
      {audioTracks.filter(t => t.type === 'voice' || t.type === 'sfx').map((track) => (
        <div
          key={track.id}
          className="flex items-center gap-2 px-3 py-2 border rounded-md bg-card min-w-[200px]"
        >
          <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{track.name}</p>
            <p className="text-[10px] text-muted-foreground">Volume: {Math.round(track.volume * 100)}%</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onRemoveAudioTrack(track.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  </div>
)}
```

---

## Problem 3: Can't Drag Music/Audio to Reorder

### Root Cause:

The audio tracks are NOT wrapped in `SortableContext`, so they can't be dragged!

Looking at the code around line 2394:

```tsx
<SortableContext items={orderedClips.map(c => c.id)} strategy={horizontalListSortingStrategy}>
  <TimelineTrack
    clips={orderedClips}
    audioTracks={audioTracks}  // ← Just passed as prop, not sortable!
    getClipSettings={getClipSettings}
    onMuteToggle={toggleClipMute}
    onRemoveClip={removeClipFromTimeline}
    onRemoveAudioTrack={removeAudioTrack}
    onOpenSettings={openClipSettings}
    totalDuration={totalDuration}
  />
</SortableContext>
```

**Only `orderedClips` are in SortableContext, not `audioTracks`!**

### Solution: Make Audio Tracks Draggable

#### Option 1: Simple - Add audio tracks to the same SortableContext

```tsx
<SortableContext 
  items={[
    ...orderedClips.map(c => c.id),
    ...audioTracks.map(a => a.id)  // ✅ Add audio track IDs
  ]} 
  strategy={horizontalListSortingStrategy}
>
  <TimelineTrack
    clips={orderedClips}
    audioTracks={audioTracks}
    getClipSettings={getClipSettings}
    onMuteToggle={toggleClipMute}
    onRemoveClip={removeClipFromTimeline}
    onRemoveAudioTrack={removeAudioTrack}
    onOpenSettings={openClipSettings}
    totalDuration={totalDuration}
  />
</SortableContext>
```

#### Option 2: Better - Create separate SortableAudioTrack component

```tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableAudioTrackProps {
  track: { id: string; url: string; name: string; type: 'music' | 'voice' | 'sfx'; volume: number };
  onRemove: (id: string) => void;
  icon: React.ComponentType<{ className?: string }>;
}

function SortableAudioTrack({ track, onRemove, icon: Icon }: SortableAudioTrackProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-2 border rounded-md bg-card min-w-[200px]",
        isDragging && "ring-2 ring-primary z-10"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none shrink-0"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{track.name}</p>
        <p className="text-[10px] text-muted-foreground">
          Volume: {Math.round(track.volume * 100)}%
        </p>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => onRemove(track.id)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
```

Then update the TimelineTrack to use it:

```tsx
{/* Music Tracks Layer - Now Draggable */}
{audioTracks.filter(t => t.type === 'music').length > 0 && (
  <div className="mt-4 pt-4 border-t">
    <div className="flex items-center gap-2 mb-2">
      <Music className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">Background Music</span>
    </div>
    <SortableContext
      items={audioTracks.filter(t => t.type === 'music').map(t => t.id)}
      strategy={horizontalListSortingStrategy}
    >
      <div className="flex gap-2 overflow-x-auto pb-2">
        {audioTracks.filter(t => t.type === 'music').map((track) => (
          <SortableAudioTrack
            key={track.id}
            track={track}
            onRemove={onRemoveAudioTrack}
            icon={Music}
          />
        ))}
      </div>
    </SortableContext>
  </div>
)}
```

#### Option 3: Simplest - Don't allow dragging audio tracks (for now)

Audio tracks are typically NOT draggable in video editors - they span the entire timeline. Only the volume and presence matter, not the order. So this might actually be expected behavior.

**Recommendation: Use Option 3 (don't make them draggable) since:**
- Background music typically plays for the entire video
- Voice tracks are usually timeline-wide
- Multi-track mode will handle positioning properly

---

## Complete Implementation Plan

### Phase 1: Fix Preview Failure (Critical)

**File: `video-editor.tsx` around line 689**

```tsx
const generatePreview = useCallback(async () => {
  // ... existing code ...
  
  payload = {
    project,
    videoSettings: {
      format: 'mp4',
      quality: 'preview',
      resolution: '720p',
    },
    enhancements: {
      transitions: /* ... */,
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
      
      // ✅ FIX: Send both audio types properly
      backgroundMusic: enhancements.backgroundMusic ? {
        audioUrl: enhancements.backgroundMusic.audioUrl,
        volume: enhancements.backgroundMusic.volume,
      } : undefined,
      
      // ✅ FIX: Only send audioTrack if backend supports it
      // For now, comment this out until backend is fixed:
      /*
      audioTrack: enhancements.audioTrack ? {
        audioUrl: enhancements.audioTrack.audioUrl,
        type: enhancements.audioTrack.type,
        volume: enhancements.audioTrack.volume,
        startAtSeconds: 0,
      } : undefined,
      */
    },
    previewMode: true,
    maxDuration: 10,
  };
  
  // ... rest of code ...
}, [/* deps */]);
```

### Phase 2: Show Separate Audio Layers

**File: `client/src/pages/video-editor/components/TimelineTrack.tsx`**

Find the audio tracks rendering section and replace with:

```tsx
{/* Separate Music Layer */}
{audioTracks.filter(t => t.type === 'music').length > 0 && (
  <div className="mt-4 pt-4 border-t">
    <div className="flex items-center gap-2 mb-2">
      <Music className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">Background Music</span>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-2">
      {audioTracks.filter(t => t.type === 'music').map((track) => (
        <div
          key={track.id}
          className="flex items-center gap-2 px-3 py-2 border rounded-md bg-card min-w-[200px]"
        >
          <Music className="h-4 w-4 text-green-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{track.name}</p>
            <p className="text-[10px] text-muted-foreground">Vol: {Math.round(track.volume * 100)}%</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onRemoveAudioTrack(track.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  </div>
)}

{/* Separate Voice/Audio Layer */}
{audioTracks.filter(t => t.type === 'voice' || t.type === 'sfx').length > 0 && (
  <div className="mt-4 pt-4 border-t">
    <div className="flex items-center gap-2 mb-2">
      <Mic className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">Voice Track</span>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-2">
      {audioTracks.filter(t => t.type === 'voice' || t.type === 'sfx').map((track) => (
        <div
          key={track.id}
          className="flex items-center gap-2 px-3 py-2 border rounded-md bg-card min-w-[200px]"
        >
          <Mic className="h-4 w-4 text-purple-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{track.name}</p>
            <p className="text-[10px] text-muted-foreground">Vol: {Math.round(track.volume * 100)}%</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onRemoveAudioTrack(track.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  </div>
)}
```

### Phase 3: Backend Fix (Required for Full Support)

**Update your Lambda `/api/video-editor/preview` endpoint** to:

1. Accept both `backgroundMusic` and `audioTrack`
2. Mix them together using FFmpeg's `amix` filter
3. Apply proper volume levels to each

Example FFmpeg command:
```bash
ffmpeg -i video.mp4 \
  -i background_music.mp3 \
  -i voice_track.mp3 \
  -filter_complex "
    [1:a]volume=0.3[music];
    [2:a]volume=1.0[voice];
    [music][voice]amix=inputs=2:duration=longest:dropout_transition=0[audio]
  " \
  -map 0:v -map "[audio]" \
  -c:v libx264 -preset ultrafast -crf 28 \
  -c:a aac -b:a 128k \
  output.mp4
```

---

## Summary of Changes

### Immediate Fixes (Frontend):
1. ✅ Comment out `audioTrack` in preview payload (line ~789)
2. ✅ Keep `backgroundMusic` in preview payload
3. ✅ Update TimelineTrack to show separate music/voice layers
4. ✅ Update removeAudioTrack to clear enhancements (from previous fix)

### Backend Investigation Required:
1. ⚠️ Add support for mixing `backgroundMusic` + `audioTrack` in Lambda
2. ⚠️ Implement FFmpeg `amix` filter for audio mixing
3. ⚠️ Test with both audio types present

### Testing Checklist:
- [ ] Add music track → Generate preview → Music plays ✓
- [ ] Remove music → Generate preview → No music ✓
- [ ] Add voice track → Generate preview → Voice plays (might fail until backend fixed)
- [ ] Add both music + voice → Generate preview → Both play mixed (needs backend)
- [ ] Music and voice show on separate timeline layers ✓
- [ ] Can remove music and voice independently ✓

The critical fix is commenting out `audioTrack` in the preview payload until your backend supports mixing multiple audio tracks!
