# Volume Controls for Music & Voice Tracks

## Current State ❌

**What you have now:**
- ✅ Music shows volume at 50% (hardcoded when added)
- ✅ Voice shows volume at 100% (hardcoded when added)
- ❌ **No UI sliders to adjust volume after adding**
- ❌ No way to change volume without re-adding the track

## What You Need ✅

**Volume controls in the Export panel** for both:
1. Background Music (adjustable 0-100%)
2. Voice/Audio Track (adjustable 0-100%)

---

## Implementation

### Where to Add: Export Category Panel

In `client/src/pages/video-editor.tsx`, find the **Export Category Content** section (around line 2292).

**After the "Fade Out" section, ADD THIS:**

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
    
    <div className="flex items-center justify-between">
      <Label className="text-xs">Fade In</Label>
      <Switch
        checked={enhancements.fadeIn}
        onCheckedChange={(checked) => setEnhancements(prev => ({ ...prev, fadeIn: checked }))}
        data-testid="switch-fade-in"
      />
    </div>
    
    <div className="flex items-center justify-between">
      <Label className="text-xs">Fade Out</Label>
      <Switch
        checked={enhancements.fadeOut}
        onCheckedChange={(checked) => setEnhancements(prev => ({ ...prev, fadeOut: checked }))}
        data-testid="switch-fade-out"
      />
    </div>
    
    {/* ========================================== */}
    {/* ✅ ADD THIS: BACKGROUND MUSIC CONTROLS */}
    {/* ========================================== */}
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
              // Also remove from audioTracks
              setAudioTracks(prev => 
                prev.filter(t => t.url !== enhancements.backgroundMusic?.audioUrl)
              );
              toast({ 
                title: "Music Removed", 
                description: "Background music removed from timeline" 
              });
            }}
            data-testid="button-remove-background-music"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="p-2 rounded-md bg-muted/50 text-xs truncate flex items-center gap-2">
          <Music className="h-4 w-4 text-green-500 shrink-0" />
          <span className="truncate flex-1">
            {enhancements.backgroundMusic.name || 'Music Track'}
          </span>
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs flex justify-between">
            Volume
            <span className="text-muted-foreground font-mono">
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
            className="cursor-pointer"
            data-testid="slider-background-music-volume"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Silent</span>
            <span>Loud</span>
          </div>
        </div>
      </div>
    )}
    
    {/* ========================================== */}
    {/* ✅ ADD THIS: VOICE/AUDIO TRACK CONTROLS */}
    {/* ========================================== */}
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
              // Also remove from audioTracks
              setAudioTracks(prev => 
                prev.filter(t => t.url !== enhancements.audioTrack?.audioUrl)
              );
              toast({ 
                title: "Voice Removed", 
                description: "Voice track removed from timeline" 
              });
            }}
            data-testid="button-remove-audio-track"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="p-2 rounded-md bg-muted/50 text-xs truncate flex items-center gap-2">
          <Mic className="h-4 w-4 text-purple-500 shrink-0" />
          <span className="truncate flex-1">
            {enhancements.audioTrack.name || 'Voice Track'}
          </span>
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs flex justify-between">
            Volume
            <span className="text-muted-foreground font-mono">
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
            className="cursor-pointer"
            data-testid="slider-audio-track-volume"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Silent</span>
            <span>Loud</span>
          </div>
        </div>
      </div>
    )}
    
    {/* AWS Lambda Timeout Warning */}
    {totalDuration > 600 && (
      <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 text-xs space-y-1">
        <div className="flex items-center gap-2 font-medium">
          <Clock className="h-4 w-4" />
          Long Video Warning
        </div>
        <p>Videos longer than 10 minutes may take significant time to process.</p>
      </div>
    )}
    
    {/* ... rest of export controls ... */}
  </div>
)}
```

---

## What This Gives You

### 1. **Background Music Controls**
```
┌─────────────────────────────────┐
│ 🎵 Background Music          [X]│
├─────────────────────────────────┤
│ 🎵 Uplifting Corporate Music   │
├─────────────────────────────────┤
│ Volume                      30% │
│ ▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ Silent                     Loud │
└─────────────────────────────────┘
```

**Features:**
- ✅ Shows music name
- ✅ Adjustable volume slider (0-100%)
- ✅ Live percentage display
- ✅ Delete button (X)
- ✅ Visual indicator (green music icon)

### 2. **Voice Track Controls**
```
┌─────────────────────────────────┐
│ 🎤 Voice Track               [X]│
├─────────────────────────────────┤
│ 🎤 Professional Voiceover      │
├─────────────────────────────────┤
│ Volume                     100% │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ Silent                     Loud │
└─────────────────────────────────┘
```

**Features:**
- ✅ Shows voice track name
- ✅ Adjustable volume slider (0-100%)
- ✅ Live percentage display
- ✅ Delete button (X)
- ✅ Visual indicator (purple mic icon)

---

## User Experience Flow

### Before (Current):
1. User adds music → stuck at 50% volume ❌
2. User adds voice → stuck at 100% volume ❌
3. User wants to adjust → must delete and re-add ❌

### After (With Volume Controls):
1. User adds music → defaults to 30% volume ✅
2. User adds voice → defaults to 100% volume ✅
3. User slides music to 20% → instant update ✅
4. User slides voice to 80% → instant update ✅
5. User clicks Generate Preview → hears new mix ✅

---

## Volume Recommendations

### Typical Volume Settings:

**Background Music:**
- **Subtle background**: 20-30%
- **Balanced**: 40-50%
- **Prominent**: 60-80%
- **Music-focused**: 90-100%

**Voice Track:**
- **Soft narration**: 70-80%
- **Standard voiceover**: 90-100%
- **Loud/emphasis**: 100%

**Pro Tip:** Music at 30% + Voice at 100% = Perfect mix for most videos!

---

## Visual Design

The controls will appear in the **Export panel** like this:

```
Export Panel
├── Aspect Ratio (16:9, 9:16, 1:1)
├── Fade In [Toggle]
├── Fade Out [Toggle]
├── ━━━━━━━━━━━━━━━━━━━━━━
├── 🎵 Background Music
│   ├── Name: "Uplifting Corporate"
│   ├── Volume Slider: 30%
│   └── [Delete X]
├── ━━━━━━━━━━━━━━━━━━━━━━
├── 🎤 Voice Track
│   ├── Name: "Professional VO"
│   ├── Volume Slider: 100%
│   └── [Delete X]
├── ━━━━━━━━━━━━━━━━━━━━━━
└── [Export Video] button
```

---

## Testing Checklist

After adding this code:

- [ ] Add background music → Volume slider appears ✅
- [ ] Adjust music volume → Percentage updates ✅
- [ ] Add voice track → Volume slider appears ✅
- [ ] Adjust voice volume → Percentage updates ✅
- [ ] Set music to 20%, voice to 100% ✅
- [ ] Generate preview → Music quiet, voice loud ✅
- [ ] Click X on music → Music removed ✅
- [ ] Click X on voice → Voice removed ✅
- [ ] Re-add both → Sliders reappear ✅

---

## Advanced: Live Preview (Future Enhancement)

If you want **instant audio preview** as users adjust sliders:

```tsx
<Slider
  value={[enhancements.backgroundMusic.volume]}
  min={0}
  max={1}
  step={0.05}
  onValueChange={([v]) => {
    // Update volume
    setEnhancements(prev => ({
      ...prev,
      backgroundMusic: prev.backgroundMusic ? {
        ...prev.backgroundMusic,
        volume: v,
      } : undefined,
    }));
    
    // 🎵 Optional: Play audio preview at this volume
    // playAudioPreview(enhancements.backgroundMusic.audioUrl, v);
  }}
/>
```

---

## Summary

**Answer: YES! ✅**

With the new configuration:

1. **Music volume**: Fully adjustable (0-100%) with slider
2. **Voice volume**: Fully adjustable (0-100%) with slider
3. **Live updates**: Changes reflected immediately
4. **Visual feedback**: Percentage shown next to slider
5. **Delete buttons**: Remove either track easily
6. **Mix preview**: Generate preview to hear the mix

**Just add the code above to your Export panel and you'll have complete volume control!** 🎚️
