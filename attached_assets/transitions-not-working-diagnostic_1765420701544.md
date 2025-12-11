# Why Transitions Aren't Working - Diagnostic

## Problem
User reports that transitions aren't working in the video editor. They can add transitions but they don't appear to be applied in the preview/export.

## Possible Root Causes

### 1. Backend Not Processing Transitions ⚠️ MOST LIKELY

**Symptoms:**
- Transitions can be added to the UI
- Preview/export plays but no transitions visible
- Video just cuts directly from clip to clip

**Cause:**
The Lambda backend may not be correctly processing the `clipTransitions` array in the enhancements payload.

**Check:**
Look at the Lambda code handling transitions. It should:
1. Read `enhancements.transitions.mode` (should be 'perClip')
2. Read `enhancements.transitions.perClip` array
3. Apply FFmpeg xfade filter between clips

**FFmpeg xfade syntax:**
```bash
# Between clip 0 and 1, 1 second fade at the 10-second mark:
xfade=transition=fade:duration=1:offset=10
```

**Lambda should generate:**
```javascript
if (enhancements.transitions.mode === 'perClip') {
  enhancements.transitions.perClip.forEach(transition => {
    const { afterClipIndex, type, durationSeconds } = transition;
    // Calculate offset (cumulative duration up to this point)
    const offset = calculateOffsetForClip(afterClipIndex);
    filterComplex += `xfade=transition=${type}:duration=${durationSeconds}:offset=${offset},`;
  });
}
```

### 2. Transition Timing Calculation Wrong

**Symptoms:**
- Transitions happen at wrong times
- Transitions overlap incorrectly
- Some transitions missing

**Cause:**
The `offset` calculation for xfade is incorrect. Each transition needs to know:
- Total duration of all clips BEFORE the transition
- Subtract half the transition duration (transitions overlap)

**Correct calculation:**
```typescript
let cumulativeDuration = 0;
for (let i = 0; i < afterClipIndex + 1; i++) {
  cumulativeDuration += clipDurations[i];
}
// Offset is where the transition STARTS (not ends)
const offset = cumulativeDuration - (durationSeconds / 2);
```

### 3. FFmpeg Filter Chain Issues

**Symptoms:**
- FFmpeg errors in Lambda logs
- Preview generation fails
- Export fails with "Invalid filter" error

**Cause:**
- xfade filter not properly chained
- Missing input streams
- Incorrect stream mapping

**FFmpeg requires:**
```bash
# For N clips with N-1 transitions:
-filter_complex "
  [0:v][1:v]xfade=transition=fade:duration=1:offset=9.5[v01];
  [v01][2:v]xfade=transition=dissolve:duration=1:offset=19.5[v12];
  [v12][3:v]xfade=transition=wipeleft:duration=1:offset=29.5[vout]
" -map "[vout]"
```

### 4. Transition Mode Not Set

**Symptoms:**
- Transitions added to UI state
- Backend ignores transitions
- No FFmpeg transition filters applied

**Cause:**
`enhancements.transitionMode` is still 'none' instead of 'perClip'.

**Fix:**
When adding a transition, ensure:
```typescript
setEnhancements(prev => ({
  ...prev,
  transitionMode: 'perClip', // ← CRITICAL
  clipTransitions: [...newTransitions],
}));
```

### 5. Payload Not Sent to Backend

**Symptoms:**
- Transitions in UI state
- Backend never receives transition data
- Preview/export shows no transitions

**Check:**
1. Verify `enhancements` object sent to `/api/video-editor/preview` and `/api/video-editor/export`
2. Check that transitions are in the payload:
```json
{
  "enhancements": {
    "transitions": {
      "mode": "perClip",
      "perClip": [
        {
          "afterClipIndex": 0,
          "type": "fade",
          "durationSeconds": 1
        }
      ]
    }
  }
}
```

## Debugging Steps

### Step 1: Check Frontend State
```typescript
// Add console.log in generatePreview:
console.log('Enhancements being sent:', enhancements);
console.log('Transition mode:', enhancements.transitionMode);
console.log('Clip transitions:', enhancements.clipTransitions);
```

**Expected output:**
```
Enhancements being sent: {
  transitionMode: 'perClip',
  clipTransitions: [
    { afterClipIndex: 0, type: 'diagtl', durationSeconds: 2 },
    { afterClipIndex: 2, type: 'distance', durationSeconds: 2 }
  ],
  // ... other enhancements
}
```

### Step 2: Check Backend Receives Data
In Lambda handler:
```javascript
console.log('Received enhancements:', JSON.stringify(event.body.enhancements, null, 2));
console.log('Transition mode:', event.body.enhancements?.transitions?.mode);
console.log('Per-clip transitions:', event.body.enhancements?.transitions?.perClip);
```

### Step 3: Check FFmpeg Command
In Lambda, log the FFmpeg command:
```javascript
console.log('FFmpeg filter_complex:', filterComplex);
console.log('Full FFmpeg command:', ffmpegCommand.join(' '));
```

### Step 4: Check CloudWatch Logs
Look for:
- "xfade" in FFmpeg commands
- FFmpeg errors related to filters
- Transition processing logs

### Step 5: Test with Simple Case
Create a minimal test:
- 2 clips, 10 seconds each
- 1 transition (fade) between them, 1 second duration
- Preview should show fade at 9.5 second mark

**Expected FFmpeg:**
```bash
ffmpeg -i clip1.mp4 -i clip2.mp4 \
  -filter_complex "[0:v][1:v]xfade=transition=fade:duration=1:offset=9.5[vout]" \
  -map "[vout]" output.mp4
```

## Most Likely Issues (in order)

1. **Backend doesn't implement transition processing** (80% likely)
   - Lambda ignores clipTransitions array
   - No xfade filters applied
   - Fix: Add transition processing to Lambda

2. **Offset calculation wrong** (10% likely)
   - Transitions at wrong times
   - Fix: Correct offset math

3. **FFmpeg filter chain broken** (5% likely)
   - Syntax errors in filter_complex
   - Fix: Debug FFmpeg command

4. **Frontend not sending data** (3% likely)
   - Payload missing transitions
   - Fix: Verify export/preview requests

5. **transitionMode not set** (2% likely)
   - Mode is 'none' instead of 'perClip'
   - Fix: Set mode when adding transitions

## Quick Test

Add this temporary logging to `generatePreview`:
```typescript
const generatePreview = useCallback(async () => {
  // ... existing code ...
  
  // ADD THIS BEFORE API CALL:
  console.log('🎬 TRANSITION DEBUG:');
  console.log('Mode:', enhancements.transitionMode);
  console.log('Transitions:', JSON.stringify(enhancements.clipTransitions, null, 2));
  console.log('Full payload transitions:', JSON.stringify(payload.enhancements.transitions, null, 2));
  
  const response = await apiRequest("POST", "/api/video-editor/preview", payload);
  // ...
}, [/* deps */]);
```

Generate a preview and check browser console. If transitions are missing from payload, frontend is broken. If transitions are in payload but preview has no transitions, backend is broken.

## Backend Fix Required?

If backend doesn't support transitions, you'll need to:

1. **Parse clipTransitions** from enhancements
2. **Calculate offsets** for each transition
3. **Build xfade filter chain** in FFmpeg
4. **Apply filters** to video concatenation

This is a significant Lambda update that requires FFmpeg expertise.
