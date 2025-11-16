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
import { usePricing } from "@/hooks/use-pricing";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Video, Upload, X, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreditCostWarning } from "@/components/credit-cost-warning";

const VIDEO_MODEL_INFO = [
  { 
    value: "veo-3.1", 
    label: "Veo 3.1", 
    description: "1080p quality with synchronized audio", 
    duration: "5-8s",
    supportsImages: false,
    maxImages: 0 
  },
  { 
    value: "veo-3.1-fast", 
    label: "Veo 3.1 Fast", 
    description: "Faster generation, great quality", 
    duration: "5-8s",
    supportsImages: true,
    maxImages: 3 
  },
  { 
    value: "veo-3", 
    label: "Veo 3", 
    description: "High-quality video generation", 
    duration: "5-8s",
    supportsImages: true,
    maxImages: 3 
  },
  { 
    value: "runway-gen3-alpha-turbo", 
    label: "Runway Gen-3 Alpha Turbo", 
    description: "Fast, high-quality video generation", 
    duration: "5-10s",
    supportsImages: true,
    maxImages: 1 
  },
  { 
    value: "runway-aleph", 
    label: "Runway Aleph", 
    description: "Advanced scene reasoning and camera control", 
    duration: "5-10s",
    supportsImages: true,
    maxImages: 1 
  },
];

export default function GenerateVideo() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();
  
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

  // Auto-adjust duration when switching from Runway to Veo (10s not supported by Veo)
  useEffect(() => {
    if (model.startsWith('veo-') && duration > 8) {
      setDuration(8);
      toast({
        title: "Duration Adjusted",
        description: "Veo models support durations up to 8 seconds. Duration set to 8s.",
      });
    }
  }, [model, duration, toast]);

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/generate/video", data);
    },
    onSuccess: () => {
      toast({
        title: "Generation Started",
        description: "Your video is being generated. Check the history page for progress.",
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
    if (model.startsWith('veo-') && duration > 8) {
      toast({
        title: "Invalid Duration",
        description: "Veo models support durations up to 8 seconds.",
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

    generateMutation.mutate({
      model,
      prompt,
      generationType,
      referenceImages: generationType === "image-to-video" ? referenceImages : undefined,
      parameters: {
        duration,
        quality,
        aspectRatio,
      },
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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Video className="h-10 w-10 text-primary" />
          AI Video Generation
        </h1>
        <p className="text-lg text-muted-foreground">
          Create stunning videos from text or reference images
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Generation Settings</CardTitle>
            <CardDescription>Configure your video parameters</CardDescription>
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
                  <SelectItem value="5">5 seconds</SelectItem>
                  <SelectItem value="8">8 seconds</SelectItem>
                  {/* 10 seconds only available for Runway models */}
                  {model.startsWith('runway-') && (
                    <SelectItem value="10">10 seconds</SelectItem>
                  )}
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
                  <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                  <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
                  <SelectItem value="4:3">4:3 (Classic)</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
          </CardContent>
        </Card>

        {/* Model Comparison */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Available Models</h2>
          <div className="space-y-4">
            {VIDEO_MODELS.map((m) => (
              <Card 
                key={m.value} 
                className={`hover-elevate active-elevate-2 cursor-pointer transition-colors ${model === m.value ? "border-primary" : ""}`}
                onClick={() => setModel(m.value)}
                data-testid={`card-model-${m.value}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{m.label}</CardTitle>
                      <CardDescription>{m.description}</CardDescription>
                    </div>
                    {m.supportsImages && (
                      <Badge variant="secondary" className="shrink-0">
                        {m.maxImages === 1 ? "1 img" : `${m.maxImages} imgs`}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{m.cost}</span>
                      <span className="text-sm text-muted-foreground">credits</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-medium">{m.duration}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
