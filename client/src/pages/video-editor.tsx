import { useState, useMemo, useEffect, useRef } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SidebarInset } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth, apiRequest, queryClient } from "@/lib/queryClient";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { useIsMobile } from "@/hooks/use-mobile";
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
  ArrowRight,
  ArrowLeft,
  Trash2,
  Video,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

type WizardStep = 1 | 2 | 3;

interface VideoCombination {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  outputPath?: string;
  errorMessage?: string;
}

interface VideoClip {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  prompt: string;
  createdAt: string;
}

interface SortableClipProps {
  clip: VideoClip;
  onRemove: (id: string) => void;
  isMobile: boolean;
}

function SortableClip({ clip, onRemove, isMobile }: SortableClipProps) {
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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group bg-card border rounded-lg overflow-hidden shrink-0",
        isMobile ? "w-full" : "w-40",
        isDragging && "ring-2 ring-primary z-10"
      )}
      data-testid={`clip-${clip.id}`}
    >
      <div className="relative aspect-video bg-muted">
        {clip.thumbnailUrl || clip.url ? (
          <video
            src={clip.url}
            poster={clip.thumbnailUrl || undefined}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <Play className="h-6 w-6 text-white fill-white" />
        </div>
      </div>

      <div className="flex items-center gap-2 p-2">
        <button
          {...attributes}
          {...listeners}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
          data-testid={`drag-handle-${clip.id}`}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>
        <p className="flex-1 text-xs line-clamp-1 text-muted-foreground">
          {clip.prompt}
        </p>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={() => onRemove(clip.id)}
          data-testid={`remove-clip-${clip.id}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface VideoCardProps {
  generation: Generation;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

function VideoCard({ generation, isSelected, onToggle }: VideoCardProps) {
  const thumbnail = generation.thumbnailUrl || generation.resultUrl;

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden border bg-card cursor-pointer transition-all hover-elevate",
        isSelected && "ring-2 ring-primary border-primary"
      )}
      onClick={() => onToggle(generation.id)}
      data-testid={`video-card-${generation.id}`}
    >
      <div className="relative aspect-video bg-muted">
        {thumbnail ? (
          <video
            src={thumbnail}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <Play className="h-8 w-8 text-white fill-white" />
        </div>
        <div className="absolute top-2 left-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggle(generation.id)}
            className="bg-background/80 backdrop-blur-sm h-5 w-5"
            data-testid={`checkbox-${generation.id}`}
          />
        </div>
        {generation.model && (
          <Badge className="absolute top-2 right-2 text-xs" variant="secondary">
            {generation.model}
          </Badge>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm line-clamp-2 font-medium">{generation.prompt}</p>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(generation.createdAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

function VideoCardSkeleton() {
  return (
    <div className="rounded-lg overflow-hidden border bg-card">
      <Skeleton className="aspect-video w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export default function VideoEditor() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const isMobile = useIsMobile();

  const [step, setStep] = useState<WizardStep>(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [orderedClips, setOrderedClips] = useState<VideoClip[]>([]);
  const [page, setPage] = useState(1);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [activeCombinationId, setActiveCombinationId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const ITEMS_PER_PAGE = 12;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Use same pattern as History page - useInfiniteQuery with cursor-based pagination
  const {
    data: generationsData,
    isLoading: generationsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["/api/generations", { paginated: true, type: "video" }],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const cursor = pageParam || '';
      const url = `/api/generations?cursor=${encodeURIComponent(cursor)}`;
      const response = await fetchWithAuth(url);
      if (!response.ok) throw new Error("Failed to fetch videos");
      const result = await response.json() as { items: Generation[]; nextCursor: string | null };
      return result;
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isAuthenticated,
  });

  // Flatten all pages and filter for completed videos
  const allVideos = useMemo(() => {
    const items = generationsData?.pages.flatMap(page => page.items) ?? [];
    return items.filter(
      (g) => g.type === "video" && g.status === "completed" && g.resultUrl
    );
  }, [generationsData]);

  // Apply client-side pagination for display
  const videos = useMemo(() => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    return allVideos.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allVideos, page]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(allVideos.length / ITEMS_PER_PAGE));
  }, [allVideos.length]);

  // Load more when reaching last page
  useEffect(() => {
    if (page >= totalPages && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [page, totalPages, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const pollCombinationStatus = async (combinationId: string) => {
    try {
      const response = await fetchWithAuth('/api/video-combinations');
      if (!response.ok) return;

      const combinations: VideoCombination[] = await response.json();
      const combination = combinations.find(c => c.id === combinationId);

      if (!combination) return;

      if (combination.status === 'processing') {
        setExportProgress(prev => Math.min(prev + 10, 90));
      } else if (combination.status === 'completed' && combination.outputPath) {
        stopPolling();
        setExportProgress(100);
        setExportedUrl(combination.outputPath);
        setActiveCombinationId(null);
        
        queryClient.invalidateQueries({ queryKey: ['/api/generations'] });
        
        toast({
          title: "Export Complete",
          description: "Your video has been successfully combined!",
        });
      } else if (combination.status === 'failed') {
        stopPolling();
        setExportProgress(0);
        setActiveCombinationId(null);
        
        toast({
          title: "Export Failed",
          description: combination.errorMessage || "Failed to combine videos",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error polling combination status:', error);
    }
  };

  const exportMutation = useMutation({
    mutationFn: async (videoIds: string[]) => {
      setExportProgress(10);

      const response = await apiRequest("POST", "/api/combine-videos", { videoIds });
      const result = await response.json();

      setExportProgress(20);
      return result;
    },
    onSuccess: (data: { combinationId: string; message: string }) => {
      setActiveCombinationId(data.combinationId);

      // Clear any existing polling interval before starting a new one
      stopPolling();
      
      pollingIntervalRef.current = setInterval(() => {
        pollCombinationStatus(data.combinationId);
      }, 2000);
    },
    onError: (error: Error) => {
      setExportProgress(0);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to start video combination",
        variant: "destructive",
      });
    },
  });

  const toggleVideoSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const proceedToArrange = () => {
    if (selectedIds.size === 0) {
      toast({
        title: "No Videos Selected",
        description: "Please select at least one video to continue.",
        variant: "destructive",
      });
      return;
    }

    const clips: VideoClip[] = allVideos
      .filter((v) => selectedIds.has(v.id))
      .map((v) => ({
        id: v.id,
        url: v.resultUrl!,
        thumbnailUrl: v.thumbnailUrl,
        prompt: v.prompt,
        createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt),
      }));

    setOrderedClips(clips);
    setStep(2);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedClips((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeClip = (id: string) => {
    setOrderedClips((prev) => prev.filter((clip) => clip.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const proceedToExport = () => {
    if (orderedClips.length === 0) {
      toast({
        title: "No Clips",
        description: "Please add at least one clip to continue.",
        variant: "destructive",
      });
      return;
    }
    setStep(3);
    setExportProgress(0);
    setExportedUrl(null);
  };

  const startExport = () => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }

    const videoIds = orderedClips.map((clip) => clip.id);
    exportMutation.mutate(videoIds);
  };

  const goBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      stopPolling();
      setStep(2);
      setExportProgress(0);
      setExportedUrl(null);
      setActiveCombinationId(null);
    }
  };

  const resetEditor = () => {
    stopPolling();
    setStep(1);
    setSelectedIds(new Set());
    setOrderedClips([]);
    setExportProgress(0);
    setExportedUrl(null);
    setActiveCombinationId(null);
  };

  const stepTitles: Record<WizardStep, string> = {
    1: "Select Videos",
    2: "Arrange Timeline",
    3: "Export Video",
  };

  const stepDescriptions: Record<WizardStep, string> = {
    1: "Choose videos from your library to combine",
    2: "Drag and drop to reorder your clips",
    3: "Preview and export your combined video",
  };

  if (authLoading) {
    return (
      <SidebarInset>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </SidebarInset>
    );
  }

  return (
    <SidebarInset>
      <div className="flex flex-col h-full">
        <header className="shrink-0 border-b p-4 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                <Film className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Video Editor</h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Combine and export your AI-generated videos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {step > 1 && (
                <Button variant="outline" onClick={goBack} data-testid="button-back">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "flex items-center",
                  s < 3 && "flex-1"
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : step > s
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                  data-testid={`step-indicator-${s}`}
                >
                  {step > s ? <Check className="h-4 w-4" /> : s}
                </div>
                {s < 3 && (
                  <div
                    className={cn(
                      "flex-1 h-1 mx-2 rounded-full transition-colors",
                      step > s ? "bg-green-500" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </header>

        <main className="flex-1 overflow-hidden p-4 md:p-6">
          <Card className="h-full flex flex-col">
            <CardHeader className="shrink-0">
              <CardTitle className="flex items-center gap-2">
                {step === 1 && <Video className="h-5 w-5" />}
                {step === 2 && <GripVertical className="h-5 w-5" />}
                {step === 3 && <Sparkles className="h-5 w-5" />}
                {stepTitles[step]}
              </CardTitle>
              <CardDescription>{stepDescriptions[step]}</CardDescription>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden">
              {step === 1 && (
                <div className="flex flex-col h-full">
                  {!isAuthenticated ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <Video className="h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        Sign in to Access Your Videos
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Log in to view and combine your generated videos
                      </p>
                      <Button onClick={() => setShowGuestModal(true)} data-testid="button-sign-in">
                        Sign In
                      </Button>
                    </div>
                  ) : generationsLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <VideoCardSkeleton key={i} />
                      ))}
                    </div>
                  ) : videos.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <Video className="h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Videos Found</h3>
                      <p className="text-muted-foreground">
                        Generate some videos first to use the editor
                      </p>
                    </div>
                  ) : (
                    <>
                      <ScrollArea className="flex-1">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
                          {videos.map((video) => (
                            <VideoCard
                              key={video.id}
                              generation={video}
                              isSelected={selectedIds.has(video.id)}
                              onToggle={toggleVideoSelection}
                            />
                          ))}
                        </div>
                      </ScrollArea>

                      <div className="shrink-0 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                            data-testid="button-prev-page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {page} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => p + 1)}
                            data-testid="button-next-page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-4">
                          <Badge variant="secondary">
                            {selectedIds.size} selected
                          </Badge>
                          <Button
                            onClick={proceedToArrange}
                            disabled={selectedIds.size === 0}
                            data-testid="button-continue-to-arrange"
                          >
                            Continue
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col h-full">
                  {orderedClips.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <Trash2 className="h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        All Clips Removed
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Go back to select more videos
                      </p>
                      <Button variant="outline" onClick={goBack}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Go Back
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-muted-foreground mb-4">
                        Drag the clips to reorder them. The final video will play in this order.
                      </div>

                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={orderedClips.map((c) => c.id)}
                          strategy={
                            isMobile
                              ? verticalListSortingStrategy
                              : horizontalListSortingStrategy
                          }
                        >
                          <ScrollArea className="flex-1">
                            <div
                              className={cn(
                                "gap-4 pb-4",
                                isMobile ? "flex flex-col" : "flex flex-row"
                              )}
                            >
                              {orderedClips.map((clip) => (
                                <SortableClip
                                  key={clip.id}
                                  clip={clip}
                                  onRemove={removeClip}
                                  isMobile={isMobile}
                                />
                              ))}
                            </div>
                            {!isMobile && <ScrollBar orientation="horizontal" />}
                          </ScrollArea>
                        </SortableContext>
                      </DndContext>

                      <div className="shrink-0 pt-4 border-t flex items-center justify-between">
                        <Badge variant="secondary">
                          {orderedClips.length} clips
                        </Badge>
                        <Button
                          onClick={proceedToExport}
                          disabled={orderedClips.length === 0}
                          data-testid="button-continue-to-export"
                        >
                          Continue to Export
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 flex flex-col items-center justify-center">
                    {exportedUrl ? (
                      <div className="text-center space-y-6 max-w-md">
                        <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                          <Check className="h-8 w-8 text-green-500" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold mb-2">
                            Export Complete!
                          </h3>
                          <p className="text-muted-foreground">
                            Your {orderedClips.length} clips have been combined into one video.
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <Button asChild data-testid="button-download-video">
                            <a href={exportedUrl} download target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4 mr-2" />
                              Download Video
                            </a>
                          </Button>
                          <Button variant="outline" onClick={resetEditor} data-testid="button-start-over">
                            Start Over
                          </Button>
                        </div>
                      </div>
                    ) : exportMutation.isPending ? (
                      <div className="text-center space-y-6 max-w-md w-full">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                          <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold mb-2">
                            Exporting Your Video
                          </h3>
                          <p className="text-muted-foreground">
                            Combining {orderedClips.length} clips. This may take a few minutes.
                          </p>
                        </div>
                        <div className="w-full px-8">
                          <Progress value={exportProgress} className="h-2" />
                          <p className="text-sm text-muted-foreground mt-2">
                            {exportProgress}% complete
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-6 max-w-lg">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                          <Film className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold mb-2">
                            Ready to Export
                          </h3>
                          <p className="text-muted-foreground">
                            Your video will combine {orderedClips.length} clips in the order you arranged them.
                          </p>
                        </div>

                        <ScrollArea className="max-h-48 w-full border rounded-lg">
                          <div className="p-4 space-y-2">
                            {orderedClips.map((clip, index) => (
                              <div
                                key={clip.id}
                                className="flex items-center gap-3 text-sm"
                              >
                                <span className="text-muted-foreground font-mono w-6">
                                  {index + 1}.
                                </span>
                                <span className="line-clamp-1 flex-1">
                                  {clip.prompt}
                                </span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>

                        <Button
                          size="lg"
                          onClick={startExport}
                          className="min-w-40"
                          data-testid="button-start-export"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Export Video
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="videos"
      />
    </SidebarInset>
  );
}
