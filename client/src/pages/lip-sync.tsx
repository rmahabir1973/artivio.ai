import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Upload, Mic, Square, Play, Pause, Volume2, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SavedSeedsLibrary } from "@/components/SavedSeedsLibrary";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { PreviewPanel } from "@/components/preview-panel";
import type { Generation } from "@shared/schema";

export default function LipSync() {
  const { toast } = useToast();
  const { getModelCost } = usePricing();

  // Form state
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioFile, setAudioFile] = useState("");
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState("720p");
  const [seed, setSeed] = useState("");
  const [seedLocked, setSeedLocked] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [recordingVolume, setRecordingVolume] = useState(100);

  // Upload state
  const [uploading, setUploading] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Fetch generations
  const { data: generations = [], isLoading } = useQuery<Generation[]>({
    queryKey: ["/api/lip-sync/generations"],
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async (params: { imageUrl: string; audioUrl: string; prompt?: string; resolution: string; seed?: string }) => {
      return await apiRequest("POST", "/api/lip-sync/generate", params);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Lip sync generation started! Check below for updates." });
      queryClient.invalidateQueries({ queryKey: ["/api/lip-sync/generations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setImageUrl("");
      setImageFile("");
      setAudioUrl("");
      setAudioFile("");
      setRecordedAudio(null);
      setPrompt("");
      setRecordingTime(0);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to generate lip sync video", variant: "destructive" });
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid File", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Maximum image size is 10MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    setImageFile(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageUrl(event.target?.result as string);
      setUploading(false);
      toast({ title: "Image Loaded", description: `${file.name} ready for lip sync` });
    };
    reader.onerror = () => {
      setUploading(false);
      toast({ title: "Error", description: "Failed to read image file", variant: "destructive" });
    };
    reader.readAsDataURL(file);
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast({ title: "Invalid File", description: "Please upload an audio file.", variant: "destructive" });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Maximum audio size is 50MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    setAudioFile(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setAudioUrl(event.target?.result as string);
      setRecordedAudio(null);
      setUploading(false);
      toast({ title: "Audio Loaded", description: `${file.name} ready for lip sync` });
    };
    reader.onerror = () => {
      setUploading(false);
      toast({ title: "Error", description: "Failed to read audio file", variant: "destructive" });
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mp3" });
        const reader = new FileReader();
        reader.onload = () => {
          const audioData = reader.result as string;
          setRecordedAudio(audioData);
          setAudioUrl(audioData);
          setAudioFile("Voice Recording.mp3");
          toast({ title: "Recording Saved", description: "Your voice recording has been saved." });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to access microphone: " + error.message, variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  const playRecording = () => {
    if (audioPlayerRef.current) {
      if (isPlayingRecording) {
        audioPlayerRef.current.pause();
        setIsPlayingRecording(false);
      } else {
        audioPlayerRef.current.play();
        setIsPlayingRecording(true);
      }
    }
  };

  const clearRecording = () => {
    setRecordedAudio(null);
    setAudioUrl("");
    setAudioFile("");
    setRecordingTime(0);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    setIsPlayingRecording(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleGenerate = () => {
    if (!imageUrl) {
      toast({ title: "Validation Error", description: "Please upload an image.", variant: "destructive" });
      return;
    }
    if (!audioUrl) {
      toast({ title: "Validation Error", description: "Please upload or record audio.", variant: "destructive" });
      return;
    }
    generateMutation.mutate({ imageUrl, audioUrl, prompt: prompt || undefined, resolution, seed: seed || undefined });
  };

  const cost = resolution === "480p" ? getModelCost("infinitalk-lip-sync-480p", 15) : getModelCost("infinitalk-lip-sync-720p", 60);
  const completedGenerations = generations.filter((g) => g.status === "completed");
  const previewItem = completedGenerations[0];

  const formContent = (
    <Card>
      <CardHeader>
        <CardTitle>Create Lip Sync Video</CardTitle>
        <CardDescription>Upload image and audio, customize settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="image-file">Image *</Label>
          <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-2">
            <div>
              <Input id="image-file" type="file" accept="image/*" onChange={handleImageSelect} className="hidden" data-testid="input-image-file" />
              <Button variant="outline" size="sm" onClick={() => document.getElementById("image-file")?.click()} disabled={uploading} data-testid="button-upload-image">
                {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</> : <><Upload className="mr-2 h-4 w-4" />Choose Image</>}
              </Button>
            </div>
            {imageFile && <p className="text-sm text-muted-foreground">Selected: {imageFile}</p>}
            <p className="text-xs text-muted-foreground">PNG, JPG, WEBP (max 10MB)</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Audio *</Label>
          <Collapsible className="border rounded-lg p-3">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span>{audioFile || "Select audio source"}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">Upload Audio File</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Input type="file" accept="audio/*" onChange={handleAudioSelect} className="hidden" data-testid="input-audio-file" />
                  <Button variant="outline" size="sm" onClick={() => document.querySelector('input[data-testid="input-audio-file"]')?.dispatchEvent(new MouseEvent("click"))} disabled={uploading} data-testid="button-upload-audio">
                    <Upload className="mr-2 h-4 w-4" />Choose File
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">MP3, WAV, OGG (max 50MB)</p>
                </div>
              </div>

              <div className="space-y-2 border-t pt-3">
                <Label className="text-sm">Or Record Voice</Label>
                <div className="space-y-2">
                  {!isRecording && !recordedAudio && (
                    <Button onClick={startRecording} className="w-full" data-testid="button-start-recording">
                      <Mic className="mr-2 h-4 w-4" />Start Recording
                    </Button>
                  )}
                  {isRecording && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Recording: {formatTime(recordingTime)}</p>
                      <div className="flex gap-2">
                        <Button onClick={pauseRecording} size="sm" variant="outline" className="flex-1" data-testid="button-pause-recording">
                          {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        </Button>
                        <Button onClick={stopRecording} size="sm" variant="destructive" className="flex-1" data-testid="button-stop-recording">
                          <Square className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {recordedAudio && (
                    <div className="space-y-2 border rounded p-3">
                      <p className="text-xs font-medium">Recording: {formatTime(recordingTime)}</p>
                      <audio ref={audioPlayerRef} src={recordedAudio} onEnded={() => setIsPlayingRecording(false)} />
                      <div className="flex gap-2">
                        <Button onClick={playRecording} size="sm" variant="outline" className="flex-1" data-testid="button-play-recording">
                          {isPlayingRecording ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button onClick={clearRecording} size="sm" variant="destructive" className="flex-1" data-testid="button-clear-recording">Clear</Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4" />
                        <Slider value={[recordingVolume]} onValueChange={(val) => {
                          setRecordingVolume(val[0]);
                          if (audioPlayerRef.current) audioPlayerRef.current.volume = val[0] / 100;
                        }} min={0} max={100} className="flex-1" data-testid="slider-recording-volume" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt">Prompt (Optional)</Label>
          <Textarea id="prompt" placeholder="e.g., Smile naturally, speak clearly, maintain eye contact" value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, 5000))} maxLength={5000} rows={3} data-testid="input-prompt" />
          <p className="text-xs text-muted-foreground">{prompt.length}/5000 characters</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="resolution">Resolution</Label>
          <Select value={resolution} onValueChange={setResolution}>
            <SelectTrigger id="resolution" data-testid="select-resolution">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="480p">480p (15 credits)</SelectItem>
              <SelectItem value="720p">720p (60 credits)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="seed">Seed (Optional)</Label>
            <div className="flex items-center gap-2">
              <Switch id="seed-lock" checked={seedLocked} onCheckedChange={setSeedLocked} data-testid="toggle-seed-lock" />
              <span className="text-xs text-muted-foreground">{seedLocked ? "Locked" : "Unlocked"}</span>
            </div>
          </div>
          <Input id="seed" type="number" placeholder="Leave empty for random" value={seed} onChange={(e) => setSeed(e.target.value)} min="10000" max="1000000" disabled={seedLocked} data-testid="input-seed" />
          <p className="text-xs text-muted-foreground">Range: 10000 - 1000000</p>
          <SavedSeedsLibrary currentSeed={seed} onApplySeed={(appliedSeed) => {
            setSeed(appliedSeed);
            setSeedLocked(true);
          }} />
        </div>

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
                <CardTitle className="text-sm">Choose High-Quality Images</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-xs text-muted-foreground">Use clear, front-facing images with good lighting. Avoid glasses or extreme angles.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-sm">Clear Audio Quality</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-xs text-muted-foreground">Ensure audio is clear and well-synchronized. Avoid background noise and gaps.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-sm">Use Descriptive Prompts</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-xs text-muted-foreground">Provide guidance on expressions and tone for more natural results.</p>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        <div className="pt-4 border-t">
          <Button onClick={handleGenerate} disabled={generateMutation.isPending || !imageUrl || !audioUrl} className="w-full" data-testid="button-generate">
            {generateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : <>Generate ({cost} credits)</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const previewContent = (
    <PreviewPanel item={previewItem} type="video" isLoading={isLoading} isEmpty={generations.length === 0} emptyMessage="No lip-sync videos generated yet" />
  );

  return (
    <div className="space-y-6">
      <div className="container mx-auto p-6 max-w-7xl">
        <h1 className="text-3xl font-bold" data-testid="text-heading">
          InfiniteTalk Lip Sync
        </h1>
        <p className="text-muted-foreground">
          Create lip-synced videos from images and audio
        </p>
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            Transform static images into dynamic lip-synced videos with perfect audio synchronization. Upload your image and audio, and let AI handle the rest.
          </p>
          <p className="text-xs text-muted-foreground font-medium">
            Features: Perfect lip-sync • Audio-to-mouth animation • 480p & 720p quality • Custom prompts • Seed control
          </p>
        </div>
      </div>

      <ThreeColumnLayout form={formContent} preview={previewContent} />

      {generations.length > 0 && (
        <div className="container mx-auto p-6 max-w-7xl">
          <Card>
            <CardHeader>
              <CardTitle>Your Lip Sync Videos</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {generations.map((gen) => (
                    <Card key={gen.id} data-testid={`card-generation-${gen.id}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm line-clamp-1">Lip Sync Video</CardTitle>
                        <CardDescription className="text-xs">{new Date(gen.createdAt!).toLocaleDateString()}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {gen.status === "completed" && gen.resultUrl && (
                          <video src={gen.resultUrl} controls className="w-full rounded-lg aspect-video bg-black" data-testid={`video-result-${gen.id}`} />
                        )}
                        {gen.status === "processing" && (
                          <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin" />
                          </div>
                        )}
                        {gen.status === "failed" && (
                          <div className="w-full aspect-video bg-destructive/10 rounded-lg flex items-center justify-center text-destructive text-sm">
                            Generation Failed
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
