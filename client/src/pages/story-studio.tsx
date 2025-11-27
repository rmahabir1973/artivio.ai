import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { SidebarInset } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { 
  Search, 
  Download, 
  ChevronDown, 
  ChevronRight,
  Loader2, 
  Play, 
  Pause, 
  Heart, 
  User, 
  Plus,
  Trash2,
  GripVertical,
  Settings2,
  Sparkles,
  BookOpen,
  Mic,
  Volume2,
  Clock,
  Layers,
  FolderOpen,
  RefreshCw,
  X,
  Check,
  AlertCircle
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/authBridge";
import { GuestGenerateModal } from "@/components/guest-generate-modal";

interface FishAudioVoice {
  _id: string;
  type: string;
  title: string;
  description?: string;
  cover_image?: string;
  state: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  visibility: string;
  like_count: number;
  mark_count: number;
  shared_count: number;
  task_count: number;
  languages?: string[];
  author?: {
    _id: string;
    nickname: string;
    avatar: string;
  };
}

interface ListVoicesResponse {
  total: number;
  items: FishAudioVoice[];
}

interface MyVoice {
  voiceId: string;
  name: string;
  description?: string;
  isActive: boolean;
  provider: string;
  createdAt: string;
}

interface StorySegment {
  id: string;
  orderIndex: number;
  speakerLabel?: string;
  voiceId?: string;
  voiceName?: string;
  text: string;
  emotionTags?: string[];
  status: string;
  audioUrl?: string;
  durationMs?: number;
}

interface StoryProject {
  id: string;
  title: string;
  mode: string;
  status: string;
  settings?: any;
  combinedAudioUrl?: string;
  totalDurationMs?: number;
  createdAt: string;
  segments?: StorySegment[];
}

const MAX_CHARS = 30000;
const PAGE_SIZE = 20;

const EMOTION_CATEGORIES = {
  basic: {
    label: "Basic Emotions",
    emotions: ["happy", "sad", "angry", "fearful", "surprised", "disgusted", "neutral", "confused", "excited", "calm", "anxious", "hopeful", "disappointed", "proud", "embarrassed", "guilty", "jealous", "loving", "nostalgic", "curious", "bored", "amused", "relieved", "content"]
  },
  advanced: {
    label: "Advanced Emotions",
    emotions: ["melancholic", "ecstatic", "furious", "terrified", "astonished", "repulsed", "indifferent", "perplexed", "elated", "serene", "panicked", "optimistic", "dejected", "triumphant", "mortified", "remorseful", "envious", "adoring", "wistful", "inquisitive", "apathetic", "entertained", "liberated", "gratified", "yearning"]
  },
  tone: {
    label: "Tone Markers",
    emotions: ["whispering", "shouting", "sarcastic", "formal", "casual"]
  },
  effects: {
    label: "Audio Effects",
    emotions: ["echo", "reverb", "distorted", "robotic", "underwater", "telephone", "radio", "stadium", "cave", "forest"]
  }
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default function StoryStudio() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { getModelCost } = usePricing();

  const [activeMode, setActiveMode] = useState<"instant" | "advanced">("instant");
  const [showGuestModal, setShowGuestModal] = useState(false);

  const [instantText, setInstantText] = useState("");
  const [instantVoice, setInstantVoice] = useState<FishAudioVoice | null>(null);
  const [instantEmotions, setInstantEmotions] = useState<string[]>([]);
  const [showEmotionPicker, setShowEmotionPicker] = useState(false);
  const [instantAudioUrl, setInstantAudioUrl] = useState<string | null>(null);
  const [isInstantPlaying, setIsInstantPlaying] = useState(false);
  const instantAudioRef = useRef<HTMLAudioElement | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [temperature, setTemperature] = useState([0.9]);
  const [speed, setSpeed] = useState([1.0]);

  const [currentProject, setCurrentProject] = useState<StoryProject | null>(null);
  const [segments, setSegments] = useState<StorySegment[]>([]);
  const [projectTitle, setProjectTitle] = useState("");
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);

  const [voiceSearchQuery, setVoiceSearchQuery] = useState("");
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [voiceSelectorTarget, setVoiceSelectorTarget] = useState<"instant" | string>("instant");

  const {
    data: voicesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: voicesLoading,
  } = useInfiniteQuery({
    queryKey: ["/api/fish-audio/voices", voiceSearchQuery],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page_size: PAGE_SIZE.toString(),
        page_number: pageParam.toString(),
        sort_by: "score",
      });
      if (voiceSearchQuery.trim()) {
        params.set("title", voiceSearchQuery.trim());
      }
      const response = await fetch(`/api/fish-audio/voices?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch voices");
      }
      return response.json() as Promise<ListVoicesResponse>;
    },
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((acc, page) => acc + page.items.length, 0);
      if (totalFetched < lastPage.total) {
        return allPages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const { data: myVoices = [], isLoading: myVoicesLoading } = useQuery<MyVoice[]>({
    queryKey: ["/api/fish-audio/my-voices"],
    enabled: isAuthenticated,
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<StoryProject[]>({
    queryKey: ["/api/story-projects"],
    enabled: isAuthenticated,
  });

  const allVoices = voicesData?.pages.flatMap(page => page.items) || [];

  const instantGenerateMutation = useMutation({
    mutationFn: async (params: {
      text: string;
      voiceId: string;
      voiceName: string;
      temperature: number;
      speed: number;
      title?: string;
    }) => {
      const response = await fetchWithAuth("/api/story-studio/generate-instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Generation failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setInstantAudioUrl(data.audioUrl);
      toast({
        title: "Speech Generated",
        description: "Your audio is ready to play!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/story-projects"] });
      
      if (instantAudioRef.current) {
        instantAudioRef.current.src = data.audioUrl;
        instantAudioRef.current.play().then(() => {
          setIsInstantPlaying(true);
        }).catch(() => {});
      }
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate speech",
        variant: "destructive",
      });
    },
  });

  const advancedGenerateMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetchWithAuth("/api/story-studio/generate-advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Generation failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Generation Started",
        description: `Processing ${data.segmentCount} segments...`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/story-projects"] });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to start generation",
        variant: "destructive",
      });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (params: { title: string; mode: string }) => {
      const response = await fetchWithAuth("/api/story-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create project");
      }
      
      return response.json();
    },
    onSuccess: (project) => {
      setCurrentProject(project);
      setSegments([]);
      setShowNewProjectDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/story-projects"] });
      toast({
        title: "Project Created",
        description: `"${project.title}" is ready for your story!`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addSegmentMutation = useMutation({
    mutationFn: async (params: { projectId: string; text: string; voiceId?: string; voiceName?: string; speakerLabel?: string; emotionTags?: string[] }) => {
      const response = await fetchWithAuth(`/api/story-projects/${params.projectId}/segments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to add segment");
      }
      
      return response.json();
    },
    onSuccess: (segment) => {
      setSegments(prev => [...prev, segment]);
      queryClient.invalidateQueries({ queryKey: ["/api/story-projects", currentProject?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSegmentMutation = useMutation({
    mutationFn: async (params: { projectId: string; segmentId: string }) => {
      const response = await fetchWithAuth(`/api/story-projects/${params.projectId}/segments/${params.segmentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete segment");
      }
      
      return response.json();
    },
    onSuccess: (_, params) => {
      setSegments(prev => prev.filter(s => s.id !== params.segmentId));
      queryClient.invalidateQueries({ queryKey: ["/api/story-projects", currentProject?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInstantGenerate = () => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }

    if (!instantText.trim()) {
      toast({
        title: "Text Required",
        description: "Please enter text to convert to speech.",
        variant: "destructive",
      });
      return;
    }

    if (!instantVoice) {
      toast({
        title: "Voice Required",
        description: "Please select a voice.",
        variant: "destructive",
      });
      return;
    }

    let processedText = instantText;
    if (instantEmotions.length > 0) {
      const emotionPrefix = instantEmotions.map(e => `[${e}]`).join("");
      processedText = `${emotionPrefix} ${instantText}`;
    }

    instantGenerateMutation.mutate({
      text: processedText,
      voiceId: instantVoice._id,
      voiceName: instantVoice.title,
      temperature: temperature[0],
      speed: speed[0],
      title: `Instant Speech - ${new Date().toLocaleDateString()}`,
    });
  };

  const handleAdvancedGenerate = () => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }

    if (!currentProject) {
      toast({
        title: "No Project",
        description: "Please create or select a project first.",
        variant: "destructive",
      });
      return;
    }

    if (segments.length === 0) {
      toast({
        title: "No Segments",
        description: "Add at least one segment to your story.",
        variant: "destructive",
      });
      return;
    }

    advancedGenerateMutation.mutate(currentProject.id);
  };

  const handleSelectVoice = (voice: FishAudioVoice) => {
    if (voiceSelectorTarget === "instant") {
      setInstantVoice(voice);
    } else {
      const segmentIndex = segments.findIndex(s => s.id === voiceSelectorTarget);
      if (segmentIndex >= 0) {
        const updatedSegments = [...segments];
        updatedSegments[segmentIndex] = {
          ...updatedSegments[segmentIndex],
          voiceId: voice._id,
          voiceName: voice.title,
        };
        setSegments(updatedSegments);
      }
    }
    setShowVoiceSelector(false);
  };

  const handleLoadProject = async (project: StoryProject) => {
    try {
      const response = await fetchWithAuth(`/api/story-projects/${project.id}`, {
        credentials: "include",
      });
      if (response.ok) {
        const fullProject = await response.json();
        setCurrentProject(fullProject);
        setSegments(fullProject.segments || []);
        setActiveMode("advanced");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load project",
        variant: "destructive",
      });
    }
  };

  const handleAddEmotionTag = (emotion: string) => {
    if (!instantEmotions.includes(emotion)) {
      setInstantEmotions([...instantEmotions, emotion]);
    }
  };

  const handleRemoveEmotionTag = (emotion: string) => {
    setInstantEmotions(instantEmotions.filter(e => e !== emotion));
  };

  const addNewSegment = () => {
    if (!currentProject) return;
    
    const newSegment: StorySegment = {
      id: `temp-${Date.now()}`,
      orderIndex: segments.length,
      text: "",
      status: "draft",
    };
    setSegments([...segments, newSegment]);
    setEditingSegmentId(newSegment.id);
  };

  const updateSegmentText = (segmentId: string, text: string) => {
    setSegments(prev => prev.map(s => 
      s.id === segmentId ? { ...s, text } : s
    ));
  };

  const saveSegment = async (segment: StorySegment) => {
    if (!currentProject || !segment.text.trim()) return;
    
    if (segment.id.startsWith("temp-")) {
      addSegmentMutation.mutate({
        projectId: currentProject.id,
        text: segment.text,
        voiceId: segment.voiceId,
        voiceName: segment.voiceName,
        speakerLabel: segment.speakerLabel,
        emotionTags: segment.emotionTags,
      });
    }
    setEditingSegmentId(null);
  };

  const ttsCost = getModelCost("fish-audio-tts");

  return (
    <SidebarInset className="flex flex-col h-screen overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-lg" data-testid="text-page-title">Story Studio</h1>
        </div>
        <Badge variant="secondary" className="ml-2">Beta</Badge>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r flex flex-col bg-muted/30">
          <div className="p-4 border-b">
            <h2 className="font-medium text-sm flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Projects
            </h2>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {projectsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No projects yet
                </div>
              ) : (
                projects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => handleLoadProject(project)}
                    className={`w-full p-3 rounded-lg text-left hover-elevate transition-colors ${
                      currentProject?.id === project.id ? 'bg-primary/10 border border-primary/20' : ''
                    }`}
                    data-testid={`button-project-${project.id}`}
                  >
                    <div className="font-medium text-sm truncate">{project.title}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">
                        {project.mode === 'instant' ? 'Instant' : 'Advanced'}
                      </Badge>
                      <span>{project.status}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="p-3 border-t">
            <Button
              onClick={() => setShowNewProjectDialog(true)}
              className="w-full"
              variant="outline"
              data-testid="button-new-project"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as "instant" | "advanced")} className="flex-1 flex flex-col">
            <div className="border-b px-4">
              <TabsList className="h-12">
                <TabsTrigger value="instant" className="gap-2" data-testid="tab-instant">
                  <Sparkles className="h-4 w-4" />
                  Instant Speech
                </TabsTrigger>
                <TabsTrigger value="advanced" className="gap-2" data-testid="tab-advanced">
                  <Layers className="h-4 w-4" />
                  Advanced Audio Story
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="instant" className="flex-1 overflow-auto m-0 p-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Quick Text-to-Speech
                    </CardTitle>
                    <CardDescription>
                      Convert text to natural speech with emotional expressions. Add emotion tags to control the tone and style.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="instant-voice">Voice</Label>
                        {instantVoice && (
                          <span className="text-sm text-muted-foreground">{instantVoice.title}</span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        className="w-full justify-start h-auto py-3"
                        onClick={() => {
                          setVoiceSelectorTarget("instant");
                          setShowVoiceSelector(true);
                        }}
                        data-testid="button-select-instant-voice"
                      >
                        {instantVoice ? (
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={instantVoice.cover_image} />
                              <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                            </Avatar>
                            <div className="text-left">
                              <div className="font-medium">{instantVoice.title}</div>
                              <div className="text-xs text-muted-foreground">{instantVoice.author?.nickname || "Unknown"}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Select a voice...</span>
                        )}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Emotion Tags</Label>
                        <span className="text-xs text-muted-foreground">{instantEmotions.length} selected</span>
                      </div>
                      
                      {instantEmotions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {instantEmotions.map(emotion => (
                            <Badge
                              key={emotion}
                              variant="secondary"
                              className="cursor-pointer"
                              onClick={() => handleRemoveEmotionTag(emotion)}
                            >
                              [{emotion}]
                              <X className="h-3 w-3 ml-1" />
                            </Badge>
                          ))}
                        </div>
                      )}

                      <Collapsible open={showEmotionPicker} onOpenChange={setShowEmotionPicker}>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2" data-testid="button-emotion-picker">
                            <Plus className="h-3 w-3" />
                            Add Emotions
                            <ChevronDown className={`h-3 w-3 transition-transform ${showEmotionPicker ? 'rotate-180' : ''}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <Card className="p-4">
                            <div className="space-y-4">
                              {Object.entries(EMOTION_CATEGORIES).map(([key, category]) => (
                                <div key={key}>
                                  <h4 className="text-sm font-medium mb-2">{category.label}</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {category.emotions.map(emotion => (
                                      <Badge
                                        key={emotion}
                                        variant={instantEmotions.includes(emotion) ? "default" : "outline"}
                                        className="cursor-pointer"
                                        onClick={() => {
                                          if (instantEmotions.includes(emotion)) {
                                            handleRemoveEmotionTag(emotion);
                                          } else {
                                            handleAddEmotionTag(emotion);
                                          }
                                        }}
                                        data-testid={`badge-emotion-${emotion}`}
                                      >
                                        {emotion}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </Card>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="instant-text">Text</Label>
                        <span className="text-xs text-muted-foreground">
                          {instantText.length} / {MAX_CHARS.toLocaleString()}
                        </span>
                      </div>
                      <Textarea
                        id="instant-text"
                        placeholder="Enter text to convert to speech... Emotion tags will be prepended automatically based on your selection above."
                        value={instantText}
                        onChange={(e) => setInstantText(e.target.value.slice(0, MAX_CHARS))}
                        className="min-h-[200px] resize-none"
                        data-testid="input-instant-text"
                      />
                      {instantEmotions.length > 0 && instantText && (
                        <div className="p-3 bg-muted rounded-lg text-sm">
                          <span className="text-muted-foreground">Preview: </span>
                          <span className="text-primary font-mono">
                            {instantEmotions.map(e => `[${e}]`).join("")}
                          </span>{" "}
                          {instantText.slice(0, 100)}{instantText.length > 100 ? "..." : ""}
                        </div>
                      )}
                    </div>

                    <Collapsible open={showAdvancedSettings} onOpenChange={setShowAdvancedSettings}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2" data-testid="button-advanced-settings">
                          <Settings2 className="h-4 w-4" />
                          Advanced Settings
                          <ChevronDown className={`h-3 w-3 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Temperature: {temperature[0].toFixed(2)}</Label>
                            <Slider
                              value={temperature}
                              onValueChange={setTemperature}
                              min={0.1}
                              max={1.5}
                              step={0.1}
                              data-testid="slider-temperature"
                            />
                            <p className="text-xs text-muted-foreground">Controls randomness (lower = more consistent)</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Speed: {speed[0].toFixed(1)}x</Label>
                            <Slider
                              value={speed}
                              onValueChange={setSpeed}
                              min={0.5}
                              max={2.0}
                              step={0.1}
                              data-testid="slider-speed"
                            />
                            <p className="text-xs text-muted-foreground">Playback speed (1.0 = normal)</p>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Cost: <span className="font-medium text-foreground">{ttsCost} credits</span>
                      </div>
                      <Button
                        onClick={handleInstantGenerate}
                        disabled={instantGenerateMutation.isPending || !instantVoice || !instantText.trim()}
                        data-testid="button-generate-instant"
                      >
                        {instantGenerateMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate Speech
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {instantAudioUrl && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Volume2 className="h-5 w-5" />
                        Generated Audio
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => {
                            if (instantAudioRef.current) {
                              if (isInstantPlaying) {
                                instantAudioRef.current.pause();
                              } else {
                                instantAudioRef.current.play();
                              }
                              setIsInstantPlaying(!isInstantPlaying);
                            }
                          }}
                          data-testid="button-play-instant"
                        >
                          {isInstantPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <audio
                          ref={instantAudioRef}
                          src={instantAudioUrl}
                          onEnded={() => setIsInstantPlaying(false)}
                          className="flex-1"
                          controls
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = instantAudioUrl;
                            a.download = "story-speech.mp3";
                            a.click();
                          }}
                          data-testid="button-download-instant"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="flex-1 overflow-auto m-0 p-6">
              <div className="max-w-5xl mx-auto space-y-6">
                {!currentProject ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-medium text-lg mb-2">No Project Selected</h3>
                      <p className="text-muted-foreground text-center mb-4 max-w-md">
                        Create a new project or select an existing one from the sidebar to start building your multi-character audio story.
                      </p>
                      <Button onClick={() => setShowNewProjectDialog(true)} data-testid="button-create-first-project">
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Project
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              {currentProject.title}
                              <Badge variant={currentProject.status === 'completed' ? 'default' : 'secondary'}>
                                {currentProject.status}
                              </Badge>
                            </CardTitle>
                            <CardDescription>
                              {segments.length} segment{segments.length !== 1 ? 's' : ''} 
                              {currentProject.totalDurationMs ? ` • ${formatDuration(currentProject.totalDurationMs)}` : ''}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/story-projects", currentProject.id] })}>
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>

                    <div className="space-y-3">
                      {segments.map((segment, index) => (
                        <Card key={segment.id} className="relative">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex items-center gap-2 text-muted-foreground cursor-grab">
                                <GripVertical className="h-5 w-5" />
                                <span className="text-sm font-medium w-6">{index + 1}</span>
                              </div>

                              <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => {
                                      setVoiceSelectorTarget(segment.id);
                                      setShowVoiceSelector(true);
                                    }}
                                    data-testid={`button-segment-voice-${index}`}
                                  >
                                    <Mic className="h-3 w-3 mr-2" />
                                    {segment.voiceName || "Select Voice"}
                                  </Button>
                                  <Input
                                    placeholder="Character name..."
                                    value={segment.speakerLabel || ""}
                                    onChange={(e) => {
                                      const updatedSegments = [...segments];
                                      updatedSegments[index] = { ...segment, speakerLabel: e.target.value };
                                      setSegments(updatedSegments);
                                    }}
                                    className="h-8 w-40"
                                    data-testid={`input-segment-speaker-${index}`}
                                  />
                                  {segment.status === 'completed' && segment.audioUrl && (
                                    <Badge variant="default" className="gap-1">
                                      <Check className="h-3 w-3" />
                                      Ready
                                    </Badge>
                                  )}
                                  {segment.status === 'generating' && (
                                    <Badge variant="secondary" className="gap-1">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Generating
                                    </Badge>
                                  )}
                                  {segment.status === 'failed' && (
                                    <Badge variant="destructive" className="gap-1">
                                      <AlertCircle className="h-3 w-3" />
                                      Failed
                                    </Badge>
                                  )}
                                </div>

                                <Textarea
                                  placeholder="Enter dialogue or narration..."
                                  value={segment.text}
                                  onChange={(e) => updateSegmentText(segment.id, e.target.value)}
                                  className="min-h-[80px] resize-none"
                                  data-testid={`input-segment-text-${index}`}
                                />

                                {segment.audioUrl && (
                                  <audio src={segment.audioUrl} controls className="w-full h-8" />
                                )}
                              </div>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  if (segment.id.startsWith("temp-")) {
                                    setSegments(prev => prev.filter(s => s.id !== segment.id));
                                  } else if (currentProject) {
                                    deleteSegmentMutation.mutate({
                                      projectId: currentProject.id,
                                      segmentId: segment.id,
                                    });
                                  }
                                }}
                                data-testid={`button-delete-segment-${index}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      <Button
                        variant="outline"
                        className="w-full border-dashed h-16"
                        onClick={addNewSegment}
                        data-testid="button-add-segment"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Segment
                      </Button>
                    </div>

                    <Card>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">
                            Estimated cost: <span className="font-medium text-foreground">{ttsCost * segments.length} credits</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {ttsCost} credits per segment × {segments.length} segments
                          </div>
                        </div>
                        <Button
                          onClick={handleAdvancedGenerate}
                          disabled={advancedGenerateMutation.isPending || segments.length === 0 || segments.some(s => !s.text.trim())}
                          size="lg"
                          data-testid="button-generate-advanced"
                        >
                          {advancedGenerateMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Starting...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Generate All Audio
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-title">Project Title</Label>
              <Input
                id="project-title"
                placeholder="My Audio Story"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                data-testid="input-project-title"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (projectTitle.trim()) {
                  createProjectMutation.mutate({
                    title: projectTitle.trim(),
                    mode: "advanced",
                  });
                  setProjectTitle("");
                }
              }}
              disabled={createProjectMutation.isPending || !projectTitle.trim()}
              data-testid="button-create-project"
            >
              {createProjectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showVoiceSelector} onOpenChange={setShowVoiceSelector}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Select Voice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search voices..."
                value={voiceSearchQuery}
                onChange={(e) => setVoiceSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-voice-search"
              />
            </div>
            <ScrollArea className="h-[400px]">
              <div className="grid grid-cols-2 gap-2">
                {myVoices.length > 0 && (
                  <>
                    <div className="col-span-2 text-sm font-medium text-muted-foreground py-2">My Cloned Voices</div>
                    {myVoices.map(voice => (
                      <button
                        key={voice.voiceId}
                        onClick={() => handleSelectVoice({
                          _id: voice.voiceId,
                          title: voice.name,
                          type: "tts",
                          state: voice.isActive ? "trained" : "inactive",
                          tags: [],
                          created_at: voice.createdAt,
                          updated_at: voice.createdAt,
                          visibility: "private",
                          like_count: 0,
                          mark_count: 0,
                          shared_count: 0,
                          task_count: 0,
                        })}
                        className="p-3 rounded-lg border hover-elevate text-left flex items-center gap-3"
                        data-testid={`button-my-voice-${voice.voiceId}`}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback><Mic className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{voice.name}</div>
                          <div className="text-xs text-muted-foreground">Cloned Voice</div>
                        </div>
                      </button>
                    ))}
                    <div className="col-span-2 text-sm font-medium text-muted-foreground py-2 border-t mt-2 pt-4">Public Voices</div>
                  </>
                )}
                {voicesLoading ? (
                  <div className="col-span-2 flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  allVoices.map(voice => (
                    <button
                      key={voice._id}
                      onClick={() => handleSelectVoice(voice)}
                      className="p-3 rounded-lg border hover-elevate text-left flex items-center gap-3"
                      data-testid={`button-voice-${voice._id}`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={voice.cover_image} />
                        <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{voice.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {voice.author?.nickname || "Unknown"} • {voice.like_count} likes
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              {hasNextPage && (
                <Button
                  variant="ghost"
                  className="w-full mt-4"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load more"}
                </Button>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <GuestGenerateModal 
        open={showGuestModal} 
        onOpenChange={setShowGuestModal} 
      />
    </SidebarInset>
  );
}
