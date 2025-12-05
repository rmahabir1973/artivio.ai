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
import { Loader2, Upload, X, Info, ArrowLeft, Star, AlertTriangle } from "lucide-react";
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

export default function InfluencerAd() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();
  
  const [prompt, setPrompt] = useState("Create an authentic influencer-style product showcase video. Start with the person naturally introducing or holding the product, then smoothly transition to highlight the product's features. The video should feel genuine and engaging, like a real influencer recommendation with natural movements and expressions.");
  const [productImage, setProductImage] = useState<string | null>(null);
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [uploadingProduct, setUploadingProduct] = useState(false);
  const [uploadingPerson, setUploadingPerson] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<any>(null);
  const [showGuestModal, setShowGuestModal] = useState(false);
  
  const creditCost = getModelCost('veo-3.1-fast-first-and-last-frames', 125);

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
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload the product image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingProduct(false);
    }
  };

  const handlePersonImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    
    setUploadingPerson(true);
    try {
      const url = await uploadImage(file);
      setPersonImage(url);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload the person image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingPerson(false);
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
        description: "Your influencer ad is being generated.",
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
        description: "Your influencer ad is ready to view and download.",
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
        title: "Missing Product Image",
        description: "Please upload a product image.",
        variant: "destructive",
      });
      return;
    }

    if (!personImage) {
      toast({
        title: "Missing Person Image",
        description: "Please upload a person/influencer image.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      model: 'veo-3.1-fast-first-and-last-frames',
      prompt: prompt.trim(),
      generationType: 'first-and-last-frames-to-video',
      referenceImages: [personImage, productImage],
      parameters: {
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
                <Star className="h-5 w-5 text-yellow-500" />
                Influencer Ad
              </CardTitle>
              <CardDescription>Create authentic influencer-style product showcases</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-md p-4 flex gap-3">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-sm">Influencer-Style Ads</p>
                  <p className="text-sm text-muted-foreground">
                    Upload a person image and product image. We'll create a natural transition video that looks like an authentic influencer product recommendation.
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
                <Star className="h-5 w-5 text-yellow-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{aspectRatio} Format</p>
                  <p className="text-xs text-muted-foreground">Natural product showcase</p>
                </div>
                <Badge variant="secondary">{creditCost} credits</Badge>
              </div>

              <p className="text-xs text-muted-foreground">
                {aspectRatio === '16:9' 
                  ? 'Upload landscape images (wider than tall) for best results'
                  : 'Upload portrait images (taller than wide) for best results'}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label>Person Image</Label>
                  {personImage ? (
                    <div className="relative group">
                      <img 
                        src={personImage} 
                        alt="Person"
                        className="w-full h-40 object-cover rounded-md border-2 border-border"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setPersonImage(null)}
                        data-testid="button-remove-person-image"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <Badge className="absolute bottom-2 left-2" variant="secondary">Person</Badge>
                    </div>
                  ) : (
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePersonImageUpload}
                        className="hidden"
                        disabled={uploadingPerson}
                        data-testid="input-upload-person-image"
                      />
                      <div className="border-2 border-dashed border-border rounded-md p-4 hover-elevate active-elevate-2 cursor-pointer text-center transition-colors h-40 flex flex-col items-center justify-center">
                        {uploadingPerson ? (
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Upload className="h-6 w-6 mb-1 text-muted-foreground" />
                            <p className="text-xs font-medium">Upload Person</p>
                          </>
                        )}
                      </div>
                    </label>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>Product Image</Label>
                  {productImage ? (
                    <div className="relative group">
                      <img 
                        src={productImage} 
                        alt="Product"
                        className="w-full h-40 object-cover rounded-md border-2 border-border"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setProductImage(null)}
                        data-testid="button-remove-product-image"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <Badge className="absolute bottom-2 left-2" variant="secondary">Product</Badge>
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
                      <div className="border-2 border-dashed border-border rounded-md p-4 hover-elevate active-elevate-2 cursor-pointer text-center transition-colors h-40 flex flex-col items-center justify-center">
                        {uploadingProduct ? (
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Upload className="h-6 w-6 mb-1 text-muted-foreground" />
                            <p className="text-xs font-medium">Upload Product</p>
                          </>
                        )}
                      </div>
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Ad Description</Label>
                <Textarea
                  placeholder="Describe how the influencer should showcase the product..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[100px] resize-none"
                  data-testid="textarea-prompt"
                />
              </div>

              <CreditCostWarning 
                cost={creditCost} 
                featureName="Influencer Ad"
              />

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || isGenerating || !productImage || !personImage}
                className="w-full"
                size="lg"
                data-testid="button-generate"
              >
                {generateMutation.isPending || isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generating Ad...
                  </>
                ) : (
                  <>
                    <Star className="h-4 w-4 mr-2" />
                    Generate Influencer Ad ({creditCost} credits)
                  </>
                )}
              </Button>

              <GenerationProgress
                isActive={isGenerating}
                modelId="veo-3.1-first-and-last-frames"
                generationType="video"
              />
            </CardContent>
          </Card>
        }
        preview={
          <PeerTubePreview
            pageType="brand-influencer-ad"
            title="Influencer Ad Preview"
            description="See a sample influencer advertisement"
            showGeneratingMessage={isGenerating}
          />
        }
      />
      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="Influencer Ads"
      />
    </>
  );
}
