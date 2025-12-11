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
import { Loader2, Upload, X, Info, ArrowLeftRight, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreditCostWarning } from "@/components/credit-cost-warning";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { PeerTubePreview } from "@/components/peertube-preview";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { SiGoogle } from "react-icons/si";
import { GenerationProgress } from "@/components/generation-progress";
import { RefinePromptButton } from "@/components/prompt-assistant";

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 (Landscape)" },
  { value: "9:16", label: "9:16 (Portrait)" },
];

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function GenerateTransition() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();
  
  const [prompt, setPrompt] = useState("");
  const [firstFrame, setFirstFrame] = useState<string | null>(null);
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const [uploadingFirst, setUploadingFirst] = useState(false);
  const [uploadingLast, setUploadingLast] = useState(false);
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

  const handleFirstFrameUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        title: "File Too Large",
        description: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the maximum allowed size of ${MAX_FILE_SIZE_MB}MB. Please compress or resize your image.`,
        variant: "destructive",
      });
      e.target.value = ''; // Reset input
      return;
    }
    
    setUploadingFirst(true);
    try {
      const url = await uploadImage(file);
      setFirstFrame(url);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload the first frame image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingFirst(false);
    }
  };

  const handleLastFrameUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        title: "File Too Large",
        description: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the maximum allowed size of ${MAX_FILE_SIZE_MB}MB. Please compress or resize your image.`,
        variant: "destructive",
      });
      e.target.value = ''; // Reset input
      return;
    }
    
    setUploadingLast(true);
    try {
      const url = await uploadImage(file);
      setLastFrame(url);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload the last frame image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingLast(false);
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
        description: "Your transition video is being generated. Watch the preview panel for progress.",
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
    enabled: isAuthenticated && !!generationId,
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
        description: "Your transition video is ready to view and download.",
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

  const handleGenerate = () => {
    // Guest check - prompt sign up if not authenticated
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }

    if (!firstFrame || !lastFrame) {
      toast({
        title: "Missing Images",
        description: "Please upload both first and last frame images.",
        variant: "destructive",
      });
      return;
    }

    if (!prompt.trim()) {
      toast({
        title: "Missing Description",
        description: "Please describe how the video should transition between the frames.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      model: 'veo-3.1-fast-first-and-last-frames',
      prompt: prompt.trim(),
      generationType: 'first-and-last-frames-to-video',
      referenceImages: [firstFrame, lastFrame],
      parameters: {
        aspectRatio,
      },
    });
  };

  // Determine preview status
  const getPreviewStatus = (): "idle" | "generating" | "completed" | "failed" => {
    if (isGenerating) return "generating";
    if (generatedVideo?.resultUrl) return "completed";
    if (generatedVideo?.status === 'failed' || generatedVideo?.status === 'failure') return "failed";
    return "idle";
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
                <CardTitle className="flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5" />
                  Transition Generator
                </CardTitle>
                <CardDescription>Create smooth video transitions between two images</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Info Banner */}
            <div className="bg-muted/50 rounded-md p-4 flex gap-3">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-sm">First & Last Frames</p>
                <p className="text-sm text-muted-foreground">
                  Upload a first frame and last frame. The AI will generate a smooth video transition between them.
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  Maximum file size: {MAX_FILE_SIZE_MB}MB per image. Larger files will be rejected.
                </p>
              </div>
            </div>

            {/* Model Info */}
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <SiGoogle className="h-5 w-5 text-blue-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Veo 3.1 Fast</p>
                <p className="text-xs text-muted-foreground">8 second transition video</p>
              </div>
              <Badge variant="secondary">{creditCost} credits</Badge>
            </div>

            {/* Frame Upload Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* First Frame */}
              <div className="space-y-3">
                <Label>First Frame</Label>
                {firstFrame ? (
                  <div className="relative group">
                    <img 
                      src={firstFrame} 
                      alt="First Frame"
                      className="w-full h-40 object-cover rounded-md border-2 border-border"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setFirstFrame(null)}
                      data-testid="button-remove-first-frame"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Badge className="absolute bottom-2 left-2" variant="secondary">Start</Badge>
                  </div>
                ) : (
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFirstFrameUpload}
                      className="hidden"
                      disabled={uploadingFirst}
                      data-testid="input-upload-first-frame"
                    />
                    <div className="border-2 border-dashed border-border rounded-md p-6 hover-elevate active-elevate-2 cursor-pointer text-center transition-colors h-40 flex flex-col items-center justify-center">
                      {uploadingFirst ? (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium">Upload First Frame</p>
                          <p className="text-xs text-muted-foreground mt-1">Drag or click to upload</p>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>

              {/* Last Frame */}
              <div className="space-y-3">
                <Label>Last Frame</Label>
                {lastFrame ? (
                  <div className="relative group">
                    <img 
                      src={lastFrame} 
                      alt="Last Frame"
                      className="w-full h-40 object-cover rounded-md border-2 border-border"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setLastFrame(null)}
                      data-testid="button-remove-last-frame"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Badge className="absolute bottom-2 left-2" variant="secondary">End</Badge>
                  </div>
                ) : (
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLastFrameUpload}
                      className="hidden"
                      disabled={uploadingLast}
                      data-testid="input-upload-last-frame"
                    />
                    <div className="border-2 border-dashed border-border rounded-md p-6 hover-elevate active-elevate-2 cursor-pointer text-center transition-colors h-40 flex flex-col items-center justify-center">
                      {uploadingLast ? (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium">Upload Last Frame</p>
                          <p className="text-xs text-muted-foreground mt-1">Drag or click to upload</p>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>
            </div>

            {/* Aspect Ratio */}
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

            {/* Prompt */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Transition Description</Label>
                <RefinePromptButton
                  prompt={prompt}
                  onRefined={setPrompt}
                  context="video"
                />
              </div>
              <Textarea
                placeholder="Describe how the video should transition between the frames... (e.g., 'The scene slowly zooms in as clouds drift across the sky')"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[100px] resize-none"
                data-testid="textarea-prompt"
              />
            </div>

            {/* Credit Warning */}
            <CreditCostWarning 
              cost={creditCost} 
              featureName="Transition"
            />

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || isGenerating || !firstFrame || !lastFrame || !prompt.trim()}
              className="w-full"
              size="lg"
              data-testid="button-generate"
            >
              {generateMutation.isPending || isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating Transition...
                </>
              ) : (
                <>
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Generate Transition ({creditCost} credits)
                </>
              )}
            </Button>

            {/* Generation Progress */}
            <GenerationProgress
              isActive={isGenerating}
              modelId="veo-3.1-first-and-last-frames"
              generationType="video"
            />
          </CardContent>
        </Card>
      }
      preview={
        generatedVideo ? (
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Generated Transition</CardTitle>
              <CardDescription>
                {generatedVideo.prompt?.substring(0, 100)}
                {generatedVideo.prompt?.length > 100 ? '...' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4">
                <video
                  src={generatedVideo.resultUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-contain"
                  data-testid="video-result"
                />
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Model:</span>
                  <Badge variant="secondary">{generatedVideo.model}</Badge>
                </div>
                {generatedVideo.parameters?.aspectRatio && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Aspect Ratio:</span>
                    <span>{generatedVideo.parameters.aspectRatio}</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = generatedVideo.resultUrl;
                    link.download = `transition-${generatedVideo.id}.mp4`;
                    link.click();
                  }}
                  data-testid="button-download-result"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setGeneratedVideo(null);
                    setPrompt('');
                    setFirstFrame(null);
                    setLastFrame(null);
                  }}
                  data-testid="button-generate-another"
                >
                  Generate Another
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <PeerTubePreview
            pageType="transition"
            title="Transition Preview"
            description="See smooth video transitions"
            showGeneratingMessage={isGenerating}
          />
        )
      }
    />
    <GuestGenerateModal
      open={showGuestModal}
      onOpenChange={setShowGuestModal}
      featureName="Video Transitions"
    />
    </>
  );
}
