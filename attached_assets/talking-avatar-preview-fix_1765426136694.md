# Talking Avatar Preview Fix

## Problem

Same as video/image generation - the `PeerTubePreview` is always rendered and never gets replaced with the actual generated avatar video.

## Solution

Add state for the generated avatar and conditionally render the result.

---

## Code Changes

### Step 1: Add State (after line 34)

Add these state variables:

```tsx
const [generationId, setGenerationId] = useState<string | null>(null);
const [isGenerating, setIsGenerating] = useState(false);
const [generatedAvatar, setGeneratedAvatar] = useState<any>(null);
```

### Step 2: Add Polling Query (after state declarations)

```tsx
// Poll for generation result
const { data: pollData } = useQuery<any>({
  queryKey: ["/api/generations", generationId],
  queryFn: async () => {
    if (!generationId) return null;
    const response = await apiRequest("GET", `/api/generations/${generationId}`);
    const data = await response.json();
    return data;
  },
  enabled: isAuthenticated && !!generationId,
  refetchInterval: generationId ? 2000 : false,
  refetchOnWindowFocus: false,
  staleTime: 0,
  gcTime: 0,
});

// Update generatedAvatar when poll data arrives
useEffect(() => {
  if (!pollData || !generationId) return;
  
  const isCompleted = pollData?.status === 'completed' || pollData?.status === 'success';
  const isFailed = pollData?.status === 'failed' || pollData?.status === 'failure';
  
  if (isCompleted && pollData?.resultUrl) {
    setGeneratedAvatar(pollData);
    setIsGenerating(false);
    setGenerationId(null);
    queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
    toast({
      title: "Avatar Generated!",
      description: "Your talking avatar is ready to view and download.",
    });
  } else if (isFailed) {
    setGeneratedAvatar(pollData);
    setIsGenerating(false);
    setGenerationId(null);
    queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
    toast({
      title: "Generation Failed",
      description: pollData?.errorMessage || "Failed to generate avatar",
      variant: "destructive",
    });
  }
}, [pollData, generationId, toast, queryClient]);
```

### Step 3: Update generateMutation.onSuccess

**FIND (around line 58):**

```tsx
onSuccess: () => {
  toast({
    title: "Success",
    description: "Avatar generation started! Check your Library for updates.",
  });
  queryClient.invalidateQueries({ queryKey: ["/api/avatar/generations"] });
  queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
  // ... rest of cleanup
},
```

**REPLACE WITH:**

```tsx
onSuccess: (data: any) => {
  setGenerationId(data.generationId);
  setIsGenerating(true);
  setGeneratedAvatar(null);
  toast({
    title: "Generation Started",
    description: "Your talking avatar is being generated. Watch the preview panel for progress.",
  });
  queryClient.invalidateQueries({ queryKey: ["/api/avatar/generations"] });
  queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
  // Keep form data for now - only clear after successful generation
},
```

### Step 4: Add Import for useEffect and useQuery

**Update imports at the top:**

```tsx
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
```

### Step 5: Add Download icon import

**Update lucide-react imports:**

```tsx
import { Loader2, Image as ImageIcon, Video, Upload, Mic, Square, Play, Pause, ChevronDown, Info, Clock, Download } from "lucide-react";
```

### Step 6: Replace preview prop (around line 530)

**FIND:**

```tsx
preview={
  <PeerTubePreview
    pageType="talking-avatar"
    title="Talking Avatar Preview"
    description="See AI avatars come to life"
    showGeneratingMessage={generateMutation.isPending}
  />
}
```

**REPLACE WITH:**

```tsx
preview={
  generatedAvatar ? (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Generated Talking Avatar</CardTitle>
        <CardDescription className="line-clamp-2">
          {generatedAvatar.prompt || "Talking avatar video"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {/* Video player */}
        <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4">
          <video
            src={generatedAvatar.resultUrl}
            controls
            autoPlay
            loop
            className="w-full h-full object-contain"
            data-testid="avatar-result"
          />
        </div>
        
        {/* Metadata */}
        <div className="space-y-2 text-sm mb-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Provider:</span>
            <span className="font-medium">{generatedAvatar.model || provider}</span>
          </div>
          {generatedAvatar.parameters?.quality && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Quality:</span>
              <span>{generatedAvatar.parameters.quality}</span>
            </div>
          )}
          {generatedAvatar.parameters?.emotion && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Emotion:</span>
              <span>{generatedAvatar.parameters.emotion}</span>
            </div>
          )}
          {generatedAvatar.seed && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Seed:</span>
              <span className="font-mono">{generatedAvatar.seed}</span>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-2 mt-auto">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              const link = document.createElement('a');
              link.href = generatedAvatar.resultUrl;
              link.download = `avatar-${generatedAvatar.id}.mp4`;
              link.click();
            }}
            data-testid="button-download-avatar"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setGeneratedAvatar(null);
              setSourceImage("");
              setImageFileName("");
              setAudioUrl("");
              setAudioFile("");
              setAudioDuration(null);
              setRecordedAudio(null);
              setEmotion("");
              setRecordingTime(0);
              if (!seedLocked) {
                setSeed("");
              }
            }}
            data-testid="button-generate-another"
          >
            Generate Another
          </Button>
        </div>
      </CardContent>
    </Card>
  ) : (
    <PeerTubePreview
      pageType="talking-avatar"
      title="Talking Avatar Preview"
      description="See AI avatars come to life"
      showGeneratingMessage={isGenerating}
    />
  )
}
```

### Step 7: Update mutation.isPending references

**FIND (around line 468):**

```tsx
disabled={generateMutation.isPending || !sourceImage || !audioUrl}
```

**REPLACE WITH:**

```tsx
disabled={isGenerating || !sourceImage || !audioUrl}
```

**And the button content:**

```tsx
{isGenerating ? (
  <>
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    Generating...
  </>
) : (
  <>
    <Video className="mr-2 h-4 w-4" />
    Generate Avatar ({cost} credits)
  </>
)}
```

---

## What This Fixes

✅ **Before generation**: Shows PeerTube demo  
✅ **During generation**: Shows loading state (`isGenerating`)  
✅ **After generation**: Shows **actual avatar video** with player  
✅ **Download button**: Lets users save the video  
✅ **Generate Another**: Clears state and resets form  
✅ **Metadata display**: Shows provider, quality, emotion, seed  

---

## Summary of Changes

1. ✅ Added `generationId`, `isGenerating`, `generatedAvatar` state
2. ✅ Added polling query to check generation status
3. ✅ Added useEffect to handle completion
4. ✅ Updated onSuccess to start polling instead of just toast
5. ✅ Replaced preview with conditional render
6. ✅ Added download functionality
7. ✅ Updated button disabled logic

Now users will see their talking avatar appear in the preview panel when it's ready! 🎭
