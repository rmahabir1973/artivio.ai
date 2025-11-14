import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { Loader2, Image as ImageIcon, Upload, Sparkles, Clock } from "lucide-react";
import type { ImageAnalysis } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AnalyzeImage() {
  const { toast } = useToast();
  const { getModelCost } = usePricing();
  const [imageFile, setImageFile] = useState<string>("");
  const [imageFileName, setImageFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const cost = getModelCost("gpt-4o", 20);

  // Fetch image analyses
  const { data: analyses = [], isLoading } = useQuery<ImageAnalysis[]>({
    queryKey: ["/api/image-analysis/results"],
  });

  // Analyze mutation
  const analyzeMutation = useMutation({
    mutationFn: async (params: {
      image: string;
      prompt?: string;
      model: string;
      idempotencyKey: string;
    }) => {
      console.log('[Image Analysis] Starting analysis request...');
      console.log('[Image Analysis] Params:', {
        imageLength: params.image?.length,
        prompt: params.prompt,
        model: params.model,
        idempotencyKey: params.idempotencyKey,
      });
      return await apiRequest("POST", "/api/image-analysis/analyze", params);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Image analyzed successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/image-analysis/results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Reset form
      setImageFile("");
      setImageFileName("");
      setCustomPrompt("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to analyze image",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 10MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setImageFileName(file.name);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setImageFile(base64);
        setUploading(false);
        toast({
          title: "Image Loaded",
          description: `${file.name} ready for analysis`,
        });
      };
      reader.onerror = () => {
        setUploading(false);
        toast({
          title: "Error",
          description: "Failed to read image file",
          variant: "destructive",
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setUploading(false);
      toast({
        title: "Error",
        description: "Failed to process image file",
        variant: "destructive",
      });
    }
  };

  const handleAnalyze = () => {
    if (!imageFile) {
      toast({
        title: "Validation Error",
        description: "Please upload an image first.",
        variant: "destructive",
      });
      return;
    }

    // Generate idempotency key to prevent double-charging on retries
    const idempotencyKey = crypto.randomUUID();

    analyzeMutation.mutate({
      image: imageFile,
      prompt: customPrompt || undefined,
      model: "gpt-4o",
      idempotencyKey,
    });
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-heading">Image Analysis</h1>
        <p className="text-muted-foreground">Upload an image and get AI-powered detailed analysis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Image</CardTitle>
            <CardDescription>Upload an image to analyze (max 10MB). Cost: {cost} credits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Image File Upload */}
            <div className="space-y-2">
              <Label htmlFor="image-file">Image File *</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-2">
                <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground" />
                <div>
                  <Input
                    id="image-file"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-image-file"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("image-file")?.click()}
                    disabled={uploading}
                    data-testid="button-select-image"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "Loading..." : "Select Image"}
                  </Button>
                  {imageFileName && (
                    <p className="mt-2 text-sm text-muted-foreground">{imageFileName}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Image Preview */}
            {imageFile && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <img
                  src={imageFile}
                  alt="Preview"
                  className="w-full h-64 object-contain rounded-lg border"
                  data-testid="img-preview"
                />
              </div>
            )}

            {/* Custom Prompt (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="custom-prompt">Custom Question (Optional)</Label>
              <Textarea
                id="custom-prompt"
                placeholder="e.g., 'Describe the emotions in this image' or 'What objects are visible?'"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="resize-none"
                rows={3}
                maxLength={500}
                data-testid="textarea-custom-prompt"
              />
              <p className="text-xs text-muted-foreground">
                {customPrompt.length}/500 characters. Leave blank for comprehensive analysis.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleAnalyze}
              disabled={!imageFile || analyzeMutation.isPending}
              className="w-full"
              data-testid="button-analyze"
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyze Image ({cost} credits)
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>Powered by GPT-4o Vision</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">What can it analyze?</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Main subjects and their actions</li>
                <li>Setting and environment details</li>
                <li>Objects, colors, and composition</li>
                <li>Text visible in the image (OCR)</li>
                <li>Mood, atmosphere, and emotions</li>
                <li>Artistic style and techniques</li>
              </ul>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Cost:</strong> {cost} credits per analysis
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results History */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis History</CardTitle>
          <CardDescription>Your recent image analyses</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8" data-testid="loader-history">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : analyses.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground" data-testid="text-no-analyses">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No analyses yet. Upload an image to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {analyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className="border rounded-lg p-4 space-y-3 hover-elevate"
                  data-testid={`card-analysis-${analysis.id}`}
                >
                  <div className="flex items-start gap-4">
                    {analysis.imageUrl && (
                      <img
                        src={analysis.imageUrl}
                        alt="Analyzed"
                        className="w-24 h-24 object-cover rounded border"
                        data-testid={`img-analyzed-${analysis.id}`}
                      />
                    )}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(analysis.createdAt)}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          analysis.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          analysis.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                          'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        }`} data-testid={`status-${analysis.id}`}>
                          {analysis.status}
                        </span>
                      </div>
                      {analysis.analysisPrompt && (
                        <div className="text-sm">
                          <span className="font-semibold">Question:</span> {analysis.analysisPrompt}
                        </div>
                      )}
                      {analysis.status === 'completed' && analysis.analysisResult && (
                        <div className="text-sm bg-muted p-3 rounded">
                          <span className="font-semibold block mb-1">Analysis:</span>
                          <p className="whitespace-pre-wrap" data-testid={`text-analysis-${analysis.id}`}>
                            {typeof analysis.analysisResult === 'string' 
                              ? analysis.analysisResult 
                              : (analysis.analysisResult as any)?.text || JSON.stringify(analysis.analysisResult)}
                          </p>
                        </div>
                      )}
                      {analysis.status === 'failed' && (
                        <div className="text-sm text-red-600 dark:text-red-400">
                          Error: {analysis.errorMessage || 'Analysis failed'}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{analysis.model} • {analysis.creditsCost} credits</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
