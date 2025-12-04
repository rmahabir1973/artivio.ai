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
import { Loader2, Upload, Download, Zap, Copy, Check } from "lucide-react";
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

interface UpscaleResult {
  id: string;
  status: string;
  resultUrl?: string;
  error?: string;
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
  const [copied, setCopied] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [showGuestModal, setShowGuestModal] = useState(false);

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

    // Check video duration before processing
    const videoElement = document.createElement("video");
    videoElement.preload = "metadata";

    videoElement.onloadedmetadata = () => {
      window.URL.revokeObjectURL(videoElement.src);
      const duration = videoElement.duration;

      if (duration > maxDuration) {
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
      };
      reader.readAsDataURL(file);
    };

    videoElement.onerror = () => {
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
      toast({
        title: "Upscaling Started",
        description: `Your video is being upscaled ${selectedFactor}x. Please wait...`,
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
        toast({
          title: "Upscaling Complete",
          description: "Your video has been successfully upscaled!",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      } else if (data.status === "failed") {
        setIsPolling(false);
        toast({
          title: "Upscaling Failed",
          description: data.errorMessage || "An error occurred during upscaling",
          variant: "destructive",
        });
      }

      return data;
    },
    enabled: isPolling && !!generationId,
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

  const handleDownload = () => {
    if (!resultUrl) return;
    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = `upscaled-${selectedFactor}x-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">
                {uploadedFileName || "Click to upload or drag and drop"}
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
        <Button
          onClick={handleUpscale}
          disabled={!videoUrl || videoDuration <= 0 || upscaleMutation.isPending || isPolling}
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
      </CardContent>
    </Card>
  );

  return (
    <SidebarInset>
      <ThreeColumnLayout 
        form={form} 
        preview={
          <PeerTubePreview
            pageType="video-upscaler"
            title="Video Upscaler"
            description="Enhance video resolution with AI"
            showGeneratingMessage={isPolling}
          />
        }
      />
      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="Video Upscaling"
      />
    </SidebarInset>
  );
}
