# Video Editor - Failed Generations Filter Fix

## Problem
Failed/broken generations with black thumbnails are appearing in the media panel despite having filtering logic in place.

## Root Cause
Current filtering (lines 1028-1074) only checks:
- `status === "completed"`
- `resultUrl` exists and not empty
- `resultUrl` doesn't contain 'undefined'

**Missing checks:**
1. No `errorMessage` check (failed gens can have status="completed" + errorMessage)
2. No URL format validation (broken URLs pass string checks)
3. No `null` string check in URLs

## Solution

Replace the filtering logic at **lines 1028-1074** with this enhanced version:

```typescript
// Helper function for robust validation
const isValidGeneration = (g: Generation): boolean => {
  // Must have completed status
  if (g.status !== "completed") return false;
  
  // Must NOT have an error message (failed generations sometimes marked as "completed")
  if (g.errorMessage && g.errorMessage.trim() !== '') return false;
  
  // Must have a valid resultUrl
  if (!g.resultUrl || g.resultUrl.trim() === '') return false;
  
  // Must not contain 'undefined' or 'null' string in URL
  if (g.resultUrl.includes('undefined') || g.resultUrl.includes('null')) return false;
  
  // Must have valid URL format (catches malformed URLs)
  try {
    new URL(g.resultUrl);
    return true;
  } catch {
    return false;
  }
};

// Flatten video pages and filter for TRULY completed videos with valid URLs
const allVideos = useMemo(() => {
  const items = videoData?.pages.flatMap(page => page.items) ?? [];
  return items.filter(isValidGeneration);
}, [videoData]);

// Flatten and filter music tracks (completed with valid URLs)
const musicTracks = useMemo(() => {
  const items = musicData?.pages.flatMap(page => page.items) ?? [];
  return items.filter(isValidGeneration);
}, [musicData]);

// Flatten and filter audio tracks (completed with valid URLs)
const voiceTracks = useMemo(() => {
  const items = audioData?.pages.flatMap(page => page.items) ?? [];
  return items.filter(isValidGeneration);
}, [audioData]);

// Flatten and filter images (completed with valid URLs)
const allImages = useMemo(() => {
  const items = imageData?.pages.flatMap(page => page.items) ?? [];
  return items.filter(isValidGeneration);
}, [imageData]);

// Avatar videos from video query (filter by model type)
const avatarVideos = useMemo(() => {
  const items = videoData?.pages.flatMap(page => page.items) ?? [];
  return items.filter((g) => {
    // Must be avatar type
    const model = (g.model ?? "").toLowerCase();
    const isAvatar = g.type === "talking-avatar" || 
                     g.type === "avatar" || 
                     model.includes("infinitetalk") || 
                     model.includes("infinite-talk");
    
    // Must also pass validation
    return isAvatar && isValidGeneration(g);
  });
}, [videoData]);
```

## What This Fixes

### 1. Error Message Check
```typescript
if (g.errorMessage && g.errorMessage.trim() !== '') return false;
```
- Filters out generations that have `status="completed"` but failed with an error
- Common in backend errors where status isn't updated properly

### 2. Null String Check
```typescript
if (g.resultUrl.includes('undefined') || g.resultUrl.includes('null')) return false;
```
- Catches URLs like `https://example.com/null.mp4` or `https://example.com/undefined.mp4`
- These can happen when backend string interpolation fails

### 3. URL Format Validation
```typescript
try {
  new URL(g.resultUrl);
  return true;
} catch {
  return false;
}
```
- Validates that the URL is actually a valid URL format
- Catches malformed URLs, relative paths, empty strings that pass other checks

## Testing the Fix

After applying, you should see:
- ✅ No black/broken thumbnails
- ✅ No broken image icons
- ✅ Only valid, playable media
- ✅ Failed generations completely hidden

## If Still Showing Failed Items

If broken items STILL appear after this fix, the problem is in the **backend API**:

```javascript
// Debug in browser console:
fetch('/api/generations?type=video&completedOnly=true&cursor=')
  .then(r => r.json())
  .then(data => {
    console.log('Total items:', data.items.length);
    console.log('Failed status:', data.items.filter(i => i.status === 'failed').length);
    console.log('Has errors:', data.items.filter(i => i.errorMessage).length);
    console.log('Null URLs:', data.items.filter(i => !i.resultUrl || i.resultUrl.includes('null')).length);
    console.log('Invalid URLs:', data.items.filter(i => {
      try { new URL(i.resultUrl); return false; } catch { return true; }
    }).length);
  });
```

If this shows failed items being returned despite `completedOnly=true`, then the backend query filter is broken and needs to be fixed in `/api/generations` route.

## Where to Apply the Fix

**File:** `video-editor.tsx`
**Lines:** Replace lines 1028-1074

Add the `isValidGeneration` helper function right before the `useMemo` blocks (around line 1025).
