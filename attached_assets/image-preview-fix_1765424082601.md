# Image Generation Preview Fix

## Problem

Same as video generation - the `PeerTubePreview` is **always rendered** and never gets replaced with the actual generated image(s).

## Solution

Replace the `preview` prop in `ThreeColumnLayout` with conditional rendering.

---

## Code Fix

**FIND THIS (around line 905):**

```tsx
preview={
  <PeerTubePreview
    pageType="image"
    title="Image Preview"
    description="See what's possible with AI images"
    showGeneratingMessage={isGenerating}
  />
}
```

**REPLACE WITH:**

```tsx
preview={
  generatedImage ? (
    // Show the actual generated image(s)
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Generated Image{generatedImage.resultUrl?.includes(',') ? 's' : ''}</CardTitle>
        <CardDescription className="line-clamp-2">
          {generatedImage.prompt}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-auto">
        {/* Image Grid - Handle multiple images (4o-image, Seedream, Midjourney) */}
        <div className={`grid gap-4 mb-4 ${
          generatedImage.resultUrl?.includes(',') 
            ? 'grid-cols-2' 
            : 'grid-cols-1'
        }`}>
          {generatedImage.resultUrl?.split(',').map((url: string, idx: number) => (
            <div key={idx} className="relative group">
              <img
                src={url.trim()}
                alt={`Generated ${idx + 1}`}
                className="w-full h-auto rounded-lg border-2 border-border object-contain"
                data-testid={`image-result-${idx}`}
              />
              {/* Individual image download */}
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = url.trim();
                  link.download = `image-${generatedImage.id}-${idx + 1}.png`;
                  link.click();
                }}
                data-testid={`button-download-${idx}`}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        
        {/* Metadata */}
        <div className="space-y-2 text-sm mb-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Model:</span>
            <div className="flex items-center gap-2">
              <ImageModelIcon modelValue={generatedImage.model} />
              <span className="font-medium">{generatedImage.model}</span>
            </div>
          </div>
          {generatedImage.parameters?.aspectRatio && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Aspect Ratio:</span>
              <span>{generatedImage.parameters.aspectRatio}</span>
            </div>
          )}
          {generatedImage.seed && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Seed:</span>
              <span className="font-mono">{generatedImage.seed}</span>
            </div>
          )}
          {generatedImage.resultUrl?.includes(',') && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Count:</span>
              <span>{generatedImage.resultUrl.split(',').length} images</span>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-2 mt-auto">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              // Download all images if multiple
              const urls = generatedImage.resultUrl.split(',');
              urls.forEach((url: string, idx: number) => {
                setTimeout(() => {
                  const link = document.createElement('a');
                  link.href = url.trim();
                  link.download = `image-${generatedImage.id}-${idx + 1}.png`;
                  link.click();
                }, idx * 200); // Stagger downloads
              });
            }}
            data-testid="button-download-all"
          >
            <Download className="h-4 w-4 mr-2" />
            Download {generatedImage.resultUrl?.includes(',') ? 'All' : ''}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setGeneratedImage(null);
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
    // Show PeerTube demo when no image generated yet
    <PeerTubePreview
      pageType="image"
      title="Image Preview"
      description="See what's possible with AI images"
      showGeneratingMessage={isGenerating}
    />
  )
}
```

---

## Import Addition

Add `Download` icon to imports at the top:

```tsx
import { Loader2, Image as ImageIcon, Upload, X, ChevronDown, Sparkles, Zap, Palette, Banana, Download } from "lucide-react";
```

---

## What This Fixes

✅ **Before generation**: Shows PeerTube demo  
✅ **During generation**: Shows loading state  
✅ **After generation**: Shows **actual generated image(s)**  
✅ **Multiple images**: Grid layout for 4o-image (2/4 images), Seedream (up to 6), Midjourney (4 variants)  
✅ **Individual downloads**: Hover over each image to download  
✅ **Download all**: Button to download all images at once  
✅ **Metadata display**: Shows model, aspect ratio, seed, count  
✅ **Generate Another**: Clears state for fresh generation  

---

## Key Features

1. **Smart Grid Layout**:
   - Single image: Full width display
   - Multiple images: 2-column grid (responsive)

2. **Per-Image Actions**:
   - Hover overlay with download button
   - Individual image downloads

3. **Batch Downloads**:
   - "Download All" button with staggered downloads (prevents browser blocking)

4. **Proper Cleanup**:
   - "Generate Another" resets all state including reference images

---

## Testing

1. Generate a single image (nano-banana, flux-kontext)
   - Should show 1 full-width image

2. Generate multiple images (4o-image with 2 or 4, Seedream with 3-6)
   - Should show 2-column grid
   - Hover should reveal download buttons
   - "Download All" should download each image

3. Generate with seed (Seedream)
   - Should display seed in metadata

4. Click "Generate Another"
   - Should return to PeerTube demo
   - Form should be cleared

---

## Alternative: Cleaner Component Version

For better code organization:

```tsx
// Add this component before the main component
function ImageResultDisplay({ 
  image, 
  onReset 
}: { 
  image: any; 
  onReset: () => void; 
}) {
  const imageUrls = image.resultUrl?.split(',').map((url: string) => url.trim()) || [];
  const isMultiple = imageUrls.length > 1;
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>
          Generated Image{isMultiple ? 's' : ''}
        </CardTitle>
        <CardDescription className="line-clamp-2">
          {image.prompt}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-auto">
        {/* Image Grid */}
        <div className={`grid gap-4 mb-4 ${isMultiple ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {imageUrls.map((url, idx) => (
            <div key={idx} className="relative group">
              <img
                src={url}
                alt={`Generated ${idx + 1}`}
                className="w-full h-auto rounded-lg border-2 border-border"
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `image-${image.id}-${idx + 1}.png`;
                  link.click();
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs">Model</span>
            <div className="flex items-center gap-1 mt-1">
              <ImageModelIcon modelValue={image.model} className="h-3 w-3" />
              <span className="font-medium text-xs">{image.model}</span>
            </div>
          </div>
          {image.parameters?.aspectRatio && (
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">Aspect Ratio</span>
              <span className="font-medium mt-1">{image.parameters.aspectRatio}</span>
            </div>
          )}
          {image.seed && (
            <div className="flex flex-col col-span-2">
              <span className="text-muted-foreground text-xs">Seed</span>
              <span className="font-mono font-medium mt-1">{image.seed}</span>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              imageUrls.forEach((url, idx) => {
                setTimeout(() => {
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `image-${image.id}-${idx + 1}.png`;
                  link.click();
                }, idx * 200);
              });
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Download {isMultiple ? 'All' : ''}
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
  generatedImage ? (
    <ImageResultDisplay 
      image={generatedImage}
      onReset={() => {
        setGeneratedImage(null);
        setPrompt('');
        setReferenceImages([]);
      }}
    />
  ) : (
    <PeerTubePreview
      pageType="image"
      title="Image Preview"
      description="See what's possible with AI images"
      showGeneratingMessage={isGenerating}
    />
  )
}
```

Both approaches work - the first is simpler, the second is cleaner for maintenance!
