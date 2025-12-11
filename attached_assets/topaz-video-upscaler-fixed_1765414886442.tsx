import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePricing } from "@/hooks/use-pricing";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Upload, Download, Zap, Copy, Check, Video as VideoIcon, Clock } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { PeerTubePreview } from "@/components/peertube-preview";

// Duration tier helper - pricing comes from database via usePricing hook
// Database model names: topaz-video-{factor}x-{tier}s
function getDurationTier(duration: number): '10s' | '15s' | '20s' {
  if (duration <= 10) return '10s';
  if (duration <= 15) return '15s';
  return '20s';
}

export default function TopazVideoUpscaler() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { getModelCost } = usePricing();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [base64Video, setBase64Video] = useState<string | null>(null);
  const [selectedFactor, setSelectedFactor] = useState<"1" | "2" | "4">("2");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [pollAttempts, setPollAttempts] = useState(0);

  const MAX_POLL_ATTEMPTS = 120; // 6 minutes (videos take longer than images)
  
  // Get pricing from database based on selected factor and duration tier
  const currentTier = videoDuration > 0 ? getDurationTier(videoDuration) : '10s';
  const currentCost = getModelCost(`topaz-video-${selectedFactor}x-${currentTier}`, 160);
  const currentCredits = (user as any)?.credits || 0;
  const creditsAfter = currentCredits - currentCost;

  const getWarningLevel = () => {
    if (currentCredits < currentCost) return "insufficient";
    if (creditsAfter < 100) return "low";
    if (creditsAfter < 500) return "moderate";
    return "normal";
  };

  const warningLevel = getWarningLevel();

  const warningColors = {
    insufficient: "text-destructive",
    low: "text-orange-500",
    moderate: "text-yellow-500",
    normal: "text-primary",
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const maxFileSize = 500 * 1024 * 1024; // 500MB
    const maxDuration = 20; // 20 seconds
    const allowedTypes = ["video/mp4", "video/quicktime", "video/x-matroska"];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload MP4, MOV, or MKV videos.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > maxFileSize) {
      toast({
        title: "File Too Large",
        description: `File is ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 500MB.`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    // Check video duration before processing
    const videoElement = document.createElement("video");
    videoElement.preload = "metadata";

    videoElement.onloadedmetadata = () => {
      window.URL.revokeObjectURL(videoElement.src);
      const duration = videoElement.duration;

      if (duration > maxDuration) {
        setIsUploading(false);
        toast({
          title: "Video Too Long",
          description: `Video is ${duration.toFixed(1)}s long. Maximum duration is ${maxDuration} seconds to avoid processing timeouts.`,
          variant: "destructive",
        });
        return;
      }

      // Store duration for cost calculation (pricing comes from database via usePricing hook)
      setVideoDuration(duration);
      const tier = getDurationTier(duration);
      
      // Show tier information to user
      toast({
        title: "Video Loaded",
        description: `Duration: ${duration.toFixed(1)}s - Tier: ${tier === '10s' ? '0-10s' : tier === '15s' ? '11-15s' : '16-20s'}`,
      });

      // Duration is valid, proceed with upload
      setUploadedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setBase64Video(base64);
        setVideoUrl(base64);
        setResultUrl(null);
        setGenerationId(null);
        setIsUploading(false);
      };
      reader.onerror = () => {
        setIsUploading(false);
        toast({
          title: "Upload Failed",
          description: "Could not read video file.",
          variant: "destructive",
        });
      };
      reader.readAsDataURL(file);
    };

    videoElement.onerror = () => {
      setIsUploading(false);
      toast({
        title: "Invalid Video",
        description: "Could not read video file. Please try a different file.",
        variant: "destructive",
      });
    };

    videoElement.src = URL.createObjectURL(file);
  };

  const upscaleMutation = useMutation({
    mutationFn: async () => {
      if (!base64Video) {
        throw new Error("No video selected");
      }

      if (videoDuration <= 0) {
        throw new Error("Video duration not detected. Please re-upload the video.");
      }

      const userCredits = (user as any)?.credits;
      if (typeof userCredits === "number" && userCredits < currentCost) {
        throw new Error(`Insufficient credits. Need ${currentCost}, have ${userCredits}.`);
      }

      const response: any = await apiRequest("POST", "/api/upscale/topaz-video", {
        videoData: base64Video,
        upscaleFactor: selectedFactor,
      });

      return response;
    },
    onSuccess: (data: any) => {
      setGenerationId(data.generationId);
      setIsPolling(true);
      setPollAttempts(0);
      toast({
        title: "Upscaling Started",
        description: `Your video is being upscaled ${selectedFactor}x. This may take several minutes...`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Upscale Failed",
        description: error.message || "Failed to start upscaling",
        variant: "destructive",
      });
    },
  });

  // Poll for generation status
  useQuery({
    queryKey: ["/api/generations", generationId],
    queryFn: async () => {
      if (!generationId) return null;

      setPollAttempts(prev => prev + 1);
      
      if (pollAttempts >= MAX_POLL_ATTEMPTS) {
        setIsPolling(false);
        toast({
          title: "Processing Timeout",
          description: "Upscaling is taking longer than expected. Please check your library.",
          variant: "destructive",
        });
        return null;
      }

      const response = await fetch(`/api/generations/${generationId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to fetch generation status");
      }

      const data = await response.json();

      if (data.status === "completed" && data.resultUrl) {
        setResultUrl(data.resultUrl);
        setIsPolling(false);
        setPollAttempts(0);
        toast({
          title: "Upscaling Complete",
          description: "Your video has been successfully upscaled!",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      } else if (data.status === "failed") {
        setIsPolling(false);
        setPollAttempts(0);
        toast({
          title: "Upscaling Failed",
          description: data.errorMessage || "An error occurred during upscaling",
          variant: "destructive",
        });
      }

      return data;
    },
    enabled: isPolling && !!generationId && pollAttempts < MAX_POLL_ATTEMPTS,
    refetchInterval: isPolling ? 3000 : undefined,
  });

  const handleUpscale = () => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }

    if (!base64Video || videoDuration <= 0) {
      toast({
        title: "No Video Uploaded",
        description: "Please upload a video first.",
        variant: "destructive",
      });
      return;
    }
    
    if (warningLevel === "insufficient") {
      toast({
        title: "Insufficient Credits",
        description: `You need ${currentCost} credits but only have ${currentCredits}.`,
        variant: "destructive",
      });
      return;
    }
    upscaleMutation.mutate();
  };

  const handleDownload = async () => {
    if (!resultUrl) return;
    
    try {
      const response = await fetch(resultUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `upscaled-${selectedFactor}x-${uploadedFileName || Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download Started",
        description: "Your upscaled video is downloading...",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download video. Try copying the URL instead.",
        variant: "destructive",
      });
    }
  };

  const handleCopyUrl = () => {
    if (!resultUrl) return;
    navigator.clipboard.writeText(resultUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied",
      description: "Video URL copied to clipboard",
    });
  };

  const handleReset = () => {
    setVideoUrl(null);
    setBase64Video(null);
    setResultUrl(null);
    setGenerationId(null);
    setUploadedFileName("");
    setVideoDuration(0);
    setIsPolling(false);
    setPollAttempts(0);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const form = (
    <Card>
      <CardHeader>
        <CardTitle>Video Upscaler</CardTitle>
        <CardDescription>Enhance your videos with AI-powered upscaling</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Video Upload */}
        <div className="space-y-3">
          <Label>Upload Video</Label>
          <label
            data-testid="video-upscaler-upload-area"
            className="flex flex-col items-center justify-center w-full px-4 py-8 border-2 border-dashed rounded-lg cursor-pointer hover-elevate transition-colors"
          >
            <div className="flex flex-col items-center justify-center">
              {isUploading ? (
                <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              )}
              <span className="text-sm font-medium">
                {isUploading ? "Loading video..." : (uploadedFileName || "Click to upload or drag and drop")}
              </span>
              <span className="text-xs text-muted-foreground">
                MP4, MOV, MKV • Max 20 seconds • Up to 500MB
              </span>
            </div>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/x-matroska"
              onChange={handleVideoUpload}
              className="hidden"
              disabled={isUploading || isPolling}
              data-testid="video-upscaler-file-input"
            />
          </label>
        </div>

        {/* Pricing Tiers Information - prices from database */}
        <div className="space-y-3">
          <Label>Pricing Based on Video Duration</Label>
          <div className="grid gap-3">
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div className="flex flex-col">
                <span className="text-sm font-medium">0-10 seconds</span>
                <span className="text-xs text-muted-foreground">Short clips</span>
              </div>
              <Badge variant="outline">{getModelCost(`topaz-video-${selectedFactor}x-10s`, 160)} credits</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div className="flex flex-col">
                <span className="text-sm font-medium">11-15 seconds</span>
                <span className="text-xs text-muted-foreground">Medium length</span>
              </div>
              <Badge variant="outline">{getModelCost(`topaz-video-${selectedFactor}x-15s`, 270)} credits</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div className="flex flex-col">
                <span className="text-sm font-medium">16-20 seconds</span>
                <span className="text-xs text-muted-foreground">Longer videos</span>
              </div>
              <Badge variant="outline">{getModelCost(`topaz-video-${selectedFactor}x-20s`, 380)} credits</Badge>
            </div>
          </div>
          {videoDuration > 0 && (
            <div className="text-sm text-primary font-medium">
              Your video: {videoDuration.toFixed(1)}s → {currentCost} credits ({currentTier} tier)
            </div>
          )}
        </div>

        {/* Upscale Factor Selection */}
        <div className="space-y-3">
          <Label>Upscale Factor</Label>
          <RadioGroup value={selectedFactor} onValueChange={(v) => setSelectedFactor(v as "1" | "2" | "4")}>
            {[
              { factor: "1", label: "1x Upscale", description: "No upscaling (format conversion)" },
              { factor: "2", label: "2x Upscale", description: "HD enhancement" },
              { factor: "4", label: "4x Upscale", description: "4K enhancement" }
            ].map(({ factor, label, description }) => (
              <div
                key={factor}
                className="flex items-center justify-between space-x-2 rounded-lg border p-4 hover-elevate"
                data-testid={`video-upscale-factor-${factor}x`}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={factor} id={`v-factor-${factor}`} data-testid={`radio-video-factor-${factor}x`} />
                  <Label htmlFor={`v-factor-${factor}`} className="cursor-pointer font-medium">
                    {label}
                  </Label>
                </div>
                <span className="text-xs text-muted-foreground">
                  {description}
                </span>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Credit Preview */}
        <div className="space-y-2 rounded-lg border p-4 bg-muted/30">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current Credits:</span>
            <span className="font-medium" data-testid="video-credits-display-current">
              {currentCredits.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Upscale Cost:</span>
            <span className="font-medium" data-testid="video-upscale-cost-display">
              {currentCost} credits
            </span>
          </div>
          <div className="flex items-center justify-between text-sm pt-2 border-t">
            <span className="text-muted-foreground">After Upscale:</span>
            <span className={`font-medium ${warningColors[warningLevel]}`} data-testid="video-credits-display-after">
              {creditsAfter.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button
            onClick={handleUpscale}
            disabled={!videoUrl || videoDuration <= 0 || upscaleMutation.isPending || isPolling || resultUrl !== null}
            className="w-full"
            data-testid="button-start-video-upscale"
          >
            {upscaleMutation.isPending || isPolling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isPolling ? "Processing..." : "Starting..."}
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Upscale {selectedFactor}x
              </>
            )}
          </Button>
          
          {resultUrl && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleReset}
              data-testid="button-new-video-upscale"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upscale Another Video
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // CRITICAL FIX: Proper video preview logic instead of always showing PeerTube
  const preview = (
    <div className="relative w-full h-full flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
      {/* State 1: No video uploaded - Show PeerTube ad */}
      {!videoUrl && !resultUrl && (
        <PeerTubePreview
          pageType="video-upscaler"
          title="Video Upscaler"
          description="Enhance video resolution with AI"
          showGeneratingMessage={false}
        />
      )}
      
      {/* State 2: Video uploaded, processing - Show original with loader */}
      {videoUrl && !resultUrl && isPolling && (
        <div className="relative w-full h-full">
          <video 
            src={videoUrl} 
            className="w-full h-full object-contain"
            controls
            muted
          />
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
            <Loader2 className="h-20 w-20 animate-spin text-white mb-6" />
            <p className="text-white font-semibold text-xl mb-2">Upscaling {selectedFactor}x...</p>
            <p className="text-white/80 text-base mb-4">
              {videoDuration.toFixed(1)}s video • {currentTier} tier
            </p>
            <p className="text-white/70 text-sm">This may take 2-5 minutes</p>
            <div className="mt-6 px-6 py-3 bg-white/10 rounded-full backdrop-blur">
              <p className="text-white/90 text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Processing {pollAttempts}/{MAX_POLL_ATTEMPTS} checks
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* State 3: Video uploaded, not processing - Show original */}
      {videoUrl && !resultUrl && !isPolling && (
        <div className="w-full h-full flex flex-col">
          <div className="flex-1 flex items-center justify-center p-8 bg-black">
            <video 
              src={videoUrl} 
              className="max-w-full max-h-full rounded-lg shadow-2xl"
              controls
              muted
            />
          </div>
          <div className="p-4 border-t bg-background/95 backdrop-blur">
            <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
              <VideoIcon className="h-4 w-4" />
              Original Video ({videoDuration.toFixed(1)}s) • Ready to upscale {selectedFactor}x
            </p>
          </div>
        </div>
      )}
      
      {/* State 4: Result ready - Show upscaled video with actions */}
      {resultUrl && (
        <div className="w-full h-full flex flex-col">
          {/* Result Video */}
          <div className="flex-1 flex items-center justify-center p-8 bg-black">
            <video 
              src={resultUrl} 
              className="max-w-full max-h-full rounded-lg shadow-2xl ring-2 ring-primary/30"
              controls
              autoPlay
              muted
            />
          </div>
          
          {/* Action Bar */}
          <div className="p-6 border-t bg-background/95 backdrop-blur space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-base flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  Upscaled {selectedFactor}x
                </p>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  {videoDuration.toFixed(1)}s • {uploadedFileName || "Enhanced Video"}
                </p>
              </div>
              <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-500/20">
                ✓ Complete
              </Badge>
            </div>
            
            <div className="flex gap-3">
              <Button 
                onClick={handleDownload}
                className="flex-1"
                size="lg"
                data-testid="button-download-video-result"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button 
                onClick={handleCopyUrl}
                variant="outline"
                className="flex-1"
                size="lg"
                data-testid="button-copy-video-url"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy URL
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <SidebarInset>
      <ThreeColumnLayout 
        form={form} 
        preview={preview}
      />
      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="Video Upscaling"
      />
    </SidebarInset>
  );
}
