import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Video, Plus, X, Combine, Music, Type, Zap, Sparkles, Clock, ArrowDown, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimelinePreview } from "@/components/TimelinePreview";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { DraggableClip } from "@/components/DraggableTimeline";

interface Generation {
  id: string;
  type: string;
  status: string;
  model: string;
  prompt: string;
  resultUrl: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface VideoCombination {
  id: string;
  sourceVideoIds: string[];
  outputPath: string | null;
  status: string;
  errorMessage: string | null;
  creditsCost: number;
  durationSeconds: number | null;
  createdAt: string;
  completedAt: string | null;
}

interface TextOverlay {
  text: string;
  timing: 'intro' | 'outro' | 'all';
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

interface ClipTrim {
  startSeconds: number;
  endSeconds: number;
}

interface Speed {
  mode: 'none' | 'custom';
  multipliers?: number[];
}

interface SpeedState {
  mode: 'none' | 'custom' | 'perClip';
  values?: Record<string, number>;
  perClip?: Array<{ clipIndex: number; factor: number }>;
  globalFactor?: number;
}

interface Transitions {
  mode: 'none' | 'crossfade';
  durationSeconds?: number;
}

interface BackgroundMusic {
  audioUrl: string | null;
  volume?: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
}

interface Enhancements {
  transitions?: Transitions;
  backgroundMusic?: BackgroundMusic;
  textOverlays?: TextOverlay[];
  speed?: SpeedState;
  clipTrims?: Record<string, ClipTrim>;
}

type EditorStep = 'select' | 'arrange' | 'enhance';

// Translate technical errors to user-friendly messages
const getUserFriendlyErrorMessage = (technicalError: string | null): string => {
  if (!technicalError) return "An error occurred during video combination.";
  
  const errorLower = technicalError.toLowerCase();
  
  // FFmpeg/video processing errors
  if (errorLower.includes('ffprobe') || errorLower.includes('probe video metadata')) {
    return "Unable to read video file. The video format may be corrupted or unsupported. Please try with a different video.";
  }
  if (errorLower.includes('ffmpeg') || errorLower.includes('command failed')) {
    return "Video processing failed. This may be due to incompatible video formats or corrupted files. Please try again with different videos.";
  }
  if (errorLower.includes('format incompatibility')) {
    return "Video format is not supported. Please use standard video formats like MP4, WebM, or MOV.";
  }
  if (errorLower.includes('codec')) {
    return "Video codec is not supported. Please use videos with common codecs like H.264 or VP9.";
  }
  if (errorLower.includes('timeout') || errorLower.includes('exceeded')) {
    return "Video processing took too long and was cancelled. Please try with shorter videos.";
  }
  if (errorLower.includes('memory') || errorLower.includes('out of memory')) {
    return "Processing ran out of memory. Please try with shorter videos or fewer effects.";
  }
  
  // Default fallback
  return "Video combination failed. Please try again with different videos or fewer effects.";
};

export default function VideoEditor() {
  const { toast } = useToast();
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<EditorStep>('select');
  const [enhancements, setEnhancements] = useState<Enhancements>({});
  const [selectedSunoTrack, setSelectedSunoTrack] = useState<string | null>(null);
  const [allGenerations, setAllGenerations] = useState<Generation[]>([]);

  // Synchronize speed values with selectedVideoIds
  useEffect(() => {
    if (enhancements.speed?.mode === 'custom' && enhancements.speed.values) {
      const currentValues = enhancements.speed.values;
      const validVideoIds = new Set(selectedVideoIds);
      const valueKeys = Object.keys(currentValues);
      const hasOrphans = valueKeys.some(id => !validVideoIds.has(id));
      
      if (hasOrphans) {
        const cleanedValues = Object.fromEntries(
          Object.entries(currentValues).filter(([id]) => validVideoIds.has(id))
        );
        setEnhancements(prev => ({
          ...prev,
          speed: { mode: 'custom', values: cleanedValues }
        }));
      }
    }
  }, [selectedVideoIds]);

  // Fetch user's completed video generations - load ALL pages using authenticated fetch
  const { data: firstPageData = { data: [] }, isLoading: loadingGenerations } = useQuery<any>({
    queryKey: ['/api/generations'],
  });

  // Fetch user's video combinations
  const { data: combinations = [], isLoading: loadingCombinations } = useQuery<VideoCombination[]>({
    queryKey: ['/api/video-combinations'],
  });

  // Load all pages of generations when component mounts using queryClient.fetchQuery
  useEffect(() => {
    const fetchAllGenerations = async () => {
      try {
        let allGens: Generation[] = [];
        let cursor: string | undefined = undefined;
        let hasMore = true;

        // Fetch all paginated pages using queryClient.fetchQuery (properly authenticated)
        while (hasMore) {
          // queryClient's default queryFn joins queryKey with "/" so we need to include the full URL
          const url = cursor ? `/api/generations?cursor=${cursor}` : '/api/generations';
          
          // Use queryClient.fetchQuery which uses the authenticated queryFn
          const response: any = await queryClient.fetchQuery({
            queryKey: [url],
          });
          
          // Handle response - API returns either array or object with data property
          const pageData = Array.isArray(response) ? response : (response.data || []);
          const pageItems = Array.isArray(pageData) ? pageData : [];
          
          allGens = [...allGens, ...pageItems];
          
          // Check if there's a next page
          cursor = response.nextCursor;
          hasMore = !!cursor;
        }

        setAllGenerations(allGens);
      } catch (error) {
        console.error('Failed to fetch all generations:', error);
        // Fallback to first page data
        const pageData = Array.isArray(firstPageData) ? firstPageData : (firstPageData?.data || []);
        setAllGenerations(Array.isArray(pageData) ? pageData : []);
      }
    };

    if (!loadingGenerations) {
      fetchAllGenerations();
    }
  }, [loadingGenerations, firstPageData]);

  const generations = allGenerations;

  // Filter videos and music tracks
  const availableVideos = generations.filter(
    g => g.type === 'video' && g.status === 'completed' && g.resultUrl
  );

  const availableMusicTracks = generations.filter(
    g => g.type === 'music' && g.status === 'completed' && g.resultUrl
  );

  // Initialize backgroundMusic when Suno track is selected
  useEffect(() => {
    if (selectedSunoTrack) {
      const sunoTrack = availableMusicTracks.find(t => t.id === selectedSunoTrack);
      if (sunoTrack?.resultUrl) {
        setEnhancements(prev => {
          // Only update if audioUrl has changed to prevent infinite loop
          if (prev.backgroundMusic?.audioUrl === sunoTrack.resultUrl) {
            return prev;
          }
          return {
            ...prev,
            backgroundMusic: {
              audioUrl: sunoTrack.resultUrl,
              volume: prev.backgroundMusic?.volume ?? 0.3,
              fadeInSeconds: prev.backgroundMusic?.fadeInSeconds ?? 0,
              fadeOutSeconds: prev.backgroundMusic?.fadeOutSeconds ?? 0,
              trimStartSeconds: prev.backgroundMusic?.trimStartSeconds ?? 0,
              trimEndSeconds: prev.backgroundMusic?.trimEndSeconds ?? 0,
            }
          };
        });
      }
    } else {
      // Clear backgroundMusic when no track is selected
      setEnhancements(prev => {
        // Only update if backgroundMusic exists to prevent infinite loop
        if (!prev.backgroundMusic) {
          return prev;
        }
        const { backgroundMusic, ...rest } = prev;
        return rest;
      });
    }
  }, [selectedSunoTrack, availableMusicTracks]);

  // Combine videos mutation
  const combineMutation = useMutation({
    mutationFn: async ({ videoIds, enhancements: enhancementsData }: { videoIds: string[], enhancements?: Enhancements }) => {
      return await apiRequest('POST', '/api/combine-videos', { videoIds, enhancements: enhancementsData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-combinations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: "Video Combination Started",
        description: "Your videos are being combined. This may take a few minutes.",
      });
      setSelectedVideoIds([]);
      setCurrentStep('select');
      setEnhancements({});
      setSelectedSunoTrack(null);
    },
    onError: (error: any) => {
      toast({
        title: "Combination Failed",
        description: error.message || "Failed to start video combination",
        variant: "destructive",
      });
    },
  });

  const calculateCost = () => {
    let cost = 75;
    if (enhancements.transitions?.mode === 'crossfade') cost += 25;
    if (selectedSunoTrack) cost += 25;
    if (enhancements.textOverlays && enhancements.textOverlays.length > 0) {
      cost += 25 * enhancements.textOverlays.length;
    }
    if (enhancements.speed?.mode === 'custom') cost += 25;
    if (enhancements.clipTrims && Object.keys(enhancements.clipTrims).length > 0) cost += 10;
    return cost;
  };

  const getSpeedMap = () => enhancements.speed?.values ?? {};

  const validateEnhancements = (): string | null => {
    if (enhancements.textOverlays) {
      for (let i = 0; i < enhancements.textOverlays.length; i++) {
        const overlay = enhancements.textOverlays[i];
        if (!overlay.text.trim()) {
          return `Text overlay #${i + 1} has empty text`;
        }
        if (overlay.x < 0 || overlay.x > 100) {
          return `Text overlay #${i + 1} has invalid X position`;
        }
        if (overlay.y < 0 || overlay.y > 100) {
          return `Text overlay #${i + 1} has invalid Y position`;
        }
        if (overlay.fontSize < 12 || overlay.fontSize > 200) {
          return `Text overlay #${i + 1} has invalid font size`;
        }
      }
    }
    return null;
  };

  const handleToggleVideo = (videoId: string) => {
    if (selectedVideoIds.includes(videoId)) {
      setSelectedVideoIds(selectedVideoIds.filter(id => id !== videoId));
      if (enhancements.speed?.mode === 'custom' && enhancements.speed.values) {
        const { [videoId]: _, ...remainingValues } = enhancements.speed.values;
        setEnhancements(prev => ({
          ...prev,
          speed: { mode: 'custom', values: remainingValues }
        }));
      }
      if (enhancements.clipTrims?.[videoId]) {
        const { [videoId]: _, ...remainingTrims } = enhancements.clipTrims;
        setEnhancements(prev => ({
          ...prev,
          clipTrims: remainingTrims
        }));
      }
    } else {
      if (selectedVideoIds.length >= 20) {
        toast({
          title: "Maximum Reached",
          description: "You can combine up to 20 videos at once",
          variant: "destructive",
        });
        return;
      }
      setSelectedVideoIds([...selectedVideoIds, videoId]);
    }
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require dragging 8px before activating (prevents accidental drags)
      },
    })
  );

  // Handle drag end to reorder clips
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = selectedVideoIds.indexOf(active.id as string);
      const newIndex = selectedVideoIds.indexOf(over.id as string);

      setSelectedVideoIds(arrayMove(selectedVideoIds, oldIndex, newIndex));
    }
  };

  const handleRemoveFromSelection = (videoId: string) => {
    setSelectedVideoIds(selectedVideoIds.filter(id => id !== videoId));
    if (enhancements.speed?.mode === 'custom' && enhancements.speed.values) {
      const { [videoId]: _, ...remainingValues } = enhancements.speed.values;
      setEnhancements(prev => ({
        ...prev,
        speed: { mode: 'custom', values: remainingValues }
      }));
    }
    if (enhancements.clipTrims?.[videoId]) {
      const { [videoId]: _, ...remainingTrims } = enhancements.clipTrims;
      setEnhancements(prev => ({
        ...prev,
        clipTrims: remainingTrims
      }));
    }
  };

  const handleCombine = async () => {
    if (selectedVideoIds.length < 2) {
      toast({
        title: "Selection Required",
        description: "Please select at least 2 videos to combine",
        variant: "destructive",
      });
      return;
    }

    const validationError = validateEnhancements();
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    const enhancementsData: any = {};

    if (enhancements.transitions?.mode === 'crossfade') {
      enhancementsData.transitions = enhancements.transitions;
    }

    if (selectedSunoTrack) {
      const sunoTrack = availableMusicTracks.find(t => t.id === selectedSunoTrack);
      if (sunoTrack?.resultUrl) {
        enhancementsData.backgroundMusic = {
          audioUrl: sunoTrack.resultUrl,
          volume: enhancements.backgroundMusic?.volume ?? 0.3,
          fadeInSeconds: enhancements.backgroundMusic?.fadeInSeconds ?? 0,
          fadeOutSeconds: enhancements.backgroundMusic?.fadeOutSeconds ?? 0,
          trimStartSeconds: enhancements.backgroundMusic?.trimStartSeconds ?? 0,
          trimEndSeconds: enhancements.backgroundMusic?.trimEndSeconds ?? 0,
        };
      }
    }

    if (enhancements.textOverlays && enhancements.textOverlays.length > 0) {
      enhancementsData.textOverlays = enhancements.textOverlays;
    }

    if (enhancements.speed?.mode === 'custom') {
      const speedMap = getSpeedMap();
      const perClip = selectedVideoIds.map((id, index) => ({
        clipIndex: index,
        factor: speedMap[id] ?? 1.0
      }));
      enhancementsData.speed = { mode: 'perClip', perClip };
    }

    if (enhancements.clipTrims && Object.keys(enhancements.clipTrims).length > 0) {
      enhancementsData.clipTrims = Object.fromEntries(
        selectedVideoIds.map((id, index) => [index, enhancements.clipTrims![id] || { startSeconds: 0, endSeconds: 0 }])
      );
    }

    const finalEnhancements = Object.keys(enhancementsData).length > 0 ? enhancementsData : undefined;
    combineMutation.mutate({ videoIds: selectedVideoIds, enhancements: finalEnhancements });
  };

  const getVideoById = (id: string) => {
    return availableVideos.find(v => v.id === id);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      processing: "default",
      completed: "default",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "default"} data-testid={`badge-status-${status}`}>{status}</Badge>;
  };

  if (loadingGenerations) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <SidebarInset>
      <div className="h-full overflow-y-auto">
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-heading">Video Editor</h1>
            <p className="text-muted-foreground">Combine multiple AI-generated videos into longer content with professional enhancements</p>
          </div>

          {/* Selection Panel */}
          {currentStep === 'select' && (
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Select Videos</CardTitle>
                <CardDescription>Choose 2-20 videos to combine (in order)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {availableVideos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No completed videos available for combination</p>
                    <p className="text-sm mt-2">Generate some videos first!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableVideos.map((video) => {
                      const isSelected = selectedVideoIds.includes(video.id);
                      const selectionIndex = selectedVideoIds.indexOf(video.id);

                      return (
                        <Card
                          key={video.id}
                          className={`cursor-pointer transition-all hover-elevate ${
                            isSelected ? 'ring-2 ring-primary' : ''
                          }`}
                          onClick={() => handleToggleVideo(video.id)}
                          data-testid={`card-video-${video.id}`}
                        >
                          <CardContent className="p-4 space-y-2">
                            <div className="aspect-video bg-muted rounded-md overflow-hidden">
                              {video.resultUrl && (
                                <video
                                  src={video.resultUrl}
                                  className="w-full h-full object-cover"
                                  controls={false}
                                  muted
                                />
                              )}
                            </div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{video.model}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">{video.prompt}</p>
                              </div>
                              {isSelected && (
                                <Badge variant="default" data-testid={`badge-order-${selectionIndex + 1}`}>
                                  #{selectionIndex + 1}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {selectedVideoIds.length > 0 && (
                  <div className="sticky bottom-0 bg-background border-t pt-4 mt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {selectedVideoIds.length} video{selectedVideoIds.length !== 1 ? 's' : ''} selected
                      </p>
                      <Button 
                        onClick={() => setCurrentStep('arrange')}
                        data-testid="button-continue"
                      >
                        Continue to Arrange <ArrowDown className="ml-2 w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Arrangement Panel */}
          {currentStep === 'arrange' && selectedVideoIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 2: Arrange & Trim</CardTitle>
                <CardDescription>Reorder videos and set trim points for precision editing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Timeline Preview */}
                <TimelinePreview
                  clips={selectedVideoIds.map((videoId) => {
                    const video = getVideoById(videoId);
                    if (!video) return null;
                    
                    const trim = enhancements.clipTrims?.[videoId];
                    const speedData = enhancements.speed?.perClip?.find(s => s.clipIndex === selectedVideoIds.indexOf(videoId));
                    
                    return {
                      id: video.id,
                      url: video.resultUrl || '',
                      trim: trim,
                      speedFactor: speedData?.factor || enhancements.speed?.globalFactor || 1,
                    };
                  }).filter(Boolean) as any[]}
                />

                <Separator />

                {/* Draggable Timeline */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={selectedVideoIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2" data-testid="sortable-timeline">
                      {selectedVideoIds.map((videoId, index) => {
                        const video = getVideoById(videoId);
                        if (!video) return null;

                        // Clone trim object to prevent frozen state issues
                        const trim = { ...(enhancements.clipTrims?.[videoId] ?? { startSeconds: 0, endSeconds: 0 }) };

                        return (
                          <DraggableClip
                            key={videoId}
                            id={videoId}
                            index={index}
                            video={{
                              id: video.id,
                              model: video.model,
                              prompt: video.prompt,
                              resultUrl: video.resultUrl || '',
                              thumbnailUrl: video.thumbnailUrl,
                            }}
                            trim={trim}
                            onRemove={() => handleRemoveFromSelection(videoId)}
                            onTrimChange={(newTrim) => {
                              setEnhancements(prev => ({
                                ...prev,
                                clipTrims: {
                                  ...(prev.clipTrims ?? {}),
                                  [videoId]: newTrim
                                }
                              }));
                            }}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>

                <Separator />

                <div className="flex items-center justify-between">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep('select')}
                    data-testid="button-back"
                  >
                    Back to Selection
                  </Button>
                  <Button
                    onClick={() => setCurrentStep('enhance')}
                    data-testid="button-continue-enhance"
                  >
                    Continue to Enhancements <ArrowDown className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Enhancements Panel */}
          {currentStep === 'enhance' && selectedVideoIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 3: Configure Enhancements (Optional)</CardTitle>
                <CardDescription>Add professional polish to your combined video</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Rendering Time Warning */}
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex gap-3">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-200 mb-1">Rendering may take up to 20 minutes</h4>
                      <p className="text-xs text-blue-800 dark:text-blue-300">
                        Video combination and processing times depend on video length and selected enhancements. You can continue using Artivio while your video renders in the background.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Transitions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <Label className="text-base font-semibold">Crossfade Transitions</Label>
                      <Badge variant="outline">+25 credits</Badge>
                    </div>
                    <Switch
                      checked={enhancements.transitions?.mode === 'crossfade'}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEnhancements(prev => ({
                            ...prev,
                            transitions: { mode: 'crossfade', durationSeconds: 1.0 }
                          }));
                        } else {
                          const { transitions, ...rest } = enhancements;
                          setEnhancements(rest);
                        }
                      }}
                      data-testid="switch-transitions"
                    />
                  </div>
                  {enhancements.transitions?.mode === 'crossfade' && (
                    <div className="pl-7 space-y-2">
                      <Label className="text-sm">Duration: {enhancements.transitions.durationSeconds || 1.0}s</Label>
                      <Slider
                        value={[enhancements.transitions.durationSeconds || 1.0]}
                        onValueChange={([value]) => {
                          setEnhancements(prev => ({
                            ...prev,
                            transitions: { mode: 'crossfade', durationSeconds: value }
                          }));
                        }}
                        min={0.5}
                        max={3.0}
                        step={0.1}
                        data-testid="slider-transition-duration"
                      />
                    </div>
                  )}
                </div>

                <Separator />

                {/* Background Music - Now with Suno Integration */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Music className="w-5 h-5 text-primary" />
                      <Label className="text-base font-semibold">Background Music</Label>
                      <Badge variant="outline">+25 credits</Badge>
                    </div>
                  </div>
                  <Tabs defaultValue="suno" className="pl-7">
                    <TabsList className="grid w-full grid-cols-1">
                      <TabsTrigger value="suno">Suno Library</TabsTrigger>
                    </TabsList>
                    <TabsContent value="suno" className="space-y-3">
                      {availableMusicTracks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No Suno tracks generated yet. Create some music first!</p>
                      ) : (
                        <div className="space-y-3">
                          <Select value={selectedSunoTrack || ''} onValueChange={(v) => setSelectedSunoTrack(v || null)}>
                            <SelectTrigger data-testid="select-suno-track">
                              <SelectValue placeholder="Select a music track" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableMusicTracks.map((track) => (
                                <SelectItem key={track.id} value={track.id}>
                                  {track.prompt.substring(0, 50)}... ({new Date(track.createdAt).toLocaleDateString()})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedSunoTrack && (() => {
                            const currentTrack = availableMusicTracks.find(t => t.id === selectedSunoTrack);
                            const trackAudioUrl = currentTrack?.resultUrl || '';
                            
                            return (
                              <div className="space-y-3 p-3 bg-muted rounded-md">
                                <audio controls className="w-full h-8">
                                  <source src={trackAudioUrl} />
                                </audio>
                                
                                {/* Audio Trim Controls */}
                                <div className="space-y-2 pt-2 border-t">
                                  <Label className="text-sm font-medium">Audio Trim</Label>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">Start (s)</Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={enhancements.backgroundMusic?.trimStartSeconds ?? 0}
                                        onChange={(e) => {
                                          setEnhancements(prev => ({
                                            ...prev,
                                            backgroundMusic: {
                                              ...(prev.backgroundMusic || { audioUrl: trackAudioUrl, volume: 0.3, fadeInSeconds: 0, fadeOutSeconds: 0, trimStartSeconds: 0, trimEndSeconds: 0 }),
                                              trimStartSeconds: parseFloat(e.target.value) || 0
                                            }
                                          }));
                                        }}
                                      className="h-8 text-sm"
                                      data-testid="input-audio-trim-start"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">End (s)</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      value={enhancements.backgroundMusic?.trimEndSeconds ?? 0}
                                      onChange={(e) => {
                                        setEnhancements(prev => ({
                                          ...prev,
                                          backgroundMusic: {
                                            ...(prev.backgroundMusic || { audioUrl: trackAudioUrl, volume: 0.3, fadeInSeconds: 0, fadeOutSeconds: 0, trimStartSeconds: 0, trimEndSeconds: 0 }),
                                            trimEndSeconds: parseFloat(e.target.value) || 0
                                          }
                                        }));
                                      }}
                                      className="h-8 text-sm"
                                      placeholder="Auto"
                                      data-testid="input-audio-trim-end"
                                    />
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Leave end time at 0 to use full track duration
                                </p>
                              </div>

                              {/* Volume Control */}
                              <div className="space-y-2">
                                <Label className="text-sm">Volume: {((enhancements.backgroundMusic?.volume ?? 0.3) * 100).toFixed(0)}%</Label>
                                <Slider
                                  value={[(enhancements.backgroundMusic?.volume ?? 0.3) * 100]}
                                  onValueChange={([value]) => {
                                    setEnhancements(prev => ({
                                      ...prev,
                                      backgroundMusic: {
                                        ...(prev.backgroundMusic || { audioUrl: trackAudioUrl, volume: 0.3, fadeInSeconds: 0, fadeOutSeconds: 0, trimStartSeconds: 0, trimEndSeconds: 0 }),
                                        volume: value / 100
                                      }
                                    }));
                                  }}
                                  min={0}
                                  max={100}
                                  step={1}
                                  data-testid="slider-music-volume"
                                />
                              </div>

                              {/* Fade Controls */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <Label className="text-sm">Fade In: {enhancements.backgroundMusic?.fadeInSeconds ?? 0}s</Label>
                                  <Slider
                                    value={[enhancements.backgroundMusic?.fadeInSeconds ?? 0]}
                                    onValueChange={([value]) => {
                                      setEnhancements(prev => ({
                                        ...prev,
                                        backgroundMusic: {
                                          ...(prev.backgroundMusic || { audioUrl: trackAudioUrl, volume: 0.3, fadeInSeconds: 0, fadeOutSeconds: 0, trimStartSeconds: 0, trimEndSeconds: 0 }),
                                          fadeInSeconds: value
                                        }
                                      }));
                                    }}
                                    min={0}
                                    max={5}
                                    step={0.1}
                                    data-testid="slider-fade-in"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm">Fade Out: {enhancements.backgroundMusic?.fadeOutSeconds ?? 0}s</Label>
                                  <Slider
                                    value={[enhancements.backgroundMusic?.fadeOutSeconds ?? 0]}
                                    onValueChange={([value]) => {
                                      setEnhancements(prev => ({
                                        ...prev,
                                        backgroundMusic: {
                                          ...(prev.backgroundMusic || { audioUrl: trackAudioUrl, volume: 0.3, fadeInSeconds: 0, fadeOutSeconds: 0, trimStartSeconds: 0, trimEndSeconds: 0 }),
                                          fadeOutSeconds: value
                                        }
                                      }));
                                    }}
                                    min={0}
                                    max={5}
                                    step={0.1}
                                    data-testid="slider-fade-out"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                          })()}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>

                <Separator />

                {/* Text Overlays */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Type className="w-5 h-5 text-primary" />
                      <Label className="text-base font-semibold">Text Overlays</Label>
                      <Badge variant="outline">+30 credits</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const newOverlay: TextOverlay = {
                          text: '',
                          timing: 'all',
                          x: 50,
                          y: 50,
                          fontSize: 48,
                          color: '#FFFFFF'
                        };
                        setEnhancements(prev => ({
                          ...prev,
                          textOverlays: [...(prev.textOverlays || []), newOverlay]
                        }));
                      }}
                      data-testid="button-add-overlay"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Overlay
                    </Button>
                  </div>
                  {enhancements.textOverlays && enhancements.textOverlays.length > 0 && (
                    <div className="pl-7 space-y-4">
                      {enhancements.textOverlays.map((overlay, index) => (
                        <div key={index} className="p-4 bg-muted rounded-md space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="font-medium">Overlay #{index + 1}</Label>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEnhancements(prev => ({
                                  ...prev,
                                  textOverlays: prev.textOverlays?.filter((_, i) => i !== index)
                                }));
                              }}
                              data-testid={`button-remove-overlay-${index}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <Label className="text-sm">Text</Label>
                              <Textarea
                                value={overlay.text}
                                onChange={(e) => {
                                  setEnhancements(prev => ({
                                    ...prev,
                                    textOverlays: prev.textOverlays?.map((o, i) =>
                                      i === index ? { ...o, text: e.target.value } : o
                                    )
                                  }));
                                }}
                                placeholder="Enter overlay text..."
                                data-testid={`textarea-overlay-text-${index}`}
                              />
                            </div>
                            <div>
                              <Label className="text-sm">Timing</Label>
                              <Select
                                value={overlay.timing}
                                onValueChange={(value: 'intro' | 'outro' | 'all') => {
                                  setEnhancements(prev => ({
                                    ...prev,
                                    textOverlays: prev.textOverlays?.map((o, i) =>
                                      i === index ? { ...o, timing: value } : o
                                    )
                                  }));
                                }}
                              >
                                <SelectTrigger data-testid={`select-timing-${index}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="intro">Intro (first 3s)</SelectItem>
                                  <SelectItem value="outro">Outro (last 3s)</SelectItem>
                                  <SelectItem value="all">Always visible</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm">Font Size</Label>
                              <Input
                                type="number"
                                value={overlay.fontSize}
                                onChange={(e) => {
                                  setEnhancements(prev => ({
                                    ...prev,
                                    textOverlays: prev.textOverlays?.map((o, i) =>
                                      i === index ? { ...o, fontSize: parseInt(e.target.value) || 48 } : o
                                    )
                                  }));
                                }}
                                min={12}
                                max={200}
                                data-testid={`input-font-size-${index}`}
                              />
                            </div>
                            <div>
                              <Label className="text-sm">X Position (%)</Label>
                              <Input
                                type="number"
                                value={overlay.x}
                                onChange={(e) => {
                                  setEnhancements(prev => ({
                                    ...prev,
                                    textOverlays: prev.textOverlays?.map((o, i) =>
                                      i === index ? { ...o, x: parseInt(e.target.value) || 50 } : o
                                    )
                                  }));
                                }}
                                min={0}
                                max={100}
                                data-testid={`input-x-position-${index}`}
                              />
                            </div>
                            <div>
                              <Label className="text-sm">Y Position (%)</Label>
                              <Input
                                type="number"
                                value={overlay.y}
                                onChange={(e) => {
                                  setEnhancements(prev => ({
                                    ...prev,
                                    textOverlays: prev.textOverlays?.map((o, i) =>
                                      i === index ? { ...o, y: parseInt(e.target.value) || 50 } : o
                                    )
                                  }));
                                }}
                                min={0}
                                max={100}
                                data-testid={`input-y-position-${index}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Speed Control */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary" />
                      <Label className="text-base font-semibold">Speed Control</Label>
                      <Badge variant="outline">+25 credits</Badge>
                    </div>
                    <Switch
                      checked={enhancements.speed?.mode === 'custom'}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          const speedMap = getSpeedMap();
                          const values = Object.fromEntries(
                            selectedVideoIds.map(id => [id, speedMap[id] ?? 1.0])
                          );
                          setEnhancements(prev => ({
                            ...prev,
                            speed: { mode: 'custom', values }
                          }));
                        } else {
                          const { speed, ...rest } = enhancements;
                          setEnhancements(rest);
                        }
                      }}
                      data-testid="switch-speed"
                    />
                  </div>
                  {enhancements.speed?.mode === 'custom' && (
                    <div className="pl-7 space-y-3">
                      {selectedVideoIds.map((videoId, index) => {
                        const video = getVideoById(videoId);
                        const speedMap = getSpeedMap();
                        const multiplier = speedMap[videoId] ?? 1.0;
                        return (
                          <div key={videoId} className="space-y-2">
                            <Label className="text-sm">
                              Clip #{index + 1}: {video?.model} - {multiplier.toFixed(2)}x
                            </Label>
                            <Slider
                              value={[multiplier]}
                              onValueChange={([value]) => {
                                const newSpeedMap = { ...(enhancements.speed?.values ?? {}) };
                                newSpeedMap[videoId] = value;
                                setEnhancements(prev => ({
                                  ...prev,
                                  speed: { mode: 'custom', values: newSpeedMap }
                                }));
                              }}
                              min={0.25}
                              max={4.0}
                              step={0.25}
                              data-testid={`slider-speed-${index}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Separator />

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
                        <CardTitle className="text-sm">Organize Timeline Properly</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <p className="text-xs text-muted-foreground">Arrange clips in logical order before combining. Reorder using drag-and-drop to match your desired sequence for better storytelling.</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="p-4">
                        <CardTitle className="text-sm">Trim with Precision</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <p className="text-xs text-muted-foreground">Use exact trim points to remove unwanted footage. Test different trim values to ensure smooth transitions between clips.</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="p-4">
                        <CardTitle className="text-sm">Sync Audio Carefully</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <p className="text-xs text-muted-foreground">Add background music at appropriate volume levels. Use fade-in/fade-out to blend audio smoothly with video transitions.</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="p-4">
                        <CardTitle className="text-sm">Enhance for Quality</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <p className="text-xs text-muted-foreground">Use crossfade transitions for professional feel. Add text overlays to introduce sections. Adjust speed for dramatic effects.</p>
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>

                <div className="flex items-center justify-between pt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep('arrange')}
                    data-testid="button-back-arrange"
                  >
                    Back to Arrangement
                  </Button>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      Total Cost: <span className="font-bold text-foreground">{calculateCost()} credits</span>
                    </p>
                    <Button
                      onClick={handleCombine}
                      disabled={combineMutation.isPending || selectedVideoIds.length < 2}
                      data-testid="button-combine-final"
                    >
                      {combineMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                          Combining...
                        </>
                      ) : (
                        <>
                          <Combine className="mr-2 w-4 h-4" />
                          Combine Videos
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Combinations History */}
          <Card>
            <CardHeader>
              <CardTitle>Your Video Combinations</CardTitle>
              <CardDescription>Previously combined videos</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCombinations ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : combinations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No video combinations yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {combinations.map((combo) => (
                    <div
                      key={combo.id}
                      className="flex items-center gap-4 p-4 bg-muted rounded-md"
                      data-testid={`combination-${combo.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(combo.status)}
                          <Badge variant="outline">
                            {combo.sourceVideoIds.length} videos
                          </Badge>
                          {combo.durationSeconds && (
                            <Badge variant="outline">
                              {combo.durationSeconds}s
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Created: {formatDate(combo.createdAt)}
                        </p>
                        {combo.errorMessage && (
                          <p className="text-xs text-destructive mt-1 max-w-md">{getUserFriendlyErrorMessage(combo.errorMessage)}</p>
                        )}
                      </div>

                      {combo.status === 'completed' && combo.outputPath && (
                        <div className="flex gap-2">
                          <a
                            href={combo.outputPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`link-view-${combo.id}`}
                          >
                            <Button size="sm">
                              <Video className="mr-2 w-3 h-3" />
                              View
                            </Button>
                          </a>
                          <a
                            href={combo.outputPath}
                            download
                            data-testid={`link-download-${combo.id}`}
                          >
                            <Button size="sm" variant="outline">
                              Download
                            </Button>
                          </a>
                        </div>
                      )}

                      {combo.status === 'processing' && (
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      )}
                    </div>
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
