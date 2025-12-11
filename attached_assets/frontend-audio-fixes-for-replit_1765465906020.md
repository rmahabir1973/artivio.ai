# Frontend Fixes for Video Editor - Audio Loading

## Problem
Audio tracks are being loaded as video elements, causing errors and using fallback durations instead of actual audio duration.

## Fix 1: Add useEffect for Audio Track Duration Loading

**Location:** After line 647 in video-editor.tsx (right after the existing useEffect for orderedClips)

**Add this code:**

```typescript
// Load durations for audio tracks
useEffect(() => {
  for (const track of audioTracks) {
    const settings = clipSettings.get(track.id);
    // Only load duration if not already loaded
    if (!settings?.originalDuration && track.url) {
      // IMPORTANT: Pass 'audio' as the mediaType parameter
      loadClipDuration(track.id, track.url, 'audio');
    }
  }
}, [audioTracks, clipSettings, loadClipDuration]);
```

## Fix 2: Initialize Audio Settings When Adding Music

**Location:** Find the music track click handler (around line 1490)

**Current code:**
```typescript
{musicTracks.map((track) => (
  <div
    onClick={() => {
      const trackId = `music_${track.id}_${Date.now()}`;
      setAudioTracks(prev => [...prev, {
        id: trackId,
        url: track.resultUrl!,
        name: track.prompt || 'Music Track',
        type: 'music',
        volume: 0.5,
      }]);
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

**Add updateClipSettings call:**
```typescript
{musicTracks.map((track) => (
  <div
    onClick={() => {
      const trackId = `music_${track.id}_${Date.now()}`;
      setAudioTracks(prev => [...prev, {
        id: trackId,
        url: track.resultUrl!,
        name: track.prompt || 'Music Track',
        type: 'music',
        volume: 0.5,
      }]);
      
      // ADD THIS LINE:
      updateClipSettings(trackId, { originalDuration: 30 });
      
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

## Fix 3: Initialize Audio Settings When Adding Voice Tracks

**Location:** Find the voice/audio track click handler (around line 1545)

**Current code:**
```typescript
{voiceTracks.map((track) => (
  <div
    onClick={() => {
      const trackId = `voice_${track.id}_${Date.now()}`;
      setAudioTracks(prev => [...prev, {
        id: trackId,
        url: track.resultUrl!,
        name: track.prompt || 'Voice Track',
        type: 'voice',
        volume: 1.0,
      }]);
      setEnhancements(prev => ({
        ...prev,
        audioTrack: {
          audioUrl: track.resultUrl!,
          volume: 1.0,
          type: 'tts',
          name: track.prompt || 'Voice Track',
        },
      }));
      toast({ title: "Audio Added", description: "Audio track added to timeline" });
    }}
```

**Add updateClipSettings call:**
```typescript
{voiceTracks.map((track) => (
  <div
    onClick={() => {
      const trackId = `voice_${track.id}_${Date.now()}`;
      setAudioTracks(prev => [...prev, {
        id: trackId,
        url: track.resultUrl!,
        name: track.prompt || 'Voice Track',
        type: 'voice',
        volume: 1.0,
      }]);
      
      // ADD THIS LINE:
      updateClipSettings(trackId, { originalDuration: 30 });
      
      setEnhancements(prev => ({
        ...prev,
        audioTrack: {
          audioUrl: track.resultUrl!,
          volume: 1.0,
          type: 'tts',
          name: track.prompt || 'Voice Track',
        },
      }));
      toast({ title: "Audio Added", description: "Audio track added to timeline" });
    }}
```

## Summary

These fixes ensure that:
1. Audio tracks get their durations loaded using `<audio>` elements (not `<video>`)
2. Audio tracks have initialized settings so the duration loading logic finds them
3. The console errors "[DURATION] Error loading video clip" will be replaced with "[DURATION] Loaded audio clip xxx: 30s"

After applying these fixes, adding music or voice tracks should work without errors and show accurate durations.
