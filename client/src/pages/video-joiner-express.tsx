import { useState, useCallback, useRef, useEffect } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SidebarInset } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { fetchWithAuth, queryClient } from "@/lib/queryClient";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import type { Generation } from "@shared/schema";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Download,
  Film,
  Check,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Play,
  X,
  Trash2,
  Video,
  Coins,
  ArrowRight,
  Zap,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type WizardStep = 1 | 2 | 3;

interface VideoClip {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  prompt: string;
  createdAt: string;
}

interface ExportJobStatus {
  status: 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  error?: string;
}

function SortableClipItem({ clip, onRemove }: { clip: VideoClip; onRemove: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 bg-card border rounded-lg touch-none",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-2 hover:bg-muted rounded cursor-grab active:cursor-grabbing touch-none"
        data-testid={`drag-handle-${clip.id}`}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>
      
      <div className="w-20 h-12 rounded overflow-hidden bg-muted shrink-0">
        {clip.thumbnailUrl ? (
          <img
            src={clip.thumbnailUrl}
            alt={clip.prompt}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{clip.prompt || "Untitled Video"}</p>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onRemove(clip.id)}
        data-testid={`button-remove-${clip.id}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const steps = [
    { step: 1, label: "Select" },
    { step: 2, label: "Arrange" },
    { step: 3, label: "Export" },
  ];

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {steps.map(({ step, label }, index) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors",
                currentStep > step
                  ? "bg-primary text-primary-foreground"
                  : currentStep === step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {currentStep > step ? (
                <Check className="h-5 w-5" />
              ) : (
                step
              )}
            </div>
            <span className={cn(
              "text-xs mt-1",
              currentStep >= step ? "text-foreground" : "text-muted-foreground"
            )}>
              {label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "w-12 h-0.5 mx-2 transition-colors",
                currentStep > step ? "bg-primary" : "bg-muted"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function VideoJoinerExpress() {
  const { isAuthenticated, user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const { getModelCost } = usePricing();
  const baseCreditCost = getModelCost('video-combiner', 150);

  const [step, setStep] = useState<WizardStep>(1);
  const [selectedClips, setSelectedClips] = useState<VideoClip[]>([]);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const {
    data: videosData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingVideos,
  } = useInfiniteQuery({
    queryKey: ['/api/generations', { type: 'video', status: 'completed' }],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        type: 'video',
        status: 'completed',
        limit: '20',
        offset: String(pageParam),
      });
      const response = await fetchWithAuth(`/api/generations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch videos');
      return response.json();
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.generations || !Array.isArray(lastPage.generations)) {
        return undefined;
      }
      const totalFetched = allPages.reduce((sum, page) => sum + (page?.generations?.length ?? 0), 0);
      return totalFetched < (lastPage.total ?? 0) ? totalFetched : undefined;
    },
    initialPageParam: 0,
    enabled: isAuthenticated && !isAuthLoading,
  });

  const allVideos: Generation[] = videosData?.pages.flatMap(page => page.generations ?? []) ?? [];
  const selectedIds = new Set(selectedClips.map(c => c.id));

  const toggleVideoSelection = (video: Generation) => {
    if (!video.resultUrl) return;
    
    const existingIndex = selectedClips.findIndex(c => c.id === video.id);
    if (existingIndex >= 0) {
      setSelectedClips(prev => prev.filter(c => c.id !== video.id));
    } else {
      setSelectedClips(prev => [...prev, {
        id: video.id,
        url: video.resultUrl!,
        thumbnailUrl: video.thumbnailUrl || null,
        prompt: video.prompt || '',
        createdAt: video.createdAt.toString(),
      }]);
    }
  };

  const removeClip = useCallback((clipId: string) => {
    setSelectedClips(prev => prev.filter(c => c.id !== clipId));
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedClips(items => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const pollExportStatus = async (jobId: string) => {
    try {
      const response = await fetchWithAuth(`/api/video-editor/export/${jobId}`);
      if (!response.ok) return;

      const status: ExportJobStatus = await response.json();

      if (status.status === 'processing') {
        setExportProgress(prev => Math.min(prev + 5, 90));
      } else if (status.status === 'completed') {
        // Always stop polling on completed status
        stopPolling();
        setActiveJobId(null);
        
        if (status.downloadUrl) {
          setExportProgress(100);
          setExportedUrl(status.downloadUrl);
          queryClient.invalidateQueries({ queryKey: ['/api/generations'] });
          toast({
            title: "Export Complete!",
            description: "Your joined video is ready to download.",
          });
        } else {
          // Completed but no URL - treat as failure
          setExportProgress(0);
          toast({
            title: "Export Issue",
            description: "Export completed but no download URL was provided.",
            variant: "destructive",
          });
        }
      } else if (status.status === 'failed') {
        stopPolling();
        setExportProgress(0);
        setActiveJobId(null);

        toast({
          title: "Export Failed",
          description: status.error || "Failed to join videos",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error polling export status:', error);
    }
  };

  const exportMutation = useMutation({
    mutationFn: async () => {
      setExportProgress(10);

      const project = {
        clips: selectedClips.map((clip, index) => ({
          id: clip.id,
          sourceUrl: clip.url,
          order: index,
        })),
      };

      const enhancementsPayload = {
        transitions: { mode: 'none' as const },
        fadeIn: false,
        fadeOut: false,
        fadeDuration: 0.5,
        aspectRatio,
        speed: { mode: 'none' as const },
        textOverlays: [],
        clipSettings: [],
        captions: [],
      };

      const response = await fetchWithAuth('/api/video-editor/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project,
          enhancements: enhancementsPayload,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.jobId) {
        // Stop any existing polling before starting new one
        stopPolling();
        setActiveJobId(data.jobId);
        setExportProgress(20);
        
        pollingIntervalRef.current = setInterval(() => pollExportStatus(data.jobId), 3000);
      }
    },
    onError: (error: Error) => {
      setExportProgress(0);
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }
    exportMutation.mutate();
  };

  const resetEditor = () => {
    stopPolling();
    setStep(1);
    setSelectedClips([]);
    setAspectRatio('16:9');
    setExportProgress(0);
    setExportedUrl(null);
    setActiveJobId(null);
  };

  return (
    <SidebarInset>
      <div className="flex flex-col h-full">
        <header className="shrink-0 border-b px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Video Joiner Express</h1>
              <p className="text-xs text-muted-foreground">Quick & easy video combining</p>
            </div>
          </div>

          <Badge variant="secondary" className="flex items-center gap-1" data-testid="badge-credit-cost">
            <Coins className="h-3 w-3" />
            <span className="text-xs">{baseCreditCost} credits</span>
          </Badge>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col">
          <StepIndicator currentStep={step} />

          <div className="flex-1 overflow-hidden px-4 pb-4">
            {step === 1 && (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">Select Videos</h2>
                  <Badge variant="outline">
                    {selectedClips.length} selected
                  </Badge>
                </div>
                
                <ScrollArea className="flex-1 -mx-4 px-4">
                  {(isAuthLoading || isLoadingVideos) ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-video rounded-lg" />
                      ))}
                    </div>
                  ) : allVideos.length === 0 ? (
                    <Card className="p-8">
                      <div className="text-center">
                        <Video className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                        <h3 className="font-medium mb-1">No Videos Found</h3>
                        <p className="text-sm text-muted-foreground">
                          Generate some videos first to combine them here.
                        </p>
                      </div>
                    </Card>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {allVideos.map(video => {
                          const isSelected = selectedIds.has(video.id);
                          return (
                            <button
                              key={video.id}
                              onClick={() => toggleVideoSelection(video)}
                              className={cn(
                                "relative aspect-video rounded-lg overflow-hidden border-2 transition-all",
                                isSelected
                                  ? "border-primary ring-2 ring-primary/20"
                                  : "border-transparent hover:border-muted-foreground/30"
                              )}
                              data-testid={`video-select-${video.id}`}
                            >
                              {video.thumbnailUrl ? (
                                <img
                                  src={video.thumbnailUrl}
                                  alt={video.prompt || ''}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                  <Video className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                              
                              <div className={cn(
                                "absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                                isSelected ? "bg-primary" : "bg-black/50"
                              )}>
                                {isSelected ? (
                                  <Check className="h-4 w-4 text-white" />
                                ) : (
                                  <Circle className="h-4 w-4 text-white" />
                                )}
                              </div>
                              
                              {isSelected && (
                                <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded">
                                  {selectedClips.findIndex(c => c.id === video.id) + 1}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      
                      {hasNextPage && (
                        <div className="flex justify-center mt-4">
                          <Button
                            variant="outline"
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                            data-testid="button-load-more"
                          >
                            {isFetchingNextPage ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Load More
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </ScrollArea>

                <div className="pt-4 border-t mt-4">
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={selectedClips.length < 2}
                    onClick={() => setStep(2)}
                    data-testid="button-next-step"
                  >
                    Continue to Arrange
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  {selectedClips.length < 2 && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Select at least 2 videos to continue
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">Arrange Order</h2>
                  <Badge variant="outline">
                    {selectedClips.length} clips
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-4">
                  Drag and drop to reorder your videos
                </p>

                <ScrollArea className="flex-1 -mx-4 px-4">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={selectedClips.map(c => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {selectedClips.map((clip, index) => (
                          <div key={clip.id} className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground w-6 text-center">
                              {index + 1}
                            </span>
                            <div className="flex-1">
                              <SortableClipItem clip={clip} onRemove={removeClip} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </ScrollArea>

                <div className="pt-4 border-t mt-4 space-y-4">
                  <div className="flex items-center gap-4">
                    <Label className="shrink-0">Aspect Ratio:</Label>
                    <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as typeof aspectRatio)}>
                      <SelectTrigger className="w-32" data-testid="select-aspect-ratio">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16:9">16:9 Landscape</SelectItem>
                        <SelectItem value="9:16">9:16 Portrait</SelectItem>
                        <SelectItem value="1:1">1:1 Square</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setStep(1)}
                      data-testid="button-back"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => setStep(3)}
                      data-testid="button-next-export"
                    >
                      Continue to Export
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">Export Video</h2>
                </div>

                {!exportedUrl ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <Card className="w-full max-w-md">
                      <CardContent className="pt-6">
                        <div className="text-center mb-6">
                          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                            <Film className="h-8 w-8 text-primary" />
                          </div>
                          <h3 className="font-semibold text-lg mb-2">Ready to Join</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedClips.length} videos will be combined into one
                          </p>
                        </div>

                        <div className="space-y-3 mb-6">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Clips:</span>
                            <span className="font-medium">{selectedClips.length}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Aspect Ratio:</span>
                            <span className="font-medium">{aspectRatio}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Cost:</span>
                            <span className="font-medium">{baseCreditCost} credits</span>
                          </div>
                        </div>

                        {exportProgress > 0 && exportProgress < 100 && (
                          <div className="mb-6">
                            <div className="flex justify-between text-sm mb-2">
                              <span>Processing...</span>
                              <span>{exportProgress}%</span>
                            </div>
                            <Progress value={exportProgress} />
                          </div>
                        )}

                        <Button
                          className="w-full"
                          size="lg"
                          onClick={handleExport}
                          disabled={exportMutation.isPending || activeJobId !== null}
                          data-testid="button-export"
                        >
                          {exportMutation.isPending || activeJobId ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Zap className="h-4 w-4 mr-2" />
                              Join Videos
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>

                    <Button
                      variant="ghost"
                      className="mt-4"
                      onClick={() => setStep(2)}
                      disabled={exportMutation.isPending || activeJobId !== null}
                      data-testid="button-back-to-arrange"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back to Arrange
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <Card className="w-full max-w-md">
                      <CardContent className="pt-6">
                        <div className="text-center mb-6">
                          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                          </div>
                          <h3 className="font-semibold text-lg mb-2">Video Ready!</h3>
                          <p className="text-sm text-muted-foreground">
                            Your joined video has been created successfully
                          </p>
                        </div>

                        <div className="aspect-video rounded-lg overflow-hidden bg-black mb-6">
                          <video
                            src={exportedUrl}
                            controls
                            className="w-full h-full"
                            data-testid="video-preview"
                          />
                        </div>

                        <div className="space-y-3">
                          <Button
                            className="w-full"
                            size="lg"
                            asChild
                            data-testid="button-download"
                          >
                            <a href={exportedUrl} download target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4 mr-2" />
                              Download Video
                            </a>
                          </Button>

                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={resetEditor}
                            data-testid="button-create-another"
                          >
                            Create Another
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <GuestGenerateModal 
        open={showGuestModal} 
        onOpenChange={setShowGuestModal}
        featureName="Video Joiner Express"
      />
    </SidebarInset>
  );
}
