import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Video, Plus, X, ArrowUp, ArrowDown, Combine, Music, Type, Zap, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset } from "@/components/ui/sidebar";

interface Generation {
  id: string;
  type: string;
  status: string;
  model: string;
  prompt: string;
  resultUrl: string | null;
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

interface Speed {
  mode: 'none' | 'custom';
  multipliers?: number[]; // For backend API
}

interface SpeedState {
  mode: 'none' | 'custom';
  values?: Record<string, number>; // Internal state keyed by videoId
}

interface Transitions {
  mode: 'none' | 'crossfade';
  durationSeconds?: number;
}

interface BackgroundMusic {
  audioUrl: string;
  volume?: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
}

interface Enhancements {
  transitions?: Transitions;
  backgroundMusic?: BackgroundMusic;
  textOverlays?: TextOverlay[];
  speed?: SpeedState; // Internal state uses Record
}

type EditorStep = 'select' | 'arrange' | 'enhance';

export default function VideoEditor() {
  const { toast } = useToast();
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<EditorStep>('select');
  const [enhancements, setEnhancements] = useState<Enhancements>({});
  const [musicFile, setMusicFile] = useState<File | null>(null);

  // Synchronize speed values with selectedVideoIds to prevent orphaned entries
  useEffect(() => {
    if (enhancements.speed?.mode === 'custom' && enhancements.speed.values) {
      const currentValues = enhancements.speed.values;
      const validVideoIds = new Set(selectedVideoIds);
      
      // Check if any videoId in values is not in selectedVideoIds
      const valueKeys = Object.keys(currentValues);
      const hasOrphans = valueKeys.some(id => !validVideoIds.has(id));
      
      if (hasOrphans) {
        // Remove orphaned entries while preserving valid ones
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

  // Fetch user's completed video generations
  const { data: generations = [], isLoading: loadingGenerations } = useQuery<Generation[]>({
    queryKey: ['/api/generations'],
  });

  // Fetch user's video combinations
  const { data: combinations = [], isLoading: loadingCombinations } = useQuery<VideoCombination[]>({
    queryKey: ['/api/video-combinations'],
  });

  // Filter only completed videos
  const availableVideos = generations.filter(
    g => g.type === 'video' && g.status === 'completed' && g.resultUrl
  );

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
      // Reset selection
      setSelectedVideoIds([]);
      setCurrentStep('select');
      setEnhancements({});
      setMusicFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Combination Failed",
        description: error.message || "Failed to start video combination",
        variant: "destructive",
      });
    },
  });

  // Calculate dynamic cost based on enhancements
  const calculateCost = () => {
    let cost = 75; // Base cost
    if (enhancements.transitions?.mode === 'crossfade') cost += 25;
    if (musicFile) cost += 25;
    if (enhancements.textOverlays && enhancements.textOverlays.length > 0) {
      cost += 25 * enhancements.textOverlays.length; // 25 credits per overlay
    }
    if (enhancements.speed?.mode === 'custom') cost += 25;
    return cost;
  };

  // Helper to get speed map
  const getSpeedMap = () => enhancements.speed?.values ?? {};

  // Validate enhancements before submission
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
      // Deselecting - remove video and clean up its speed multiplier
      setSelectedVideoIds(selectedVideoIds.filter(id => id !== videoId));
      
      if (enhancements.speed?.mode === 'custom' && enhancements.speed.values) {
        const { [videoId]: _, ...remainingValues } = enhancements.speed.values;
        setEnhancements(prev => ({
          ...prev,
          speed: { mode: 'custom', values: remainingValues }
        }));
      }
    } else {
      // Selecting - add video
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

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const newOrder = [...selectedVideoIds];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setSelectedVideoIds(newOrder);
      // Speed multipliers stay associated with videoIds automatically
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < selectedVideoIds.length - 1) {
      const newOrder = [...selectedVideoIds];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setSelectedVideoIds(newOrder);
      // Speed multipliers stay associated with videoIds automatically
    }
  };

  const handleRemoveFromSelection = (videoId: string) => {
    setSelectedVideoIds(selectedVideoIds.filter(id => id !== videoId));

    // Clean up speed multiplier for removed video
    if (enhancements.speed?.mode === 'custom' && enhancements.speed.values) {
      const { [videoId]: _, ...remainingValues } = enhancements.speed.values;
      setEnhancements(prev => ({
        ...prev,
        speed: { mode: 'custom', values: remainingValues }
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

    // Validate enhancements
    const validationError = validateEnhancements();
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    // Upload music file if present
    let musicUrl: string | undefined;
    if (musicFile) {
      const formData = new FormData();
      formData.append('file', musicFile);
      try {
        const response = await apiRequest('POST', '/api/upload-temp-file', formData) as { url: string };
        musicUrl = response.url;
      } catch (error: any) {
        toast({
          title: "Music Upload Failed",
          description: error.message || "Failed to upload background music",
          variant: "destructive",
        });
        return;
      }
    }

    // Construct enhancements payload - ONLY include enabled features (omit disabled)
    // Backend API expects mode: 'perClip' with perClip array, not 'custom' with multipliers
    const enhancementsData: {
      transitions?: Transitions;
      backgroundMusic?: BackgroundMusic;
      textOverlays?: TextOverlay[];
      speed?: {
        mode: 'perClip';
        perClip: Array<{ clipIndex: number; factor: number }>;
      };
    } = {};

    if (enhancements.transitions?.mode === 'crossfade') {
      enhancementsData.transitions = enhancements.transitions;
    }

    if (musicUrl) {
      enhancementsData.backgroundMusic = {
        audioUrl: musicUrl,
        volume: 0.3
        // fadeInSeconds and fadeOutSeconds are optional - omit to use backend defaults
      };
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

    // Only send enhancements if at least one feature is enabled
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
        <p className="text-muted-foreground">Combine multiple AI-generated videos into longer content</p>
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
            <CardTitle>Step 2: Arrange Order</CardTitle>
            <CardDescription>Drag to reorder your videos before combining</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {selectedVideoIds.map((videoId, index) => {
                const video = getVideoById(videoId);
                if (!video) return null;

                return (
                  <div
                    key={videoId}
                    className="flex items-center gap-3 p-3 bg-muted rounded-md"
                    data-testid={`row-selected-video-${index}`}
                  >
                    <div className="flex flex-col gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        data-testid={`button-move-up-${index}`}
                        className="h-6 w-6"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === selectedVideoIds.length - 1}
                        data-testid={`button-move-down-${index}`}
                        className="h-6 w-6"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                    </div>

                    <Badge variant="outline" data-testid={`badge-position-${index + 1}`}>#{index + 1}</Badge>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{video.model}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{video.prompt}</p>
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveFromSelection(videoId)}
                      data-testid={`button-remove-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

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
                      // Remove transitions enhancement entirely when disabled
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

            {/* Background Music */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Music className="w-5 h-5 text-primary" />
                  <Label className="text-base font-semibold">Background Music</Label>
                  <Badge variant="outline">+25 credits</Badge>
                </div>
              </div>
              <div className="pl-7">
                <Input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setMusicFile(file);
                    }
                  }}
                  data-testid="input-music-file"
                />
                {musicFile && (
                  <p className="text-sm text-muted-foreground mt-2">Selected: {musicFile.name}</p>
                )}
              </div>
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
                      // Create Record keyed by videoId with default 1.0
                      const speedMap = getSpeedMap();
                      const values = Object.fromEntries(
                        selectedVideoIds.map(id => [id, speedMap[id] ?? 1.0])
                      );
                      setEnhancements(prev => ({
                        ...prev,
                        speed: { mode: 'custom', values }
                      }));
                    } else {
                      // Remove speed enhancement entirely when disabled
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
                      <p className="text-xs text-destructive mt-1">{combo.errorMessage}</p>
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
