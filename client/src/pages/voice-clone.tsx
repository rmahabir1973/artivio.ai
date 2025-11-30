import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarInset } from "@/components/ui/sidebar";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { 
  Loader2, 
  Mic, 
  Upload, 
  Trash2, 
  Square, 
  Play, 
  Pause, 
  Globe, 
  Link, 
  Lock, 
  Image as ImageIcon,
  X,
  Plus,
  Zap,
  ChevronRight,
  ChevronLeft,
  Clock,
  CheckCircle2
} from "lucide-react";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { PeerTubePreview } from "@/components/peertube-preview";

const SAMPLE_TEXT = `Please read this sample text aloud in a natural, conversational tone. Speak clearly and at a comfortable pace. 

Try to express different emotions as you read - feel excited when sharing good news, thoughtful when pondering questions, and calm during descriptive passages.

The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet, making it perfect for voice training.

For the best results, record at least 30 seconds of clear audio. More audio typically means better voice quality!`;

const MIN_DURATION = 10;
const GOOD_DURATION = 30;
const MAX_DURATION = 90;

interface MyVoice {
  voiceId: string;
  name: string;
  description?: string;
  isActive: boolean;
  provider: string;
  createdAt: string;
}

type Visibility = 'public' | 'unlist' | 'private';

export default function VoiceClone() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();
  
  const [step, setStep] = useState(1);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [audioFile, setAudioFile] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const recordingTimeRef = useRef(0);

  const { data: myVoices = [], isLoading: voicesLoading } = useQuery<MyVoice[]>({
    queryKey: ["/api/fish-audio/my-voices"],
    enabled: isAuthenticated,
  });

  const cloneMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      visibility: Visibility;
      tags: string[];
      audioFiles: string[];
      texts?: string[];
    }) => {
      return await apiRequest("POST", "/api/fish-audio/voice-clone", data);
    },
    onSuccess: () => {
      toast({
        title: "Voice Created Successfully",
        description: "Your voice model is being trained and will be ready shortly!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/fish-audio/my-voices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      resetForm();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Voice Creation Failed",
        description: error.message || "Failed to create voice. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      return await apiRequest("DELETE", `/api/fish-audio/voices/${voiceId}`);
    },
    onSuccess: () => {
      toast({
        title: "Voice Deleted",
        description: "Voice has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/fish-audio/my-voices"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete voice.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setStep(1);
    setVisibility('private');
    setCoverImage(null);
    setCoverImageFile(null);
    setName("");
    setDescription("");
    setTags([]);
    setTagInput("");
    setAudioFile(null);
    setAudioDuration(0);
    setRecordedAudio(null);
    setRecordingTime(0);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast({
        title: "Image Too Large",
        description: "Cover image must be less than 1MB.",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    setCoverImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setCoverImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 10) {
      setTags([...tags, trimmedTag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 32 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Audio file must be less than 32MB.",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an audio file.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const audio = new Audio(dataUrl);
      audio.addEventListener('loadedmetadata', () => {
        setAudioDuration(Math.floor(audio.duration));
        setAudioFile(dataUrl);
        setRecordedAudio(null);
        setRecordingTime(0);
        setUploading(false);
      });
      audio.addEventListener('error', () => {
        toast({
          title: "Audio Error",
          description: "Could not load audio file.",
          variant: "destructive",
        });
        setUploading(false);
      });
    } catch {
      toast({
        title: "Upload Failed",
        description: "Failed to process audio file.",
        variant: "destructive",
      });
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingTimeRef.current = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalDuration = recordingTimeRef.current;
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudio(audioUrl);
        
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioFile(reader.result as string);
          setAudioDuration(finalDuration);
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach(track => track.stop());
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = window.setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= MAX_DURATION) {
            stopRecording();
            return prev;
          }
          return newTime;
        });
      }, 1000);
    } catch {
      toast({
        title: "Recording Failed",
        description: "Unable to access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
  };

  const discardRecording = () => {
    if (isRecording) {
      stopRecording();
    }
    setRecordedAudio(null);
    setAudioFile(null);
    setRecordingTime(0);
    setAudioDuration(0);
    recordingTimeRef.current = 0;
    audioChunksRef.current = [];
  };

  const playRecording = () => {
    if (recordedAudio) {
      const audio = new Audio(recordedAudio);
      audioPlayerRef.current = audio;
      audio.play();
      setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
    }
  };

  const pausePlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDurationStatus = () => {
    if (audioDuration < MIN_DURATION) return { status: 'short', color: 'text-destructive' };
    if (audioDuration < GOOD_DURATION) return { status: 'minimum', color: 'text-yellow-500' };
    if (audioDuration <= MAX_DURATION) return { status: 'good', color: 'text-green-500' };
    return { status: 'too long', color: 'text-destructive' };
  };

  const getDurationProgress = () => {
    return Math.min((audioDuration / MAX_DURATION) * 100, 100);
  };

  const handleCreate = () => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }

    if (!name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your voice.",
        variant: "destructive",
      });
      setStep(1);
      return;
    }

    if (!audioFile) {
      toast({
        title: "Audio Required",
        description: "Please upload or record audio for voice cloning.",
        variant: "destructive",
      });
      return;
    }

    if (audioDuration < MIN_DURATION) {
      toast({
        title: "Audio Too Short",
        description: `Audio must be at least ${MIN_DURATION} seconds. Current: ${audioDuration}s`,
        variant: "destructive",
      });
      return;
    }

    cloneMutation.mutate({
      title: name.trim(),
      description: description.trim() || undefined,
      visibility,
      tags,
      audioFiles: [audioFile],
    });
  };

  const handleDeleteVoice = (voiceId: string, voiceName: string) => {
    if (confirm(`Are you sure you want to delete "${voiceName}"?`)) {
      deleteMutation.mutate(voiceId);
    }
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const cost = getModelCost("fish-audio-voice-clone", 500);

  const formContent = (
    <>
      <Card>
      <CardHeader className="pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${step === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        1
                      </div>
                      <span className={step === 1 ? 'font-semibold' : 'text-muted-foreground'}>Voice Details</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        2
                      </div>
                      <span className={step === 2 ? 'font-semibold' : 'text-muted-foreground'}>Audio Samples</span>
                    </div>
                    <Badge variant="secondary" className="gap-1">
                      <Zap className="h-3 w-3" />
                      Instant
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {step === 1 && (
                    <>
                      <div className="space-y-3">
                        <Label>Visibility</Label>
                        <div className="flex gap-2">
                          <Button
                            variant={visibility === 'public' ? 'default' : 'outline'}
                            onClick={() => setVisibility('public')}
                            className="flex-1"
                            data-testid="button-visibility-public"
                          >
                            <Globe className="h-4 w-4 mr-2" />
                            Public
                          </Button>
                          <Button
                            variant={visibility === 'unlist' ? 'default' : 'outline'}
                            onClick={() => setVisibility('unlist')}
                            className="flex-1"
                            data-testid="button-visibility-unlisted"
                          >
                            <Link className="h-4 w-4 mr-2" />
                            Unlisted
                          </Button>
                          <Button
                            variant={visibility === 'private' ? 'default' : 'outline'}
                            onClick={() => setVisibility('private')}
                            className="flex-1"
                            data-testid="button-visibility-private"
                          >
                            <Lock className="h-4 w-4 mr-2" />
                            Private
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label>Cover Image (Optional)</Label>
                        <div 
                          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover-elevate"
                          onClick={() => imageInputRef.current?.click()}
                        >
                          <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                            data-testid="input-cover-image"
                          />
                          {coverImage ? (
                            <div className="relative inline-block">
                              <img 
                                src={coverImage} 
                                alt="Cover" 
                                className="h-24 w-24 rounded-lg object-cover mx-auto"
                              />
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCoverImage(null);
                                  setCoverImageFile(null);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">Click to upload (max 1MB)</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          placeholder="Enter voice name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          data-testid="input-voice-name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Textarea
                          id="description"
                          placeholder="Describe this voice..."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={3}
                          data-testid="input-voice-description"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tags (Optional)</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add a tag"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddTag();
                              }
                            }}
                            data-testid="input-tag"
                          />
                          <Button
                            variant="outline"
                            onClick={handleAddTag}
                            disabled={!tagInput.trim() || tags.length >= 10}
                            data-testid="button-add-tag"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {tags.map((tag) => (
                              <Badge 
                                key={tag} 
                                variant="secondary"
                                className="cursor-pointer"
                                onClick={() => handleRemoveTag(tag)}
                              >
                                {tag}
                                <X className="h-3 w-3 ml-1" />
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">{tags.length}/10 tags</p>
                      </div>

                      <Button 
                        className="w-full" 
                        onClick={() => setStep(2)}
                        disabled={!name.trim()}
                        data-testid="button-next-step"
                      >
                        Continue to Audio Samples
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => setStep(1)}
                        className="mb-2"
                        data-testid="button-back-step"
                      >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Back to Voice Details
                      </Button>

                      <div className="space-y-2">
                        <Label>Input Audio</Label>
                        <Tabs defaultValue="upload" className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="upload" data-testid="tab-upload">
                              <Upload className="h-4 w-4 mr-2" />
                              Upload
                            </TabsTrigger>
                            <TabsTrigger value="record" data-testid="tab-record">
                              <Mic className="h-4 w-4 mr-2" />
                              Record
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="upload" className="space-y-4 mt-4">
                            <div
                              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover-elevate"
                              onClick={() => fileInputRef.current?.click()}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const file = e.dataTransfer.files[0];
                                if (file && fileInputRef.current) {
                                  const dt = new DataTransfer();
                                  dt.items.add(file);
                                  fileInputRef.current.files = dt.files;
                                  fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                              }}
                            >
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm"
                                onChange={handleFileSelect}
                                className="hidden"
                                data-testid="input-audio-file"
                              />
                              {uploading ? (
                                <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                              ) : audioFile && !recordedAudio ? (
                                <div className="space-y-2">
                                  <CheckCircle2 className="h-8 w-8 mx-auto text-green-500" />
                                  <p className="font-medium">Audio Uploaded</p>
                                  <p className="text-sm text-muted-foreground">Duration: {formatTime(audioDuration)}</p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      discardRecording();
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                                  <p className="font-medium">Drop audio file here or click to upload</p>
                                  <p className="text-sm text-muted-foreground">Max 32MB</p>
                                </div>
                              )}
                            </div>
                          </TabsContent>

                          <TabsContent value="record" className="space-y-4 mt-4">
                            <div className="bg-muted/50 rounded-lg p-4 mb-4">
                              <p className="text-sm font-medium mb-2">Sample Text to Read:</p>
                              <ScrollArea className="h-32">
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{SAMPLE_TEXT}</p>
                              </ScrollArea>
                            </div>

                            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
                              {!isRecording && !recordedAudio && (
                                <>
                                  <Mic className="h-12 w-12 mx-auto text-muted-foreground" />
                                  <p className="font-medium">Click to Start Recording</p>
                                  <Button onClick={startRecording} data-testid="button-start-recording">
                                    <Mic className="h-4 w-4 mr-2" />
                                    Start Recording
                                  </Button>
                                </>
                              )}

                              {isRecording && (
                                <>
                                  <div className="flex items-center justify-center gap-2">
                                    <span className="flex h-3 w-3 relative">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                                    </span>
                                    <p className="text-2xl font-mono font-bold">
                                      {formatTime(recordingTime)}
                                    </p>
                                  </div>
                                  <p className="text-sm text-muted-foreground">Recording in progress...</p>
                                  <Button onClick={stopRecording} data-testid="button-stop-recording">
                                    <Square className="h-4 w-4 mr-2" />
                                    Stop Recording
                                  </Button>
                                </>
                              )}

                              {recordedAudio && (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-center gap-2">
                                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                                    <span className="font-medium">Recording Complete</span>
                                    <span className="text-muted-foreground">({formatTime(audioDuration)})</span>
                                  </div>
                                  <div className="flex gap-2 justify-center">
                                    {!isPlaying ? (
                                      <Button variant="outline" onClick={playRecording} data-testid="button-play-recording">
                                        <Play className="h-4 w-4 mr-2" />
                                        Play
                                      </Button>
                                    ) : (
                                      <Button variant="outline" onClick={pausePlayback} data-testid="button-pause-playback">
                                        <Pause className="h-4 w-4 mr-2" />
                                        Pause
                                      </Button>
                                    )}
                                    <Button variant="outline" onClick={discardRecording} data-testid="button-discard-recording">
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Discard
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>

                      {(audioFile || audioDuration > 0) && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Duration</span>
                            <span className={getDurationStatus().color}>
                              {formatTime(audioDuration)} ({getDurationStatus().status})
                            </span>
                          </div>
                          <Progress value={getDurationProgress()} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Min ({MIN_DURATION}s)</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              ~{GOOD_DURATION}s recommended
                            </span>
                            <span>Max ({MAX_DURATION}s)</span>
                          </div>
                        </div>
                      )}

                      <Button 
                        className="w-full" 
                        onClick={handleCreate}
                        disabled={cloneMutation.isPending || !audioFile || audioDuration < MIN_DURATION}
                        data-testid="button-create-voice"
                      >
                        {cloneMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating Voice...
                          </>
                        ) : (
                          <>
                            Create Voice ({cost} credits)
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Latest Activity Section */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">Latest Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {voicesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : myVoices.length === 0 ? (
                    <div className="text-center py-8 space-y-3">
                      <Mic className="h-12 w-12 mx-auto text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        Generated Voices Will Appear here
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {myVoices.map((voice) => (
                          <div
                            key={voice.voiceId}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                            data-testid={`voice-item-${voice.voiceId}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{voice.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(voice.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={voice.isActive ? "default" : "secondary"} className="text-xs">
                                {voice.isActive ? "Active" : "Inactive"}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteVoice(voice.voiceId, voice.name)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-voice-${voice.voiceId}`}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
    </>
  );

  return (
    <SidebarInset>
      <ThreeColumnLayout 
        form={formContent} 
        preview={
          <PeerTubePreview
            pageType="voice-clone"
            title="Voice Cloning Preview"
            description="Create custom AI voice clones"
            showGeneratingMessage={cloneMutation.isPending}
          />
        }
      />
      <GuestGenerateModal 
        open={showGuestModal} 
        onOpenChange={setShowGuestModal}
        featureName="Voice Clones"
      />
    </SidebarInset>
  );
}
