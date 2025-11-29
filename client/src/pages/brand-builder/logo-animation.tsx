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
import { Loader2, Upload, X, Info, ArrowLeft, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreditCostWarning } from "@/components/credit-cost-warning";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { PeerTubePreview } from "@/components/peertube-preview";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { GenerationProgress } from "@/components/generation-progress";
import { Link } from "wouter";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ANIMATION_STYLES = [
  { value: "elegant", label: "Elegant Fade In", prompt: "Create an elegant logo animation with a smooth fade-in effect, subtle particle trails, and a professional finish. The logo should appear gracefully with a refined, sophisticated motion." },
  { value: "dynamic", label: "Dynamic Reveal", prompt: "Create a dynamic logo animation with energetic motion, zoom effects, and impactful reveal. The logo should appear with bold, attention-grabbing movements." },
  { value: "minimal", label: "Minimal & Clean", prompt: "Create a minimalist logo animation with clean, simple motion. The logo should appear with understated elegance and smooth, subtle transitions." },
  { value: "3d", label: "3D Effect", prompt: "Create a logo animation with 3D depth and perspective. The logo should rotate, have depth, and appear with cinematic 3D movements." },
  { value: "glitch", label: "Tech/Glitch", prompt: "Create a tech-inspired logo animation with glitch effects, digital distortion, and futuristic elements. The logo should appear with modern, digital aesthetics." },
];

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 (Landscape)" },
  { value: "1:1", label: "1:1 (Square)" },
];

export default function LogoAnimation() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();
  
  const [animationStyle, setAnimationStyle] = useState("elegant");
  const [prompt, setPrompt] = useState(ANIMATION_STYLES[0].prompt);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<any>(null);
  const [showGuestModal, setShowGuestModal] = useState(false);
  
  const creditCost = getModelCost('veo-3.1-fast', 400) || 100;

  const handleStyleChange = (value: string) => {
    setAnimationStyle(value);
    const selectedStyle = ANIMATION_STYLES.find(s => s.value === value);
    if (selectedStyle) {
      setPrompt(selectedStyle.prompt);
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    
    setUploadingLogo(true);
    try {
      const url = await uploadImage(file);
      setLogoImage(url);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload the logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
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
        description: "Your logo animation is being generated.",
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
        description: "Your logo animation is ready to view and download.",
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

    if (!logoImage) {
      toast({
        title: "Missing Logo",
        description: "Please upload your logo image.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      model: 'veo-3.1-fast',
      prompt: prompt.trim(),
      generationType: 'image-to-video',
      referenceImages: [logoImage],
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
                <Sparkles className="h-5 w-5 text-yellow-500" />
                Logo Animation
              </CardTitle>
              <CardDescription>Transform your logo into a dynamic animated intro</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-md p-4 flex gap-3">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-sm">Animated Logo Intros</p>
                  <p className="text-sm text-muted-foreground">
                    Upload your static logo and choose an animation style. We'll create a professional animated intro perfect for videos and social media.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Veo 3.1 Fast</p>
                  <p className="text-xs text-muted-foreground">Professional logo animation</p>
                </div>
                <Badge variant="secondary">{creditCost} credits</Badge>
              </div>

              <div className="space-y-3">
                <Label>Logo Image</Label>
                <p className="text-xs text-muted-foreground">Upload your logo (PNG with transparent background works best)</p>
                {logoImage ? (
                  <div className="relative group">
                    <div className="w-full h-48 bg-muted/50 rounded-md border-2 border-border flex items-center justify-center p-4">
                      <img 
                        src={logoImage} 
                        alt="Logo"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setLogoImage(null)}
                      data-testid="button-remove-logo"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={uploadingLogo}
                      data-testid="input-upload-logo"
                    />
                    <div className="border-2 border-dashed border-border rounded-md p-6 hover-elevate active-elevate-2 cursor-pointer text-center transition-colors h-48 flex flex-col items-center justify-center">
                      {uploadingLogo ? (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium">Upload Logo</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, SVG, JPG up to {MAX_FILE_SIZE_MB}MB</p>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>

              <div className="space-y-3">
                <Label>Animation Style</Label>
                <Select value={animationStyle} onValueChange={handleStyleChange}>
                  <SelectTrigger data-testid="select-animation-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANIMATION_STYLES.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Aspect Ratio</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger data-testid="select-aspect-ratio">
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

              <div className="space-y-3">
                <Label>Animation Description</Label>
                <Textarea
                  placeholder="Customize the animation..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[100px] resize-none"
                  data-testid="textarea-prompt"
                />
              </div>

              <CreditCostWarning 
                cost={creditCost} 
                featureName="Logo Animation"
              />

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || isGenerating || !logoImage}
                className="w-full"
                size="lg"
                data-testid="button-generate"
              >
                {generateMutation.isPending || isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generating Animation...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Logo Animation ({creditCost} credits)
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
            pageType="brand-logo-animation"
            title="Logo Animation Preview"
            description="See a sample logo animation"
            showGeneratingMessage={isGenerating}
          />
        }
      />
      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="Logo Animation"
      />
    </>
  );
}
