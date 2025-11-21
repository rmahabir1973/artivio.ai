import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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

const OUTPUT_FORMATS = [
  { value: "mp3_44100_128", label: "MP3 44.1kHz 128kbps (Recommended)" },
  { value: "mp3_44100_192", label: "MP3 44.1kHz 192kbps (High Quality)" },
  { value: "mp3_44100_96", label: "MP3 44.1kHz 96kbps" },
  { value: "mp3_44100_64", label: "MP3 44.1kHz 64kbps" },
  { value: "mp3_44100_32", label: "MP3 44.1kHz 32kbps" },
  { value: "mp3_22050_32", label: "MP3 22.05kHz 32kbps" },
  { value: "opus_48000_128", label: "Opus 48kHz 128kbps" },
  { value: "opus_48000_96", label: "Opus 48kHz 96kbps" },
  { value: "pcm_44100", label: "PCM 44.1kHz (Uncompressed)" },
  { value: "pcm_24000", label: "PCM 24kHz" },
];

export default function SoundEffects() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();
  const { markStepComplete } = useOnboarding();
  
  const model = "elevenlabs/sound-effect-v2";
  const [text, setText] = useState("");
  const [loop, setLoop] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>(5);
  const [promptInfluence, setPromptInfluence] = useState(0.3);
  const [outputFormat, setOutputFormat] = useState("mp3_44100_128");
  const [generatedAudio, setGeneratedAudio] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationId, setGenerationId] = useState<string | null>(null);

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

  // Poll for generation result when generationId is set
  const { data: pollData } = useQuery({
    queryKey: ["/api/generations", generationId],
    queryFn: async () => {
      if (!generationId) return null;
      const response = await apiRequest("GET", `/api/generations/${generationId}`);
      return response;
    },
    enabled: !!generationId && isGenerating,
    refetchInterval: 2000, // Poll every 2 seconds while generating
    refetchOnWindowFocus: false,
  });

  // Update generatedAudio when poll data arrives with resultUrl
  useEffect(() => {
    if (pollData?.resultUrl) {
      setGeneratedAudio(pollData);
      setIsGenerating(false);
    } else if (pollData?.status === 'failure') {
      setIsGenerating(false);
      toast({
        title: "Generation Failed",
        description: pollData?.errorMessage || "Failed to generate sound effect",
        variant: "destructive",
      });
    }
  }, [pollData, toast]);

  const generateSoundEffectsMutation = useMutation({
    mutationFn: async () => {
      if (!text.trim()) {
        throw new Error("Please describe the sound effect you want to generate");
      }

      const response = await apiRequest("POST", "/api/generate/sound-effects", {
        model,
        text,
        loop,
        duration_seconds: durationSeconds,
        prompt_influence: promptInfluence,
        output_format: outputFormat,
      });

      return response;
    },
    onSuccess: (data) => {
      setGenerationId(data.generationId);
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      markStepComplete("generate_content");
      toast({
        title: "Generation Started",
        description: "Your sound effect is being generated...",
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/login";
        return;
      }
      setIsGenerating(false);
      toast({
        title: "Generation Failed",
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

  const modelCost = getModelCost(model, durationSeconds || 5);

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
        form={
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Generate Sound Effects</h2>
              <p className="text-sm text-muted-foreground">
                Describe the sound effect you want and let AI create it
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="text">Describe the Sound Effect</Label>
                <Textarea
                  id="text"
                  data-testid="input-text"
                  placeholder="e.g., 'sci-fi laser gun sound', 'heavy rain with thunder', 'retro game beep sound'"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-24"
                />
                <p className="text-xs text-muted-foreground">
                  Up to 5000 characters. Describe the sound effect you want in detail.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (seconds, optional)</Label>
                <Input
                  id="duration"
                  data-testid="input-duration"
                  type="number"
                  min="0.5"
                  max="22"
                  step="0.1"
                  value={durationSeconds || ""}
                  onChange={(e) => setDurationSeconds(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="Auto (optimal duration)"
                />
                <p className="text-xs text-muted-foreground">
                  Range: 0.5 - 22 seconds. Leave empty for optimal duration.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="loop"
                  data-testid="checkbox-loop"
                  checked={loop}
                  onCheckedChange={(checked) => setLoop(checked as boolean)}
                />
                <Label htmlFor="loop" className="cursor-pointer">
                  Create loopable sound effect
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="promptInfluence">
                  Prompt Influence: {promptInfluence.toFixed(2)}
                </Label>
                <Slider
                  id="promptInfluence"
                  data-testid="slider-prompt-influence"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[promptInfluence]}
                  onValueChange={(value) => setPromptInfluence(value[0])}
                />
                <p className="text-xs text-muted-foreground">
                  How closely to follow the prompt (0-1). Higher = less variation.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="outputFormat">Output Format</Label>
                <Select value={outputFormat} onValueChange={setOutputFormat}>
                  <SelectTrigger id="outputFormat" data-testid="select-output-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTPUT_FORMATS.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <CreditCostWarning
                cost={modelCost}
                featureName="Sound effect generation"
              />

              <Button
                data-testid="button-generate"
                onClick={handleGenerate}
                disabled={!text.trim() || generateSoundEffectsMutation.isPending}
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
                    Generate Sound Effect ({modelCost} credits)
                  </>
                )}
              </Button>
            </div>
          </div>
        }
        preview={
          <PreviewPanel
            status={
              isGenerating
                ? "generating"
                : generatedAudio
                  ? "completed"
                  : "idle"
            }
            resultUrl={generatedAudio?.resultUrl}
            resultType="audio"
            errorMessage={generatedAudio?.errorMessage}
            onDownload={() => {
              if (generatedAudio?.resultUrl) {
                const url = generatedAudio.resultUrl;
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', '');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }
            }}
          />
        }
      />
    </SidebarInset>
  );
}
