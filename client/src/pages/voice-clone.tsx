import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Mic, Upload, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

export default function VoiceClone() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audioFiles, setAudioFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

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
          window.location.href = "/api/login";
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
            <CardDescription>Upload audio samples to clone a voice (100 credits)</CardDescription>
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

            {/* Audio File Upload */}
            <div className="space-y-2">
              <Label htmlFor="audio-files">Audio Samples * (1-3 files, min 60s total)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-2">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <div>
                  <Input
                    id="audio-files"
                    type="file"
                    accept="audio/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-audio-files"
                  />
                  <Label
                    htmlFor="audio-files"
                    className="cursor-pointer text-primary hover-elevate"
                  >
                    {uploading ? "Uploading..." : "Click to upload audio files"}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  MP3, WAV, M4A (max 10MB each, 60+ seconds total recommended)
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
                  Clone Voice (100 Credits)
                </>
              )}
            </Button>
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
  );
}
