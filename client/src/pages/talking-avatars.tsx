import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Image as ImageIcon, Video, Upload, Mic, Square, Play, Pause, ChevronDown, Info, Clock } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SavedSeedsLibrary } from "@/components/SavedSeedsLibrary";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { PeerTubePreview } from "@/components/peertube-preview";

const MAX_AUDIO_DURATION = 15;

export default function TalkingAvatars() {
  const { toast } = useToast();
  const { getModelCost } = usePricing();
  const { isAuthenticated } = useAuth();
  const [showGuestModal, setShowGuestModal] = useState(false);

  const [sourceImage, setSourceImage] = useState("");
  const [imageFileName, setImageFileName] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioFile, setAudioFile] = useState("");
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [provider, setProvider] = useState("infinite-talk");
  const [quality, setQuality] = useState("480p");

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    setQuality(newProvider === "kling-ai" ? "720p" : "480p");
  };
  
  const [emotion, setEmotion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [seed, setSeed] = useState("");
  const [seedLocked, setSeedLocked] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const generateMutation = useMutation({
    mutationFn: async (params: {
      sourceImage: string;
      audioUrl: string;
      provider: string;
      parameters?: { quality?: string; emotion?: string; seed?: number };
    }) => {
      return await apiRequest("POST", "/api/avatar/generate", params);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Avatar generation started! Check your Library for updates.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/avatar/generations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      setSourceImage("");
      setImageFileName("");
      setAudioUrl("");
      setAudioFile("");
      setAudioDuration(null);
      setRecordedAudio(null);
      setEmotion("");
      setRecordingTime(0);
      if (!seedLocked) {
        setSeed("");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate avatar",
        variant: "destructive",
      });
    },
  });

  const checkAudioDuration = (audioDataUrl: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.src = audioDataUrl;
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };
      audio.onerror = () => {
        reject(new Error("Failed to load audio"));
      };
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Maximum image size is 10MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setImageFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      setSourceImage(event.target?.result as string);
      setUploading(false);
      toast({
        title: "Image Loaded",
        description: `${file.name} ready for avatar generation`,
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
  };

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    reader.onload = async (event) => {
      const audioData = event.target?.result as string;
      
      try {
        const duration = await checkAudioDuration(audioData);
        if (duration > MAX_AUDIO_DURATION) {
          toast({ 
            title: "Audio Too Long", 
            description: `Maximum audio duration is ${MAX_AUDIO_DURATION} seconds. Your audio is ${Math.round(duration)} seconds.`, 
            variant: "destructive" 
          });
          setUploading(false);
          setAudioFile("");
          return;
        }
        
        setAudioDuration(duration);
        setAudioUrl(audioData);
        setRecordedAudio(null);
        setUploading(false);
        toast({ title: "Audio Loaded", description: `${file.name} (${Math.round(duration)}s) ready for avatar` });
      } catch {
        setUploading(false);
        toast({ title: "Error", description: "Failed to read audio file", variant: "destructive" });
      }
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
      const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        const reader = new FileReader();
        reader.onload = async () => {
          const audioData = reader.result as string;
          
          try {
            const duration = await checkAudioDuration(audioData);
            if (duration > MAX_AUDIO_DURATION) {
              toast({ 
                title: "Recording Too Long", 
                description: `Maximum audio duration is ${MAX_AUDIO_DURATION} seconds. Your recording is ${Math.round(duration)} seconds.`, 
                variant: "destructive" 
              });
              return;
            }
            
            setAudioDuration(duration);
            setRecordedAudio(audioData);
            setAudioUrl(audioData);
            const ext = actualMimeType.includes('webm') ? 'webm' : actualMimeType.includes('ogg') ? 'ogg' : 'mp4';
            setAudioFile(`Voice Recording.${ext}`);
            toast({ title: "Recording Saved", description: `Your voice recording (${Math.round(duration)}s) has been saved.` });
          } catch {
            toast({ title: "Error", description: "Failed to process recording", variant: "destructive" });
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= MAX_AUDIO_DURATION - 1) {
            toast({
              title: "Recording Complete",
              description: `Maximum recording duration of ${MAX_AUDIO_DURATION} seconds reached.`,
            });
            stopRecording();
            return MAX_AUDIO_DURATION;
          }
          return newTime;
        });
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
    setAudioDuration(null);
    setRecordingTime(0);
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

    if (!sourceImage) {
      toast({
        title: "Validation Error",
        description: "Please upload an image.",
        variant: "destructive",
      });
      return;
    }

    if (!audioUrl) {
      toast({
        title: "Validation Error",
        description: "Please upload or record audio.",
        variant: "destructive",
      });
      return;
    }

    if (audioDuration === null) {
      toast({
        title: "Validation Error",
        description: "Audio duration could not be determined. Please re-upload or re-record.",
        variant: "destructive",
      });
      return;
    }

    if (audioDuration > MAX_AUDIO_DURATION) {
      toast({
        title: "Validation Error",
        description: `Audio duration exceeds maximum of ${MAX_AUDIO_DURATION} seconds.`,
        variant: "destructive",
      });
      return;
    }

    if (provider === "infinite-talk" && seed) {
      const seedNum = parseInt(seed, 10);
      if (isNaN(seedNum) || seedNum < 10000 || seedNum > 1000000) {
        toast({
          title: "Validation Error",
          description: "Seed must be between 10000 and 1000000.",
          variant: "destructive",
        });
        return;
      }
    }

    generateMutation.mutate({
      sourceImage,
      audioUrl,
      provider,
      parameters: {
        quality,
        emotion: emotion || undefined,
        seed: provider === "infinite-talk" && seed ? parseInt(seed, 10) : undefined,
      },
    });
  };

  const cost = provider === "kling-ai" ? getModelCost("kling-ai", 350) : getModelCost("infinite-talk", 300);

  const formContent = (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-heading">AI Talking Avatars</h1>
        <p className="text-muted-foreground">Transform static images into dynamic talking avatars</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Avatar</CardTitle>
          <CardDescription>Upload an image and provide audio (max {MAX_AUDIO_DURATION}s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="image-file">Avatar Image *</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-2">
              <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground" />
              <div>
                <Input
                  id="image-file"
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  data-testid="input-image-file"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("image-file")?.click()}
                  disabled={uploading}
                  data-testid="button-upload-image"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Choose Image
                    </>
                  )}
                </Button>
              </div>
              {imageFileName && <p className="text-sm text-muted-foreground">Selected: {imageFileName}</p>}
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP (max 10MB)</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Audio * (max {MAX_AUDIO_DURATION}s)</Label>
              {audioDuration !== null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {Math.round(audioDuration)}s
                </span>
              )}
            </div>
            <div className="border-2 border-dashed rounded-lg p-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioSelect}
                  className="hidden"
                  data-testid="input-audio-file"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.querySelector<HTMLInputElement>('input[data-testid="input-audio-file"]')?.click()}
                  disabled={uploading || isRecording}
                  data-testid="button-upload-audio"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Audio
                </Button>

                {!isRecording ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startRecording}
                    disabled={uploading}
                    data-testid="button-start-recording"
                  >
                    <Mic className="mr-2 h-4 w-4" />
                    Record Voice
                  </Button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={pauseRecording}
                      data-testid="button-pause-recording"
                    >
                      {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={stopRecording}
                      data-testid="button-stop-recording"
                    >
                      <Square className="mr-2 h-4 w-4" />
                      Stop ({formatTime(recordingTime)}/{formatTime(MAX_AUDIO_DURATION)})
                    </Button>
                  </div>
                )}
              </div>

              {audioFile && (
                <div className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="text-sm truncate flex items-center gap-2">
                    {audioFile}
                    {audioDuration !== null && (
                      <span className="text-xs text-muted-foreground">({Math.round(audioDuration)}s)</span>
                    )}
                  </span>
                  <div className="flex gap-2">
                    {recordedAudio && (
                      <>
                        <audio ref={audioPlayerRef} src={recordedAudio} onEnded={() => setIsPlayingRecording(false)} />
                        <Button variant="ghost" size="sm" onClick={playRecording}>
                          {isPlayingRecording ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={clearRecording}>
                      Clear
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Upload an audio file (MP3, WAV, M4A) or record your voice directly. The avatar will lip-sync to your audio.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger id="provider" data-testid="select-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="infinite-talk">Infinite Talk ({getModelCost("infinite-talk", 300)} credits)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quality">Quality</Label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger id="quality" data-testid="select-quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="480p">480p</SelectItem>
                  <SelectItem value="720p">720p</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emotion">Emotion/Style (Optional)</Label>
            <Input
              id="emotion"
              placeholder="e.g., professional, enthusiastic, friendly"
              value={emotion}
              onChange={(e) => setEmotion(e.target.value)}
              data-testid="input-emotion"
            />
          </div>

          {provider === "infinite-talk" && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="seed">Seed (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="seed-lock"
                    checked={seedLocked}
                    onCheckedChange={setSeedLocked}
                    data-testid="toggle-seed-lock"
                  />
                  <span className="text-xs text-muted-foreground">{seedLocked ? "Locked" : "Unlocked"}</span>
                </div>
              </div>
              <Input
                id="seed"
                type="number"
                placeholder="Leave empty for random"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                min="10000"
                max="1000000"
                disabled={seedLocked}
                data-testid="input-seed"
              />
              <p className="text-xs text-muted-foreground">Range: 10000 - 1000000. Use a seed to reproduce the same result.</p>
              <SavedSeedsLibrary
                currentSeed={seed ? parseInt(seed, 10) : undefined}
                onApplySeed={(appliedSeed: number) => {
                  setSeed(appliedSeed.toString());
                  setSeedLocked(true);
                }}
              />
            </div>
          )}

          <Collapsible className="mt-4">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full">
                <Info className="mr-2 h-4 w-4" />
                About Talking Avatars
                <ChevronDown className="ml-auto h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-3">
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h4 className="font-medium">Features</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    Convert static images into dynamic talking videos
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    Upload audio or record your voice directly
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    Customize emotion and style for natural expressions
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    Support for 480p, 720p, and 1080p video quality
                  </li>
                </ul>
                <div className="pt-2 border-t">
                  <p className="text-sm">
                    <strong>Tip:</strong> For text-to-speech, use our Text to Speech tool first to generate audio, then upload it here!
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <strong>Costs:</strong> Kling AI - {getModelCost("kling-ai", 350)} credits | Infinite Talk - {getModelCost("infinite-talk", 300)} credits
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full">
                <ChevronDown className="mr-2 h-4 w-4" />
                Tips & Best Practices
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-3">
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-sm">Choose High-Quality Source Images</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground">Use clear, front-facing images with good lighting. Avoid glasses, heavy makeup, or extreme angles for best results.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-sm">Audio Quality Matters</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground">Record in a quiet environment or upload high-quality audio files. Clear audio produces better lip-sync results.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-sm">Pick the Right Provider</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground">Infinite Talk is recommended for reliable results. Kling AI offers high quality but may have availability issues.</p>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !sourceImage || !audioUrl}
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
                <Video className="mr-2 h-4 w-4" />
                Generate Avatar ({cost} credits)
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="Talking Avatars"
      />
    </div>
  );

  return (
    <ThreeColumnLayout
      form={formContent}
      preview={
        <PeerTubePreview
          pageType="talking-avatar"
          title="Talking Avatar Preview"
          description="See AI avatars come to life"
          showGeneratingMessage={generateMutation.isPending}
        />
      }
      showPreview={true}
    />
  );
}
