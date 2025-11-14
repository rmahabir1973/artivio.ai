import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { Loader2, Image as ImageIcon, Video, Upload } from "lucide-react";
import type { AvatarGeneration, VoiceClone } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function TalkingAvatars() {
  const { toast } = useToast();
  const { getModelCost } = usePricing();
  const [sourceImage, setSourceImage] = useState("");
  const [imageFileName, setImageFileName] = useState("");
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [provider, setProvider] = useState("kling-ai");
  const [quality, setQuality] = useState("720p");
  const [emotion, setEmotion] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: avatars = [], isLoading } = useQuery<AvatarGeneration[]>({
    queryKey: ["/api/avatar/generations"],
  });

  const { data: voices = [] } = useQuery<VoiceClone[]>({
    queryKey: ["/api/voices"],
  });

  const generateMutation = useMutation({
    mutationFn: async (params: {
      sourceImage: string;
      script: string;
      voiceId?: string;
      provider: string;
      parameters?: { quality?: string; emotion?: string };
    }) => {
      return await apiRequest("POST", "/api/avatar/generate", params);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Avatar generation started! Check below for updates.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/avatar/generations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setSourceImage("");
      setImageFileName("");
      setScript("");
      setVoiceId("");
      setEmotion("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate avatar",
        variant: "destructive",
      });
    },
  });

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

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Maximum image size is 5MB.",
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

  const handleGenerate = () => {
    if (!sourceImage) {
      toast({
        title: "Validation Error",
        description: "Please upload an image.",
        variant: "destructive",
      });
      return;
    }

    if (!script.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a script.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      sourceImage,
      script,
      voiceId: voiceId || undefined,
      provider,
      parameters: {
        quality,
        emotion: emotion || undefined,
      },
    });
  };

  const cost = provider === "kling-ai" ? getModelCost("kling-ai", 350) : getModelCost("infinite-talk", 300);

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-heading">AI Talking Avatars</h1>
        <p className="text-muted-foreground">Transform static images into dynamic talking avatars</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Avatar</CardTitle>
            <CardDescription>Upload an image and provide a script</CardDescription>
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
                <p className="text-xs text-muted-foreground">PNG, JPG, WEBP (max 5MB)</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="script">Script *</Label>
              <Textarea
                id="script"
                placeholder="What the avatar says..."
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={4}
                maxLength={3000}
                data-testid="input-script"
              />
              <p className="text-xs text-muted-foreground">{script.length}/3000 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="voice">Voice (Optional)</Label>
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger id="voice" data-testid="select-voice">
                  <SelectValue placeholder="Default voice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Default voice</SelectItem>
                  {voices.filter(v => v.isActive).map((voice) => (
                    <SelectItem key={voice.id} value={voice.voiceId!}>
                      {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger id="provider" data-testid="select-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kling-ai">Kling AI ({getModelCost("kling-ai", 350)} credits)</SelectItem>
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
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !sourceImage || !script}
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

        <Card>
          <CardHeader>
            <CardTitle>About Talking Avatars</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Features</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  Convert static images into dynamic talking videos
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  Use your own cloned voices or default AI voices
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  Customize emotion and style for natural expressions
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  Support for 480p and 720p video quality
                </li>
              </ul>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Costs:</strong> Kling AI - {getModelCost("kling-ai", 350)} credits | Infinite Talk - {getModelCost("infinite-talk", 300)} credits
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Avatars</CardTitle>
          <CardDescription>Generated talking avatar videos</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : avatars.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No avatars generated yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {avatars.map((avatar) => (
                <Card key={avatar.id} data-testid={`card-avatar-${avatar.id}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base line-clamp-1">
                      {avatar.script.slice(0, 50)}{avatar.script.length > 50 ? '...' : ''}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {avatar.provider} • {avatar.creditsCost} credits
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {avatar.status === "processing" && (
                      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processing...
                      </div>
                    )}
                    {avatar.status === "completed" && avatar.resultUrl && (
                      <video
                        src={avatar.resultUrl}
                        controls
                        className="w-full rounded-lg"
                        data-testid={`video-${avatar.id}`}
                      />
                    )}
                    {avatar.status === "failed" && (
                      <p className="text-sm text-destructive">
                        {avatar.errorMessage || "Generation failed"}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
