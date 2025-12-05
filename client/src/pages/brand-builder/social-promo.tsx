import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePricing } from "@/hooks/use-pricing";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/authBridge";
import { Loader2, Upload, X, Info, ArrowLeft, Share2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreditCostWarning } from "@/components/credit-cost-warning";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { PeerTubePreview } from "@/components/peertube-preview";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { GenerationProgress } from "@/components/generation-progress";
import { Link } from "wouter";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 (Landscape)", hint: "Best for YouTube, websites" },
  { value: "9:16", label: "9:16 (Portrait)", hint: "Best for TikTok, Reels, Shorts" },
];

const PLATFORMS = [
  { value: "tiktok", label: "TikTok", prompt: "Create a trendy, fast-paced TikTok-style promotional video with energetic transitions, zoom effects, and attention-grabbing movements. Perfect for viral social content." },
  { value: "instagram", label: "Instagram Reels", prompt: "Create a polished Instagram Reels promotional video with aesthetic transitions, smooth camera movements, and visually appealing effects. Designed for engagement and shares." },
  { value: "youtube", label: "YouTube Shorts", prompt: "Create an engaging YouTube Shorts promotional video with dynamic content, captivating visuals, and professional quality. Optimized for the short-form video audience." },
];

// Model selection based on aspect ratio
// Veo 3.1 image-to-video only supports 16:9 output
// Kling 2.5 Turbo supports all aspect ratios for image-to-video
const getModelForAspectRatio = (aspectRatio: string) => {
  // Use Kling 2.5 Turbo for image-to-video as it properly supports all aspect ratios
  return 'kling-2.5-turbo';
};

export default function SocialPromo() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();
  
  const [platform, setPlatform] = useState("tiktok");
  const [prompt, setPrompt] = useState(PLATFORMS[0].prompt);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [uploadingProduct, setUploadingProduct] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [imageDimensions, setImageDimensions] = useState<{width: number, height: number} | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<any>(null);
  const [showGuestModal, setShowGuestModal] = useState(false);
  
  // Use Kling 2.5 Turbo for image-to-video (5s duration) - supports all aspect ratios
  const creditCost = getModelCost('kling-2.5-turbo-i2v-5s', 90);

  const checkImageAspectRatio = (width: number, height: number): { matches: boolean, actual: string, suggestion: string } => {
    const ratio = width / height;
    const targetRatio = aspectRatio === '16:9' ? 16/9 : 9/16;
    const tolerance = 0.15;
    const matches = Math.abs(ratio - targetRatio) < tolerance;
    const actual = ratio > 1 ? 'landscape' : ratio < 1 ? 'portrait' : 'square';
    const suggestion = aspectRatio === '16:9' 
      ? 'Use a landscape image (wider than tall)' 
      : 'Use a portrait image (taller than wide)';
    return { matches, actual, suggestion };
  };

  const aspectRatioMismatch = imageDimensions 
    ? !checkImageAspectRatio(imageDimensions.width, imageDimensions.height).matches 
    : false;

  const handlePlatformChange = (value: string) => {
    setPlatform(value);
    const selectedPlatform = PLATFORMS.find(p => p.value === value);
    if (selectedPlatform) {
      setPrompt(selectedPlatform.prompt);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetchWithAuth('/api/upload-temp-image', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    
    const data = await response.json();
    return data.url;
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        title: "File Too Large",
        description: `File size exceeds ${MAX_FILE_SIZE_MB}MB. Please compress or resize your image.`,
        variant: "destructive",
      });
      e.target.value = '';
      return;
    }
    
    setUploadingProduct(true);
    try {
      const url = await uploadImage(file);
      setProductImage(url);
      
      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });
      };
      img.src = url;
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingProduct(false);
    }
  };

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
        description: "Your social media promo is being generated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Please log in to generate videos.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to start video generation.",
        variant: "destructive",
      });
    },
  });

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

  useEffect(() => {
    if (!pollData || !generationId) return;
    
    const isCompleted = pollData?.status === 'completed' || pollData?.status === 'success';
    const isFailed = pollData?.status === 'failed' || pollData?.status === 'failure';
    
    if (isCompleted && pollData?.resultUrl) {
      setGeneratedVideo(pollData);
      setIsGenerating(false);
      setGenerationId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      toast({
        title: "Video Generated!",
        description: "Your social media promo is ready to view and download.",
      });
    } else if (isFailed) {
      setGeneratedVideo(pollData);
      setIsGenerating(false);
      setGenerationId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      toast({
        title: "Generation Failed",
        description: pollData?.errorMessage || "Failed to generate video",
        variant: "destructive",
      });
    }
  }, [pollData, generationId, toast, queryClient]);

  const handleGenerate = () => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }

    if (!productImage) {
      toast({
        title: "Missing Image",
        description: "Please upload a product or brand image.",
        variant: "destructive",
      });
      return;
    }

    // Use Kling 2.5 Turbo for image-to-video (supports all aspect ratios properly)
    generateMutation.mutate({
      model: 'kling-2.5-turbo',
      prompt: prompt.trim(),
      generationType: 'image-to-video',
      referenceImages: [productImage],
      parameters: {
        aspectRatio,
        duration: '5', // 5 seconds for social media content
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

  return (
    <>
      <ThreeColumnLayout
        form={
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Link href="/brand-builder">
                  <Button variant="ghost" size="icon" data-testid="button-back">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <Badge variant="outline">Brand Builder</Badge>
              </div>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-yellow-500" />
                Social Media Promo
              </CardTitle>
              <CardDescription>Create platform-optimized promotional content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-md p-4 flex gap-3">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-sm">Platform-Optimized Content</p>
                  <p className="text-sm text-muted-foreground">
                    Choose your target platform and upload your product or brand image. We'll generate a trendy promo video optimized for that platform's audience.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Video Aspect Ratio</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger data-testid="select-aspect-ratio">
                    <SelectValue placeholder="Select aspect ratio" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIOS.map((ar) => (
                      <SelectItem key={ar.value} value={ar.value} data-testid={`aspect-ratio-${ar.value}`}>
                        <div className="flex flex-col">
                          <span>{ar.label}</span>
                          <span className="text-xs text-muted-foreground">{ar.hint}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Share2 className="h-5 w-5 text-yellow-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{aspectRatio} Format</p>
                  <p className="text-xs text-muted-foreground">Optimized for social media</p>
                </div>
                <Badge variant="secondary">{creditCost} credits</Badge>
              </div>

              <div className="space-y-3">
                <Label>Target Platform</Label>
                <Select value={platform} onValueChange={handlePlatformChange}>
                  <SelectTrigger data-testid="select-platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Product/Brand Image</Label>
                <p className="text-xs text-muted-foreground">
                  {aspectRatio === '16:9' 
                    ? 'Upload a landscape image (wider than tall) for best results'
                    : 'Upload a portrait image (taller than wide) for best results'}
                </p>
                {productImage ? (
                  <div className="space-y-2">
                    <div className="relative group">
                      <img 
                        src={productImage} 
                        alt="Product"
                        className="w-full h-48 object-cover rounded-md border-2 border-border"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          setProductImage(null);
                          setImageDimensions(null);
                        }}
                        data-testid="button-remove-product-image"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    {aspectRatioMismatch && imageDimensions && (
                      <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-yellow-500">Image may not match aspect ratio</p>
                          <p className="text-muted-foreground text-xs mt-1">
                            Your image ({imageDimensions.width}x{imageDimensions.height}) appears to be {checkImageAspectRatio(imageDimensions.width, imageDimensions.height).actual}.
                            For {aspectRatio} video, {checkImageAspectRatio(imageDimensions.width, imageDimensions.height).suggestion.toLowerCase()}.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProductImageUpload}
                      className="hidden"
                      disabled={uploadingProduct}
                      data-testid="input-upload-product-image"
                    />
                    <div className="border-2 border-dashed border-border rounded-md p-6 hover-elevate active-elevate-2 cursor-pointer text-center transition-colors h-48 flex flex-col items-center justify-center">
                      {uploadingProduct ? (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium">Upload Image</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to {MAX_FILE_SIZE_MB}MB</p>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>

              <div className="space-y-3">
                <Label>Promo Description</Label>
                <Textarea
                  placeholder="Describe your promotional video..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[100px] resize-none"
                  data-testid="textarea-prompt"
                />
              </div>

              <CreditCostWarning 
                cost={creditCost} 
                featureName="Social Promo"
              />

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || isGenerating || !productImage}
                className="w-full"
                size="lg"
                data-testid="button-generate"
              >
                {generateMutation.isPending || isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generating Promo...
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 mr-2" />
                    Generate Social Promo ({creditCost} credits)
                  </>
                )}
              </Button>

              <GenerationProgress
                isActive={isGenerating}
                modelId="kling-2.5-turbo"
                generationType="video"
              />
            </CardContent>
          </Card>
        }
        preview={
          <PeerTubePreview
            pageType="brand-social-promo"
            title="Social Promo Preview"
            description="See a sample social media promo"
            showGeneratingMessage={isGenerating}
          />
        }
      />
      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="Social Promo"
      />
    </>
  );
}
