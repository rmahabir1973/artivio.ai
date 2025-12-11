import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Upload, Download, Zap, Copy, Check } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { PeerTubePreview } from "@/components/peertube-preview";

interface UpsculerCosts {
  "2": number;
  "4": number;
  "8": number;
}

const UPSCALE_COSTS: UpsculerCosts = {
  "2": 10,
  "4": 20,
  "8": 40,
};

export default function TopazUpscaler() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [selectedFactor, setSelectedFactor] = useState<"2" | "4" | "8">("2");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [pollAttempts, setPollAttempts] = useState(0);

  const MAX_POLL_ATTEMPTS = 60; // 3 minutes at 3s intervals
  const currentCost = UPSCALE_COSTS[selectedFactor];
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload JPEG, PNG, or WebP images.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > maxFileSize) {
      toast({
        title: "File Too Large",
        description: `File is ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 100MB.`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadedFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setBase64Image(base64);
      setImageUrl(base64);
      setResultUrl(null);
      setGenerationId(null);
      setIsUploading(false);
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast({
        title: "Upload Failed",
        description: "Could not read image file.",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  const upscaleMutation = useMutation({
    mutationFn: async () => {
      if (!base64Image) {
        throw new Error("No image selected");
      }

      const userCredits = (user as any)?.credits;
      if (typeof userCredits === "number" && userCredits < currentCost) {
        throw new Error(`Insufficient credits. Need ${currentCost}, have ${userCredits}.`);
      }

      const response: any = await apiRequest("POST", "/api/upscale/topaz", {
        imageData: base64Image,
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
        description: `Your image is being upscaled ${selectedFactor}x. Please wait...`,
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
          description: "Your image has been successfully upscaled!",
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
      link.download = `upscaled-${selectedFactor}x-${uploadedFileName || Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download Started",
        description: "Your upscaled image is downloading...",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download image. Try copying the URL instead.",
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
      description: "Image URL copied to clipboard",
    });
  };

  const handleReset = () => {
    setImageUrl(null);
    setBase64Image(null);
    setResultUrl(null);
    setGenerationId(null);
    setUploadedFileName("");
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
        <CardTitle>Topaz Upscaler</CardTitle>
        <CardDescription>Enhance your images with AI-powered upscaling</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Image Upload */}
        <div className="space-y-3">
          <Label>Upload Image</Label>
          <label
            data-testid="upscaler-upload-area"
            className="flex flex-col items-center justify-center w-full px-4 py-8 border-2 border-dashed rounded-lg cursor-pointer hover-elevate transition-colors"
          >
            <div className="flex flex-col items-center justify-center">
              {isUploading ? (
                <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              )}
              <span className="text-sm font-medium">
                {isUploading ? "Loading image..." : (uploadedFileName || "Click to upload or drag and drop")}
              </span>
              <span className="text-xs text-muted-foreground">
                PNG, JPG, WebP up to 100MB
              </span>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleImageUpload}
              className="hidden"
              disabled={isUploading || isPolling}
              data-testid="upscaler-file-input"
            />
          </label>
        </div>

        {/* Upscale Factor Selection */}
        <div className="space-y-3">
          <Label>Upscale Factor</Label>
          <RadioGroup value={selectedFactor} onValueChange={(v) => setSelectedFactor(v as "2" | "4" | "8")}>
            {Object.entries(UPSCALE_COSTS).map(([factor, cost]) => (
              <div
                key={factor}
                className="flex items-center justify-between space-x-2 rounded-lg border p-4 hover-elevate"
                data-testid={`upscale-factor-${factor}x`}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={factor} id={`factor-${factor}`} data-testid={`radio-factor-${factor}x`} />
                  <Label htmlFor={`factor-${factor}`} className="cursor-pointer font-medium">
                    {factor}x Upscale
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" data-testid={`cost-badge-${factor}x`}>
                    {cost} credits
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {factor === "2" && "Up to 2K"}
                    {factor === "4" && "4K"}
                    {factor === "8" && "8K"}
                  </span>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Credit Preview */}
        <div className="space-y-2 rounded-lg border p-4 bg-muted/30">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current Credits:</span>
            <span className="font-medium" data-testid="credits-display-current">
              {currentCredits.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Upscale Cost:</span>
            <span className="font-medium" data-testid="upscale-cost-display">
              {currentCost} credits
            </span>
          </div>
          <div className="flex items-center justify-between text-sm pt-2 border-t">
            <span className="text-muted-foreground">After Upscale:</span>
            <span className={`font-medium ${warningColors[warningLevel]}`} data-testid="credits-display-after">
              {creditsAfter.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button
            onClick={handleUpscale}
            disabled={!imageUrl || upscaleMutation.isPending || isPolling || resultUrl !== null}
            className="w-full"
            data-testid="button-start-upscale"
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
              data-testid="button-new-upscale"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upscale Another Image
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // CRITICAL FIX: Proper image preview logic instead of always showing PeerTube
  const preview = (
    <div className="relative w-full h-full flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
      {/* State 1: No image uploaded - Show PeerTube ad */}
      {!imageUrl && !resultUrl && (
        <PeerTubePreview
          pageType="image-upscaler"
          title="Image Upscaler"
          description="Enhance image resolution with AI"
          showGeneratingMessage={false}
        />
      )}
      
      {/* State 2: Image uploaded, processing - Show original with loader */}
      {imageUrl && !resultUrl && isPolling && (
        <div className="relative w-full h-full">
          <img 
            src={imageUrl} 
            alt="Original" 
            className="w-full h-full object-contain"
          />
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm">
            <Loader2 className="h-16 w-16 animate-spin text-white mb-4" />
            <p className="text-white font-medium text-lg">Upscaling {selectedFactor}x...</p>
            <p className="text-white/70 text-sm mt-2">This may take 1-2 minutes</p>
            <div className="mt-4 px-4 py-2 bg-white/10 rounded-full">
              <p className="text-white/90 text-xs">
                Processing {pollAttempts}/{MAX_POLL_ATTEMPTS} checks
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* State 3: Image uploaded, not processing - Show original */}
      {imageUrl && !resultUrl && !isPolling && (
        <div className="w-full h-full flex flex-col">
          <div className="flex-1 flex items-center justify-center p-8">
            <img 
              src={imageUrl} 
              alt="Original" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            />
          </div>
          <div className="p-4 border-t bg-background/95 backdrop-blur">
            <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
              <Upload className="h-4 w-4" />
              Original Image • Ready to upscale {selectedFactor}x
            </p>
          </div>
        </div>
      )}
      
      {/* State 4: Result ready - Show upscaled image with actions */}
      {resultUrl && (
        <div className="w-full h-full flex flex-col">
          {/* Result Image */}
          <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-background to-muted/30">
            <img 
              src={resultUrl} 
              alt={`Upscaled ${selectedFactor}x`}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl ring-1 ring-primary/20"
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
                <p className="text-sm text-muted-foreground mt-1">
                  {uploadedFileName || "Enhanced Image"}
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
                data-testid="button-download-result"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button 
                onClick={handleCopyUrl}
                variant="outline"
                className="flex-1"
                size="lg"
                data-testid="button-copy-url"
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
        featureName="Image Upscaling"
      />
    </SidebarInset>
  );
}
