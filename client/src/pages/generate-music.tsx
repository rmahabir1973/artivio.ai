import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePricing } from "@/hooks/use-pricing";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Music, ChevronDown, Sparkles, Upload, Plus } from "lucide-react";

const MUSIC_MODEL_INFO = [
  { value: "suno-v3.5", label: "Suno V3.5", description: "High-quality music generation" },
  { value: "suno-v4", label: "Suno V4", description: "Enhanced vocals and richer sound" },
  { value: "suno-v4.5", label: "Suno V4.5", description: "Best quality, up to 8 minutes long" },
  { value: "suno-v4.5-plus", label: "Suno V4.5 Plus", description: "Premium quality with advanced features" },
  { value: "suno-v5", label: "Suno V5", description: "Latest model with cutting-edge AI" },
];

export default function GenerateMusic() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost } = usePricing();
  
  // Tab state
  const [activeTab, setActiveTab] = useState("generate");
  
  // Generate tab state
  const [model, setModel] = useState("suno-v4");
  const [prompt, setPrompt] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [duration, setDuration] = useState([120]); // in seconds
  const [genre, setGenre] = useState("pop");
  
  // Advanced settings state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [instrumental, setInstrumental] = useState(false);
  const [style, setStyle] = useState("");
  const [title, setTitle] = useState("");
  const [negativeTags, setNegativeTags] = useState("");
  const [vocalGender, setVocalGender] = useState<"m" | "f" | undefined>(undefined);
  const [styleWeight, setStyleWeight] = useState([0.5]);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState([0.5]);
  const [audioWeight, setAudioWeight] = useState([0.5]);
  
  // Lyrics generation tab state
  const [lyricsPrompt, setLyricsPrompt] = useState("");
  const [generatedLyrics, setGeneratedLyrics] = useState("");
  
  // Extend music tab state
  const [selectedAudioId, setSelectedAudioId] = useState("");
  const [extendPrompt, setExtendPrompt] = useState("");
  const [extendModel, setExtendModel] = useState("suno-v4");
  const [extendStyle, setExtendStyle] = useState("");
  const [extendTitle, setExtendTitle] = useState("");
  const [continueAt, setContinueAt] = useState([0]);
  const [extendInstrumental, setExtendInstrumental] = useState(false);
  const [extendVocalGender, setExtendVocalGender] = useState<"m" | "f" | undefined>(undefined);
  const [extendNegativeTags, setExtendNegativeTags] = useState("");
  const [showExtendAdvanced, setShowExtendAdvanced] = useState(false);
  const [extendStyleWeight, setExtendStyleWeight] = useState([0.5]);
  const [extendWeirdnessConstraint, setExtendWeirdnessConstraint] = useState([0.5]);
  const [extendAudioWeight, setExtendAudioWeight] = useState([0.5]);
  
  // Upload & Cover tab state
  const [coverAudioSource, setCoverAudioSource] = useState<"url" | "upload" | "library">("url");
  const [coverSelectedLibraryId, setCoverSelectedLibraryId] = useState("");
  const [coverUploadUrl, setCoverUploadUrl] = useState("");
  const [coverUploadedFile, setCoverUploadedFile] = useState<string>("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverPrompt, setCoverPrompt] = useState("");
  const [coverModel, setCoverModel] = useState("suno-v4");
  const [coverCustomMode, setCoverCustomMode] = useState(false);
  const [coverInstrumental, setCoverInstrumental] = useState(false);
  const [coverStyle, setCoverStyle] = useState("");
  const [coverTitle, setCoverTitle] = useState("");
  const [coverNegativeTags, setCoverNegativeTags] = useState("");
  const [coverVocalGender, setCoverVocalGender] = useState<"m" | "f" | undefined>(undefined);
  const [showCoverAdvanced, setShowCoverAdvanced] = useState(false);
  const [coverStyleWeight, setCoverStyleWeight] = useState([0.5]);
  const [coverWeirdnessConstraint, setCoverWeirdnessConstraint] = useState([0.5]);
  const [coverAudioWeight, setCoverAudioWeight] = useState([0.5]);
  
  // Upload & Extend tab state
  const [extendAudioSource, setExtendAudioSource] = useState<"url" | "upload" | "library">("url");
  const [extendSelectedLibraryId, setExtendSelectedLibraryId] = useState("");
  const [extendUploadUrl, setExtendUploadUrl] = useState("");
  const [extendUploadedFile, setExtendUploadedFile] = useState<string>("");
  const [extendUploading, setExtendUploading] = useState(false);
  const [uploadExtendPrompt, setUploadExtendPrompt] = useState("");
  const [uploadExtendModel, setUploadExtendModel] = useState("suno-v4");
  const [uploadExtendInstrumental, setUploadExtendInstrumental] = useState(false);
  const [uploadExtendStyle, setUploadExtendStyle] = useState("");
  const [uploadExtendTitle, setUploadExtendTitle] = useState("");
  const [uploadExtendContinueAt, setUploadExtendContinueAt] = useState([0]);
  const [uploadExtendNegativeTags, setUploadExtendNegativeTags] = useState("");
  const [uploadExtendVocalGender, setUploadExtendVocalGender] = useState<"m" | "f" | undefined>(undefined);
  const [showUploadExtendAdvanced, setShowUploadExtendAdvanced] = useState(false);
  const [uploadExtendStyleWeight, setUploadExtendStyleWeight] = useState([0.5]);
  const [uploadExtendWeirdnessConstraint, setUploadExtendWeirdnessConstraint] = useState([0.5]);
  const [uploadExtendAudioWeight, setUploadExtendAudioWeight] = useState([0.5]);

  // Fetch user's music generations for extend and upload tabs
  const { data: generations = [] } = useQuery<any[]>({
    queryKey: ["/api/generations"],
    enabled: isAuthenticated && (activeTab === "extend" || activeTab === "cover" || activeTab === "upload-extend"),
  });

  const musicGenerations = generations.filter(g => g.type === 'music' && g.status === 'completed');

  // File upload handlers
  const handleCoverAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i)) {
      toast({
        title: "Invalid File",
        description: "Please upload an audio file (MP3, WAV, M4A, AAC, OGG, FLAC).",
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

    setCoverUploading(true);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      setCoverUploadedFile(dataUrl);
      toast({
        title: "Audio Loaded",
        description: `${file.name} ready for cover generation`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to read audio file",
        variant: "destructive",
      });
    } finally {
      setCoverUploading(false);
    }
  };

  const handleExtendAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i)) {
      toast({
        title: "Invalid File",
        description: "Please upload an audio file (MP3, WAV, M4A, AAC, OGG, FLAC).",
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

    setExtendUploading(true);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      setExtendUploadedFile(dataUrl);
      toast({
        title: "Audio Loaded",
        description: `${file.name} ready for extension`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to read audio file",
        variant: "destructive",
      });
    } finally {
      setExtendUploading(false);
    }
  };

  // Merge model info with dynamic pricing
  const MUSIC_MODELS = MUSIC_MODEL_INFO.map(m => ({
    ...m,
    cost: getModelCost(m.value, 200),
  }));

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

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/generate/music", data);
    },
    onSuccess: () => {
      toast({
        title: "Generation Started",
        description: "Your music is being generated. Check the history page for progress.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      setPrompt("");
      setLyrics("");
      setStyle("");
      setTitle("");
      setNegativeTags("");
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
        title: "Generation Failed",
        description: error.message || "Failed to generate music. Please try again.",
        variant: "destructive",
      });
    },
  });

  const lyricsGenerationMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/generate/lyrics", data);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      toast({
        title: "Lyrics Generation Started",
        description: "AI is generating your lyrics. Check the history page for the result.",
      });
      setLyricsPrompt("");
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate lyrics.",
        variant: "destructive",
      });
    },
  });

  const extendMusicMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/generate/extend-music", data);
    },
    onSuccess: () => {
      toast({
        title: "Extension Started",
        description: "Your music is being extended. Check the history page for progress.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      setSelectedAudioId("");
      setExtendPrompt("");
    },
    onError: (error: Error) => {
      toast({
        title: "Extension Failed",
        description: error.message || "Failed to extend music.",
        variant: "destructive",
      });
    },
  });

  const uploadCoverMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/generate/upload-cover", data);
    },
    onSuccess: () => {
      toast({
        title: "Cover Generation Started",
        description: "Your music cover is being generated. Check the history page for progress.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      setCoverUploadUrl("");
      setCoverPrompt("");
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate cover.",
        variant: "destructive",
      });
    },
  });

  const uploadExtendMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/generate/upload-extend", data);
    },
    onSuccess: () => {
      toast({
        title: "Extension Started",
        description: "Your music is being extended. Check the history page for progress.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      setExtendUploadUrl("");
      setUploadExtendPrompt("");
    },
    onError: (error: Error) => {
      toast({
        title: "Extension Failed",
        description: error.message || "Failed to extend music.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a description for your music.",
        variant: "destructive",
      });
      return;
    }

    const parameters: any = {
      duration: duration[0],
      genre,
    };

    if (lyrics.trim()) parameters.lyrics = lyrics;
    if (customMode) parameters.customMode = true;
    if (instrumental) parameters.instrumental = true;
    if (style.trim()) parameters.style = style;
    if (title.trim()) parameters.title = title;
    if (negativeTags.trim()) parameters.negativeTags = negativeTags;
    if (vocalGender) parameters.vocalGender = vocalGender;
    if (showAdvanced) {
      parameters.styleWeight = styleWeight[0];
      parameters.weirdnessConstraint = weirdnessConstraint[0];
      parameters.audioWeight = audioWeight[0];
    }

    generateMutation.mutate({
      model,
      prompt,
      parameters,
    });
  };

  const handleGenerateLyrics = () => {
    if (!lyricsPrompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please describe the lyrics you want to generate.",
        variant: "destructive",
      });
      return;
    }

    lyricsGenerationMutation.mutate({
      prompt: lyricsPrompt,
      parameters: {},
    });
  };

  const handleExtendMusic = () => {
    if (!selectedAudioId) {
      toast({
        title: "Audio Required",
        description: "Please select an audio track to extend.",
        variant: "destructive",
      });
      return;
    }

    const parameters: any = {};
    if (extendInstrumental) parameters.instrumental = true;
    if (extendNegativeTags.trim()) parameters.negativeTags = extendNegativeTags;
    if (extendVocalGender) parameters.vocalGender = extendVocalGender;
    if (showExtendAdvanced) {
      parameters.styleWeight = extendStyleWeight[0];
      parameters.weirdnessConstraint = extendWeirdnessConstraint[0];
      parameters.audioWeight = extendAudioWeight[0];
    }

    extendMusicMutation.mutate({
      audioId: selectedAudioId,
      model: extendModel,
      defaultParamFlag: false,
      continueAt: continueAt[0],
      prompt: extendPrompt.trim() || undefined,
      style: extendStyle.trim() || undefined,
      title: extendTitle.trim() || undefined,
      parameters,
    });
  };

  const handleUploadCover = () => {
    // Determine audio source based on selection
    let audioUrl = "";
    if (coverAudioSource === "url") {
      if (!coverUploadUrl.trim()) {
        toast({
          title: "URL Required",
          description: "Please provide an audio URL.",
          variant: "destructive",
        });
        return;
      }
      audioUrl = coverUploadUrl;
    } else if (coverAudioSource === "upload") {
      if (!coverUploadedFile) {
        toast({
          title: "File Required",
          description: "Please upload an audio file.",
          variant: "destructive",
        });
        return;
      }
      audioUrl = coverUploadedFile;
    } else if (coverAudioSource === "library") {
      if (!coverSelectedLibraryId) {
        toast({
          title: "Selection Required",
          description: "Please select a song from your library.",
          variant: "destructive",
        });
        return;
      }
      const selectedGen = musicGenerations.find(g => g.id === coverSelectedLibraryId);
      if (!selectedGen?.outputUrl) {
        toast({
          title: "Error",
          description: "Selected song has no audio URL.",
          variant: "destructive",
        });
        return;
      }
      audioUrl = selectedGen.outputUrl;
    }

    const parameters: any = {};
    if (coverNegativeTags.trim()) parameters.negativeTags = coverNegativeTags;
    if (coverVocalGender) parameters.vocalGender = coverVocalGender;
    if (showCoverAdvanced) {
      parameters.styleWeight = coverStyleWeight[0];
      parameters.weirdnessConstraint = coverWeirdnessConstraint[0];
      parameters.audioWeight = coverAudioWeight[0];
    }

    uploadCoverMutation.mutate({
      uploadUrl: audioUrl,
      model: coverModel,
      customMode: coverCustomMode,
      instrumental: coverInstrumental,
      prompt: coverPrompt.trim() || undefined,
      style: coverStyle.trim() || undefined,
      title: coverTitle.trim() || undefined,
      parameters,
    });
  };

  const handleUploadExtend = () => {
    // Determine audio source based on selection
    let audioUrl = "";
    if (extendAudioSource === "url") {
      if (!extendUploadUrl.trim()) {
        toast({
          title: "URL Required",
          description: "Please provide an audio URL.",
          variant: "destructive",
        });
        return;
      }
      audioUrl = extendUploadUrl;
    } else if (extendAudioSource === "upload") {
      if (!extendUploadedFile) {
        toast({
          title: "File Required",
          description: "Please upload an audio file.",
          variant: "destructive",
        });
        return;
      }
      audioUrl = extendUploadedFile;
    } else if (extendAudioSource === "library") {
      if (!extendSelectedLibraryId) {
        toast({
          title: "Selection Required",
          description: "Please select a song from your library.",
          variant: "destructive",
        });
        return;
      }
      const selectedGen = musicGenerations.find(g => g.id === extendSelectedLibraryId);
      if (!selectedGen?.outputUrl) {
        toast({
          title: "Error",
          description: "Selected song has no audio URL.",
          variant: "destructive",
        });
        return;
      }
      audioUrl = selectedGen.outputUrl;
    }

    const parameters: any = {};
    if (uploadExtendNegativeTags.trim()) parameters.negativeTags = uploadExtendNegativeTags;
    if (uploadExtendVocalGender) parameters.vocalGender = uploadExtendVocalGender;
    if (showUploadExtendAdvanced) {
      parameters.styleWeight = uploadExtendStyleWeight[0];
      parameters.weirdnessConstraint = uploadExtendWeirdnessConstraint[0];
      parameters.audioWeight = uploadExtendAudioWeight[0];
    }

    uploadExtendMutation.mutate({
      uploadUrl: audioUrl,
      model: uploadExtendModel,
      defaultParamFlag: false,
      instrumental: uploadExtendInstrumental,
      continueAt: uploadExtendContinueAt[0],
      prompt: uploadExtendPrompt.trim() || undefined,
      style: uploadExtendStyle.trim() || undefined,
      title: uploadExtendTitle.trim() || undefined,
      parameters,
    });
  };

  const selectedModel = MUSIC_MODELS.find(m => m.value === model);

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
          <Music className="h-10 w-10 text-primary" />
          Music Studio
        </h1>
        <p className="text-lg text-muted-foreground">
          Create, extend, and edit original music with AI-powered Suno models
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="generate" data-testid="tab-generate">
            <Music className="h-4 w-4 mr-2" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="extend" data-testid="tab-extend">
            <Plus className="h-4 w-4 mr-2" />
            Extend
          </TabsTrigger>
          <TabsTrigger value="lyrics" data-testid="tab-lyrics">
            <Sparkles className="h-4 w-4 mr-2" />
            Lyrics
          </TabsTrigger>
          <TabsTrigger value="cover" data-testid="tab-cover">
            <Upload className="h-4 w-4 mr-2" />
            Cover
          </TabsTrigger>
          <TabsTrigger value="upload-extend" data-testid="tab-upload-extend">
            <Upload className="h-4 w-4 mr-2" />
            Upload & Extend
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Generation Settings</CardTitle>
                <CardDescription>Configure your music parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Model Selection */}
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger id="model" data-testid="select-music-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MUSIC_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label} ({m.cost} credits)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedModel && (
                    <p className="text-sm text-muted-foreground">{selectedModel.description}</p>
                  )}
                </div>

                {/* Prompt */}
                <div className="space-y-2">
                  <Label htmlFor="prompt">Music Description</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Describe the music you want to create... (e.g., 'Upbeat electronic dance music with energetic drums')"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    data-testid="input-music-prompt"
                  />
                </div>

                {/* Lyrics (Optional) */}
                <div className="space-y-2">
                  <Label htmlFor="lyrics">Lyrics (Optional)</Label>
                  <Textarea
                    id="lyrics"
                    placeholder="Enter custom lyrics for your song (leave empty for instrumental)..."
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    rows={6}
                    data-testid="input-music-lyrics"
                  />
                </div>

                {/* Genre */}
                <div className="space-y-2">
                  <Label htmlFor="genre">Genre</Label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger id="genre" data-testid="select-genre">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pop">Pop</SelectItem>
                      <SelectItem value="rock">Rock</SelectItem>
                      <SelectItem value="electronic">Electronic</SelectItem>
                      <SelectItem value="jazz">Jazz</SelectItem>
                      <SelectItem value="classical">Classical</SelectItem>
                      <SelectItem value="hiphop">Hip Hop</SelectItem>
                      <SelectItem value="ambient">Ambient</SelectItem>
                      <SelectItem value="country">Country</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <Label htmlFor="duration">
                    Duration: {Math.floor(duration[0] / 60)}:{(duration[0] % 60).toString().padStart(2, '0')}
                  </Label>
                  <Slider
                    id="duration"
                    min={30}
                    max={480}
                    step={30}
                    value={duration}
                    onValueChange={setDuration}
                    data-testid="slider-music-duration"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum duration depends on the selected model
                  </p>
                </div>

                {/* Advanced Settings */}
                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full" data-testid="button-advanced-settings">
                      <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                      Advanced Settings
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                    {/* Custom Mode */}
                    <div className="flex items-center justify-between">
                      <Label htmlFor="customMode">Custom Mode</Label>
                      <Switch
                        id="customMode"
                        checked={customMode}
                        onCheckedChange={setCustomMode}
                        data-testid="switch-custom-mode"
                      />
                    </div>

                    {/* Instrumental */}
                    <div className="flex items-center justify-between">
                      <Label htmlFor="instrumental">Instrumental Only</Label>
                      <Switch
                        id="instrumental"
                        checked={instrumental}
                        onCheckedChange={setInstrumental}
                        data-testid="switch-instrumental"
                      />
                    </div>

                    {/* Style */}
                    <div className="space-y-2">
                      <Label htmlFor="style">Style Tags</Label>
                      <Input
                        id="style"
                        placeholder="e.g., energetic, upbeat, melodic"
                        value={style}
                        onChange={(e) => setStyle(e.target.value)}
                        data-testid="input-style"
                      />
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                      <Label htmlFor="title">Song Title</Label>
                      <Input
                        id="title"
                        placeholder="Enter a title for your song"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        data-testid="input-title"
                      />
                    </div>

                    {/* Negative Tags */}
                    <div className="space-y-2">
                      <Label htmlFor="negativeTags">Negative Tags</Label>
                      <Input
                        id="negativeTags"
                        placeholder="Styles or elements to avoid"
                        value={negativeTags}
                        onChange={(e) => setNegativeTags(e.target.value)}
                        data-testid="input-negative-tags"
                      />
                    </div>

                    {/* Vocal Gender */}
                    <div className="space-y-2">
                      <Label htmlFor="vocalGender">Vocal Gender</Label>
                      <Select value={vocalGender || "none"} onValueChange={(v) => setVocalGender(v === "none" ? undefined : v as "m" | "f")}>
                        <SelectTrigger id="vocalGender" data-testid="select-vocal-gender">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Preference</SelectItem>
                          <SelectItem value="m">Male</SelectItem>
                          <SelectItem value="f">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Style Weight */}
                    <div className="space-y-2">
                      <Label>Style Weight: {styleWeight[0].toFixed(2)}</Label>
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={styleWeight}
                        onValueChange={setStyleWeight}
                        data-testid="slider-style-weight"
                      />
                    </div>

                    {/* Weirdness Constraint */}
                    <div className="space-y-2">
                      <Label>Creativity Level: {weirdnessConstraint[0].toFixed(2)}</Label>
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={weirdnessConstraint}
                        onValueChange={setWeirdnessConstraint}
                        data-testid="slider-weirdness"
                      />
                      <p className="text-xs text-muted-foreground">
                        Higher values = more creative/experimental
                      </p>
                    </div>

                    {/* Audio Weight */}
                    <div className="space-y-2">
                      <Label>Audio Weight: {audioWeight[0].toFixed(2)}</Label>
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={audioWeight}
                        onValueChange={setAudioWeight}
                        data-testid="slider-audio-weight"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Generate Button */}
                <Button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="w-full"
                  size="lg"
                  data-testid="button-generate-music"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>Generate Music ({selectedModel?.cost} credits)</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Model Comparison */}
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Available Models</h2>
              <div className="space-y-4">
                {MUSIC_MODELS.map((m) => (
                  <Card key={m.value} className={model === m.value ? "border-primary" : ""}>
                    <CardHeader>
                      <CardTitle className="text-lg">{m.label}</CardTitle>
                      <CardDescription>{m.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">{m.cost}</span>
                        <span className="text-sm text-muted-foreground">credits per track</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="bg-accent/50">
                <CardHeader>
                  <CardTitle className="text-lg">Pro Tips</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">
                    • For best results with vocals, provide structured lyrics with verse/chorus/bridge sections
                  </p>
                  <p className="text-sm">
                    • Instrumental tracks work great when you focus on mood, instruments, and tempo
                  </p>
                  <p className="text-sm">
                    • Use advanced settings to fine-tune creativity and style adherence
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Extend Music Tab */}
        <TabsContent value="extend" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Extend Existing Music</CardTitle>
              <CardDescription>Continue your previously generated songs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Select Audio */}
              <div className="space-y-2">
                <Label htmlFor="audioSelect">Select Audio to Extend</Label>
                <Select value={selectedAudioId} onValueChange={setSelectedAudioId}>
                  <SelectTrigger id="audioSelect" data-testid="select-audio-extend">
                    <SelectValue placeholder="Choose a completed music generation..." />
                  </SelectTrigger>
                  <SelectContent>
                    {musicGenerations.length === 0 ? (
                      <SelectItem value="none" disabled>No completed music generations</SelectItem>
                    ) : (
                      musicGenerations.map((gen) => (
                        <SelectItem key={gen.id} value={gen.id}>
                          {gen.prompt?.substring(0, 50) || "Untitled"} - {new Date(gen.createdAt).toLocaleDateString()}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Model */}
              <div className="space-y-2">
                <Label htmlFor="extendModel">Model</Label>
                <Select value={extendModel} onValueChange={setExtendModel}>
                  <SelectTrigger id="extendModel" data-testid="select-extend-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSIC_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label} ({m.cost} credits)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Continue At */}
              <div className="space-y-2">
                <Label>Continue At: {continueAt[0]}s</Label>
                <Slider
                  min={0}
                  max={240}
                  step={1}
                  value={continueAt}
                  onValueChange={setContinueAt}
                  data-testid="slider-continue-at"
                />
                <p className="text-xs text-muted-foreground">
                  Timestamp in seconds where to continue the song
                </p>
              </div>

              {/* Optional Prompt */}
              <div className="space-y-2">
                <Label htmlFor="extendPrompt">Additional Direction (Optional)</Label>
                <Textarea
                  id="extendPrompt"
                  placeholder="Describe how you want the extension to sound..."
                  value={extendPrompt}
                  onChange={(e) => setExtendPrompt(e.target.value)}
                  rows={3}
                  data-testid="input-extend-prompt"
                />
              </div>

              {/* Style */}
              <div className="space-y-2">
                <Label htmlFor="extendStyle">Style Tags (Optional)</Label>
                <Input
                  id="extendStyle"
                  placeholder="e.g., energetic, upbeat"
                  value={extendStyle}
                  onChange={(e) => setExtendStyle(e.target.value)}
                  data-testid="input-extend-style"
                />
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="extendTitle">Title (Optional)</Label>
                <Input
                  id="extendTitle"
                  placeholder="Title for the extended version"
                  value={extendTitle}
                  onChange={(e) => setExtendTitle(e.target.value)}
                  data-testid="input-extend-title"
                />
              </div>

              {/* Instrumental */}
              <div className="flex items-center justify-between">
                <Label htmlFor="extendInstrumental">Instrumental Only</Label>
                <Switch
                  id="extendInstrumental"
                  checked={extendInstrumental}
                  onCheckedChange={setExtendInstrumental}
                  data-testid="switch-extend-instrumental"
                />
              </div>

              {/* Negative Tags */}
              <div className="space-y-2">
                <Label htmlFor="extendNegativeTags">Negative Tags (Optional)</Label>
                <Input
                  id="extendNegativeTags"
                  placeholder="Styles or elements to avoid"
                  value={extendNegativeTags}
                  onChange={(e) => setExtendNegativeTags(e.target.value)}
                  data-testid="input-extend-negative-tags"
                />
              </div>

              {/* Vocal Gender */}
              <div className="space-y-2">
                <Label htmlFor="extendVocalGender">Vocal Gender</Label>
                <Select value={extendVocalGender || "none"} onValueChange={(v) => setExtendVocalGender(v === "none" ? undefined : v as "m" | "f")}>
                  <SelectTrigger id="extendVocalGender" data-testid="select-extend-vocal-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Preference</SelectItem>
                    <SelectItem value="m">Male</SelectItem>
                    <SelectItem value="f">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Advanced Settings for Extend */}
              <Collapsible open={showExtendAdvanced} onOpenChange={setShowExtendAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full" data-testid="button-extend-advanced">
                    <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${showExtendAdvanced ? 'rotate-180' : ''}`} />
                    Advanced Settings
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Style Weight: {extendStyleWeight[0].toFixed(2)}</Label>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={extendStyleWeight}
                      onValueChange={setExtendStyleWeight}
                      data-testid="slider-extend-style-weight"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Creativity Level: {extendWeirdnessConstraint[0].toFixed(2)}</Label>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={extendWeirdnessConstraint}
                      onValueChange={setExtendWeirdnessConstraint}
                      data-testid="slider-extend-weirdness"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Audio Weight: {extendAudioWeight[0].toFixed(2)}</Label>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={extendAudioWeight}
                      onValueChange={setExtendAudioWeight}
                      data-testid="slider-extend-audio-weight"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button
                onClick={handleExtendMusic}
                disabled={extendMusicMutation.isPending || !selectedAudioId}
                className="w-full"
                size="lg"
                data-testid="button-extend-music"
              >
                {extendMusicMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Extending...
                  </>
                ) : (
                  `Extend Music (${getModelCost(extendModel, 200)} credits)`
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generate Lyrics Tab */}
        <TabsContent value="lyrics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Lyrics Generation</CardTitle>
              <CardDescription>Generate creative lyrics with AI (5 credits)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="lyricsPrompt">Describe Your Lyrics</Label>
                <Textarea
                  id="lyricsPrompt"
                  placeholder="e.g., 'A love song about summer nights' or 'Rap lyrics about overcoming challenges'"
                  value={lyricsPrompt}
                  onChange={(e) => setLyricsPrompt(e.target.value)}
                  rows={6}
                  data-testid="input-lyrics-prompt"
                />
              </div>

              <Button
                onClick={handleGenerateLyrics}
                disabled={lyricsGenerationMutation.isPending}
                className="w-full"
                size="lg"
                data-testid="button-generate-lyrics"
              >
                {lyricsGenerationMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Lyrics (5 credits)"
                )}
              </Button>

              <Card className="bg-accent/50">
                <CardHeader>
                  <CardTitle className="text-lg">Tips for Better Lyrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">
                    • Be specific about the theme, mood, and genre
                  </p>
                  <p className="text-sm">
                    • Mention the song structure (verse, chorus, bridge) if desired
                  </p>
                  <p className="text-sm">
                    • Check your history page to view generated lyrics
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upload & Cover Tab */}
        <TabsContent value="cover" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generate Music Cover</CardTitle>
              <CardDescription>Create a new version of existing audio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Audio Source Selector */}
              <div className="space-y-2">
                <Label>Audio Source</Label>
                <Select value={coverAudioSource} onValueChange={(v: "url" | "upload" | "library") => setCoverAudioSource(v)}>
                  <SelectTrigger data-testid="select-cover-audio-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url">Enter URL</SelectItem>
                    <SelectItem value="upload">Upload File</SelectItem>
                    <SelectItem value="library">Choose from Library</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional Audio Input based on source */}
              {coverAudioSource === "url" && (
                <div className="space-y-2">
                  <Label htmlFor="coverUploadUrl">Audio URL</Label>
                  <Input
                    id="coverUploadUrl"
                    type="url"
                    placeholder="https://example.com/audio.mp3"
                    value={coverUploadUrl}
                    onChange={(e) => setCoverUploadUrl(e.target.value)}
                    data-testid="input-cover-url"
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide a direct URL to the audio file
                  </p>
                </div>
              )}

              {coverAudioSource === "upload" && (
                <div className="space-y-2">
                  <Label htmlFor="coverUploadFile">Upload Audio File</Label>
                  <Input
                    id="coverUploadFile"
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
                    onChange={handleCoverAudioUpload}
                    disabled={coverUploading}
                    data-testid="input-cover-upload"
                  />
                  {coverUploading && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Processing file...
                    </p>
                  )}
                  {coverUploadedFile && !coverUploading && (
                    <p className="text-xs text-green-500">✓ Audio file loaded and ready</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    MP3, WAV, M4A, AAC, OGG, FLAC (max 25MB)
                  </p>
                </div>
              )}

              {coverAudioSource === "library" && (
                <div className="space-y-2">
                  <Label htmlFor="coverLibrarySelect">Select from Your Library</Label>
                  <Select value={coverSelectedLibraryId} onValueChange={setCoverSelectedLibraryId}>
                    <SelectTrigger id="coverLibrarySelect" data-testid="select-cover-library">
                      <SelectValue placeholder="Choose a song from your library..." />
                    </SelectTrigger>
                    <SelectContent>
                      {musicGenerations.length === 0 ? (
                        <SelectItem value="none" disabled>No completed music generations</SelectItem>
                      ) : (
                        musicGenerations.map((gen) => (
                          <SelectItem key={gen.id} value={gen.id}>
                            {gen.prompt?.substring(0, 50) || "Untitled"} - {new Date(gen.createdAt).toLocaleDateString()}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Model */}
              <div className="space-y-2">
                <Label htmlFor="coverModel">Model</Label>
                <Select value={coverModel} onValueChange={setCoverModel}>
                  <SelectTrigger id="coverModel" data-testid="select-cover-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSIC_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label} ({m.cost} credits)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Mode */}
              <div className="flex items-center justify-between">
                <Label htmlFor="coverCustomMode">Custom Mode</Label>
                <Switch
                  id="coverCustomMode"
                  checked={coverCustomMode}
                  onCheckedChange={setCoverCustomMode}
                  data-testid="switch-cover-custom-mode"
                />
              </div>

              {/* Instrumental */}
              <div className="flex items-center justify-between">
                <Label htmlFor="coverInstrumental">Instrumental</Label>
                <Switch
                  id="coverInstrumental"
                  checked={coverInstrumental}
                  onCheckedChange={setCoverInstrumental}
                  data-testid="switch-cover-instrumental"
                />
              </div>

              {/* Optional Fields */}
              <div className="space-y-2">
                <Label htmlFor="coverPrompt">Prompt (Optional)</Label>
                <Textarea
                  id="coverPrompt"
                  placeholder="Describe how you want the cover to sound..."
                  value={coverPrompt}
                  onChange={(e) => setCoverPrompt(e.target.value)}
                  rows={3}
                  data-testid="input-cover-prompt"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coverStyle">Style (Optional)</Label>
                <Input
                  id="coverStyle"
                  placeholder="e.g., rock, acoustic"
                  value={coverStyle}
                  onChange={(e) => setCoverStyle(e.target.value)}
                  data-testid="input-cover-style"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coverTitle">Title (Optional)</Label>
                <Input
                  id="coverTitle"
                  placeholder="Title for the cover"
                  value={coverTitle}
                  onChange={(e) => setCoverTitle(e.target.value)}
                  data-testid="input-cover-title"
                />
              </div>

              {/* Negative Tags */}
              <div className="space-y-2">
                <Label htmlFor="coverNegativeTags">Negative Tags (Optional)</Label>
                <Input
                  id="coverNegativeTags"
                  placeholder="Styles or elements to avoid"
                  value={coverNegativeTags}
                  onChange={(e) => setCoverNegativeTags(e.target.value)}
                  data-testid="input-cover-negative-tags"
                />
              </div>

              {/* Vocal Gender */}
              <div className="space-y-2">
                <Label htmlFor="coverVocalGender">Vocal Gender</Label>
                <Select value={coverVocalGender || "none"} onValueChange={(v) => setCoverVocalGender(v === "none" ? undefined : v as "m" | "f")}>
                  <SelectTrigger id="coverVocalGender" data-testid="select-cover-vocal-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Preference</SelectItem>
                    <SelectItem value="m">Male</SelectItem>
                    <SelectItem value="f">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Advanced Settings for Cover */}
              <Collapsible open={showCoverAdvanced} onOpenChange={setShowCoverAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full" data-testid="button-cover-advanced">
                    <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${showCoverAdvanced ? 'rotate-180' : ''}`} />
                    Advanced Settings
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Style Weight: {coverStyleWeight[0].toFixed(2)}</Label>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={coverStyleWeight}
                      onValueChange={setCoverStyleWeight}
                      data-testid="slider-cover-style-weight"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Creativity Level: {coverWeirdnessConstraint[0].toFixed(2)}</Label>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={coverWeirdnessConstraint}
                      onValueChange={setCoverWeirdnessConstraint}
                      data-testid="slider-cover-weirdness"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Audio Weight: {coverAudioWeight[0].toFixed(2)}</Label>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={coverAudioWeight}
                      onValueChange={setCoverAudioWeight}
                      data-testid="slider-cover-audio-weight"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button
                onClick={handleUploadCover}
                disabled={uploadCoverMutation.isPending || !coverUploadUrl}
                className="w-full"
                size="lg"
                data-testid="button-upload-cover"
              >
                {uploadCoverMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  `Generate Cover (${getModelCost(coverModel, 200)} credits)`
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upload & Extend Tab */}
        <TabsContent value="upload-extend" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Extend Uploaded Audio</CardTitle>
              <CardDescription>Extend any audio file with AI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Audio Source Selector */}
              <div className="space-y-2">
                <Label>Audio Source</Label>
                <Select value={extendAudioSource} onValueChange={(v: "url" | "upload" | "library") => setExtendAudioSource(v)}>
                  <SelectTrigger data-testid="select-extend-audio-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url">Enter URL</SelectItem>
                    <SelectItem value="upload">Upload File</SelectItem>
                    <SelectItem value="library">Choose from Library</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional Audio Input based on source */}
              {extendAudioSource === "url" && (
                <div className="space-y-2">
                  <Label htmlFor="extendUploadUrl">Audio URL</Label>
                  <Input
                    id="extendUploadUrl"
                    type="url"
                    placeholder="https://example.com/audio.mp3"
                    value={extendUploadUrl}
                    onChange={(e) => setExtendUploadUrl(e.target.value)}
                    data-testid="input-upload-extend-url"
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide a direct URL to the audio file
                  </p>
                </div>
              )}

              {extendAudioSource === "upload" && (
                <div className="space-y-2">
                  <Label htmlFor="extendUploadFile">Upload Audio File</Label>
                  <Input
                    id="extendUploadFile"
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
                    onChange={handleExtendAudioUpload}
                    disabled={extendUploading}
                    data-testid="input-extend-upload"
                  />
                  {extendUploading && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Processing file...
                    </p>
                  )}
                  {extendUploadedFile && !extendUploading && (
                    <p className="text-xs text-green-500">✓ Audio file loaded and ready</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    MP3, WAV, M4A, AAC, OGG, FLAC (max 25MB)
                  </p>
                </div>
              )}

              {extendAudioSource === "library" && (
                <div className="space-y-2">
                  <Label htmlFor="extendLibrarySelect">Select from Your Library</Label>
                  <Select value={extendSelectedLibraryId} onValueChange={setExtendSelectedLibraryId}>
                    <SelectTrigger id="extendLibrarySelect" data-testid="select-extend-library">
                      <SelectValue placeholder="Choose a song from your library..." />
                    </SelectTrigger>
                    <SelectContent>
                      {musicGenerations.length === 0 ? (
                        <SelectItem value="none" disabled>No completed music generations</SelectItem>
                      ) : (
                        musicGenerations.map((gen) => (
                          <SelectItem key={gen.id} value={gen.id}>
                            {gen.prompt?.substring(0, 50) || "Untitled"} - {new Date(gen.createdAt).toLocaleDateString()}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Model */}
              <div className="space-y-2">
                <Label htmlFor="uploadExtendModel">Model</Label>
                <Select value={uploadExtendModel} onValueChange={setUploadExtendModel}>
                  <SelectTrigger id="uploadExtendModel" data-testid="select-upload-extend-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSIC_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label} ({m.cost} credits)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Continue At */}
              <div className="space-y-2">
                <Label>Continue At: {uploadExtendContinueAt[0]}s</Label>
                <Slider
                  min={0}
                  max={240}
                  step={1}
                  value={uploadExtendContinueAt}
                  onValueChange={setUploadExtendContinueAt}
                  data-testid="slider-upload-extend-continue-at"
                />
              </div>

              {/* Instrumental */}
              <div className="flex items-center justify-between">
                <Label htmlFor="uploadExtendInstrumental">Instrumental</Label>
                <Switch
                  id="uploadExtendInstrumental"
                  checked={uploadExtendInstrumental}
                  onCheckedChange={setUploadExtendInstrumental}
                  data-testid="switch-upload-extend-instrumental"
                />
              </div>

              {/* Optional Fields */}
              <div className="space-y-2">
                <Label htmlFor="uploadExtendPrompt">Prompt (Optional)</Label>
                <Textarea
                  id="uploadExtendPrompt"
                  placeholder="Describe the extension..."
                  value={uploadExtendPrompt}
                  onChange={(e) => setUploadExtendPrompt(e.target.value)}
                  rows={3}
                  data-testid="input-upload-extend-prompt"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="uploadExtendStyle">Style (Optional)</Label>
                <Input
                  id="uploadExtendStyle"
                  placeholder="e.g., upbeat, melodic"
                  value={uploadExtendStyle}
                  onChange={(e) => setUploadExtendStyle(e.target.value)}
                  data-testid="input-upload-extend-style"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="uploadExtendTitle">Title (Optional)</Label>
                <Input
                  id="uploadExtendTitle"
                  placeholder="Title for extended version"
                  value={uploadExtendTitle}
                  onChange={(e) => setUploadExtendTitle(e.target.value)}
                  data-testid="input-upload-extend-title"
                />
              </div>

              {/* Negative Tags */}
              <div className="space-y-2">
                <Label htmlFor="uploadExtendNegativeTags">Negative Tags (Optional)</Label>
                <Input
                  id="uploadExtendNegativeTags"
                  placeholder="Styles or elements to avoid"
                  value={uploadExtendNegativeTags}
                  onChange={(e) => setUploadExtendNegativeTags(e.target.value)}
                  data-testid="input-upload-extend-negative-tags"
                />
              </div>

              {/* Vocal Gender */}
              <div className="space-y-2">
                <Label htmlFor="uploadExtendVocalGender">Vocal Gender</Label>
                <Select value={uploadExtendVocalGender || "none"} onValueChange={(v) => setUploadExtendVocalGender(v === "none" ? undefined : v as "m" | "f")}>
                  <SelectTrigger id="uploadExtendVocalGender" data-testid="select-upload-extend-vocal-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Preference</SelectItem>
                    <SelectItem value="m">Male</SelectItem>
                    <SelectItem value="f">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Advanced Settings for Upload & Extend */}
              <Collapsible open={showUploadExtendAdvanced} onOpenChange={setShowUploadExtendAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full" data-testid="button-upload-extend-advanced">
                    <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${showUploadExtendAdvanced ? 'rotate-180' : ''}`} />
                    Advanced Settings
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Style Weight: {uploadExtendStyleWeight[0].toFixed(2)}</Label>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={uploadExtendStyleWeight}
                      onValueChange={setUploadExtendStyleWeight}
                      data-testid="slider-upload-extend-style-weight"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Creativity Level: {uploadExtendWeirdnessConstraint[0].toFixed(2)}</Label>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={uploadExtendWeirdnessConstraint}
                      onValueChange={setUploadExtendWeirdnessConstraint}
                      data-testid="slider-upload-extend-weirdness"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Audio Weight: {uploadExtendAudioWeight[0].toFixed(2)}</Label>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={uploadExtendAudioWeight}
                      onValueChange={setUploadExtendAudioWeight}
                      data-testid="slider-upload-extend-audio-weight"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button
                onClick={handleUploadExtend}
                disabled={uploadExtendMutation.isPending || !extendUploadUrl}
                className="w-full"
                size="lg"
                data-testid="button-upload-extend"
              >
                {uploadExtendMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Extending...
                  </>
                ) : (
                  `Extend Audio (${getModelCost(uploadExtendModel, 200)} credits)`
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
