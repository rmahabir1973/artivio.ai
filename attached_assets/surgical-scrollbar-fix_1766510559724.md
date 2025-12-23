# Surgical Scrollbar Fix - Timeline Track Headers Only

## Problem
The media panel scrollbar works, but the timeline track headers scrollbar doesn't show. We need to fix ONLY the track headers without breaking the media panel.

## Solution: Custom CSS Class with !important

### Step 1: Add CSS to your global.css or a new CSS file

Add this CSS (it will ONLY target the track headers, not the media panel):

```css
/* Timeline Track Headers Scrollbar - Force Visible */
[data-testid="track-headers-scroll"] {
  overflow-y: scroll !important;
  flex: 1 !important;
  min-height: 0 !important;
  
  /* Firefox scrollbar */
  scrollbar-width: thin !important;
  scrollbar-color: rgba(156, 163, 175, 0.5) rgba(0, 0, 0, 0.05) !important;
}

/* Webkit browsers (Chrome, Safari, Edge) */
[data-testid="track-headers-scroll"]::-webkit-scrollbar {
  width: 12px !important;
  display: block !important;
}

[data-testid="track-headers-scroll"]::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05) !important;
}

[data-testid="track-headers-scroll"]::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5) !important;
  border-radius: 6px !important;
  border: 3px solid rgba(0, 0, 0, 0.05) !important;
  background-clip: content-box !important;
}

[data-testid="track-headers-scroll"]::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.8) !important;
}
```

### Step 2: Keep your AdvancedTimeline code as-is

Your track headers div already has the right `data-testid`, so the CSS will target it:

```tsx
<div className="flex-1 min-h-0 overflow-y-scroll" data-testid="track-headers-scroll">
  {/* Your existing code */}
</div>
```

### Step 3: Test

1. Add the CSS to your global styles
2. Refresh the page
3. Add 8+ layers to see the scrollbar
4. Media panel scrollbar should remain working

## Why This Works

- Uses `data-testid` selector to ONLY target track headers
- Uses `!important` to override any parent constraints
- Doesn't touch anything else
- Media panel scrollbar (`data-testid="media-panel"`) is completely separate

## Alternative: If You Can't Add CSS

If you can't modify CSS files, add an inline style tag in your component:

```tsx
// At the top of your AdvancedTimeline component, add:
useEffect(() => {
  const style = document.createElement('style');
  style.textContent = `
    [data-testid="track-headers-scroll"] {
      overflow-y: scroll !important;
      scrollbar-width: thin !important;
      scrollbar-color: rgba(156, 163, 175, 0.5) transparent !important;
    }
    [data-testid="track-headers-scroll"]::-webkit-scrollbar {
      width: 12px !important;
      display: block !important;
    }
    [data-testid="track-headers-scroll"]::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.05) !important;
    }
    [data-testid="track-headers-scroll"]::-webkit-scrollbar-thumb {
      background-color: rgba(156, 163, 175, 0.5) !important;
      border-radius: 6px !important;
    }
  `;
  document.head.appendChild(style);
  return () => document.head.removeChild(style);
}, []);
```

This injects the CSS at runtime without touching any CSS files.

## What Gets Fixed vs What Stays Safe

✅ **FIXED:** Timeline track headers (left sidebar in timeline at bottom)
✅ **SAFE:** Media panel (left sidebar at top with videos)
✅ **SAFE:** All other scrollbars in the app

The selector `[data-testid="track-headers-scroll"]` is VERY specific and won't affect anything else.
