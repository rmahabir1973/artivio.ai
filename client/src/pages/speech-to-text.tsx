import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SidebarInset } from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { Loader2, FileAudio, Upload, Copy, Check, Clock, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { SttGeneration } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function SpeechToText() {
  const { toast } = useToast();
  const { getModelCost } = usePricing();
  const [audioFile, setAudioFile] = useState<string>("");
  const [audioFileName, setAudioFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [language, setLanguage] = useState("");
  const [diarization, setDiarization] = useState(false);
  const [timestamps, setTimestamps] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch STT transcriptions
  const { data: transcriptions = [], isLoading } = useQuery<SttGeneration[]>({
    queryKey: ["/api/stt/transcriptions"],
  });

  // Transcribe mutation
  const transcribeMutation = useMutation({
    mutationFn: async (params: {
      audioFile: string;
      model: string;
      language?: string;
      parameters?: {
        diarization?: boolean;
        timestamps?: boolean;
      };
    }) => {
      return await apiRequest("POST", "/api/stt/transcribe", params);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Transcription started! It will appear in your transcriptions below.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stt/transcriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Reset form
      setAudioFile("");
      setAudioFileName("");
      setLanguage("");
      setDiarization(false);
      setTimestamps(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to transcribe audio",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("audio/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an audio file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 10MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setAudioFileName(file.name);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setAudioFile(base64);
        setUploading(false);
        toast({
          title: "Audio Loaded",
          description: `${file.name} ready for transcription`,
        });
      };
      reader.onerror = () => {
        setUploading(false);
        toast({
          title: "Error",
          description: "Failed to read audio file",
          variant: "destructive",
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setUploading(false);
      toast({
        title: "Error",
        description: "Failed to process audio file",
        variant: "destructive",
      });
    }
  };

  const handleTranscribe = () => {
    if (!audioFile) {
      toast({
        title: "Validation Error",
        description: "Please upload an audio file.",
        variant: "destructive",
      });
      return;
    }

    transcribeMutation.mutate({
      audioFile,
      model: "scribe-v1",
      language: language || undefined,
      parameters: {
        diarization,
        timestamps,
      },
    });
  };

  const handleCopyTranscription = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: "Copied",
      description: "Transcription copied to clipboard",
    });
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-y-auto">
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-heading">Speech-to-Text</h1>
        <p className="text-muted-foreground">Transcribe audio files with AI-powered speech recognition</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Audio</CardTitle>
            <CardDescription>Upload an audio file to transcribe (max 10MB)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Audio File Upload */}
            <div className="space-y-2">
              <Label htmlFor="audio-file">Audio File *</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-2">
                <FileAudio className="h-8 w-8 mx-auto text-muted-foreground" />
                <div>
                  <Input
                    id="audio-file"
                    type="file"
                    accept="audio/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-audio-file"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("audio-file")?.click()}
                    disabled={uploading}
                    data-testid="button-upload-audio"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Choose Audio File
                      </>
                    )}
                  </Button>
                </div>
                {audioFileName && (
                  <p className="text-sm text-muted-foreground">Selected: {audioFileName}</p>
                )}
                <p className="text-xs text-muted-foreground">Supported: MP3, WAV, M4A, etc. (max 10MB)</p>
              </div>
            </div>

            {/* Language (optional) */}
            <div className="space-y-2">
              <Label htmlFor="language">Language (optional)</Label>
              <Input
                id="language"
                type="text"
                placeholder="e.g., en, es, fr"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                data-testid="input-language"
              />
              <p className="text-xs text-muted-foreground">ISO 639-1 language code (improves accuracy)</p>
            </div>

            {/* Parameters */}
            <div className="space-y-3 p-4 border rounded-lg">
              <Label>Options</Label>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="diarization"
                  checked={diarization}
                  onCheckedChange={(checked) => setDiarization(checked as boolean)}
                  data-testid="checkbox-diarization"
                />
                <Label htmlFor="diarization" className="cursor-pointer">
                  Speaker Diarization
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">Identify different speakers in the audio</p>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="timestamps"
                  checked={timestamps}
                  onCheckedChange={(checked) => setTimestamps(checked as boolean)}
                  data-testid="checkbox-timestamps"
                />
                <Label htmlFor="timestamps" className="cursor-pointer">
                  Include Timestamps
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">Add time markers to the transcription</p>
            </div>

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
                    <CardTitle className="text-sm">Ensure Clean Audio Quality</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">Record in quiet environments. Use noise-reduction tools to remove background sounds for better transcription accuracy.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Select Correct Language</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">Specify the primary language used in your audio. Leave blank for auto-detection of 95+ supported languages.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Clear Speaker Clarity</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">Speakers should speak clearly at moderate pace. Mumbling, accents, or rapid speech may reduce accuracy.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Use Diarization for Multiple Speakers</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">Enable diarization to identify different speakers in your audio. Perfect for interviews, meetings, and podcasts.</p>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleTranscribe}
              disabled={transcribeMutation.isPending || !audioFile}
              className="w-full"
              data-testid="button-transcribe"
            >
              {transcribeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transcribing...
                </>
              ) : (
                <>
                  <FileAudio className="mr-2 h-4 w-4" />
                  Transcribe Audio (25 credits)
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>ElevenLabs Scribe v1</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Features</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  High-accuracy speech recognition
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  Support for 95+ languages
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  Speaker diarization (identify different speakers)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  Optional timestamp markers
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  Professional-grade accuracy for podcasts, meetings, interviews
                </li>
              </ul>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Cost:</strong> {getModelCost("eleven_scribe_v1", 25)} credits per transcription
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transcriptions History */}
      <Card>
        <CardHeader>
          <CardTitle>Your Transcriptions</CardTitle>
          <CardDescription>View and copy your transcribed audio</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : transcriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileAudio className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No transcriptions yet</p>
              <p className="text-sm">Upload an audio file above to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transcriptions.map((transcription) => (
                <Card key={transcription.id} data-testid={`card-transcription-${transcription.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">
                          {transcription.language ? `Language: ${transcription.language}` : "Transcription"}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {transcription.model} • {transcription.creditsCost} credits
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {transcription.status === "processing" && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing
                          </div>
                        )}
                        {transcription.status === "completed" && transcription.transcription && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyTranscription(transcription.transcription!, transcription.id)}
                            data-testid={`button-copy-${transcription.id}`}
                          >
                            {copiedId === transcription.id ? (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 mr-1" />
                                Copy
                              </>
                            )}
                          </Button>
                        )}
                        {transcription.status === "failed" && (
                          <div className="text-sm text-destructive">Failed</div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {transcription.status === "completed" && transcription.transcription && (
                      <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {transcription.transcription}
                      </div>
                    )}
                    {transcription.status === "failed" && transcription.errorMessage && (
                      <p className="text-xs text-destructive">{transcription.errorMessage}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(transcription.createdAt)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </div>
      </div>
    </SidebarInset>
  );
}
