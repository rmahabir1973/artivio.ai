import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Upload, Mic, Square, Play, Pause, Volume2, ChevronDown, AlertTriangle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SavedSeedsLibrary } from "@/components/SavedSeedsLibrary";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { PeerTubePreview } from "@/components/peertube-preview";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import type { Generation } from "@shared/schema";
import { GenerationProgress } from "@/components/generation-progress";
import { SidebarInset } from "@/components/ui/sidebar";

const MAX_AUDIO_DURATION = 15; // Maximum audio duration in seconds

export default function LipSync() {
  const { toast } = useToast();
  const { getModelCost } = usePricing();
  const { isAuthenticated } = useAuth();
  const [showGuestModal, setShowGuestModal] = useState(false);

  // Form state
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioFile, setAudioFile] = useState("");
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
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
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Fetch generations
  const { data: generations = [], isLoading } = useQuery<Generation[]>({
    queryKey: ["/api/lip-sync/generations"],
    enabled: isAuthenticated,
  });

  // Reset isGenerating when generation completes
  useEffect(() => {
    if (isGenerating && generations.length > 0) {
      const latestGeneration = generations[0];
      if (latestGeneration?.status === "completed" || latestGeneration?.status === "failed") {
        setIsGenerating(false);
      }
    }
  }, [isGenerating, generations]);

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async (params: { imageUrl: string; audioUrl: string; prompt?: string; resolution: string; seed?: string }) => {
      return await apiRequest("POST", "/api/lip-sync/generate", params);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Lip sync generation started! Check below for updates." });
      queryClient.invalidateQueries({ queryKey: ["/api/lip-sync/generations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setIsGenerating(true);
      setImageUrl("");
      setImageFile("");
      setAudioUrl("");
      setAudioFile("");
      setRecordedAudio(null);
      setPrompt("");
      setRecordingTime(0);
      setAudioDuration(null);
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
    
    // Check audio duration before accepting
    const audioElement = new Audio();
    audioElement.src = URL.createObjectURL(file);
    audioElement.onloadedmetadata = () => {
      const duration = audioElement.duration;
      URL.revokeObjectURL(audioElement.src);
      
      if (duration > MAX_AUDIO_DURATION) {
        setUploading(false);
        setAudioFile("");
        setAudioDuration(null);
        toast({ 
          title: "Audio Too Long", 
          description: `Audio must be ${MAX_AUDIO_DURATION} seconds or less. Your audio is ${Math.round(duration)} seconds.`, 
          variant: "destructive" 
        });
        return;
      }
      
      setAudioDuration(duration);
      const reader = new FileReader();
      reader.onload = (event) => {
        setAudioUrl(event.target?.result as string);
        setRecordedAudio(null);
        setUploading(false);
        toast({ title: "Audio Loaded", description: `${file.name} (${Math.round(duration)}s) ready for lip sync` });
      };
      reader.onerror = () => {
        setUploading(false);
        toast({ title: "Error", description: "Failed to read audio file", variant: "destructive" });
      };
      reader.readAsDataURL(file);
    };
    audioElement.onerror = () => {
      setUploading(false);
      toast({ title: "Error", description: "Failed to load audio file", variant: "destructive" });
    };
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine the best supported MIME type for recording
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }
      
      const mediaRecorder = selectedMimeType 
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);
      
      // Store the actual MIME type being used
      const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        // Use the actual MIME type from the recorder
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        const reader = new FileReader();
        reader.onload = () => {
          const audioData = reader.result as string;
          setRecordedAudio(audioData);
          setAudioUrl(audioData);
          // Use appropriate extension based on MIME type
          const ext = actualMimeType.includes('webm') ? 'webm' : actualMimeType.includes('ogg') ? 'ogg' : 'mp4';
          setAudioFile(`Voice Recording.${ext}`);
          toast({ title: "Recording Saved", description: "Your voice recording has been saved." });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setAudioDuration(null);
      
      let currentTime = 0;
      timerIntervalRef.current = window.setInterval(() => {
        currentTime += 1;
        setRecordingTime(currentTime);
        setAudioDuration(currentTime);
        
        // Auto-stop at max duration
        if (currentTime >= MAX_AUDIO_DURATION) {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            toast({ 
              title: "Recording Stopped", 
              description: `Maximum recording length is ${MAX_AUDIO_DURATION} seconds.`,
              variant: "default"
            });
          }
        }
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
    setAudioDuration(null);
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
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }

    if (!imageUrl) {
      toast({ title: "Validation Error", description: "Please upload an image.", variant: "destructive" });
      return;
    }
    if (!audioUrl) {
      toast({ title: "Validation Error", description: "Please upload or record audio.", variant: "destructive" });
      return;
    }
    if (audioDuration && audioDuration > MAX_AUDIO_DURATION) {
      toast({ 
        title: "Audio Too Long", 
        description: `Audio must be ${MAX_AUDIO_DURATION} seconds or less. Please use shorter audio.`, 
        variant: "destructive" 
      });
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
        <Alert variant="default" className="border-amber-500 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-sm">
            <span className="font-bold text-amber-600 dark:text-amber-400">
              Maximum audio length: {MAX_AUDIO_DURATION} seconds
            </span>
            <span className="text-muted-foreground ml-1">
              — Audio exceeding this limit will be rejected.
            </span>
          </AlertDescription>
        </Alert>
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
          <SavedSeedsLibrary currentSeed={seed ? parseInt(seed, 10) : 0} onApplySeed={(appliedSeed) => {
            setSeed(String(appliedSeed));
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
          
          {/* Generation Progress */}
          <GenerationProgress
            isActive={isGenerating}
            modelId="lip-sync"
            generationType="lip-sync"
          />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <SidebarInset>
      <ThreeColumnLayout 
        form={formContent} 
        preview={
          <PeerTubePreview
            pageType="lip-sync"
            title="Lip Sync Preview"
            description="See what's possible with AI lip sync"
            showGeneratingMessage={generateMutation.isPending || isGenerating}
          />
        }
      />
      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="Lip Sync"
      />
    </SidebarInset>
  );
}
