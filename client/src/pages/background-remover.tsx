import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Upload, Download, Copy, Check, Wand2, Library } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { PeerTubePreview } from "@/components/peertube-preview";
import { Link } from "wouter";

const BACKGROUND_REMOVER_COST = 3;

interface RemovalResult {
  id: string;
  status: string;
  resultUrl?: string;
  error?: string;
}

export default function BackgroundRemover() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);

  const currentCost = BACKGROUND_REMOVER_COST;
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
    const maxFileSize = 5 * 1024 * 1024; // 5MB as per API spec
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
        description: `File is ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 5MB.`,
        variant: "destructive",
      });
      return;
    }

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setBase64Image(base64);
      setImageUrl(base64);
      setResultUrl(null);
      setGenerationId(null);
    };
    reader.readAsDataURL(file);
  };

  const removalMutation = useMutation({
    mutationFn: async () => {
      if (!base64Image) {
        throw new Error("No image selected");
      }

      const userCredits = (user as any)?.credits;
      if (typeof userCredits === "number" && userCredits < currentCost) {
        throw new Error(`Insufficient credits. Need ${currentCost}, have ${userCredits}.`);
      }

      setResultUrl(null);

      const response: any = await apiRequest("POST", "/api/background-remover", {
        imageData: base64Image,
      });

      return response;
    },
    onSuccess: (data: any) => {
      setGenerationId(data.generationId);
      setIsPolling(true);
      toast({
        title: "Removing Background",
        description: "Your background is being removed. Please wait...",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Background Removal Failed",
        description: error.message || "Failed to remove background",
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
          title: "Background Removed",
          description: "Your background has been successfully removed!",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      } else if (data.status === "failed") {
        setIsPolling(false);
        toast({
          title: "Background Removal Failed",
          description: data.errorMessage || "An error occurred during background removal",
          variant: "destructive",
        });
      }

      return data;
    },
    enabled: isPolling && !!generationId,
    refetchInterval: isPolling ? 3000 : undefined,
  });

  const handleRemoveBackground = () => {
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
    removalMutation.mutate();
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = `background-removed-${Date.now()}.png`;
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
      description: "Image URL copied to clipboard",
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
        <CardTitle>Background Remover</CardTitle>
        <CardDescription>Remove backgrounds from your images with AI precision</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Image Upload */}
        <div className="space-y-3">
          <Label>Upload Image</Label>
          <label
            data-testid="background-remover-upload-area"
            className="flex flex-col items-center justify-center w-full px-4 py-8 border-2 border-dashed rounded-lg cursor-pointer hover-elevate transition-colors"
          >
            <div className="flex flex-col items-center justify-center">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">
                {uploadedFileName || "Click to upload or drag and drop"}
              </span>
              <span className="text-xs text-muted-foreground">
                PNG, JPG, WebP up to 5MB
              </span>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleImageUpload}
              className="hidden"
              data-testid="background-remover-file-input"
            />
          </label>
        </div>

        {/* Tips */}
        <div className="space-y-2 rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
            Tips & Best Practices
          </p>
          <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
            <li>• Use high-contrast images for best results</li>
            <li>• Supported formats: PNG, JPG, WebP</li>
            <li>• Maximum image size: 5MB</li>
            <li>• Works best with clear subject separation from background</li>
          </ul>
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
            <span className="text-muted-foreground">Removal Cost:</span>
            <span className="font-medium" data-testid="removal-cost-display">
              {currentCost} credits
            </span>
          </div>
          <div className="flex items-center justify-between text-sm pt-2 border-t">
            <span className="text-muted-foreground">After Removal:</span>
            <span className={`font-medium ${warningColors[warningLevel]}`} data-testid="credits-display-after">
              {creditsAfter.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={handleRemoveBackground}
          disabled={!imageUrl || removalMutation.isPending || isPolling}
          className="w-full"
          data-testid="button-remove-background"
        >
          {removalMutation.isPending || isPolling ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isPolling ? "Processing..." : "Starting..."}
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Remove Background
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );

  const preview = resultUrl ? (
    <div className="w-full sticky top-8">
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition duration-500" />
        
        <div className="relative bg-gradient-to-br from-[#0f0f1e]/95 via-[#0a0a15]/95 to-[#050510]/95 rounded-2xl border border-purple-500/20 overflow-hidden backdrop-blur-xl shadow-2xl shadow-purple-900/20">
          <div className="flex items-center justify-between px-6 py-4 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/20 to-transparent">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500 blur-md opacity-50" />
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Background Removed</h3>
                <p className="text-sm text-purple-300/70">Ready to download</p>
              </div>
            </div>
          </div>

          <div className="relative aspect-square bg-gradient-to-br from-[#0a0a15] to-[#050510] flex items-center justify-center p-4">
            <img
              src={resultUrl}
              alt="Background Removed"
              className="max-w-full max-h-full object-contain rounded-lg"
              data-testid="preview-removed-background"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050510]/80 via-transparent to-transparent pointer-events-none" />
          </div>

          <div className="px-6 py-4 border-t border-purple-500/20 space-y-3">
            <Button
              onClick={handleDownload}
              variant="default"
              className="w-full"
              data-testid="button-download-removed"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Image
            </Button>
            <Button
              onClick={handleCopyUrl}
              variant="outline"
              className="w-full"
              data-testid="button-copy-url"
            >
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copied!" : "Copy URL"}
            </Button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 text-sm text-purple-400/60">
        <Library className="w-4 h-4" />
        <Link href="/history" className="hover:text-purple-300 transition-colors">
          View all your creations in the Library
        </Link>
      </div>
    </div>
  ) : (
    <PeerTubePreview
      pageType="background-remover"
      title="Background Remover"
      description="See AI-powered background removal in action"
      showGeneratingMessage={isPolling || removalMutation.isPending}
    />
  );

  return (
    <SidebarInset>
      <ThreeColumnLayout form={form} preview={preview} />
      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="Background Removal"
      />
    </SidebarInset>
  );
}
