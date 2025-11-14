import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Image as ImageIcon, Upload, X } from "lucide-react";

const IMAGE_MODELS = [
  { value: "4o-image", label: "4o Image API", cost: 100, description: "High-fidelity visuals with accurate text rendering" },
  { value: "flux-kontext", label: "Flux Kontext", cost: 150, description: "Vivid scenes with strong subject consistency" },
  { value: "nano-banana", label: "Nano Banana", cost: 50, description: "Fast, precise image generation and editing" },
];

const ASPECT_RATIOS = [
  { value: "1:1", label: "Square (1:1)" },
  { value: "16:9", label: "Landscape (16:9)" },
  { value: "9:16", label: "Portrait (9:16)" },
  { value: "4:3", label: "Classic (4:3)" },
  { value: "3:4", label: "Portrait (3:4)" },
];

const OUTPUT_FORMATS = [
  { value: "PNG", label: "PNG (Lossless)" },
  { value: "JPEG", label: "JPEG (Compressed)" },
  { value: "WEBP", label: "WebP (Modern)" },
];

const QUALITY_OPTIONS = [
  { value: "standard", label: "Standard Quality" },
  { value: "hd", label: "HD Quality" },
];

export default function GenerateImage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [mode, setMode] = useState<"text-to-image" | "image-editing">("text-to-image");
  const [model, setModel] = useState("4o-image");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [style, setStyle] = useState("realistic");
  const [outputFormat, setOutputFormat] = useState("PNG");
  const [quality, setQuality] = useState("standard");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);

  // Clear reference images when switching to text-to-image mode
  useEffect(() => {
    if (mode === "text-to-image" && referenceImages.length > 0) {
      setReferenceImages([]);
    }
  }, [mode]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/generate/image", data);
    },
    onSuccess: () => {
      toast({
        title: "Generation Started",
        description: "Your image is being generated. Check the history page for progress.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      setPrompt("");
      setReferenceImages([]);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Limit to 10 images total
    const remainingSlots = 10 - referenceImages.length;
    if (remainingSlots <= 0) {
      toast({
        title: "Upload Limit Reached",
        description: "You can upload a maximum of 10 images for editing.",
        variant: "destructive",
      });
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    const maxFileSize = 10 * 1024 * 1024; // 10MB limit
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

    filesToProcess.forEach((file) => {
      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not a supported image format. Allowed: JPEG, PNG, WebP, GIF.`,
          variant: "destructive",
        });
        return;
      }

      // Validate file size
      if (file.size > maxFileSize) {
        toast({
          title: "File Too Large",
          description: `${file.name} is ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 10MB.`,
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setReferenceImages((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a description for your image.",
        variant: "destructive",
      });
      return;
    }

    if (mode === "image-editing" && referenceImages.length === 0) {
      toast({
        title: "Image Required",
        description: "Please upload at least one image for editing.",
        variant: "destructive",
      });
      return;
    }

    // Ensure referenceImages is only sent in image-editing mode
    const payload: any = {
      model,
      prompt,
      mode,
      parameters: {
        aspectRatio,
        style,
        outputFormat,
        quality,
      },
    };

    // Only include referenceImages in editing mode
    if (mode === "image-editing") {
      payload.referenceImages = referenceImages;
    }

    generateMutation.mutate(payload);
  };

  const selectedModel = IMAGE_MODELS.find(m => m.value === model);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <ImageIcon className="h-10 w-10 text-primary" />
          Image Generation
        </h1>
        <p className="text-lg text-muted-foreground">
          Create and edit high-quality images with AI-powered models
        </p>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="text-to-image" data-testid="tab-text-to-image">Text to Image</TabsTrigger>
          <TabsTrigger value="image-editing" data-testid="tab-image-editing">Image Editing</TabsTrigger>
        </TabsList>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Generation Settings</CardTitle>
              <CardDescription>
                {mode === "text-to-image" 
                  ? "Configure your image parameters" 
                  : "Upload images and describe the edits you want"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Model Selection */}
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model" data-testid="select-image-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label} ({m.cost} credits)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedModel && (
                  <p className="text-sm text-muted-foreground">{selectedModel.description}</p>
                )}
              </div>

              <TabsContent value="image-editing" className="mt-0">
                {/* Image Upload */}
                <div className="space-y-2">
                  <Label>Reference Images (Max 10)</Label>
                  <div className="border-2 border-dashed rounded-md p-6 text-center hover-elevate cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                      data-testid="input-image-upload"
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload images or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        PNG, JPG, WebP up to 10MB each
                      </p>
                    </label>
                  </div>

                  {/* Image Previews */}
                  {referenceImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      {referenceImages.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <img
                            src={img}
                            alt={`Reference ${idx + 1}`}
                            className="w-full h-24 object-cover rounded border"
                          />
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeImage(idx)}
                            data-testid={`button-remove-image-${idx}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Prompt */}
              <div className="space-y-2">
                <Label htmlFor="prompt">
                  {mode === "text-to-image" ? "Image Description" : "Editing Instructions"}
                </Label>
                <Textarea
                  id="prompt"
                  placeholder={
                    mode === "text-to-image"
                      ? "Describe the image you want to create..."
                      : "Describe what changes you want to make to the image..."
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  data-testid="input-image-prompt"
                />
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-2">
                <Label htmlFor="aspectRatio">Aspect Ratio</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger id="aspectRatio" data-testid="select-aspect-ratio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIOS.map((ratio) => (
                      <SelectItem key={ratio.value} value={ratio.value}>
                        {ratio.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Output Format */}
              <div className="space-y-2">
                <Label htmlFor="outputFormat">Output Format</Label>
                <Select value={outputFormat} onValueChange={setOutputFormat}>
                  <SelectTrigger id="outputFormat" data-testid="select-output-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTPUT_FORMATS.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quality */}
              <div className="space-y-2">
                <Label htmlFor="quality">Quality</Label>
                <Select value={quality} onValueChange={setQuality}>
                  <SelectTrigger id="quality" data-testid="select-quality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALITY_OPTIONS.map((q) => (
                      <SelectItem key={q.value} value={q.value}>
                        {q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Style */}
              <div className="space-y-2">
                <Label htmlFor="style">Style</Label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger id="style" data-testid="select-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realistic">Realistic</SelectItem>
                    <SelectItem value="artistic">Artistic</SelectItem>
                    <SelectItem value="anime">Anime</SelectItem>
                    <SelectItem value="cinematic">Cinematic</SelectItem>
                    <SelectItem value="abstract">Abstract</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="w-full"
                size="lg"
                data-testid="button-generate-image"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {mode === "text-to-image" ? "Generating..." : "Editing..."}
                  </>
                ) : (
                  <>{mode === "text-to-image" ? "Generate Image" : "Edit Image"} ({selectedModel?.cost} credits)</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Model Comparison */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Available Models</h2>
            <div className="space-y-4">
              {IMAGE_MODELS.map((m) => (
                <Card key={m.value} className={model === m.value ? "border-primary" : ""}>
                  <CardHeader>
                    <CardTitle className="text-lg">{m.label}</CardTitle>
                    <CardDescription>{m.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{m.cost}</span>
                      <span className="text-sm text-muted-foreground">credits per image</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
