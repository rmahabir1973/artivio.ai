import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarInset } from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Mic, Upload, Trash2, ToggleLeft, ToggleRight, Square, Play, Pause, FileText, Radio, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Professional 2-minute voice cloning script (phonetically diverse)
const VOICE_SCRIPT = `Hello! I'm excited to help you create a high-quality voice clone. This script is designed to capture the full range of your voice, including different tones, emotions, and phonetic sounds.

Let's start with some everyday conversation. I love spending time outdoors, whether it's hiking in the mountains or relaxing at the beach. There's something magical about nature that helps me clear my mind and find inspiration. Technology has transformed how we live and work, connecting people across the globe in ways we never imagined possible.

Now, let's explore different emotions and tones. I'm absolutely thrilled when I discover something new! But sometimes, I feel a bit worried when things don't go as planned. It's important to stay calm and think things through carefully. Questions like "What should I do next?" or "How can I solve this problem?" help guide my decisions.

Here are some challenging phonetic combinations: The quick brown fox jumps over the lazy dog. She sells seashells by the seashore. How much wood would a woodchuck chuck if a woodchuck could chuck wood? Peter Piper picked a peck of pickled peppers.

Let's practice numbers and technical terms: The meeting is scheduled for 3:45 PM on February 15th, 2025. Our address is 1234 Oak Street, Apartment 567. The total came to $89.99, including tax. Technical specifications include 256 gigabytes of storage and 16 gigabytes of RAM.

Finally, let's vary the pitch and pace. Sometimes I speak quickly when I'm excited about something! Other times, I slow down to emphasize important points. I might whisper softly when sharing a secret, or project my voice clearly when making an announcement.

Thank you for taking the time to record this script. Your patience and clear pronunciation will help create an excellent voice clone!`;

export default function VoiceClone() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audioFiles, setAudioFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scriptDialogOpen, setScriptDialogOpen] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Fetch user's voice clones
  const { data: voiceClones = [], isLoading: voicesLoading } = useQuery<any[]>({
    queryKey: ["/api/voice-clones"],
    enabled: isAuthenticated,
  });

  // Clone voice mutation
  const cloneMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/voice-clone", data);
    },
    onSuccess: () => {
      toast({
        title: "Voice Cloned Successfully",
        description: "Your voice has been cloned and is ready to use!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/voice-clones"] });
      setName("");
      setDescription("");
      setAudioFiles([]);
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
        title: "Cloning Failed",
        description: error.message || "Failed to clone voice. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Toggle voice mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ voiceId, isActive }: { voiceId: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/voice-clones/${voiceId}/toggle`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-clones"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update voice status.",
        variant: "destructive",
      });
    },
  });

  // Delete voice mutation
  const deleteMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      return await apiRequest("DELETE", `/api/voice-clones/${voiceId}`);
    },
    onSuccess: () => {
      toast({
        title: "Voice Deleted",
        description: "Voice clone has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/voice-clones"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete voice clone.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (audioFiles.length + files.length > 3) {
      toast({
        title: "Too Many Files",
        description: "Maximum 3 audio files allowed.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const newAudioUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        if (!file.type.startsWith('audio/')) {
          toast({
            title: "Invalid File Type",
            description: `${file.name} is not an audio file.`,
            variant: "destructive",
          });
          continue;
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "File Too Large",
            description: `${file.name} exceeds 10MB limit.`,
            variant: "destructive",
          });
          continue;
        }

        // Convert to base64 data URI
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        newAudioUrls.push(dataUrl);
      }

      setAudioFiles([...audioFiles, ...newAudioUrls]);
      toast({
        title: "Files Uploaded",
        description: `${newAudioUrls.length} audio file(s) added.`,
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to process audio files.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClone = () => {
    if (!name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your voice clone.",
        variant: "destructive",
      });
      return;
    }

    if (audioFiles.length === 0) {
      toast({
        title: "Audio Required",
        description: "Please upload at least one audio file (60+ seconds total recommended).",
        variant: "destructive",
      });
      return;
    }

    cloneMutation.mutate({
      name,
      description: description.trim() || undefined,
      audioFiles,
    });
  };

  const handleToggle = (voiceId: string, currentStatus: boolean) => {
    toggleMutation.mutate({ voiceId, isActive: !currentStatus });
  };

  const handleDelete = (voiceId: string) => {
    if (confirm("Are you sure you want to delete this voice clone?")) {
      deleteMutation.mutate(voiceId);
    }
  };

  // Recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudio(audioUrl);
        
        // Convert to base64 for upload
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          setAudioFiles([base64Audio]);
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach(track => track.stop());
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      toast({
        title: "Recording Failed",
        description: "Unable to access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const discardRecording = () => {
    if (isRecording || isPaused) {
      stopRecording();
    }
    setRecordedAudio(null);
    setRecordingTime(0);
    setAudioFiles([]);
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

  // Cleanup on unmount
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

  if (!isAuthenticated) return null;

  return (
    <SidebarInset>
      <div className="h-full overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Mic className="h-10 w-10 text-primary" />
          Voice Cloning
        </h1>
        <p className="text-lg text-muted-foreground">
          Clone your voice or others with ElevenLabs AI (min 60 seconds of clear audio recommended)
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Clone Voice Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create Voice Clone</CardTitle>
            <CardDescription>Upload audio samples to clone a voice ({getModelCost("voice-clone", 100)} credits)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Voice Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Voice Name *</Label>
              <Input
                id="name"
                placeholder="e.g., My Voice, Character Voice"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-voice-name"
              />
            </div>

            {/* Description */}
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

            {/* Recording/Upload Tabs */}
            <div className="space-y-2">
              <Label>Audio Samples * (min 60s total recommended)</Label>
              <Tabs defaultValue="record" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="record" data-testid="tab-record">
                    <Radio className="h-4 w-4 mr-2" />
                    Record Voice
                  </TabsTrigger>
                  <TabsTrigger value="upload" data-testid="tab-upload">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </TabsTrigger>
                </TabsList>

                {/* Record Tab */}
                <TabsContent value="record" className="space-y-4 mt-4">
                  {/* Script Dialog */}
                  <Dialog open={scriptDialogOpen} onOpenChange={setScriptDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full" data-testid="button-open-script">
                        <FileText className="mr-2 h-4 w-4" />
                        View Recording Script (2 minutes)
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>Voice Recording Script</DialogTitle>
                        <DialogDescription>
                          Read this script naturally for optimal voice cloning. Takes about 2 minutes.
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="h-[500px] w-full rounded-md border p-4">
                        <div className="space-y-4 text-sm leading-relaxed whitespace-pre-wrap">
                          {VOICE_SCRIPT}
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>

                  {/* Recording Controls */}
                  {!recordedAudio ? (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-4">
                      <Mic className="h-12 w-12 mx-auto text-primary" />
                      
                      {!isRecording && !isPaused && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Ready to record</p>
                          <p className="text-xs text-muted-foreground">
                            Click the script button above, then start recording while reading it aloud
                          </p>
                          <Button onClick={startRecording} data-testid="button-start-recording">
                            <Radio className="mr-2 h-4 w-4" />
                            Start Recording
                          </Button>
                        </div>
                      )}

                      {(isRecording || isPaused) && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-center gap-2">
                            {isRecording && <span className="flex h-3 w-3 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                            </span>}
                            <p className="text-2xl font-mono font-bold">
                              {formatTime(recordingTime)}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {isPaused ? 'Recording paused' : 'Recording in progress...'}
                          </p>
                          <div className="flex gap-2 justify-center">
                            {!isPaused ? (
                              <Button variant="outline" onClick={pauseRecording} data-testid="button-pause-recording">
                                <Pause className="mr-2 h-4 w-4" />
                                Pause
                              </Button>
                            ) : (
                              <Button variant="outline" onClick={resumeRecording} data-testid="button-resume-recording">
                                <Play className="mr-2 h-4 w-4" />
                                Resume
                              </Button>
                            )}
                            <Button onClick={stopRecording} data-testid="button-stop-recording">
                              <Square className="mr-2 h-4 w-4" />
                              Stop & Save
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border rounded-lg p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="default">Recorded</Badge>
                          <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={discardRecording}
                          data-testid="button-discard-recording"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Discard
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        {!isPlaying ? (
                          <Button variant="outline" onClick={playRecording} className="flex-1" data-testid="button-play-recording">
                            <Play className="mr-2 h-4 w-4" />
                            Play Recording
                          </Button>
                        ) : (
                          <Button variant="outline" onClick={pausePlayback} className="flex-1" data-testid="button-pause-playback">
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                          </Button>
                        )}
                      </div>
                      {recordingTime < 60 && (
                        <p className="text-sm text-yellow-600 dark:text-yellow-500">
                          ⚠️ Recording is under 60 seconds. For best results, record at least 60 seconds.
                        </p>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Upload Tab */}
                <TabsContent value="upload" className="space-y-4 mt-4">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        data-testid="input-audio-files"
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          console.log('Upload Files button clicked');
                          console.log('fileInputRef.current:', fileInputRef.current);
                          fileInputRef.current?.click();
                        }}
                        disabled={uploading}
                        data-testid="button-upload-files"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {uploading ? "Uploading..." : "Upload Files"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      MP3, WAV, M4A (max 10MB each, 1-3 files, 60+ seconds total recommended)
                    </p>
                  </div>
                  {audioFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-medium">{audioFiles.length} file(s) uploaded</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAudioFiles([])}
                        data-testid="button-clear-files"
                      >
                        Clear All
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Clone Button */}
            <Button
              onClick={handleClone}
              disabled={cloneMutation.isPending || uploading}
              className="w-full"
              data-testid="button-clone-voice"
            >
              {cloneMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cloning Voice...
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  Clone Voice ({getModelCost("voice-clone", 100)} Credits)
                </>
              )}
            </Button>

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
                    <CardTitle className="text-sm">Recording Quality is Key</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">Record in a quiet environment using a good microphone. Clear audio without background noise ensures better voice clones.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Use Supported Audio Formats</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">MP3, WAV, and M4A formats work best. Ensure audio is under 10MB per file and 60+ seconds total for optimal results.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Minimize Background Noise</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">Remove ambient sound, echo, and interference. Use voice isolation tools if needed before uploading.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Voice Distinctiveness Matters</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">Record with varied emotions and tones. This helps the model capture your unique vocal characteristics.</p>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Voice Clones List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Voice Clones</CardTitle>
            <CardDescription>Manage your cloned voices</CardDescription>
          </CardHeader>
          <CardContent>
            {voicesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !voiceClones || voiceClones.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mic className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No voice clones yet. Create one to get started!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {voiceClones.map((voice: any) => (
                  <div
                    key={voice.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                    data-testid={`voice-clone-${voice.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{voice.name}</h4>
                        <Badge variant={voice.isActive ? "default" : "secondary"} data-testid={`badge-status-${voice.id}`}>
                          {voice.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {voice.description && (
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {voice.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        ID: {voice.voiceId} • {voice.provider}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggle(voice.id, voice.isActive)}
                        disabled={toggleMutation.isPending}
                        data-testid={`button-toggle-${voice.id}`}
                      >
                        {voice.isActive ? (
                          <ToggleRight className="h-4 w-4" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(voice.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${voice.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
        </div>
      </div>
    </SidebarInset>
  );
}
