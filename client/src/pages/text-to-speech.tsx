import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { SidebarInset } from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { Volume2, Mic, Download, ChevronDown, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { VoiceClone } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GuestGenerateModal } from "@/components/guest-generate-modal";

// Pre-made ElevenLabs voices
const PREMADE_VOICES = [
  { id: "Rachel", name: "Rachel" },
  { id: "Aria", name: "Aria" },
  { id: "Clyde", name: "Clyde" },
  { id: "Dave", name: "Dave" },
  { id: "Drew", name: "Drew" },
  { id: "Fin", name: "Fin" },
  { id: "Freya", name: "Freya" },
  { id: "Gigi", name: "Gigi" },
  { id: "Glinda", name: "Glinda" },
  { id: "Harry", name: "Harry" },
];

const TTS_MODEL_INFO = [
  { value: "eleven_multilingual_v2", label: "Multilingual v2" },
  { value: "eleven_turbo_v2.5", label: "Turbo v2.5" },
];

export default function TextToSpeech() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { getModelCost } = usePricing();
  const [text, setText] = useState("");
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [voiceId, setVoiceId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [model, setModel] = useState<string>("eleven_multilingual_v2");
  const [stability, setStability] = useState([0.5]);
  const [similarityBoost, setSimilarityBoost] = useState([0.75]);
  const [style, setStyle] = useState([0.0]);
  const [speed, setSpeed] = useState([1.0]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Merge model info with dynamic pricing
  const TTS_MODELS = useMemo(() => TTS_MODEL_INFO.map(m => ({
    ...m,
    label: `${m.label} (${getModelCost(m.value, 20)} credits)`,
    credits: getModelCost(m.value, 20),
  })), [getModelCost]);

  // Fetch user's cloned voices
  const { data: clonedVoices = [] } = useQuery<VoiceClone[]>({
    queryKey: ["/api/voice-clones"],
  });

  // Generate TTS mutation
  const generateMutation = useMutation({
    mutationFn: async (params: {
      text: string;
      voiceId: string;
      voiceName?: string;
      model: string;
      parameters?: {
        stability?: number;
        similarityBoost?: number;
        style?: number;
        speed?: number;
      };
    }) => {
      return await apiRequest("POST", "/api/tts/generate", params);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "TTS generation started! Check your Generation History to access your audio file when complete.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tts/generations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate TTS",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    // Guest check - prompt sign up if not authenticated
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }

    if (!text.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter text to convert to speech.",
        variant: "destructive",
      });
      return;
    }

    if (!voiceId) {
      toast({
        title: "Validation Error",
        description: "Please select a voice.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      text: text.trim(),
      voiceId,
      voiceName,
      model,
      parameters: {
        stability: stability[0],
        similarityBoost: similarityBoost[0],
        style: style[0],
        speed: speed[0],
      },
    });
  };

  const handleVoiceSelect = (value: string) => {
    setVoiceId(value);
    
    // Find if it's a cloned voice or pre-made
    const clonedVoice = clonedVoices.find(v => v.voiceId === value);
    if (clonedVoice) {
      setVoiceName(clonedVoice.name);
    } else {
      const premadeVoice = PREMADE_VOICES.find(v => v.id === value);
      setVoiceName(premadeVoice?.name || value);
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  const selectedModel = TTS_MODELS.find(m => m.value === model);

  return (
    <SidebarInset>
      <div className="h-full overflow-y-auto">
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-heading">Text-to-Speech</h1>
        <p className="text-muted-foreground">Generate natural-sounding speech from text using AI voices</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generation Form */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Speech</CardTitle>
            <CardDescription>Convert your text to natural-sounding audio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Text Input */}
            <div className="space-y-2">
              <Label htmlFor="text-input">Text * (max 5000 characters)</Label>
              <Textarea
                id="text-input"
                data-testid="textarea-text-input"
                placeholder="Enter the text you want to convert to speech..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-32"
                maxLength={5000}
              />
              <p className="text-xs text-muted-foreground">{text.length} / 5000 characters</p>
            </div>

            {/* Voice Selection */}
            <div className="space-y-2">
              <Label htmlFor="voice-select">Voice *</Label>
              <Select value={voiceId} onValueChange={handleVoiceSelect}>
                <SelectTrigger id="voice-select" data-testid="select-voice">
                  <SelectValue placeholder="Select a voice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Pre-made Voices</SelectLabel>
                    {PREMADE_VOICES.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {clonedVoices.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Your Cloned Voices</SelectLabel>
                      {clonedVoices.filter(v => v.isActive).map((voice) => (
                        <SelectItem key={voice.voiceId} value={voice.voiceId}>
                          {voice.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="model-select">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="model-select" data-testid="select-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TTS_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Advanced Options Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              data-testid="button-toggle-advanced"
            >
              {showAdvanced ? "Hide" : "Show"} Advanced Options
            </Button>

            {showAdvanced && (
              <div className="space-y-4 p-4 border rounded-lg">
                {/* Stability */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Stability</Label>
                    <span className="text-sm text-muted-foreground">{stability[0].toFixed(2)}</span>
                  </div>
                  <Slider
                    value={stability}
                    onValueChange={setStability}
                    min={0}
                    max={1}
                    step={0.01}
                    data-testid="slider-stability"
                  />
                  <p className="text-xs text-muted-foreground">Higher values make output more consistent</p>
                </div>

                {/* Similarity Boost */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Similarity Boost</Label>
                    <span className="text-sm text-muted-foreground">{similarityBoost[0].toFixed(2)}</span>
                  </div>
                  <Slider
                    value={similarityBoost}
                    onValueChange={setSimilarityBoost}
                    min={0}
                    max={1}
                    step={0.01}
                    data-testid="slider-similarity"
                  />
                  <p className="text-xs text-muted-foreground">Higher values make output sound more like the selected voice</p>
                </div>

                {/* Style */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Style Exaggeration</Label>
                    <span className="text-sm text-muted-foreground">{style[0].toFixed(2)}</span>
                  </div>
                  <Slider
                    value={style}
                    onValueChange={setStyle}
                    min={0}
                    max={1}
                    step={0.01}
                    data-testid="slider-style"
                  />
                  <p className="text-xs text-muted-foreground">Higher values add more expressiveness</p>
                </div>

                {/* Speed */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Speed</Label>
                    <span className="text-sm text-muted-foreground">{speed[0].toFixed(1)}x</span>
                  </div>
                  <Slider
                    value={speed}
                    onValueChange={setSpeed}
                    min={0.7}
                    max={1.2}
                    step={0.1}
                    data-testid="slider-speed"
                  />
                  <p className="text-xs text-muted-foreground">Adjust playback speed (0.7x - 1.2x)</p>
                </div>
              </div>
            )}

            {/* Tips & Best Practices */}
            <Collapsible className="mt-6">
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full">
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Tips & Best Practices
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-3">
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Choose the Right Voice</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">Select voices based on tone and audience. Test different voices to find the best fit for your content.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Fine-tune Stability & Similarity</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">Higher stability (0.7-1.0) ensures consistent voice. Increase similarity (0.75+) for more natural reproductions of cloned voices.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Adjust Speaking Speed</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">Use 0.7-0.9x for dramatic effect, 1.0x for normal speech, and 1.1-1.2x for faster presentations.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Multilingual Support</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">The Multilingual v2 model supports 29+ languages. Test pronunciation on important terms beforehand.</p>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !text.trim() || !voiceId}
              className="w-full"
              data-testid="button-generate"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Volume2 className="mr-2 h-4 w-4" />
                  Generate Speech ({selectedModel?.credits || 20} credits)
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>How it Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Mic className="h-5 w-5 mt-0.5 text-primary" />
              <div>
                <h4 className="font-medium">Choose a Voice</h4>
                <p className="text-sm text-muted-foreground">
                  Select from pre-made voices or use your cloned voices
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Volume2 className="h-5 w-5 mt-0.5 text-primary" />
              <div>
                <h4 className="font-medium">Customize Settings</h4>
                <p className="text-sm text-muted-foreground">
                  Adjust stability, similarity, style, and speed for perfect results
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 mt-0.5 text-primary" />
              <div>
                <h4 className="font-medium">Download Audio</h4>
                <p className="text-sm text-muted-foreground">
                  Generated audio files are available for download
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

        </div>
      </div>
      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="Text to Speech"
      />
    </SidebarInset>
  );
}
