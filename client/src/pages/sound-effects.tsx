import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset } from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePricing } from "@/hooks/use-pricing";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Wand2, Download } from "lucide-react";
import { CreditCostWarning } from "@/components/credit-cost-warning";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { PreviewPanel } from "@/components/preview-panel";

const SOUND_EFFECTS_MODELS = [
  { value: "sound-effects-v1", label: "Sound Effects V1", description: "High-quality sound effect generation" },
];

export default function SoundEffects() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();
  const { markStepComplete } = useOnboarding();
  
  const [model, setModel] = useState("sound-effects-v1");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("5");
  const [generatedAudio, setGeneratedAudio] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const generateSoundEffectsMutation = useMutation({
    mutationFn: async () => {
      if (!description.trim()) {
        throw new Error("Please describe the sound effect you want to generate");
      }

      const response = await apiRequest("POST", "/api/generate/sound-effects", {
        model,
        description,
        duration: parseInt(duration),
      });

      return response;
    },
    onSuccess: (data) => {
      setGeneratedAudio(data);
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      markStepComplete("generate_content");
      toast({
        title: "Success",
        description: "Sound effect generated successfully!",
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/login";
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to generate sound effect",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    generateSoundEffectsMutation.mutate();
    setTimeout(() => setIsGenerating(false), 1000);
  };

  const modelCost = getModelCost(model, 5);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <SidebarInset>
      <ThreeColumnLayout
        leftPanel={
          <div className="space-y-6 p-4 md:p-6">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Generate Sound Effects</h2>
              <p className="text-sm text-muted-foreground">
                Describe the sound effect you want and let AI create it
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model" data-testid="select-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOUND_EFFECTS_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Describe the Sound Effect</Label>
                <Textarea
                  id="description"
                  data-testid="input-description"
                  placeholder="e.g., 'sci-fi laser gun sound', 'heavy rain with thunder', 'retro game beep sound'"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-24"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (seconds)</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger id="duration" data-testid="select-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 seconds</SelectItem>
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="10">10 seconds</SelectItem>
                    <SelectItem value="15">15 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <CreditCostWarning
                cost={modelCost}
                userCredits={user?.credits || 0}
                featureName="Sound effect generation"
              />

              <Button
                data-testid="button-generate"
                onClick={handleGenerate}
                disabled={!description.trim() || generateSoundEffectsMutation.isPending}
                className="w-full"
              >
                {generateSoundEffectsMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate Sound Effect
                  </>
                )}
              </Button>
            </div>
          </div>
        }
        rightPanel={
          <PreviewPanel
            state={
              isGenerating
                ? "generating"
                : generatedAudio
                  ? "completed"
                  : "idle"
            }
            content={
              generatedAudio ? (
                <div className="space-y-4">
                  {generatedAudio.audioUrl && (
                    <>
                      <audio
                        data-testid="audio-player"
                        controls
                        src={generatedAudio.audioUrl}
                        className="w-full"
                      />
                      <Button
                        data-testid="button-download"
                        variant="outline"
                        className="w-full"
                        asChild
                      >
                        <a href={generatedAudio.audioUrl} download>
                          <Download className="w-4 h-4 mr-2" />
                          Download Audio
                        </a>
                      </Button>
                    </>
                  )}
                </div>
              ) : null
            }
          />
        }
      />
    </SidebarInset>
  );
}
