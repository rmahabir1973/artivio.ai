import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Video } from "lucide-react";

const VIDEO_MODELS = [
  { value: "veo-3.1", label: "Veo 3.1", cost: 500, description: "1080p videos with synchronized audio" },
  { value: "veo-3.1-fast", label: "Veo 3.1 Fast", cost: 300, description: "Faster, lower-cost rendering" },
  { value: "runway-aleph", label: "Runway Aleph", cost: 400, description: "Advanced scene reasoning and camera control" },
];

export default function GenerateVideo() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [model, setModel] = useState("veo-3.1");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState([5]);
  const [resolution, setResolution] = useState("1080p");

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
      return await apiRequest("POST", "/api/generate/video", data);
    },
    onSuccess: () => {
      toast({
        title: "Generation Started",
        description: "Your video is being generated. Check the history page for progress.",
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
        description: error.message || "Failed to generate video. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a description for your video.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      model,
      prompt,
      parameters: {
        duration: duration[0],
        resolution,
      },
    });
  };

  const selectedModel = VIDEO_MODELS.find(m => m.value === model);

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
          <Video className="h-10 w-10 text-primary" />
          Video Generation
        </h1>
        <p className="text-lg text-muted-foreground">
          Create stunning videos with AI-powered models
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Generation Settings</CardTitle>
            <CardDescription>Configure your video parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="model" data-testid="select-video-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_MODELS.map((m) => (
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
              <Label htmlFor="prompt">Video Description</Label>
              <Textarea
                id="prompt"
                placeholder="Describe the video you want to create... (e.g., 'A serene sunset over mountains with birds flying')"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                data-testid="input-video-prompt"
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">
                Duration: {duration[0]} seconds
              </Label>
              <Slider
                id="duration"
                min={3}
                max={30}
                step={1}
                value={duration}
                onValueChange={setDuration}
                data-testid="slider-duration"
              />
            </div>

            {/* Resolution */}
            <div className="space-y-2">
              <Label htmlFor="resolution">Resolution</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger id="resolution" data-testid="select-resolution">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="1080p">1080p</SelectItem>
                  <SelectItem value="4k">4K</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="w-full"
              size="lg"
              data-testid="button-generate-video"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>Generate Video ({selectedModel?.cost} credits)</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Model Comparison */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Available Models</h2>
          <div className="space-y-4">
            {VIDEO_MODELS.map((m) => (
              <Card key={m.value} className={model === m.value ? "border-primary" : ""}>
                <CardHeader>
                  <CardTitle className="text-lg">{m.label}</CardTitle>
                  <CardDescription>{m.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{m.cost}</span>
                    <span className="text-sm text-muted-foreground">credits per video</span>
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
