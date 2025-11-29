import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePricing } from "@/hooks/use-pricing";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/authBridge";
import { Loader2, Upload, X, Info, ArrowLeft, Zap, Percent, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreditCostWarning } from "@/components/credit-cost-warning";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { PeerTubePreview } from "@/components/peertube-preview";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { GenerationProgress } from "@/components/generation-progress";
import { Link } from "wouter";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function FlashSale() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();
  
  const [productImage, setProductImage] = useState<string | null>(null);
  const [uploadingProduct, setUploadingProduct] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("50");
  const [timeLimit, setTimeLimit] = useState("24 hours");
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<any>(null);
  const [showGuestModal, setShowGuestModal] = useState(false);
  
  const creditCost = getModelCost('veo-3.1-fast', 400) || 130;

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
        description: "Your flash sale promo is being generated.",
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
        description: "Your flash sale promo is ready to view and download.",
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

    const prompt = `Create a high-energy flash sale promotional video with urgency-inducing effects. Feature a ${discountPercent}% OFF sale that ends in ${timeLimit}. Use dynamic zoom effects, flashing text, countdown elements, and attention-grabbing animations. The video should create excitement and urgency to drive immediate action. ${additionalDetails}`.trim();

    generateMutation.mutate({
      model: 'veo-3.1-fast',
      prompt,
      generationType: 'image-to-video',
      referenceImages: [productImage],
      parameters: {
        aspectRatio: '9:16',
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
                <Zap className="h-5 w-5 text-yellow-500" />
                Flash Sale Promo
              </CardTitle>
              <CardDescription>Create urgency-focused promotional videos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-md p-4 flex gap-3">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-sm">High-Energy Sale Videos</p>
                  <p className="text-sm text-muted-foreground">
                    Upload your product and enter sale details. We'll create an attention-grabbing promo video with countdown elements and urgency effects.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Zap className="h-5 w-5 text-yellow-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">9:16 Social Format</p>
                  <p className="text-xs text-muted-foreground">Urgency-focused video</p>
                </div>
                <Badge variant="secondary">{creditCost} credits</Badge>
              </div>

              <div className="space-y-3">
                <Label>Product Image</Label>
                {productImage ? (
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
                      onClick={() => setProductImage(null)}
                      data-testid="button-remove-product-image"
                    >
                      <X className="h-3 w-3" />
                    </Button>
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
                          <p className="text-sm font-medium">Upload Product Image</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to {MAX_FILE_SIZE_MB}MB</p>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Discount
                  </Label>
                  <Input
                    type="text"
                    placeholder="50"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    data-testid="input-discount"
                  />
                  <p className="text-xs text-muted-foreground">e.g., 50% OFF</p>
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Time Limit
                  </Label>
                  <Input
                    type="text"
                    placeholder="24 hours"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(e.target.value)}
                    data-testid="input-time-limit"
                  />
                  <p className="text-xs text-muted-foreground">e.g., 24 hours, Today Only</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Additional Details (Optional)</Label>
                <Textarea
                  placeholder="Add any extra sale details... (e.g., 'Free shipping included', 'Limited stock', 'Exclusive deal')"
                  value={additionalDetails}
                  onChange={(e) => setAdditionalDetails(e.target.value)}
                  className="min-h-[80px] resize-none"
                  data-testid="textarea-details"
                />
              </div>

              <CreditCostWarning 
                cost={creditCost} 
                featureName="Flash Sale"
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
                    <Zap className="h-4 w-4 mr-2" />
                    Generate Flash Sale ({creditCost} credits)
                  </>
                )}
              </Button>

              <GenerationProgress
                isActive={isGenerating}
                modelId="veo-3.1-fast"
                generationType="video"
              />
            </CardContent>
          </Card>
        }
        preview={
          <PeerTubePreview
            pageType="brand-flash-sale"
            title="Flash Sale Preview"
            description="See a sample flash sale promo"
            showGeneratingMessage={isGenerating}
          />
        }
      />
      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="Flash Sale Promo"
      />
    </>
  );
}
