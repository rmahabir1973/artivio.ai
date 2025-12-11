# Video Generation Preview Issue - Fix

## Problem

The video generation page shows the PeerTube demo video while generating (good), but **never shows the actual generated video** after completion. The `PeerTubePreview` component stays visible the entire time.

## Root Cause

Looking at the code structure:

```tsx
preview={
  <PeerTubePreview
    pageType="video"
    title="Video Preview"
    description="See what's possible with AI video"
    showGeneratingMessage={isGenerating}
  />
}
```

**Issues:**
1. ❌ `PeerTubePreview` is **always rendered** - no conditional logic
2. ❌ No code to display `generatedVideo` when it exists
3. ❌ State updates correctly (`generatedVideo` gets set), but UI doesn't change
4. ✅ Polling works correctly (confirmed by your state management)

## Solution

Replace the `preview` prop in `ThreeColumnLayout` with conditional rendering that shows:
- **PeerTubePreview** when no video has been generated yet
- **Generating state** when `isGenerating === true`
- **Actual video player** when `generatedVideo` exists

---

## Code Fix

**FIND THIS (around line 1138):**

```tsx
preview={
  <PeerTubePreview
    pageType="video"
    title="Video Preview"
    description="See what's possible with AI video"
    showGeneratingMessage={isGenerating}
  />
}
```

**REPLACE WITH:**

```tsx
preview={
  generatedVideo ? (
    // Show the actual generated video
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Generated Video</CardTitle>
        <CardDescription>
          {generatedVideo.prompt?.substring(0, 100)}
          {generatedVideo.prompt?.length > 100 ? '...' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4">
          <video
            src={generatedVideo.resultUrl}
            controls
            autoPlay
            loop
            className="w-full h-full object-contain"
            data-testid="video-result"
          />
        </div>
        
        {/* Video metadata */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Model:</span>
            <Badge variant="secondary">{generatedVideo.model}</Badge>
          </div>
          {generatedVideo.parameters?.duration && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Duration:</span>
              <span>{generatedVideo.parameters.duration}s</span>
            </div>
          )}
          {generatedVideo.parameters?.aspectRatio && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Aspect Ratio:</span>
              <span>{generatedVideo.parameters.aspectRatio}</span>
            </div>
          )}
          {generatedVideo.seed && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Seed:</span>
              <span className="font-mono">{generatedVideo.seed}</span>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              const link = document.createElement('a');
              link.href = generatedVideo.resultUrl;
              link.download = `video-${generatedVideo.id}.mp4`;
              link.click();
            }}
            data-testid="button-download-result"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setGeneratedVideo(null);
              setPrompt('');
              setReferenceImages([]);
            }}
            data-testid="button-generate-another"
          >
            Generate Another
          </Button>
        </div>
      </CardContent>
    </Card>
  ) : (
    // Show PeerTube demo when no video generated yet
    <PeerTubePreview
      pageType="video"
      title="Video Preview"
      description="See what's possible with AI video"
      showGeneratingMessage={isGenerating}
    />
  )
}
```

---

## Alternative: Cleaner Component Approach

If you want cleaner code, extract the result display into a separate component:

```tsx
// Add this component before the main component
function VideoResultDisplay({ 
  video, 
  onReset 
}: { 
  video: any; 
  onReset: () => void; 
}) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Generated Video</CardTitle>
        <CardDescription className="line-clamp-2">
          {video.prompt}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {/* Video player */}
        <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4">
          <video
            src={video.resultUrl}
            controls
            autoPlay
            loop
            className="w-full h-full object-contain"
            data-testid="video-result"
          />
        </div>
        
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs">Model</span>
            <Badge variant="secondary" className="w-fit mt-1">
              {video.model}
            </Badge>
          </div>
          {video.parameters?.duration && (
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">Duration</span>
              <span className="font-medium mt-1">{video.parameters.duration}s</span>
            </div>
          )}
          {video.parameters?.aspectRatio && (
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">Aspect Ratio</span>
              <span className="font-medium mt-1">{video.parameters.aspectRatio}</span>
            </div>
          )}
          {video.seed && (
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">Seed</span>
              <span className="font-mono font-medium mt-1">{video.seed}</span>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              const link = document.createElement('a');
              link.href = video.resultUrl;
              link.download = `video-${video.id}.mp4`;
              link.click();
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" onClick={onReset}>
            Generate Another
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Then in ThreeColumnLayout:
preview={
  generatedVideo ? (
    <VideoResultDisplay 
      video={generatedVideo}
      onReset={() => {
        setGeneratedVideo(null);
        setPrompt('');
        setReferenceImages([]);
      }}
    />
  ) : (
    <PeerTubePreview
      pageType="video"
      title="Video Preview"
      description="See what's possible with AI video"
      showGeneratingMessage={isGenerating}
    />
  )
}
```

---

## What This Fixes

✅ **Before generation**: Shows PeerTube demo video  
✅ **During generation**: Shows loading state in PeerTube  
✅ **After generation**: Shows **actual generated video** with player  
✅ **Download button**: Lets users save the video  
✅ **Generate Another**: Clears state to start fresh  
✅ **Metadata display**: Shows model, duration, aspect ratio, seed  

---

## Additional Import Needed

Add `Download` icon to imports at the top:

```tsx
import { Loader2, Video, Upload, X, Info, ChevronDown, Sparkles, Zap, Film, Wand2, Download } from "lucide-react";
```

---

## Testing

1. Generate a video
2. Wait for completion
3. Preview panel should **switch from PeerTube to actual video player**
4. Video should autoplay with controls
5. Download button should work
6. "Generate Another" should reset back to PeerTube demo

---

## Why It Wasn't Working

The issue is a common React pattern mistake - the component structure never checked if there was a result to display. The `PeerTubePreview` was **unconditionally rendered** regardless of state.

The fix uses **conditional rendering**:
```tsx
{generatedVideo ? <ActualVideo /> : <PeerTubeDemo />}
```

This is the same pattern used successfully in image generation and other features.
