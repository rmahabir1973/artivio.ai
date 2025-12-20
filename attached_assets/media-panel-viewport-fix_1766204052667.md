# Media Panel Viewport Fix - "Load More" Button Cut Off

## Problem
The media panel is expanding vertically when loading more videos, pushing the timeline off the bottom of the screen. The "Load More" button is cut off unless you zoom to 30%.

## Root Cause
The `ScrollArea` component inside the media panel is trying to expand to fit its content instead of being constrained by the available viewport height.

## Solution

### Current Code (Lines ~1152-1170):
```tsx
{mediaPanelOpen && (
  <div className="w-72 border-r flex flex-col shrink-0 bg-background" 
       style={{ height: '100%', maxHeight: '100%' }} 
       data-testid="media-panel">
    <div className="flex items-center justify-between p-3 border-b shrink-0 bg-background">
      <span className="text-sm font-medium capitalize">{activeCategory}</span>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-7 w-7"
        onClick={() => setMediaPanelOpen(false)}
        data-testid="button-close-media-panel"
      >
        <PanelLeftClose className="h-4 w-4" />
      </Button>
    </div>

    <div className="flex-1 overflow-hidden min-h-0">
      <ScrollArea className="h-full">
        <div className="p-3 space-y-3">
          {/* ... media content ... */}
        </div>
      </ScrollArea>
    </div>
  </div>
)}
```

### Fixed Code:
```tsx
{mediaPanelOpen && (
  <div className="w-72 border-r flex flex-col shrink-0 bg-background overflow-hidden" 
       data-testid="media-panel">
    <div className="flex items-center justify-between p-3 border-b shrink-0 bg-background">
      <span className="text-sm font-medium capitalize">{activeCategory}</span>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-7 w-7"
        onClick={() => setMediaPanelOpen(false)}
        data-testid="button-close-media-panel"
      >
        <PanelLeftClose className="h-4 w-4" />
      </Button>
    </div>

    <ScrollArea className="flex-1">
      <div className="p-3 space-y-3">
        {/* ... media content ... */}
      </div>
    </ScrollArea>
  </div>
)}
```

## Key Changes

1. **Remove inline styles**: Removed `style={{ height: '100%', maxHeight: '100%' }}` - this was fighting with flex
2. **Add `overflow-hidden`** to the outer container to enforce clipping
3. **Remove wrapper div**: Removed the extra `<div className="flex-1 overflow-hidden min-h-0">` wrapper
4. **Change ScrollArea to `flex-1`**: This makes it take all available space from the flex container
5. **Keep the closing tag** at the same location (after ScrollArea content)

## Where to Apply

**File:** `video-editor.tsx` (in your Replit project)

**Line Numbers:** Around line 1152-1170 (search for `{mediaPanelOpen &&`)

**Find this pattern:**
```tsx
<div className="w-72 border-r flex flex-col shrink-0 bg-background" style={{ height: '100%', maxHeight: '100%' }} data-testid="media-panel">
```

**Replace the entire media panel section** with the fixed code above.

## Why This Works

The original code had:
```
Outer div: flex flex-col (should work)
  ↓
Inner div: flex-1 overflow-hidden min-h-0 (unnecessary wrapper)
  ↓
ScrollArea: h-full (tries to be 100% of parent)
  ↓
Content: keeps growing, pushing everything down ❌
```

The fixed code has:
```
Outer div: flex flex-col overflow-hidden (enforces bounds)
  ↓
ScrollArea: flex-1 (takes available flex space)
  ↓
Content: scrolls when it exceeds space ✅
```

## Testing

After applying the fix:

1. ✅ Click "Media" category
2. ✅ Load 20+ videos by clicking "Load More" multiple times
3. ✅ Scroll down in the media panel - should see "Load More" button at 100% zoom
4. ✅ Timeline should remain visible at the bottom at all times
5. ✅ No need to zoom out to 30% to see the button

## Additional Context

This fix works because:
- The outer container with `calc(100vh - 48px)` already constrains the total height
- The flex layout (60% top, 40% bottom for timeline) divides that space
- The media panel needs to respect its portion of that 60% 
- `ScrollArea` with `flex-1` takes available space and scrolls its content
- No inline styles or extra wrappers fighting the flex layout
