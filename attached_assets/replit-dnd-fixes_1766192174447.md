# Video Editor DND Issues - Solutions for Replit

## Issue Summary
Your video editor is experiencing several drag-and-drop (DND) issues in Replit:
1. Media area shifts downward when "Load More" is clicked
2. Can't drag files from media window to timeline
3. Videos snap to other clips instead of allowing free positioning
4. Can't drag effects/transitions to timeline

## Root Causes & Solutions

---

## Issue #1: Media Area Shifts Down on "Load More"

### Problem
The media panel doesn't have fixed dimensions, causing the entire layout to reflow when content is added.

### Solution
Add fixed height constraints to the media panel's ScrollArea to prevent layout shifts.

**File:** `video-editor.tsx`

**Current code (around line 2694):**
```tsx
<div className="flex-1 overflow-hidden">
  <ScrollArea className="h-full">
    <div className="p-3 space-y-3">
```

**Fixed code:**
```tsx
<div className="flex-1 overflow-hidden">
  <ScrollArea className="h-full" style={{ maxHeight: 'calc(100vh - 200px)' }}>
    <div className="p-3 space-y-3">
```

**Additional fix - add to media panel container (around line 2680):**
```tsx
<div 
  className="w-72 h-full border-r flex flex-col shrink-0 bg-background" 
  style={{ minHeight: 0, height: '100%' }}
  data-testid="media-panel"
>
```

**Why this works:** Setting explicit height constraints prevents the flex container from expanding when new items load, keeping the media panel size stable.

---

## Issue #2: Can't Drag Files from Media Window to Timeline

### Problem
The `DndContext` wraps both the media panel and timeline, but the collision detection or droppable zones might not be properly configured for cross-container dragging.

### Root Cause Analysis
Looking at your code structure:
- DndContext starts at line 2661 in video-editor.tsx
- Media panel is inside this context (starts ~line 2680)
- Timeline/Advanced Timeline is also inside (around line 3100+)
- DraggableMediaItem components have proper useDraggable hooks
- BUT: The droppable zones may not be rendering or detecting properly

### Solution A: Ensure Droppable Zones are Always Rendered

**File:** `advanced-timeline.tsx`

The DroppableTrack components need to be present even when empty. Check that they're rendering:

**Around line 1090-1150, ensure this pattern:**
```tsx
<DroppableTrack trackId="layer-1" style={{ height: TRACK_HEIGHT }}>
  {/* Track content */}
  {trackVisibility['layer-1'] !== false && (
    <>
      {/* clips render here */}
    </>
  )}
</DroppableTrack>
```

### Solution B: Fix Collision Detection for Cross-Panel Drags

**File:** `video-editor.tsx` (around line 1217)

**Current collision detection may be too strict. Update it:**

```tsx
const customCollisionDetection: CollisionDetection = useCallback((args) => {
  const pointerCollisions = pointerWithin(args);
  const rectCollisions = rectIntersection(args);
  const allCollisions = [...pointerCollisions, ...rectCollisions];
  
  const activeData = args.active.data.current;
  const isMediaDrag = activeData?.type === 'media-item';
  const isTransitionDrag = activeData?.type === 'transition';
  
  // For MEDIA drags from library: be more lenient with collision detection
  if (isMediaDrag) {
    // First try pointer-based collision (more precise for drags from sidebar)
    const trackDropHits = pointerCollisions.filter(
      collision => collision.data?.droppableContainer?.data?.current?.type === 'track-drop-zone'
    );
    
    if (trackDropHits.length > 0) {
      console.log('[COLLISION] Track drop zone hit (pointer):', trackDropHits[0].id);
      return [trackDropHits[0]];
    }
    
    // Fall back to rect intersection
    const rectTrackDropHits = rectCollisions.filter(
      collision => collision.data?.droppableContainer?.data?.current?.type === 'track-drop-zone'
    );
    
    if (rectTrackDropHits.length > 0) {
      console.log('[COLLISION] Track drop zone hit (rect):', rectTrackDropHits[0].id);
      return [rectTrackDropHits[0]];
    }
  }
  
  // ... rest of collision detection
}, []);
```

### Solution C: Check z-index Layering

The media panel might be layered above the timeline, blocking drops.

**Add to the timeline container:**
```tsx
<div 
  className="flex-[4] flex flex-col border-t bg-muted/30 overflow-hidden"
  style={{ position: 'relative', zIndex: 1 }}
>
  <AdvancedTimeline ... />
</div>
```

**And ensure media panel has lower z-index:**
```tsx
<div 
  className="w-72 h-full border-r flex flex-col shrink-0 bg-background" 
  style={{ position: 'relative', zIndex: 0 }}
  data-testid="media-panel"
>
```

### Solution D: Verify DragOverlay is Working

**File:** `video-editor.tsx`

Add a DragOverlay at the end of your DndContext (should be around line 3719):

```tsx
</DndContext>
```

**Ensure you have:**
```tsx
  <DndContext
    sensors={sensors}
    collisionDetection={customCollisionDetection}
    onDragEnd={handleDragEnd}
    onDragStart={(event) => {
      console.log('[DRAG START]', event.active.id, event.active.data.current);
    }}
    onDragCancel={() => {
      console.log('[DRAG] Drag cancelled');
    }}
  >
    {/* ... all your content ... */}
    
    <DragOverlay>
      {/* Show what's being dragged */}
      {activeId && (
        <div className="p-2 bg-primary/20 rounded border-2 border-primary backdrop-blur">
          <span className="text-xs">Dragging...</span>
        </div>
      )}
    </DragOverlay>
  </DndContext>
```

---

## Issue #3: Videos Snap to Other Clips (Can't Free-Position)

### Problem
Clips are using the sortable/snap-to-grid behavior instead of free positioning.

### Solution: Implement Free-Positioning Logic

**File:** `advanced-timeline.tsx`

Currently, clips are positioned based on cumulative durations (line ~700-750). To allow free positioning:

**Option A: Add manual positioning mode**

Add state to track if clips should snap or be free:
```tsx
const [snapEnabled, setSnapEnabled] = useState(true);
```

Update the clip positioning calculation (around line 700):
```tsx
const clipPositions = useMemo(() => {
  if (!snapEnabled) {
    // Free positioning mode - use stored positions
    return clips.map((clip, index) => {
      const settings = getClipSettings(clip.id);
      const duration = getClipDuration(clip, settings);
      const width = duration * pixelsPerSecond;
      
      return {
        clip,
        index,
        left: settings.positionSeconds ? settings.positionSeconds * pixelsPerSecond : 0,
        width,
        duration,
      };
    });
  }
  
  // Original snap-to-grid logic
  let currentLeft = 0;
  return clips.map((clip, index) => {
    // ... existing logic
  });
}, [clips, pixelsPerSecond, snapEnabled, getClipSettings]);
```

**Option B: Allow overlap with negative margins**

In the `TimelineClipItem` drag handler, change the positioning:

```tsx
// In handleDragEnd for clip reordering
const handleClipMove = (clipId: string, newTimeSeconds: number) => {
  // Update clip settings with new position
  onClipSettingsChange?.(clipId, { 
    positionSeconds: newTimeSeconds 
  });
};
```

**Add UI toggle for snap mode:**
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant={snapEnabled ? 'default' : 'outline'}
      size="sm"
      onClick={() => setSnapEnabled(!snapEnabled)}
    >
      <Magnet className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    {snapEnabled ? 'Disable Snap' : 'Enable Snap'}
  </TooltipContent>
</Tooltip>
```

### Better Solution: Modify Existing DragEnd Handler

**File:** `advanced-timeline.tsx` (around line 850-950)

In the `handleDragEnd` function, modify to support pixel-based positioning:

```tsx
const handleDragEnd = (event: DragEndEvent) => {
  const { active, delta } = event;
  
  if (!active) return;
  
  const clipId = active.id as string;
  const clip = clips.find(c => c.id === clipId);
  if (!clip) return;
  
  // Calculate new position based on delta
  const currentPos = clipPositions.find(p => p.clip.id === clipId);
  if (!currentPos) return;
  
  const newLeftPx = currentPos.left + delta.x;
  const newTimeSeconds = Math.max(0, newLeftPx / pixelsPerSecond);
  
  // Check for overlaps if snap is enabled
  if (snapEnabled) {
    // Existing snap logic
  } else {
    // Free positioning - just update the position
    if (onClipSettingsChange) {
      onClipSettingsChange(clipId, {
        positionSeconds: newTimeSeconds
      });
    }
  }
};
```

---

## Issue #4: Can't Drag Transitions to Timeline

### Problem
Transitions aren't being detected by the timeline's drop zones.

### Solution A: Verify DraggableTransition Setup

**File:** `draggable-transition.tsx`

Your code looks correct, but ensure the data structure matches what handleDragEnd expects:

**Current code is good:**
```tsx
useDraggable({ 
  id: `transition-${type}`,
  data: { 
    type: 'transition',
    transitionType: type,
  }
});
```

### Solution B: Check DroppableTransitionZone Rendering

**File:** `advanced-timeline.tsx` (around line 179-220)

The transition drop zones only render between consecutive clips on the same layer. Make sure they're visible:

**Add visual debugging:**
```tsx
<div
  ref={setNodeRef}
  className={cn(
    "absolute flex items-center justify-center z-20 transition-all",
    hasTransition ? "w-12" : "w-8",
    isOver ? "w-16 bg-primary/30 border-2 border-primary border-dashed rounded" : "",
    "min-h-[40px]" // ADD THIS - ensure minimum hit area
  )}
  style={{
    left: `${left}px`,
    top: 0,
    height: TRACK_HEIGHT,
  }}
  data-testid={`transition-zone-${trackId}-${position}`}
>
```

### Solution C: Update Collision Detection Priority

**File:** `video-editor.tsx` (around line 1230)

The transition collision detection looks correct, but add debugging:

```tsx
if (isTransitionDrag) {
  console.log('[COLLISION DEBUG] Looking for transition zones');
  console.log('[COLLISION DEBUG] All collisions:', allCollisions.map(c => ({
    id: c.id,
    type: c.data?.droppableContainer?.data?.current?.type
  })));
  
  const transitionZoneHits = allCollisions.filter(
    collision => collision.data?.droppableContainer?.data?.current?.type === 'transition-zone'
  );
  
  if (transitionZoneHits.length > 0) {
    console.log('[COLLISION] Transition zone hit:', transitionZoneHits[0].id);
    return [transitionZoneHits[0]];
  } else {
    console.log('[COLLISION] No transition zones detected!');
  }
}
```

### Solution D: Ensure Transition Zones Render on All Tracks

**File:** `advanced-timeline.tsx`

Check that transition drop zones are being created. Around line 1170-1400, you have sections for each layer. Verify they're all rendering:

**For each layer, ensure this pattern exists:**
```tsx
{/* Transition drop zones for layer-1 clips */}
{(() => {
  const layer1Clips = clipPositions.filter(p => (p.clip.trackId || 'layer-1') === 'layer-1');
  return layer1Clips.slice(0, -1).map((position) => {
    const hasTransition = clipTransitions.some(
      t => t.afterClipIndex === position.index && (t.trackId || 'layer-1') === 'layer-1'
    );
    const transitionType = clipTransitions.find(
      t => t.afterClipIndex === position.index && (t.trackId || 'layer-1') === 'layer-1'
    )?.type;
    
    return (
      <DroppableTransitionZone
        key={`trans-zone-l1-${position.index}`}
        position={position.index}
        clipId={position.clip.id}
        left={position.left + position.width}
        hasTransition={hasTransition}
        transitionType={transitionType}
        trackId="layer-1"
      />
    );
  });
})()}
```

---

## Testing Checklist

After implementing fixes:

### Test #1: Media Panel Stability
- [ ] Load videos in media panel
- [ ] Click "Load More" 
- [ ] Verify timeline doesn't move down
- [ ] Verify media grid stays in place

### Test #2: Drag Media to Timeline
- [ ] Open Console (F12)
- [ ] Drag a video from media panel
- [ ] Check console for "[DRAG START]" message
- [ ] Look for "[COLLISION] Track drop zone hit" message
- [ ] Verify video appears on timeline

### Test #3: Free Positioning
- [ ] Add 2+ clips to timeline
- [ ] Try dragging clip over another
- [ ] If snap toggle added, test both modes
- [ ] Verify clips can overlap when snap disabled

### Test #4: Transition Drops
- [ ] Open Console
- [ ] Add 2+ clips to same layer
- [ ] Drag transition from effects panel
- [ ] Watch for "[COLLISION DEBUG]" messages
- [ ] Look for transition zone detection
- [ ] Verify transition appears between clips

---

## Quick Debug Commands for Replit Console

```javascript
// Check if droppable zones exist
document.querySelectorAll('[data-testid^="track-"]').length

// Check transition zones
document.querySelectorAll('[data-testid^="transition-zone"]').length

// Check draggable items
document.querySelectorAll('[data-testid^="draggable-"]').length

// Monitor drag events
window.addEventListener('dragstart', (e) => console.log('DRAG START', e));
window.addEventListener('dragend', (e) => console.log('DRAG END', e));
```

---

## Priority Implementation Order

1. **Fix #1 first** - Media panel height (easiest, prevents annoyance)
2. **Fix #2 second** - Drag from media to timeline (most critical)
3. **Fix #4 third** - Transition dragging (feature parity)
4. **Fix #3 last** - Free positioning (enhancement, not blocker)

---

## Additional Recommendations

### Performance Optimization
The timeline re-renders on every clip change. Consider:
```tsx
const MemoizedTimelineClip = memo(TimelineClipItem, (prev, next) => {
  return (
    prev.position.clip.id === next.position.clip.id &&
    prev.position.left === next.position.left &&
    prev.position.width === next.position.width &&
    prev.isSelected === next.isSelected
  );
});
```

### Improved Visual Feedback
Add better drop zone indicators:
```tsx
{isOver && (
  <div className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed rounded-lg flex items-center justify-center">
    <div className="bg-primary text-primary-foreground px-3 py-1 rounded-md text-sm font-medium">
      Drop here to add to {trackLabel}
    </div>
  </div>
)}
```

### Error Boundary
Wrap DndContext in error boundary to catch DND-related crashes:
```tsx
<ErrorBoundary fallback={<div>Drag and drop error</div>}>
  <DndContext ...>
    {/* content */}
  </DndContext>
</ErrorBoundary>
```
