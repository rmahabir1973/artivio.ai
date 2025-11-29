import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePricing } from "@/hooks/use-pricing";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Image as ImageIcon, Upload, X, ChevronDown, Sparkles, Zap, Palette, Banana } from "lucide-react";
import { CreditCostWarning } from "@/components/credit-cost-warning";
import { TemplateManager } from "@/components/template-manager";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { PreviewPanel } from "@/components/preview-panel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SeedControl } from "@/components/SeedControl";
import { SavedSeedsLibrary } from "@/components/SavedSeedsLibrary";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { SiOpenai } from "react-icons/si";

// Model icon component for consistent styling
const ImageModelIcon = ({ modelValue, className = "h-4 w-4" }: { modelValue: string; className?: string }) => {
  if (modelValue === "4o-image") {
    return <SiOpenai className={`${className} text-green-500`} />;
  }
  if (modelValue === "flux-kontext") {
    return <Zap className={`${className} text-blue-500`} />;
  }
  if (modelValue === "nano-banana") {
    return <Banana className={`${className} text-yellow-500`} />;
  }
  if (modelValue === "seedream-4") {
    return <Sparkles className={`${className} text-purple-500`} />;
  }
  if (modelValue === "midjourney-v7") {
    return <Palette className={`${className} text-indigo-500`} />;
  }
  return <ImageIcon className={`${className} text-muted-foreground`} />;
};

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

const GPT4O_ASPECT_RATIOS = [
  { value: "1:1", label: "Square (1:1)" },
  { value: "2:3", label: "Tall Portrait (2:3)" },
  { value: "3:2", label: "Wide Landscape (3:2)" },
];

const FLUX_ASPECT_RATIOS = [
  { value: "1:1", label: "Square (1:1)" },
  { value: "16:9", label: "Landscape (16:9)" },
  { value: "21:9", label: "Ultra-wide (21:9)" },
  { value: "4:3", label: "Classic (4:3)" },
  { value: "3:4", label: "Portrait (3:4)" },
  { value: "9:16", label: "Mobile Portrait (9:16)" },
];

const NANO_BANANA_ASPECT_RATIOS = [
  { value: "1:1", label: "Square (1:1)" },
  { value: "2:3", label: "Tall Portrait (2:3)" },
  { value: "3:2", label: "Wide Landscape (3:2)" },
  { value: "3:4", label: "Portrait (3:4)" },
  { value: "4:3", label: "Classic (4:3)" },
  { value: "4:5", label: "Portrait (4:5)" },
  { value: "5:4", label: "Landscape (5:4)" },
  { value: "9:16", label: "Mobile Portrait (9:16)" },
  { value: "16:9", label: "Landscape (16:9)" },
  { value: "21:9", label: "Ultra-wide (21:9)" },
];

const NANO_BANANA_RESOLUTIONS = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
  { value: "4K", label: "4K" },
];

const NANO_BANANA_OUTPUT_FORMATS = [
  { value: "png", label: "PNG (Lossless)" },
  { value: "jpg", label: "JPG (Compressed)" },
];

const SEEDREAM_ASPECT_RATIOS = [
  { value: "square", label: "Square" },
  { value: "square_hd", label: "Square HD" },
  { value: "portrait_4_3", label: "Portrait 3:4" },
  { value: "portrait_3_2", label: "Portrait 2:3" },
  { value: "portrait_16_9", label: "Portrait 9:16" },
  { value: "landscape_4_3", label: "Landscape 4:3" },
  { value: "landscape_3_2", label: "Landscape 3:2" },
  { value: "landscape_16_9", label: "Landscape 16:9" },
  { value: "landscape_21_9", label: "Landscape 21:9" },
];

const SEEDREAM_RESOLUTIONS = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
  { value: "4K", label: "4K" },
];

const MIDJOURNEY_ASPECT_RATIOS = [
  { value: "1:2", label: "Ultra-tall (1:2)" },
  { value: "9:16", label: "Portrait (9:16)" },
  { value: "2:3", label: "Portrait (2:3)" },
  { value: "3:4", label: "Portrait (3:4)" },
  { value: "5:6", label: "Portrait (5:6)" },
  { value: "6:5", label: "Landscape (6:5)" },
  { value: "4:3", label: "Classic (4:3)" },
  { value: "3:2", label: "Classic (3:2)" },
  { value: "1:1", label: "Square (1:1)" },
  { value: "16:9", label: "Widescreen (16:9)" },
  { value: "2:1", label: "Ultra-wide (2:1)" },
];

const MIDJOURNEY_VERSIONS = [
  { value: "7", label: "Version 7" },
  { value: "6.1", label: "Version 6.1" },
  { value: "6", label: "Version 6" },
  { value: "5.2", label: "Version 5.2" },
  { value: "5.1", label: "Version 5.1" },
  { value: "niji6", label: "Niji 6" },
];

const MIDJOURNEY_SPEED_OPTIONS = [
  { value: "relaxed", label: "Relaxed" },
  { value: "fast", label: "Fast" },
  { value: "turbo", label: "Turbo" },
];

const GENERATE_QUANTITIES = [
  { value: "1", label: "1 Image (6 credits)" },
  { value: "2", label: "2 Images (7 credits)" },
  { value: "4", label: "4 Images (8 credits)" },
];

const FLUX_MODELS = [
  { value: "pro", label: "Pro (5 credits)" },
  { value: "max", label: "Max (10 credits)" },
];

const OUTPUT_FORMATS = [
  { value: "PNG", label: "PNG (Lossless)" },
  { value: "JPEG", label: "JPEG (Compressed)" },
  { value: "WEBP", label: "WebP (Modern)" },
];

const FLUX_OUTPUT_FORMATS = [
  { value: "png", label: "PNG (Lossless)" },
  { value: "jpeg", label: "JPEG (Compressed)" },
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
  const [resolution, setResolution] = useState("1K"); // For nano-banana: 1K, 2K, or 4K
  const [seedreamResolution, setSeedreamResolution] = useState("1K"); // For seedream-4: 1K, 2K, or 4K
  const [seedreamImageSize, setSeedreamImageSize] = useState("square"); // For seedream-4: image_size
  const [maxImages, setMaxImages] = useState(1); // For seedream-4: 1-6 images
  const [generateQuantity, setGenerateQuantity] = useState("1"); // For 4o-image: 1, 2, or 4
  const [fluxModel, setFluxModel] = useState("pro"); // For flux-kontext: pro or max
  const [promptUpsampling, setPromptUpsampling] = useState(false); // For flux-kontext
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [seedLocked, setSeedLocked] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  
  // Midjourney-specific state
  const [mjMode, setMjMode] = useState<"text-to-image" | "image-to-image" | "image-to-video">("text-to-image");
  const [mjSpeed, setMjSpeed] = useState("fast");
  const [mjVersion, setMjVersion] = useState("7");
  const [mjStylization, setMjStylization] = useState(0);
  const [mjWeirdness, setMjWeirdness] = useState(0);
  const [mjVariety, setMjVariety] = useState(0);
  const [mjWatermark, setMjWatermark] = useState("");
  const [mjEnableTranslation, setMjEnableTranslation] = useState(false);
  const [mjAspectRatio, setMjAspectRatio] = useState("1:1");
  
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
  const IMAGE_MODELS = useMemo(() => IMAGE_MODEL_INFO.map(m => {
    let cost = getModelCost(m.value, 100);
    
    // For 4o-image, adjust cost based on generate quantity
    if (m.value === '4o-image') {
      const quantityMapping: { [key: string]: number } = {
        '1': 6,
        '2': 7,
        '4': 8,
      };
      cost = quantityMapping[generateQuantity] || 6;
    }
    
    // For flux-kontext, adjust cost based on model selection
    if (m.value === 'flux-kontext') {
      cost = fluxModel === 'pro' ? 5 : 10;
    }
    
    // For seedream-4, adjust cost based on maxImages (8 credits per image)
    if (m.value === 'seedream-4') {
      cost = 8 * maxImages;
    }
    
    // For midjourney-v7, adjust cost based on mode
    if (m.value === 'midjourney-v7') {
      if (mjMode === 'image-to-video') {
        cost = 60;
      } else {
        cost = 8; // text-to-image or image-to-image
      }
    }
    
    return {
      ...m,
      cost,
    };
  }), [getModelCost, generateQuantity, fluxModel, maxImages, mjMode]);

  // Clear reference images when switching to text-to-image mode
  useEffect(() => {
    if (mode === "text-to-image" && referenceImages.length > 0) {
      setReferenceImages([]);
    }
  }, [mode]);


  // Load seed from sessionStorage (from history "Use Seed" button) - only once on mount
  useEffect(() => {
    const savedSeed = sessionStorage.getItem('regenerateSeed');
    if (savedSeed) {
      const seedValue = parseInt(savedSeed, 10);
      // Always apply valid seeds, regardless of current model (user can change model later)
      if (!isNaN(seedValue) && seedValue >= 1 && seedValue <= 2147483647) {
        setSeed(seedValue);
        setSeedLocked(true); // Lock the seed when loading from history
      }
      // Always clear the stored seed after consuming it (even if invalid)
      sessionStorage.removeItem('regenerateSeed');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - run only once on mount

  // Generation result state
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<any>(null);

  // Poll for generation result when generationId is set
  // Keep polling active based ONLY on generationId - don't gate on isGenerating (causes race condition)
  const { data: pollData } = useQuery<any>({
    queryKey: ["/api/generations", generationId],
    queryFn: async () => {
      if (!generationId) return null;
      console.log(`[POLL] Fetching generation ${generationId}`);
      const response = await apiRequest("GET", `/api/generations/${generationId}`);
      const data = await response.json();
      console.log(`[POLL] Response:`, { status: data?.status, hasResultUrl: !!data?.resultUrl });
      return data;
    },
    enabled: isAuthenticated && !!generationId,
    refetchInterval: generationId ? 2000 : false,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  // Update generatedImage when poll data arrives with terminal status
  useEffect(() => {
    if (!pollData || !generationId) return;
    
    console.log(`[POLL EFFECT] pollData:`, { 
      status: pollData?.status, 
      hasResultUrl: !!pollData?.resultUrl,
      generationId
    });
    
    const isCompleted = pollData?.status === 'completed' || pollData?.status === 'success';
    const isFailed = pollData?.status === 'failed' || pollData?.status === 'failure';
    
    if (isCompleted && pollData?.resultUrl) {
      console.log(`[POLL] ✓ Generation completed with resultUrl`);
      setGeneratedImage(pollData);
      setIsGenerating(false);
      setGenerationId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      toast({
        title: "Image Generated!",
        description: "Your image is ready to view and download.",
      });
    } else if (isFailed) {
      console.log(`[POLL] ✗ Generation failed`);
      setGeneratedImage(pollData);
      setIsGenerating(false);
      setGenerationId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      toast({
        title: "Generation Failed",
        description: pollData?.errorMessage || "Failed to generate image",
        variant: "destructive",
      });
    }
  }, [pollData, generationId, toast, queryClient]);

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
    // Guest check - prompt sign up if not authenticated
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }

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

    // Validate Midjourney image requirements
    if (model === 'midjourney-v7' && (mjMode === 'image-to-image' || mjMode === 'image-to-video') && referenceImages.length === 0) {
      toast({
        title: "Image Required",
        description: "Please upload at least one image for this generation mode.",
        variant: "destructive",
      });
      return;
    }

    // Build parameters with model-specific fields
    const parameters: any = {};
    
    // For 4o-image, pass nVariants
    if (model === '4o-image') {
      parameters.aspectRatio = aspectRatio;
      parameters.nVariants = parseInt(generateQuantity);
    } 
    // For flux-kontext, pass model and promptUpsampling
    else if (model === 'flux-kontext') {
      parameters.aspectRatio = aspectRatio;
      parameters.model = fluxModel; // pro or max
      parameters.promptUpsampling = promptUpsampling;
      parameters.outputFormat = outputFormat;
    } 
    // For nano-banana, pass resolution and outputFormat (no style)
    else if (model === 'nano-banana') {
      parameters.aspectRatio = aspectRatio;
      parameters.resolution = resolution;
      parameters.outputFormat = outputFormat;
    }
    // For seedream-4, pass imageSize, imageResolution, and maxImages
    else if (model === 'seedream-4') {
      parameters.imageSize = seedreamImageSize;
      parameters.imageResolution = seedreamResolution;
      parameters.maxImages = maxImages;
    }
    // For midjourney-v7, pass all Midjourney-specific parameters
    else if (model === 'midjourney-v7') {
      parameters.mjMode = mjMode;
      parameters.speed = mjSpeed;
      parameters.version = mjVersion;
      parameters.aspectRatio = mjAspectRatio;
      parameters.stylization = mjStylization;
      parameters.weirdness = mjWeirdness;
      parameters.variety = mjVariety;
      if (mjWatermark) {
        parameters.waterMark = mjWatermark;
      }
      parameters.enableTranslation = mjEnableTranslation;
    }
    // For other models, include style, outputFormat, quality, and aspectRatio
    else {
      parameters.aspectRatio = aspectRatio;
      parameters.style = style;
      parameters.outputFormat = outputFormat;
      parameters.quality = quality;
    }
    
    // Add seed if model supports it and seed is provided
    if (modelSupportsSeed() && seed) {
      parameters.seed = seed;
    }
    
    // Ensure referenceImages is sent for both image-editing and Midjourney modes
    const payload: any = {
      model,
      prompt,
      mode,
      parameters,
    };

    // Include referenceImages for editing mode or Midjourney image modes
    if (mode === "image-editing" || (model === 'midjourney-v7' && (mjMode === 'image-to-image' || mjMode === 'image-to-video'))) {
      payload.referenceImages = referenceImages;
      if (model === 'midjourney-v7') {
        payload.mjMode = mjMode;
      }
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

  return (
    <>
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
                    <div className="flex items-center gap-2">
                      <ImageModelIcon modelValue={model} />
                      <span>{selectedModel?.label || model} ({selectedModel?.cost || 0} credits)</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        <div className="flex items-center gap-2">
                          <ImageModelIcon modelValue={m.value} />
                          <span>{m.label} ({m.cost} credits)</span>
                        </div>
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

              {/* Midjourney-specific: Speed Selection - Top Priority */}
              {model === 'midjourney-v7' && (
                <div className="space-y-2">
                  <Label>Model generation speed</Label>
                  <div className="flex gap-2">
                    {MIDJOURNEY_SPEED_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        variant={mjSpeed === opt.value ? "default" : "outline"}
                        onClick={() => setMjSpeed(opt.value)}
                        className="flex-1"
                        data-testid={`button-speed-${opt.value}`}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Midjourney-specific: Mode Selection */}
              {model === 'midjourney-v7' && (
                <div className="space-y-2">
                  <Label>Generation Mode</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={mjMode === 'text-to-image' ? "default" : "outline"}
                      onClick={() => setMjMode('text-to-image')}
                      className="flex-1"
                      data-testid="button-mj-text-to-image"
                    >
                      Text to Image
                    </Button>
                    <Button
                      variant={mjMode === 'image-to-image' ? "default" : "outline"}
                      onClick={() => setMjMode('image-to-image')}
                      className="flex-1"
                      data-testid="button-mj-image-to-image"
                    >
                      Image to Image
                    </Button>
                    <Button
                      variant={mjMode === 'image-to-video' ? "default" : "outline"}
                      onClick={() => setMjMode('image-to-video')}
                      className="flex-1"
                      data-testid="button-mj-image-to-video"
                    >
                      Image to Video
                    </Button>
                  </div>
                </div>
              )}

              {/* Midjourney-specific: Enable Translation Toggle */}
              {model === 'midjourney-v7' && (
                <div className="flex items-center justify-between space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="enableTranslation">Enable Translation</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically translate non-English prompts to English for better results
                    </p>
                  </div>
                  <Switch
                    id="enableTranslation"
                    checked={mjEnableTranslation}
                    onCheckedChange={setMjEnableTranslation}
                    data-testid="switch-enable-translation"
                  />
                </div>
              )}

              {/* Aspect Ratio - Model-specific options */}
              {model !== 'seedream-4' && model !== 'midjourney-v7' && (
                <div className="space-y-2">
                  <Label htmlFor="aspectRatio">Aspect Ratio</Label>
                  <Select value={aspectRatio} onValueChange={setAspectRatio}>
                    <SelectTrigger id="aspectRatio" data-testid="select-aspect-ratio">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(model === '4o-image' ? GPT4O_ASPECT_RATIOS : model === 'flux-kontext' ? FLUX_ASPECT_RATIOS : model === 'nano-banana' ? NANO_BANANA_ASPECT_RATIOS : ASPECT_RATIOS).map((ratio) => (
                        <SelectItem key={ratio.value} value={ratio.value}>
                          {ratio.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Midjourney Aspect Ratio */}
              {model === 'midjourney-v7' && (
                <div className="space-y-2">
                  <Label htmlFor="mjAspectRatio">Aspect Ratio</Label>
                  <Select value={mjAspectRatio} onValueChange={setMjAspectRatio}>
                    <SelectTrigger id="mjAspectRatio" data-testid="select-mj-aspect-ratio">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MIDJOURNEY_ASPECT_RATIOS.map((ratio) => (
                        <SelectItem key={ratio.value} value={ratio.value}>
                          {ratio.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Midjourney Version Dropdown */}
              {model === 'midjourney-v7' && (
                <div className="space-y-2">
                  <Label htmlFor="mjVersion">Version</Label>
                  <Select value={mjVersion} onValueChange={setMjVersion}>
                    <SelectTrigger id="mjVersion" data-testid="select-mj-version">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MIDJOURNEY_VERSIONS.map((ver) => (
                        <SelectItem key={ver.value} value={ver.value}>
                          {ver.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Midjourney Stylization Slider */}
              {model === 'midjourney-v7' && (
                <div className="space-y-3">
                  <Label htmlFor="mjStylization">Stylization (0-1000)</Label>
                  <input
                    id="mjStylization"
                    type="range"
                    min="0"
                    max="1000"
                    step="50"
                    value={mjStylization}
                    onChange={(e) => setMjStylization(parseInt(e.target.value, 10))}
                    className="w-full"
                    data-testid="slider-stylization"
                  />
                  <p className="text-sm text-muted-foreground">Stylization (0-1000)</p>
                </div>
              )}

              {/* Midjourney Weirdness Slider */}
              {model === 'midjourney-v7' && (
                <div className="space-y-3">
                  <Label htmlFor="mjWeirdness">Weirdness (0-3000)</Label>
                  <input
                    id="mjWeirdness"
                    type="range"
                    min="0"
                    max="3000"
                    step="100"
                    value={mjWeirdness}
                    onChange={(e) => setMjWeirdness(parseInt(e.target.value, 10))}
                    className="w-full"
                    data-testid="slider-weirdness"
                  />
                  <p className="text-sm text-muted-foreground">Weirdness (0-3000)</p>
                </div>
              )}

              {/* Midjourney Variety Slider */}
              {model === 'midjourney-v7' && (
                <div className="space-y-3">
                  <Label htmlFor="mjVariety">Variety (0-100)</Label>
                  <input
                    id="mjVariety"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={mjVariety}
                    onChange={(e) => setMjVariety(parseInt(e.target.value, 10))}
                    className="w-full"
                    data-testid="slider-variety"
                  />
                  <p className="text-sm text-muted-foreground">Variety (0-100)</p>
                </div>
              )}

              {/* Midjourney Watermark */}
              {model === 'midjourney-v7' && (
                <div className="space-y-2">
                  <Label htmlFor="mjWatermark">Watermark Identifier (Optional)</Label>
                  <input
                    id="mjWatermark"
                    type="text"
                    placeholder="Enter watermark identifier"
                    value={mjWatermark}
                    onChange={(e) => setMjWatermark(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    data-testid="input-watermark"
                  />
                  <p className="text-xs text-muted-foreground">
                    Watermark identifier (optional)
                  </p>
                </div>
              )}

              {/* Image Size - Only for Seedream-4 */}
              {model === 'seedream-4' && (
                <div className="space-y-2">
                  <Label htmlFor="seedreamImageSize">Image Size</Label>
                  <Select value={seedreamImageSize} onValueChange={setSeedreamImageSize}>
                    <SelectTrigger id="seedreamImageSize" data-testid="select-seedream-image-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEEDREAM_ASPECT_RATIOS.map((ratio) => (
                        <SelectItem key={ratio.value} value={ratio.value}>
                          {ratio.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Resolution - For Nano Banana and Seedream-4 */}
              {(model === 'nano-banana' || model === 'seedream-4') && (
                <div className="space-y-2">
                  <Label htmlFor="resolution">Resolution</Label>
                  <Select value={model === 'seedream-4' ? seedreamResolution : resolution} onValueChange={model === 'seedream-4' ? setSeedreamResolution : setResolution}>
                    <SelectTrigger id="resolution" data-testid="select-resolution">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(model === 'seedream-4' ? SEEDREAM_RESOLUTIONS : NANO_BANANA_RESOLUTIONS).map((res) => (
                        <SelectItem key={res.value} value={res.value}>
                          {res.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Max Images - Only for Seedream-4 */}
              {model === 'seedream-4' && (
                <div className="space-y-2">
                  <Label htmlFor="maxImages">Number of Images</Label>
                  <div className="flex items-center gap-4">
                    <input
                      id="maxImages"
                      type="number"
                      min="1"
                      max="6"
                      value={maxImages}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1 && val <= 6) {
                          setMaxImages(val);
                        }
                      }}
                      className="w-16 px-2 py-2 border rounded"
                      data-testid="input-max-images"
                    />
                    <span className="text-sm text-muted-foreground">
                      {maxImages} image{maxImages !== 1 ? 's' : ''} ({8 * maxImages} credits)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    value={maxImages}
                    onChange={(e) => setMaxImages(parseInt(e.target.value, 10))}
                    className="w-full"
                    data-testid="slider-max-images"
                  />
                </div>
              )}

              {/* Output Format - Hidden for 4o-image, seedream-4, and midjourney-v7 */}
              {model !== '4o-image' && model !== 'seedream-4' && model !== 'midjourney-v7' && (
                <div className="space-y-2">
                  <Label htmlFor="outputFormat">Output Format</Label>
                  <Select value={outputFormat} onValueChange={setOutputFormat}>
                    <SelectTrigger id="outputFormat" data-testid="select-output-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(model === 'flux-kontext' ? FLUX_OUTPUT_FORMATS : model === 'nano-banana' ? NANO_BANANA_OUTPUT_FORMATS : OUTPUT_FORMATS).map((format) => (
                        <SelectItem key={format.value} value={format.value}>
                          {format.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Quality - Hidden for 4o-image, flux-kontext, nano-banana, seedream-4, and midjourney-v7 */}
              {model !== '4o-image' && model !== 'flux-kontext' && model !== 'nano-banana' && model !== 'seedream-4' && model !== 'midjourney-v7' && (
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
              )}

              {/* Style - Hidden for 4o-image, flux-kontext, nano-banana, seedream-4, and midjourney-v7 */}
              {model !== '4o-image' && model !== 'flux-kontext' && model !== 'nano-banana' && model !== 'seedream-4' && model !== 'midjourney-v7' && (
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
              )}

              {/* Flux Kontext Model Selection - Only for flux-kontext */}
              {model === 'flux-kontext' && (
                <div className="space-y-2">
                  <Label htmlFor="fluxModel">Model</Label>
                  <Select value={fluxModel} onValueChange={setFluxModel}>
                    <SelectTrigger id="fluxModel" data-testid="select-flux-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FLUX_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Pro for balanced performance, Max for advanced capabilities
                  </p>
                </div>
              )}

              {/* Prompt Upsampling Toggle - Only for flux-kontext */}
              {model === 'flux-kontext' && (
                <div className="space-y-2 flex items-center justify-between">
                  <Label htmlFor="promptUpsampling">Prompt Upsampling</Label>
                  <Switch 
                    id="promptUpsampling" 
                    checked={promptUpsampling} 
                    onCheckedChange={setPromptUpsampling}
                    data-testid="toggle-prompt-upsampling"
                  />
                </div>
              )}

              {/* Generate Quantity - Only for 4o-image */}
              {model === '4o-image' && (
                <div className="space-y-2">
                  <Label htmlFor="generateQuantity">Generate Quantity</Label>
                  <Select value={generateQuantity} onValueChange={setGenerateQuantity}>
                    <SelectTrigger id="generateQuantity" data-testid="select-generate-quantity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENERATE_QUANTITIES.map((q) => (
                        <SelectItem key={q.value} value={q.value}>
                          {q.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select how many images to generate in a single request
                  </p>
                </div>
              )}

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

              {/* Tips & Best Practices */}
              <Collapsible className="mt-6">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <ChevronDown className="mr-2 h-4 w-4" />
                    Tips & Best Practices
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-3">
                  <Card>
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm">Write Clear, Detailed Prompts</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-xs text-muted-foreground">Be specific about what you want: composition, style, colors, mood. Longer descriptions yield better results than vague prompts.</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm">Choose Appropriate Aspect Ratios</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-xs text-muted-foreground">Square (1:1) for general use, 16:9 for landscape images, 9:16 for portrait/mobile. Match the output format to your needs.</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm">Use Seed for Consistency</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-xs text-muted-foreground">Lock seeds to regenerate similar images with minor prompt variations. Great for creating variations of a concept.</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm">Reference Artistic Styles</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-xs text-muted-foreground">Mention styles like "oil painting," "3D render," "photorealistic," or "anime" to guide the visual output.</p>
                    </CardContent>
                  </Card>
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

      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="Images"
      />
    </>
  );
}
