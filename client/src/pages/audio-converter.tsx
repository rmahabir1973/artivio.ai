import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Music2, Upload, Download } from "lucide-react";
import type { AudioConversion } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AudioConverter() {
  const { toast } = useToast();
  const [sourceAudio, setSourceAudio] = useState("");
  const [fileName, setFileName] = useState("");
  const [sourceFormat, setSourceFormat] = useState("mp3");
  const [operation, setOperation] = useState<'wav-conversion' | 'vocal-removal' | 'stem-separation'>('wav-conversion');
  const [targetFormat, setTargetFormat] = useState<'mp3' | 'wav'>('mp3');
  const [separationType, setSeparationType] = useState<'separate_vocal' | 'split_stem'>('separate_vocal');
  const [compressionLevel, setCompressionLevel] = useState("medium");
  const [uploading, setUploading] = useState(false);

  const { data: conversions = [], isLoading } = useQuery<AudioConversion[]>({
    queryKey: ["/api/audio/conversions"],
  });

  const convertMutation = useMutation({
    mutationFn: async (params: {
      sourceAudio: string;
      sourceFormat: string;
      operation: 'wav-conversion' | 'vocal-removal' | 'stem-separation';
      parameters?: {
        targetFormat?: string;
        separationType?: string;
        compressionLevel?: string;
      };
    }) => {
      return await apiRequest("POST", "/api/audio/convert", params);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Audio conversion started! Check below for updates.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/audio/conversions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setSourceAudio("");
      setFileName("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to convert audio",
        variant: "destructive",
      });
    },
  });

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i)) {
      toast({
        title: "Invalid File",
        description: "Please upload an audio file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Maximum audio size is 25MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setFileName(file.name);

    const extension = file.name.split('.').pop()?.toLowerCase() || 'mp3';
    setSourceFormat(extension);

    const reader = new FileReader();
    reader.onload = (event) => {
      setSourceAudio(event.target?.result as string);
      setUploading(false);
      toast({
        title: "Audio Loaded",
        description: `${file.name} ready for conversion`,
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
  };

  const handleConvert = () => {
    if (!sourceAudio) {
      toast({
        title: "Validation Error",
        description: "Please upload an audio file.",
        variant: "destructive",
      });
      return;
    }

    const parameters: any = {};
    if (operation === 'wav-conversion') {
      parameters.targetFormat = targetFormat;
      parameters.compressionLevel = compressionLevel;
    } else if (operation === 'stem-separation') {
      parameters.separationType = separationType;
    }

    convertMutation.mutate({
      sourceAudio,
      sourceFormat,
      operation,
      parameters,
    });
  };

  const costs = {
    'wav-conversion': 15,
    'vocal-removal': 25,
    'stem-separation': 30,
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-heading">Audio Converter</h1>
        <p className="text-muted-foreground">Convert audio formats and separate audio stems</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Convert Audio</CardTitle>
            <CardDescription>Upload audio and select conversion type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="audio-file">Audio File *</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-2">
                <Music2 className="h-8 w-8 mx-auto text-muted-foreground" />
                <div>
                  <Input
                    id="audio-file"
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
                    onChange={handleAudioSelect}
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
                        Choose Audio
                      </>
                    )}
                  </Button>
                </div>
                {fileName && <p className="text-sm text-muted-foreground">Selected: {fileName}</p>}
                <p className="text-xs text-muted-foreground">MP3, WAV, M4A, AAC, OGG, FLAC (max 25MB)</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="operation">Operation *</Label>
              <Select value={operation} onValueChange={(val) => setOperation(val as typeof operation)}>
                <SelectTrigger id="operation" data-testid="select-operation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wav-conversion">Format Conversion (15 credits)</SelectItem>
                  <SelectItem value="vocal-removal">Vocal Removal (25 credits)</SelectItem>
                  <SelectItem value="stem-separation">Stem Separation (30 credits)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {operation === 'wav-conversion' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="target-format">Target Format</Label>
                  <Select value={targetFormat} onValueChange={(val) => setTargetFormat(val as typeof targetFormat)}>
                    <SelectTrigger id="target-format" data-testid="select-target-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mp3">MP3</SelectItem>
                      <SelectItem value="wav">WAV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compression">Compression Level</Label>
                  <Select value={compressionLevel} onValueChange={setCompressionLevel}>
                    <SelectTrigger id="compression" data-testid="select-compression">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {operation === 'stem-separation' && (
              <div className="space-y-2">
                <Label htmlFor="separation-type">Separation Type</Label>
                <Select value={separationType} onValueChange={(val) => setSeparationType(val as typeof separationType)}>
                  <SelectTrigger id="separation-type" data-testid="select-separation-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="separate_vocal">Separate Vocal</SelectItem>
                    <SelectItem value="split_stem">Split Stem (Full)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleConvert}
              disabled={convertMutation.isPending || !sourceAudio}
              className="w-full"
              data-testid="button-convert"
            >
              {convertMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Music2 className="mr-2 h-4 w-4" />
                  Convert Audio ({costs[operation]} credits)
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About Audio Converter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Operations</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <strong>Format Conversion:</strong> Convert between MP3 and WAV formats
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <strong>Vocal Removal:</strong> Extract instrumental track from songs
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <strong>Stem Separation:</strong> Split audio into individual stems (vocals, drums, bass, etc.)
                </li>
              </ul>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Costs:</strong> Format Conversion - 15 credits | Vocal Removal - 25 credits | Stem Separation - 30 credits
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Conversions</CardTitle>
          <CardDescription>Converted audio files</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : conversions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Music2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No conversions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {conversions.map((conv) => (
                <Card key={conv.id} data-testid={`card-conversion-${conv.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {conv.sourceFormat.toUpperCase()} → {conv.targetFormat?.toUpperCase() || 'Processed'}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {conv.creditsCost} credits
                        </CardDescription>
                      </div>
                      {conv.status === "processing" && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Processing...
                        </div>
                      )}
                      {conv.status === "completed" && conv.resultUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          data-testid={`button-download-${conv.id}`}
                        >
                          <a href={conv.resultUrl} download>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </a>
                        </Button>
                      )}
                      {conv.status === "failed" && (
                        <p className="text-sm text-destructive">
                          {conv.errorMessage || "Failed"}
                        </p>
                      )}
                    </div>
                  </CardHeader>
                  {conv.status === "completed" && conv.resultUrl && (
                    <CardContent>
                      <audio
                        src={conv.resultUrl}
                        controls
                        className="w-full"
                        data-testid={`audio-${conv.id}`}
                      />
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
