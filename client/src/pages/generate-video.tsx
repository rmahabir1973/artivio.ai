import { useState, useEffect } from "react";
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
import { Loader2, Video, Upload, X, Info, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreditCostWarning } from "@/components/credit-cost-warning";
import { TemplateManager } from "@/components/template-manager";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { PreviewPanel } from "@/components/preview-panel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SeedControl } from "@/components/SeedControl";

const ASPECT_RATIO_SUPPORT: Record<string, string[]> = {
  "veo-3.1": ["16:9", "9:16"],
  "veo-3.1-fast": ["16:9", "9:16"],
  "veo-3": ["16:9", "9:16"],
  "runway-gen3-alpha-turbo": ["16:9", "9:16"],
  "runway-aleph": ["16:9", "9:16"],
  "seedance-1-pro": ["16:9", "9:16", "1:1", "4:3"],
  "seedance-1-lite": ["16:9", "9:16", "1:1", "4:3"],
  "wan-2.5": ["16:9", "9:16", "1:1"],
  "kling-2.5-turbo": ["16:9", "9:16", "1:1"],
  "kling-2.1": ["16:9", "9:16", "1:1"],
};

const DURATION_SUPPORT: Record<string, number[]> = {
  "veo-3.1": [8],
  "veo-3.1-fast": [8],
  "veo-3": [8],
  "runway-gen3-alpha-turbo": [5, 10],
  "runway-aleph": [5, 10],
  "seedance-1-pro": [10],
  "seedance-1-lite": [10],
  "wan-2.5": [10],
  "kling-2.5-turbo": [5, 10],
  "kling-2.1": [5, 10],
};

const ASPECT_RATIO_LABELS: Record<string, string> = {
  "16:9": "16:9 (Landscape)",
  "9:16": "9:16 (Portrait)",
  "1:1": "1:1 (Square)",
  "4:3": "4:3 (Classic)",
};

const VIDEO_MODEL_INFO = [
  { 
    value: "veo-3.1", 
    label: "Veo 3.1", 
    description: "1080p quality with synchronized audio", 
    duration: "8s",
    supportsImages: false,
    maxImages: 0 
  },
  { 
    value: "veo-3.1-fast", 
    label: "Veo 3.1 Fast", 
    description: "Faster generation, great quality", 
    duration: "8s",
    supportsImages: true,
    maxImages: 3 
  },
  { 
    value: "veo-3", 
    label: "Veo 3", 
    description: "High-quality video generation", 
    duration: "8s",
    supportsImages: true,
    maxImages: 3 
  },
  { 
    value: "runway-gen3-alpha-turbo", 
    label: "Runway Gen-3 Alpha Turbo", 
    description: "Fast, high-quality video generation", 
    duration: "5s, 10s",
    supportsImages: true,
    maxImages: 1 
  },
  { 
    value: "runway-aleph", 
    label: "Runway Aleph", 
    description: "Advanced scene reasoning and camera control", 
    duration: "5s, 10s",
    supportsImages: true,
    maxImages: 1 
  },
  { 
    value: "seedance-1-pro", 
    label: "Seedance 1.0 Pro", 
    description: "1080p cinematic quality with camera control", 
    duration: "10s",
    supportsImages: true,
    maxImages: 1 
  },
  { 
    value: "seedance-1-lite", 
    label: "Seedance 1.0 Lite", 
    description: "720p fast generation", 
    duration: "10s",
    supportsImages: true,
    maxImages: 1 
  },
  { 
    value: "wan-2.5", 
    label: "Wan 2.5", 
    description: "Native audio sync & lip-sync support", 
    duration: "10s",
    supportsImages: true,
    maxImages: 1 
  },
  { 
    value: "kling-2.5-turbo", 
    label: "Kling 2.5 Turbo", 
    description: "Fast, fluid motion with realistic physics", 
    duration: "5s, 10s",
    supportsImages: true,
    maxImages: 1 
  },
  { 
    value: "kling-2.1", 
    label: "Kling 2.1", 
    description: "Professional hyper-realistic video generation", 
    duration: "5s, 10s",
    supportsImages: true,
    maxImages: 1 
  },
];

export default function GenerateVideo() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();
  const { markStepComplete } = useOnboarding();
  
  const [generationType, setGenerationType] = useState<"text-to-video" | "image-to-video">("text-to-video");
  const [model, setModel] = useState("veo-3.1");

  // Merge model info with dynamic pricing
  const VIDEO_MODELS = VIDEO_MODEL_INFO.map(m => ({
    ...m,
    cost: getModelCost(m.value, 400),
  }));
  const [prompt, setPrompt] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [duration, setDuration] = useState(5);
  const [quality, setQuality] = useState("1080p");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [seedLocked, setSeedLocked] = useState(false);
  
  // Generation result state
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<any>(null);
  
  // Helper to check if current model supports seeds
  const modelSupportsSeed = () => {
    return model.startsWith('veo-') || model.startsWith('seedance-') || model.startsWith('wan-');
  };

  // Load template handler
  const handleLoadTemplate = (template: any) => {
    setPrompt(template.prompt);
    if (template.model) {
      setModel(template.model);
    }
    if (template.parameters) {
      if (template.parameters.aspectRatio) setAspectRatio(template.parameters.aspectRatio);
      if (template.parameters.duration) setDuration(template.parameters.duration);
      if (template.parameters.quality) setQuality(template.parameters.quality);
    }
  };

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

  // Poll for generation result when generationId is set
  const { data: pollData } = useQuery<any>({
    queryKey: ["/api/generations", generationId],
    queryFn: async () => {
      if (!generationId) return null;
      return await apiRequest("GET", `/api/generations/${generationId}`);
    },
    enabled: !!generationId && isGenerating,
    refetchInterval: 2000, // Poll every 2 seconds while generating
    refetchOnWindowFocus: false,
  });

  // Update generatedVideo when poll data arrives with resultUrl
  useEffect(() => {
    if (pollData?.resultUrl) {
      setGeneratedVideo(pollData);
      setIsGenerating(false);
      toast({
        title: "Video Generated!",
        description: "Your video is ready to view and download.",
      });
    } else if (pollData?.status === 'failed' || pollData?.status === 'failure') {
      setGeneratedVideo(pollData);
      setIsGenerating(false);
      setGenerationId(null); // Stop polling
      toast({
        title: "Generation Failed",
        description: pollData?.errorMessage || "Failed to generate video",
        variant: "destructive",
      });
    }
  }, [pollData, toast]);

  const selectedModel = VIDEO_MODELS.find(m => m.value === model);
  const maxImages = selectedModel?.maxImages || 1;

  // Trim reference images when model changes (enforce max images limit)
  useEffect(() => {
    if (referenceImages.length > maxImages) {
      setReferenceImages(prev => prev.slice(0, maxImages));
      toast({
        title: "Images Adjusted",
        description: `${selectedModel?.label} supports up to ${maxImages} image${maxImages > 1 ? 's' : ''}. Extra images removed.`,
      });
    }
  }, [model, maxImages, referenceImages.length, selectedModel?.label, toast]);

  // Auto-adjust duration when model changes to ensure it's supported
  useEffect(() => {
    const supportedDurations = DURATION_SUPPORT[model] || [5, 8, 10];
    
    // If current duration is not supported by the new model, auto-adjust to closest supported duration
    if (!supportedDurations.includes(duration)) {
      // Find the closest supported duration
      const closestDuration = supportedDurations.reduce((prev, curr) => 
        Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
      );
      
      setDuration(closestDuration);
      
      const modelLabel = VIDEO_MODEL_INFO.find(m => m.value === model)?.label || model;
      toast({
        title: "Duration Adjusted",
        description: `${modelLabel} supports: ${supportedDurations.join('s, ')}s. Duration set to ${closestDuration}s.`,
      });
    }
  }, [model, duration, toast]);

  // Auto-adjust aspect ratio when switching models
  useEffect(() => {
    const supportedRatios = ASPECT_RATIO_SUPPORT[model] || ["16:9", "9:16"];
    
    if (!supportedRatios.includes(aspectRatio)) {
      setAspectRatio('16:9');
      const modelName = selectedModel?.label || model;
      toast({
        title: "Aspect Ratio Adjusted",
        description: `${modelName} doesn't support ${aspectRatio}. Aspect ratio set to 16:9.`,
      });
    }
  }, [model, aspectRatio, toast, selectedModel?.label]);

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/generate/video", data);
    },
    onSuccess: (data: any) => {
      setGenerationId(data.generationId);
      setIsGenerating(true);
      setGeneratedVideo(null);
      toast({
        title: "Generation Started",
        description: "Your video is being generated. Watch the preview panel for progress.",
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
        description: error.message || "Failed to generate video. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (referenceImages.length >= maxImages) {
      toast({
        title: "Image Limit Reached",
        description: `${selectedModel?.label} supports up to ${maxImages} reference image${maxImages > 1 ? 's' : ''}.`,
        variant: "destructive",
      });
      return;
    }

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setReferenceImages(prev => [...prev, base64String]);
        setUploadingImage(false);
      };
      reader.onerror = () => {
        toast({
          title: "Upload Failed",
          description: "Failed to read image file.",
          variant: "destructive",
        });
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload image.",
        variant: "destructive",
      });
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a description for your video.",
        variant: "destructive",
      });
      return;
    }

    if (generationType === "image-to-video" && referenceImages.length === 0) {
      toast({
        title: "Reference Image Required",
        description: "Please upload at least one reference image for image-to-video generation.",
        variant: "destructive",
      });
      return;
    }

    // Final guard: ensure reference images don't exceed model limit
    if (referenceImages.length > maxImages) {
      toast({
        title: "Too Many Images",
        description: `${selectedModel?.label} supports up to ${maxImages} image${maxImages > 1 ? 's' : ''}.`,
        variant: "destructive",
      });
      return;
    }

    // Validate duration for model
    const supportedDurations = DURATION_SUPPORT[model] || [5, 8, 10];
    if (!supportedDurations.includes(duration)) {
      const modelLabel = VIDEO_MODEL_INFO.find(m => m.value === model)?.label || model;
      toast({
        title: "Invalid Duration",
        description: `${modelLabel} supports: ${supportedDurations.join('s, ')}s only.`,
        variant: "destructive",
      });
      return;
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

    // Build parameters with seed support (Veo uses array 'seeds', others use singular 'seed')
    const parameters: any = {
      duration,
      quality,
      aspectRatio,
    };
    
    // Add seed if model supports it and seed is provided
    if (modelSupportsSeed() && seed) {
      if (model.startsWith('veo-')) {
        parameters.seeds = [seed]; // Veo uses array format
      } else {
        parameters.seed = seed; // Seedance/Wan use singular
      }
    }
    
    generateMutation.mutate({
      model,
      prompt,
      generationType,
      referenceImages: generationType === "image-to-video" ? referenceImages : undefined,
      parameters,
    });
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
                <CardTitle>Generation Settings</CardTitle>
                <CardDescription>Configure your video parameters</CardDescription>
              </div>
              <TemplateManager
                featureType="video"
                onLoadTemplate={handleLoadTemplate}
                currentPrompt={prompt}
                currentModel={model}
                currentParameters={{ aspectRatio, duration, quality }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Generation Type Tabs */}
            <Tabs value={generationType} onValueChange={(v: any) => setGenerationType(v)}>
              <TabsList className="grid w-full grid-cols-2" data-testid="tabs-generation-type">
                <TabsTrigger value="text-to-video" data-testid="tab-text-to-video">
                  Text to Video
                </TabsTrigger>
                <TabsTrigger value="image-to-video" data-testid="tab-image-to-video">
                  Image to Video
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text-to-video" className="space-y-6 mt-6">
                <div className="bg-muted/50 rounded-md p-4 flex gap-3">
                  <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-sm">Text to Video</p>
                    <p className="text-sm text-muted-foreground">
                      Generate videos from text descriptions using AI models
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="image-to-video" className="space-y-6 mt-6">
                <div className="bg-muted/50 rounded-md p-4 flex gap-3">
                  <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-sm">Image to Video</p>
                    <p className="text-sm text-muted-foreground">
                      Upload {maxImages === 1 ? "1 reference image" : `up to ${maxImages} reference images`} to guide video generation
                    </p>
                  </div>
                </div>

                {/* Image Upload */}
                <div className="space-y-3">
                  <Label>Reference Images ({referenceImages.length}/{maxImages})</Label>
                  
                  {referenceImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {referenceImages.map((img, index) => (
                        <div key={index} className="relative group">
                          <img 
                            src={img} 
                            alt={`Reference ${index + 1}`}
                            className="w-full h-24 object-cover rounded-md border-2 border-border"
                          />
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeImage(index)}
                            data-testid={`button-remove-image-${index}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          <Badge className="absolute bottom-1 left-1 text-xs">
                            {index + 1}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {referenceImages.length < maxImages && (
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                        data-testid="input-upload-image"
                      />
                      <div className="border-2 border-dashed border-border rounded-md p-6 hover-elevate active-elevate-2 cursor-pointer text-center transition-colors">
                        {uploadingImage ? (
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                        ) : (
                          <>
                            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm font-medium">Upload Reference Image</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Click to select an image file
                            </p>
                          </>
                        )}
                      </div>
                    </label>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="model">AI Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="model" data-testid="select-video-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label} ({m.cost} credits)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedModel && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{selectedModel.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Duration: {selectedModel.duration} • Max images: {selectedModel.maxImages}
                  </p>
                </div>
              )}
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label htmlFor="prompt">Video Description</Label>
              <Textarea
                id="prompt"
                placeholder={
                  generationType === "text-to-video" 
                    ? "Describe the video you want to create... (e.g., 'A serene sunset over mountains with birds flying')"
                    : "Describe how the reference image(s) should animate... (e.g., 'The scene slowly zooms in as clouds drift across the sky')"
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                data-testid="input-video-prompt"
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger id="duration" data-testid="select-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(DURATION_SUPPORT[model] || [5, 8, 10]).map((dur) => (
                    <SelectItem key={dur} value={String(dur)}>
                      {dur} seconds
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(DURATION_SUPPORT[model] || []).length < 3 && (
                <p className="text-xs text-muted-foreground">
                  {selectedModel?.label || model} supports: {(DURATION_SUPPORT[model] || [5, 8, 10]).join('s, ')}s
                </p>
              )}
            </div>

            {/* Quality */}
            <div className="space-y-2">
              <Label htmlFor="quality">Quality</Label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger id="quality" data-testid="select-quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">720p (HD)</SelectItem>
                  <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-2">
              <Label htmlFor="aspectRatio">Aspect Ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger id="aspectRatio" data-testid="select-aspect-ratio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(ASPECT_RATIO_SUPPORT[model] || ["16:9", "9:16"]).map((ratio) => (
                    <SelectItem key={ratio} value={ratio}>
                      {ASPECT_RATIO_LABELS[ratio] || ratio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(ASPECT_RATIO_SUPPORT[model] || []).length < 4 && (
                <p className="text-xs text-muted-foreground">
                  {selectedModel?.label || model} supports: {(ASPECT_RATIO_SUPPORT[model] || ["16:9", "9:16"]).join(", ")}
                </p>
              )}
            </div>

            {/* Seed Control - Only show for models that support it */}
            {modelSupportsSeed() && (
              <SeedControl
                seed={seed}
                onSeedChange={setSeed}
                locked={seedLocked}
                onLockChange={setSeedLocked}
              />
            )}

            {/* Credit Cost Warning */}
            {selectedModel && (
              <CreditCostWarning 
                cost={selectedModel.cost} 
                featureName={`${selectedModel.label} video generation`}
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
              data-testid="button-generate-video"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (user && typeof (user as any).credits === 'number' && (user as any).credits < (selectedModel?.cost || 0)) ? (
                <>Insufficient Credits - Upgrade Plan</>
              ) : (
                <>Generate Video ({selectedModel?.cost} credits)</>
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
                {VIDEO_MODELS.map((m) => (
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
                        {m.supportsImages && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {m.maxImages === 1 ? "1 img" : `${m.maxImages} imgs`}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold">{m.cost} credits</span>
                        <span className="text-muted-foreground text-xs">{m.duration}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      }
      preview={
        <PreviewPanel
          status={
            isGenerating ? "generating" :
            generatedVideo?.resultUrl ? "completed" :
            generatedVideo?.status === 'failed' ? "failed" :
            "idle"
          }
          title="Video Preview"
          description="Your generated video will appear here"
          resultUrl={generatedVideo?.resultUrl}
          resultType="video"
          errorMessage={generatedVideo?.errorMessage}
          onDownload={() => {
            if (generatedVideo?.id) {
              window.location.href = `/api/generations/${generatedVideo.id}/download`;
            }
          }}
        />
      }
    />
  );
}
