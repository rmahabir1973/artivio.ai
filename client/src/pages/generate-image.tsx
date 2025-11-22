import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePricing } from "@/hooks/use-pricing";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Image as ImageIcon, Upload, X, ChevronDown } from "lucide-react";
import { CreditCostWarning } from "@/components/credit-cost-warning";
import { TemplateManager } from "@/components/template-manager";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { PreviewPanel } from "@/components/preview-panel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SeedControl } from "@/components/SeedControl";
import { SavedSeedsLibrary } from "@/components/SavedSeedsLibrary";

const IMAGE_MODEL_INFO = [
  { value: "4o-image", label: "4o Image API", description: "High-fidelity visuals with accurate text rendering" },
  { value: "flux-kontext", label: "Flux Kontext", description: "Vivid scenes with strong subject consistency" },
  { value: "nano-banana", label: "Nano Banana", description: "Fast, precise image generation and editing" },
  { value: "seedream-4", label: "Seedream 4.0", description: "Up to 4K resolution with batch generation" },
  { value: "midjourney-v7", label: "Midjourney v7", description: "Latest MJ with style controls (4 variants)" },
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
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();
  const { markStepComplete } = useOnboarding();
  
  const [mode, setMode] = useState<"text-to-image" | "image-editing">("text-to-image");
  const [model, setModel] = useState("4o-image");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [style, setStyle] = useState("realistic");
  const [outputFormat, setOutputFormat] = useState("PNG");
  const [quality, setQuality] = useState("standard");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [seedLocked, setSeedLocked] = useState(false);
  
  // Helper to check if current model supports seeds (currently only Seedream 4)
  const modelSupportsSeed = () => {
    return model === 'seedream-4';
  };

  // Load template handler
  const handleLoadTemplate = (template: any) => {
    setPrompt(template.prompt);
    if (template.model) {
      setModel(template.model);
    }
    if (template.parameters) {
      if (template.parameters.aspectRatio) setAspectRatio(template.parameters.aspectRatio);
      if (template.parameters.style) setStyle(template.parameters.style);
      if (template.parameters.outputFormat) setOutputFormat(template.parameters.outputFormat);
      if (template.parameters.quality) setQuality(template.parameters.quality);
    }
  };

  // Merge model info with dynamic pricing
  const IMAGE_MODELS = useMemo(() => IMAGE_MODEL_INFO.map(m => ({
    ...m,
    cost: getModelCost(m.value, 100),
  })), [getModelCost]);

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
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  // Load seed from sessionStorage (from history "Use Seed" button)
  useEffect(() => {
    const savedSeed = sessionStorage.getItem('regenerateSeed');
    if (savedSeed) {
      const seedValue = parseInt(savedSeed, 10);
      if (!isNaN(seedValue)) {
        setSeed(seedValue);
        setSeedLocked(true); // Lock the seed when loading from history
      }
      // Clear the stored seed after loading it
      sessionStorage.removeItem('regenerateSeed');
    }
  }, []);

  // Generation result state
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<any>(null);

  // Poll for generation result when generationId is set
  const { data: pollData } = useQuery<any>({
    queryKey: ["/api/generations", generationId],
    queryFn: async () => {
      if (!generationId) return null;
      return await apiRequest("GET", `/api/generations/${generationId}`);
    },
    enabled: !!generationId && isGenerating,
    refetchInterval: 2000,
    refetchOnWindowFocus: false,
  });

  // Update generatedImage when poll data arrives
  useEffect(() => {
    if (pollData?.resultUrl) {
      setGeneratedImage(pollData);
      setIsGenerating(false);
      toast({
        title: "Image Generated!",
        description: "Your image is ready to view and download.",
      });
    } else if (pollData?.status === 'failed' || pollData?.status === 'failure') {
      setGeneratedImage(pollData);
      setIsGenerating(false);
      setGenerationId(null);
      toast({
        title: "Generation Failed",
        description: pollData?.errorMessage || "Failed to generate image",
        variant: "destructive",
      });
    }
  }, [pollData, toast]);

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/generate/image", data);
    },
    onSuccess: (data: any) => {
      setGenerationId(data.generationId);
      setIsGenerating(true);
      setGeneratedImage(null);
      toast({
        title: "Generation Started",
        description: "Your image is being generated. Watch the preview panel for progress.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
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

  const selectedModel = IMAGE_MODELS.find(m => m.value === model);

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

    // Build parameters with seed support (only Seedream 4 supports seeds)
    const parameters: any = {
      aspectRatio,
      style,
      outputFormat,
      quality,
    };
    
    // Add seed if model supports it and seed is provided
    if (modelSupportsSeed() && seed) {
      parameters.seed = seed;
    }
    
    // Ensure referenceImages is only sent in image-editing mode
    const payload: any = {
      model,
      prompt,
      mode,
      parameters,
    };

    // Only include referenceImages in editing mode
    if (mode === "image-editing") {
      payload.referenceImages = referenceImages;
    }

    // Defensive credit check - prevent API call if insufficient credits
    const userCredits = (user as any)?.credits;
    const modelCost = selectedModel?.cost || 0;
    
    if (typeof userCredits === 'number' && userCredits < modelCost) {
      toast({
        title: "Insufficient Credits",
        description: `You need ${modelCost} credits but only have ${userCredits}. Please upgrade your plan.`,
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate(payload);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <ThreeColumnLayout
      form={
        <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>Image Generation</CardTitle>
                  <CardDescription>
                    {mode === "text-to-image" 
                      ? "Configure your image parameters" 
                      : "Upload images and describe the edits you want"}
                  </CardDescription>
                </div>
                <TemplateManager
                  featureType="image"
                  onLoadTemplate={handleLoadTemplate}
                  currentPrompt={prompt}
                  currentModel={model}
                  currentParameters={{ aspectRatio, style, outputFormat, quality }}
                />
              </div>
            </CardHeader>
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
              <div className="px-6 pt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text-to-image" data-testid="tab-text-to-image">
                    Text to Image
                  </TabsTrigger>
                  <TabsTrigger value="image-editing" data-testid="tab-image-editing">
                    Image Editing
                  </TabsTrigger>
                </TabsList>
              </div>
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

              {/* Seed Control - Only show for models that support it */}
              {modelSupportsSeed() && (
                <>
                  <SeedControl
                    seed={seed}
                    onSeedChange={setSeed}
                    locked={seedLocked}
                    onLockChange={setSeedLocked}
                  />
                  
                  {/* Seed Library Actions */}
                  <div className="flex gap-2">
                    <SavedSeedsLibrary
                      currentSeed={seed}
                      onApplySeed={(appliedSeed) => {
                        setSeed(appliedSeed);
                        setSeedLocked(true); // Lock when applying a saved seed
                      }}
                    />
                  </div>
                </>
              )}

              {/* Credit Cost Warning */}
              {selectedModel && (
                <CreditCostWarning 
                  cost={selectedModel.cost} 
                  featureName={`${selectedModel.label} image ${mode === "text-to-image" ? "generation" : "editing"}`}
                />
              )}

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={
                  generateMutation.isPending || 
                  (user && typeof (user as any).credits === 'number' && (user as any).credits < (selectedModel?.cost || 0))
                }
                className="w-full"
                size="lg"
                data-testid="button-generate-image"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {mode === "text-to-image" ? "Generating..." : "Editing..."}
                  </>
                ) : (user && typeof (user as any).credits === 'number' && (user as any).credits < (selectedModel?.cost || 0)) ? (
                  <>Insufficient Credits - Upgrade Plan</>
                ) : (
                  <>{mode === "text-to-image" ? "Generate Image" : "Edit Image"} ({selectedModel?.cost} credits)</>
                )}
              </Button>

              {/* Model Comparison - Collapsible */}
              <Collapsible className="mt-6">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full" data-testid="button-toggle-models">
                    <ChevronDown className="mr-2 h-4 w-4" />
                    View All Models
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-3">
                  {IMAGE_MODELS.map((m) => (
                    <Card 
                      key={m.value} 
                      className={`hover-elevate active-elevate-2 cursor-pointer transition-colors ${model === m.value ? "border-primary" : ""}`}
                      onClick={() => setModel(m.value)}
                      data-testid={`card-model-${m.value}`}
                    >
                      <CardHeader className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-base">{m.label}</CardTitle>
                            <CardDescription className="text-xs">{m.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold">{m.cost} credits</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
            </Tabs>
          </Card>
      }
      preview={
        <PreviewPanel
          status={
            isGenerating ? "generating" :
            generatedImage?.resultUrl ? "completed" :
            generatedImage?.status === 'failed' ? "failed" :
            "idle"
          }
          title="Image Preview"
          description="Your generated image will appear here"
          resultUrl={generatedImage?.resultUrl}
          resultType="image"
          errorMessage={generatedImage?.errorMessage}
          onDownload={() => {
            if (generatedImage?.id) {
              window.location.href = `/api/generations/${generatedImage.id}/download`;
            }
          }}
        />
      }
    />
  );
}
