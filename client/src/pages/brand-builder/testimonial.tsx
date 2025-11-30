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
import { Loader2, Upload, X, Info, ArrowLeft, Quote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreditCostWarning } from "@/components/credit-cost-warning";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { PeerTubePreview } from "@/components/peertube-preview";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { GenerationProgress } from "@/components/generation-progress";
import { Link } from "wouter";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function Testimonial() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();
  
  const [testimonialText, setTestimonialText] = useState("");
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [uploadingPerson, setUploadingPerson] = useState(false);
  const [resolution, setResolution] = useState("720p");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<any>(null);
  const [showGuestModal, setShowGuestModal] = useState(false);
  
  // Testimonial includes both TTS + Lip-sync costs
  const lipSyncCost = getModelCost(resolution === '480p' ? 'infinitalk-lip-sync-480p' : 'infinitalk-lip-sync-720p', 60) || 250;
  const ttsCost = getModelCost('fish-audio-tts', 60) || 20;
  const creditCost = lipSyncCost + ttsCost;

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
      return await apiRequest("POST", "/api/testimonial/generate", data);
    },
    onSuccess: (data: any) => {
      setGenerationId(data.generationId);
      setIsGenerating(true);
      setGeneratedVideo(null);
      toast({
        title: "Generation Started",
        description: "Creating audio from text, then generating lip-sync video...",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/testimonial/generations"] });
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
    queryKey: ["/api/testimonial/generations", generationId],
    queryFn: async () => {
      if (!generationId) return null;
      const response = await apiRequest("GET", `/api/testimonial/generations/${generationId}`);
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
      queryClient.invalidateQueries({ queryKey: ["/api/testimonial/generations"] });
      toast({
        title: "Video Generated!",
        description: "Your testimonial video is ready to view and download.",
      });
    } else if (isFailed) {
      setGeneratedVideo(pollData);
      setIsGenerating(false);
      setGenerationId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/testimonial/generations"] });
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

    if (!personImage) {
      toast({
        title: "Missing Person Image",
        description: "Please upload a person image for the testimonial.",
        variant: "destructive",
      });
      return;
    }

    if (!testimonialText.trim()) {
      toast({
        title: "Missing Testimonial Text",
        description: "Please enter the testimonial text.",
        variant: "destructive",
      });
      return;
    }

    if (testimonialText.length > 500) {
      toast({
        title: "Testimonial Too Long",
        description: "Please keep the testimonial under 500 characters for best results.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      imageUrl: personImage,
      text: testimonialText.trim(),
      resolution,
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
                <Quote className="h-5 w-5 text-yellow-500" />
                Testimonial Video
              </CardTitle>
              <CardDescription>Transform reviews into speaking testimonial videos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-md p-4 flex gap-3">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-sm">AI-Powered Testimonials</p>
                  <p className="text-sm text-muted-foreground">
                    Upload a person's image and enter the testimonial text. Our AI will create a realistic video of them speaking the testimonial.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Quote className="h-5 w-5 text-yellow-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Lip-Sync Technology</p>
                  <p className="text-xs text-muted-foreground">Natural speaking testimonials</p>
                </div>
                <Badge variant="secondary">{creditCost} credits</Badge>
              </div>

              <div className="space-y-3">
                <Label>Person Image</Label>
                <p className="text-xs text-muted-foreground">Upload a clear, front-facing photo of the person</p>
                {personImage ? (
                  <div className="relative group">
                    <img 
                      src={personImage} 
                      alt="Person"
                      className="w-full h-48 object-cover rounded-md border-2 border-border"
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
                    <div className="border-2 border-dashed border-border rounded-md p-6 hover-elevate active-elevate-2 cursor-pointer text-center transition-colors h-48 flex flex-col items-center justify-center">
                      {uploadingPerson ? (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium">Upload Person Image</p>
                          <p className="text-xs text-muted-foreground mt-1">Clear, front-facing photo</p>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>

              <div className="space-y-3">
                <Label>Testimonial Text</Label>
                <Textarea
                  placeholder="Enter the testimonial text that the person will speak... (e.g., 'I've been using this product for 3 months and it has completely transformed my daily routine. Highly recommended!')"
                  value={testimonialText}
                  onChange={(e) => setTestimonialText(e.target.value)}
                  className="min-h-[120px] resize-none"
                  data-testid="textarea-testimonial"
                />
                <p className="text-xs text-muted-foreground text-right">{testimonialText.length}/500 characters</p>
              </div>

              <div className="space-y-3">
                <Label>Video Resolution</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger data-testid="select-resolution">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="480p">480p (Lower credits)</SelectItem>
                    <SelectItem value="720p">720p (Recommended)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <CreditCostWarning 
                cost={creditCost} 
                featureName="Testimonial Video"
              />

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || isGenerating || !personImage || !testimonialText.trim()}
                className="w-full"
                size="lg"
                data-testid="button-generate"
              >
                {generateMutation.isPending || isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generating Testimonial...
                  </>
                ) : (
                  <>
                    <Quote className="h-4 w-4 mr-2" />
                    Generate Testimonial ({creditCost} credits)
                  </>
                )}
              </Button>

              <GenerationProgress
                isActive={isGenerating}
                modelId="lip-sync"
                generationType="lip-sync"
              />
            </CardContent>
          </Card>
        }
        preview={
          <PeerTubePreview
            pageType="brand-testimonial"
            title="Testimonial Preview"
            description="See a sample testimonial video"
            showGeneratingMessage={isGenerating}
          />
        }
      />
      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="Testimonial Videos"
      />
    </>
  );
}
