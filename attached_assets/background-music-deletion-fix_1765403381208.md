# Background Music Deletion Issue - Fix

## Problem Analysis

When you add music to the timeline and then "delete" it, the music still plays in the preview. This happens because:

1. **There's no DELETE button for background music in the UI**
2. The music gets added to both `audioTracks` state AND `enhancements.backgroundMusic` state
3. Only the `audioTracks` gets modified when you "delete" from the timeline
4. The preview uses `enhancements.backgroundMusic`, which never gets cleared

## Evidence from Code

### When Music is Added (line ~1792):
```tsx
onClick={() => {
  const trackId = `music_${track.id}_${Date.now()}`;
  
  // ✅ Adds to audioTracks
  setAudioTracks(prev => [...prev, {
    id: trackId,
    url: track.resultUrl!,
    name: track.prompt || 'Music Track',
    type: 'music',
    volume: 0.5,
  }]);
  
  // ✅ ALSO adds to enhancements.backgroundMusic
  setEnhancements(prev => ({
    ...prev,
    backgroundMusic: {
      audioUrl: track.resultUrl!,
      volume: 0.5,
      name: track.prompt || 'Music Track',
    },
  }));
  
  toast({ title: "Music Added", description: "Music track added to timeline" });
}}
```

### When Preview is Generated (line ~786):
```tsx
backgroundMusic: enhancements.backgroundMusic ? {
  audioUrl: enhancements.backgroundMusic.audioUrl,
  volume: enhancements.backgroundMusic.volume,
} : undefined,
```

**The preview uses `enhancements.backgroundMusic`, NOT `audioTracks`!**

### The Problem:
There's a `removeAudioTrack` function that removes from `audioTracks`:
```tsx
const removeAudioTrack = useCallback((trackId: string) => {
  setAudioTracks(prev => prev.filter(t => t.id !== trackId));
}, []);
```

But this does NOT clear `enhancements.backgroundMusic`!

## Solution

You need to synchronize the deletion. When an audio track is removed, also clear the background music from enhancements.

### Fix #1: Update removeAudioTrack to also clear enhancements

```tsx
const removeAudioTrack = useCallback((trackId: string) => {
  setAudioTracks(prev => prev.filter(t => t.id !== trackId));
  
  // ✅ ALSO clear background music from enhancements
  setEnhancements(prev => ({
    ...prev,
    backgroundMusic: undefined,
    audioTrack: undefined, // Also clear audio track if needed
  }));
}, []);
```

### Fix #2: Add a Delete Button in the Export Panel

Add this UI in the Export category content (around line 2292):

```tsx
{/* Export Category Content */}
{activeCategory === 'export' && (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label className="text-xs">Aspect Ratio</Label>
      <Select 
        value={enhancements.aspectRatio} 
        onValueChange={(value: '16:9' | '9:16' | '1:1') => {
          setEnhancements(prev => ({ ...prev, aspectRatio: value }));
        }}
      >
        <SelectTrigger data-testid="select-aspect-ratio">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
          <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
          <SelectItem value="1:1">1:1 (Square)</SelectItem>
        </SelectContent>
      </Select>
    </div>
    
    {/* ✅ ADD THIS SECTION FOR BACKGROUND MUSIC CONTROLS */}
    {enhancements.backgroundMusic && (
      <div className="pt-4 border-t space-y-2">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-medium">Background Music</Label>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              setEnhancements(prev => ({ ...prev, backgroundMusic: undefined }));
              toast({ title: "Music Removed", description: "Background music removed" });
            }}
            data-testid="button-remove-background-music"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
          <Music className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs truncate flex-1">{enhancements.backgroundMusic.name || 'Music Track'}</span>
        </div>
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
            data-testid="slider-background-music-volume"
          />
        </div>
      </div>
    )}
    
    {/* ✅ ALSO ADD FOR AUDIO TRACK IF PRESENT */}
    {enhancements.audioTrack && (
      <div className="pt-4 border-t space-y-2">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-medium">Voice Track</Label>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              setEnhancements(prev => ({ ...prev, audioTrack: undefined }));
              toast({ title: "Voice Removed", description: "Voice track removed" });
            }}
            data-testid="button-remove-audio-track"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
          <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs truncate flex-1">{enhancements.audioTrack.name || 'Voice Track'}</span>
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex justify-between">
            Volume
            <span className="text-muted-foreground">
              {Math.round(enhancements.audioTrack.volume * 100)}%
            </span>
          </Label>
          <Slider
            value={[enhancements.audioTrack.volume]}
            min={0}
            max={1}
            step={0.05}
            onValueChange={([v]) => 
              setEnhancements(prev => ({
                ...prev,
                audioTrack: prev.audioTrack ? {
                  ...prev.audioTrack,
                  volume: v,
                } : undefined,
              }))
            }
            data-testid="slider-audio-track-volume"
          />
        </div>
      </div>
    )}
    
    <div className="flex items-center justify-between">
      <Label className="text-xs">Fade In</Label>
      <Switch
        checked={enhancements.fadeIn}
        onCheckedChange={(checked) => setEnhancements(prev => ({ ...prev, fadeIn: checked }))}
        data-testid="switch-fade-in"
      />
    </div>
    
    {/* ... rest of export controls ... */}
  </div>
)}
```

### Fix #3: Better Approach - Sync audioTracks with enhancements

Actually, looking at the architecture, there's a fundamental design issue:

**The timeline shows `audioTracks` but the preview/export uses `enhancements.backgroundMusic`**

This creates a disconnect. Here's a better fix:

```tsx
// Update removeAudioTrack to sync with enhancements
const removeAudioTrack = useCallback((trackId: string) => {
  // Get the track being removed
  const removedTrack = audioTracks.find(t => t.id === trackId);
  
  // Remove from audioTracks
  setAudioTracks(prev => prev.filter(t => t.id !== trackId));
  
  // If this track was the background music, clear it from enhancements
  if (removedTrack && enhancements.backgroundMusic?.audioUrl === removedTrack.url) {
    setEnhancements(prev => ({
      ...prev,
      backgroundMusic: undefined,
    }));
  }
  
  // If this track was the audio track, clear it from enhancements
  if (removedTrack && enhancements.audioTrack?.audioUrl === removedTrack.url) {
    setEnhancements(prev => ({
      ...prev,
      audioTrack: undefined,
    }));
  }
}, [audioTracks, enhancements.backgroundMusic, enhancements.audioTrack]);
```

## Complete Fix Implementation

Here's the complete fix combining all approaches:

### Step 1: Update removeAudioTrack function

Find this function (around line 2721) and replace it:

```tsx
const removeAudioTrack = useCallback((trackId: string) => {
  // Get the track being removed
  const removedTrack = audioTracks.find(t => t.id === trackId);
  
  // Remove from audioTracks state
  setAudioTracks(prev => prev.filter(t => t.id !== trackId));
  
  // ✅ CRITICAL: Also remove from enhancements if this was the background music or audio track
  setEnhancements(prev => {
    const updates: Partial<EnhancementsState> = {};
    
    // Check if removing background music
    if (removedTrack && prev.backgroundMusic?.audioUrl === removedTrack.url) {
      updates.backgroundMusic = undefined;
    }
    
    // Check if removing audio track
    if (removedTrack && prev.audioTrack?.audioUrl === removedTrack.url) {
      updates.audioTrack = undefined;
    }
    
    return { ...prev, ...updates };
  });
  
  toast({
    title: "Audio Removed",
    description: "Audio track removed from timeline",
  });
}, [audioTracks, enhancements.backgroundMusic, enhancements.audioTrack, toast]);
```

### Step 2: Add UI controls in Export panel

Insert this after the "Fade Out" section (around line 2305):

```tsx
{/* Background Music Controls */}
{enhancements.backgroundMusic && (
  <div className="pt-4 border-t space-y-2">
    <div className="flex items-center justify-between mb-2">
      <Label className="text-xs font-medium flex items-center gap-2">
        <Music className="h-3 w-3" />
        Background Music
      </Label>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => {
          setEnhancements(prev => ({ ...prev, backgroundMusic: undefined }));
          // Also remove from audioTracks if present
          setAudioTracks(prev => 
            prev.filter(t => t.url !== enhancements.backgroundMusic?.audioUrl)
          );
          toast({ title: "Music Removed", description: "Background music removed" });
        }}
        data-testid="button-remove-background-music"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
    <div className="p-2 rounded-md bg-muted/50 text-xs truncate">
      {enhancements.backgroundMusic.name || 'Music Track'}
    </div>
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
        data-testid="slider-background-music-volume"
      />
    </div>
  </div>
)}

{/* Voice/Audio Track Controls */}
{enhancements.audioTrack && (
  <div className="pt-4 border-t space-y-2">
    <div className="flex items-center justify-between mb-2">
      <Label className="text-xs font-medium flex items-center gap-2">
        <Mic className="h-3 w-3" />
        Voice Track
      </Label>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => {
          setEnhancements(prev => ({ ...prev, audioTrack: undefined }));
          // Also remove from audioTracks if present
          setAudioTracks(prev => 
            prev.filter(t => t.url !== enhancements.audioTrack?.audioUrl)
          );
          toast({ title: "Voice Removed", description: "Voice track removed" });
        }}
        data-testid="button-remove-audio-track"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
    <div className="p-2 rounded-md bg-muted/50 text-xs truncate">
      {enhancements.audioTrack.name || 'Voice Track'}
    </div>
    <div className="space-y-1">
      <Label className="text-xs flex justify-between">
        Volume
        <span className="text-muted-foreground">
          {Math.round(enhancements.audioTrack.volume * 100)}%
        </span>
      </Label>
      <Slider
        value={[enhancements.audioTrack.volume]}
        min={0}
        max={1}
        step={0.05}
        onValueChange={([v]) => 
          setEnhancements(prev => ({
            ...prev,
            audioTrack: prev.audioTrack ? {
              ...prev.audioTrack,
              volume: v,
            } : undefined,
          }))
        }
        data-testid="slider-audio-track-volume"
      />
    </div>
  </div>
)}
```

## Root Cause Summary

The issue is **state synchronization**:

1. **Two separate states**: `audioTracks` (for timeline display) and `enhancements.backgroundMusic` (for preview/export)
2. **Deletion only updates one**: When you remove audio from timeline, only `audioTracks` gets updated
3. **Preview uses the other**: Preview reads from `enhancements.backgroundMusic` which never gets cleared
4. **Result**: Music keeps playing because the preview still sees it in `enhancements`

## Testing Checklist

After applying the fix:

- [ ] Add music track from Music panel
- [ ] Verify music appears in Export panel as "Background Music"
- [ ] Generate preview and confirm music plays
- [ ] Click X button in Export panel to remove music
- [ ] Generate preview again - music should NOT play
- [ ] Add music again and remove from timeline (if that's possible)
- [ ] Generate preview - music should NOT play

## Additional Note

There might also be a Lambda caching issue. The Lambda might be caching the preview based on clip URLs. To avoid this, you could:

1. Add a cache-busting parameter to the preview request
2. Include a timestamp in the payload
3. Clear the preview URL state before generating a new preview

But the primary issue is definitely the state synchronization problem described above.
