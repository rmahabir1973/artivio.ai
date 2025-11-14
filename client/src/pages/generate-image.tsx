import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Image as ImageIcon } from "lucide-react";

const IMAGE_MODELS = [
  { value: "4o-image", label: "4o Image API", cost: 100, description: "High-fidelity visuals with accurate text rendering" },
  { value: "flux-kontext", label: "Flux Kontext", cost: 150, description: "Vivid scenes with strong subject consistency" },
  { value: "nano-banana", label: "Nano Banana", cost: 50, description: "Fast, precise image generation and editing" },
];

const ASPECT_RATIOS = [
  { value: "1:1", label: "Square (1:1)" },
  { value: "16:9", label: "Landscape (16:9)" },
  { value: "9:16", label: "Portrait (9:16)" },
  { value: "4:3", label: "Classic (4:3)" },
  { value: "3:4", label: "Portrait (3:4)" },
];

export default function GenerateImage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [model, setModel] = useState("4o-image");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [style, setStyle] = useState("realistic");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/generate/image", data);
    },
    onSuccess: () => {
      toast({
        title: "Generation Started",
        description: "Your image is being generated. Check the history page for progress.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      setPrompt("");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a description for your image.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      model,
      prompt,
      parameters: {
        aspectRatio,
        style,
      },
    });
  };

  const selectedModel = IMAGE_MODELS.find(m => m.value === model);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <ImageIcon className="h-10 w-10 text-primary" />
          Image Generation
        </h1>
        <p className="text-lg text-muted-foreground">
          Create high-quality images with AI-powered models
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Generation Settings</CardTitle>
            <CardDescription>Configure your image parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="model" data-testid="select-image-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label} ({m.cost} credits)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedModel && (
                <p className="text-sm text-muted-foreground">{selectedModel.description}</p>
              )}
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label htmlFor="prompt">Image Description</Label>
              <Textarea
                id="prompt"
                placeholder="Describe the image you want to create... (e.g., 'A majestic lion in an African savanna at golden hour')"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                data-testid="input-image-prompt"
              />
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-2">
              <Label htmlFor="aspectRatio">Aspect Ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger id="aspectRatio" data-testid="select-aspect-ratio">
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

            {/* Style */}
            <div className="space-y-2">
              <Label htmlFor="style">Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger id="style" data-testid="select-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realistic">Realistic</SelectItem>
                  <SelectItem value="artistic">Artistic</SelectItem>
                  <SelectItem value="anime">Anime</SelectItem>
                  <SelectItem value="cinematic">Cinematic</SelectItem>
                  <SelectItem value="abstract">Abstract</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="w-full"
              size="lg"
              data-testid="button-generate-image"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>Generate Image ({selectedModel?.cost} credits)</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Model Comparison */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Available Models</h2>
          <div className="space-y-4">
            {IMAGE_MODELS.map((m) => (
              <Card key={m.value} className={model === m.value ? "border-primary" : ""}>
                <CardHeader>
                  <CardTitle className="text-lg">{m.label}</CardTitle>
                  <CardDescription>{m.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{m.cost}</span>
                    <span className="text-sm text-muted-foreground">credits per image</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
