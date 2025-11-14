import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePricing } from "@/hooks/use-pricing";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Music } from "lucide-react";

const MUSIC_MODEL_INFO = [
  { value: "suno-v3.5", label: "Suno V3.5", description: "High-quality music generation" },
  { value: "suno-v4", label: "Suno V4", description: "Enhanced vocals and richer sound" },
  { value: "suno-v4.5", label: "Suno V4.5", description: "Best quality, up to 8 minutes long" },
];

export default function GenerateMusic() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();
  
  const [model, setModel] = useState("suno-v4");
  const [prompt, setPrompt] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [duration, setDuration] = useState([120]); // in seconds
  const [genre, setGenre] = useState("pop");

  // Merge model info with dynamic pricing
  const MUSIC_MODELS = MUSIC_MODEL_INFO.map(m => ({
    ...m,
    cost: getModelCost(m.value, 200),
  }));

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
      return await apiRequest("POST", "/api/generate/music", data);
    },
    onSuccess: () => {
      toast({
        title: "Generation Started",
        description: "Your music is being generated. Check the history page for progress.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      setPrompt("");
      setLyrics("");
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
        description: error.message || "Failed to generate music. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a description for your music.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      model,
      prompt,
      parameters: {
        lyrics: lyrics.trim() || undefined,
        duration: duration[0],
        genre,
      },
    });
  };

  const selectedModel = MUSIC_MODELS.find(m => m.value === model);

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
          <Music className="h-10 w-10 text-primary" />
          Music Generation
        </h1>
        <p className="text-lg text-muted-foreground">
          Create original music with AI-powered Suno models
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Generation Settings</CardTitle>
            <CardDescription>Configure your music parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="model" data-testid="select-music-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MUSIC_MODELS.map((m) => (
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
              <Label htmlFor="prompt">Music Description</Label>
              <Textarea
                id="prompt"
                placeholder="Describe the music you want to create... (e.g., 'Upbeat electronic dance music with energetic drums')"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                data-testid="input-music-prompt"
              />
            </div>

            {/* Lyrics (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="lyrics">Lyrics (Optional)</Label>
              <Textarea
                id="lyrics"
                placeholder="Enter custom lyrics for your song (leave empty for instrumental)..."
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={6}
                data-testid="input-music-lyrics"
              />
            </div>

            {/* Genre */}
            <div className="space-y-2">
              <Label htmlFor="genre">Genre</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger id="genre" data-testid="select-genre">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pop">Pop</SelectItem>
                  <SelectItem value="rock">Rock</SelectItem>
                  <SelectItem value="electronic">Electronic</SelectItem>
                  <SelectItem value="jazz">Jazz</SelectItem>
                  <SelectItem value="classical">Classical</SelectItem>
                  <SelectItem value="hiphop">Hip Hop</SelectItem>
                  <SelectItem value="ambient">Ambient</SelectItem>
                  <SelectItem value="country">Country</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">
                Duration: {Math.floor(duration[0] / 60)}:{(duration[0] % 60).toString().padStart(2, '0')}
              </Label>
              <Slider
                id="duration"
                min={30}
                max={480}
                step={30}
                value={duration}
                onValueChange={setDuration}
                data-testid="slider-music-duration"
              />
              <p className="text-xs text-muted-foreground">
                Maximum duration depends on the selected model
              </p>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="w-full"
              size="lg"
              data-testid="button-generate-music"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>Generate Music ({selectedModel?.cost} credits)</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Model Comparison */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Available Models</h2>
          <div className="space-y-4">
            {MUSIC_MODELS.map((m) => (
              <Card key={m.value} className={model === m.value ? "border-primary" : ""}>
                <CardHeader>
                  <CardTitle className="text-lg">{m.label}</CardTitle>
                  <CardDescription>{m.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{m.cost}</span>
                    <span className="text-sm text-muted-foreground">credits per track</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-accent/50">
            <CardHeader>
              <CardTitle className="text-lg">Pro Tip</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                For best results with vocals, provide structured lyrics with verse/chorus/bridge sections.
              </p>
              <p className="text-sm">
                Instrumental tracks work great when you focus the prompt on mood, instruments, and tempo.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
