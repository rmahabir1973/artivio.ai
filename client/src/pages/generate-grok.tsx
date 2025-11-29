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
import { Loader2, Upload, X, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreditCostWarning } from "@/components/credit-cost-warning";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { PreviewPanel } from "@/components/preview-panel";

const GROK_MODES = [
  { value: "normal", label: "Normal", description: "Standard image-to-video transformation" },
  { value: "fun", label: "Fun", description: "Creative and playful transformations" },
  { value: "spicy", label: "Spicy", description: "Dynamic and energetic style" },
];

export default function GenerateGrok() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();

  const [prompt, setPrompt] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [mode, setMode] = useState("normal");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<any>(null);

  const modelCost = getModelCost('grok-imagine', 400);

  // Poll for generation result
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
    enabled: !!generationId,
    refetchInterval: generationId ? 2000 : false,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  // Update generatedVideo when poll data arrives with terminal status
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
      setGeneratedVideo(pollData);
      setIsGenerating(false);
      setGenerationId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      toast({
        title: "Video Generated!",
        description: "Your Grok video is ready to view and download.",
      });
    } else if (isFailed) {
      console.log(`[POLL] ✗ Generation failed`);
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

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/generate/video", data);
    },
    onSuccess: (data: any) => {
      setGenerationId(data.generationId);
      setIsGenerating(true);
      setGeneratedVideo(null);
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again",
          variant: "destructive",
        });
        window.location.href = "/login";
      } else {
        toast({
          title: "Generation Failed",
          description: error.response?.data?.message || error.message,
          variant: "destructive",
        });
      }
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to process image",
        variant: "destructive",
      });
    }
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
  };

  const handleGenerate = () => {
    if (!uploadedImage) {
      toast({
        title: "Image Required",
        description: "Please upload an image to generate a video",
        variant: "destructive",
      });
      return;
    }

    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a description for the video",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      model: "grok-imagine",
      prompt: prompt.trim(),
      generationType: "image-to-video",
      referenceImages: [uploadedImage],
      parameters: {
        mode,
      },
    });
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <ThreeColumnLayout
        leftPanel={
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 pt-0">
              <CardTitle>Grok Imagine</CardTitle>
              <CardDescription>Transform images into dynamic videos</CardDescription>
            </CardHeader>

            <CardContent className="px-0 space-y-6">
              {/* Image Upload */}
              <div className="space-y-3">
                <Label htmlFor="image-upload" className="text-base font-semibold">
                  Upload Image <span className="text-red-500">*</span>
                </Label>
                <div className="relative border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => document.getElementById("image-upload")?.click()}
                  data-testid="button-upload-image">
                  {uploadedImage ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">Image uploaded</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage();
                        }}
                        data-testid="button-remove-image"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-medium">Click to upload an image</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP up to 10MB</p>
                    </>
                  )}
                </div>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  data-testid="input-image-file"
                />
              </div>

              {/* Prompt */}
              <div className="space-y-3">
                <Label htmlFor="prompt" className="text-base font-semibold">
                  Video Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="prompt"
                  placeholder="Describe how the image should transform into a video..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="resize-none min-h-24"
                  data-testid="textarea-prompt"
                />
              </div>

              {/* Mode Selection */}
              <div className="space-y-3">
                <Label htmlFor="mode" className="text-base font-semibold">
                  Generation Mode
                </Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger id="mode" data-testid="select-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROK_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        <div>
                          <div className="font-medium">{m.label}</div>
                          <div className="text-xs text-muted-foreground">{m.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cost Warning */}
              <CreditCostWarning cost={modelCost} />

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !uploadedImage || !prompt.trim()}
                className="w-full"
                size="lg"
                data-testid="button-generate"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Video"
                )}
              </Button>
            </CardContent>
          </Card>
        }
        rightPanel={
          <PreviewPanel
            generation={generatedVideo}
            isGenerating={isGenerating}
            type="video"
          />
        }
      />
    </div>
  );
}
