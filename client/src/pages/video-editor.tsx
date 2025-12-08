import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
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
import { usePricing } from "@/hooks/use-pricing";
import { fetchWithAuth, apiRequest, queryClient } from "@/lib/queryClient";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Generation, VideoEnhancements, ClipSetting, TextOverlay } from "@shared/schema";
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
  Coins,
  Volume2,
  VolumeX,
  Settings,
  Music,
  Type,
  Layers,
  User,
  Scissors,
  Plus,
  ChevronDown,
  Eye,
  Mic,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type WizardStep = 1 | 2 | 3;

interface VideoCombination {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  outputPath?: string;
  errorMessage?: string;
}

interface ExportJobStatus {
  status: 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  error?: string;
}

interface VideoClip {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  prompt: string;
  createdAt: string;
}

interface ClipSettingsLocal {
  clipId: string;
  muted: boolean;
  volume: number;
  speed: number; // 0.5 to 2.0
  trimStartSeconds?: number;
  trimEndSeconds?: number;
}

interface EnhancementsState {
  transitionMode: 'none' | 'crossfade';
  transitionDuration: number;
  fadeIn: boolean;
  fadeOut: boolean;
  fadeDuration: number; // seconds
  aspectRatio: '16:9' | '9:16' | '1:1';
  backgroundMusic?: {
    audioUrl: string;
    volume: number;
    name?: string;
  };
  audioTrack?: {
    audioUrl: string;
    volume: number;
    type: 'tts' | 'voice' | 'sfx';
    name?: string;
  };
  textOverlays: Array<{
    id: string;
    text: string;
    position: 'top' | 'center' | 'bottom';
    timing: 'intro' | 'outro' | 'all';
    fontSize: number;
    colorHex: string;
  }>;
  avatarOverlay?: {
    videoUrl: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    size: 'small' | 'medium' | 'large';
    name?: string;
  };
}

interface SortableClipProps {
  clip: VideoClip;
  clipIndex: number;
  clipSettings: ClipSettingsLocal;
  onRemove: (id: string) => void;
  onToggleMute: (id: string) => void;
  onOpenSettings: (clip: VideoClip, index: number) => void;
  onSplitClip: (clip: VideoClip, index: number) => void;
  isMobile: boolean;
  showTransition: boolean;
  transitionMode: 'none' | 'crossfade';
}

function SortableClip({ 
  clip, 
  clipIndex,
  clipSettings,
  onRemove, 
  onToggleMute,
  onOpenSettings,
  onSplitClip,
  isMobile,
  showTransition,
  transitionMode,
}: SortableClipProps) {
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
    <div className="flex items-center gap-1 shrink-0">
      {showTransition && transitionMode === 'crossfade' && (
        <div className="flex flex-col items-center px-1">
          <div className="w-px h-4 bg-primary/50" />
          <div className="text-[10px] text-primary/70 font-medium px-1">
            <Layers className="h-3 w-3" />
          </div>
          <div className="w-px h-4 bg-primary/50" />
        </div>
      )}
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "relative group bg-card border rounded-lg overflow-visible shrink-0",
          isMobile ? "w-full" : "w-44",
          isDragging && "ring-2 ring-primary z-10"
        )}
        data-testid={`clip-${clip.id}`}
      >
        <div className="relative aspect-video bg-muted rounded-t-lg overflow-hidden">
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
          
          <Badge className="absolute top-1 left-1 text-[10px] h-5 px-1.5" variant="secondary">
            #{clipIndex + 1}
          </Badge>
          
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-1 right-1 h-6 w-6 bg-black/40 hover:bg-black/60 text-white"
            onClick={() => onRemove(clip.id)}
            data-testid={`remove-clip-${clip.id}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        <div className="p-2 space-y-2">
          <p className="text-xs line-clamp-1 text-muted-foreground">
            {clip.prompt}
          </p>
          
          <div className="flex items-center justify-between gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={clipSettings.muted ? "destructive" : "ghost"}
                  className="h-7 w-7"
                  onClick={() => onToggleMute(clip.id)}
                  data-testid={`mute-clip-${clip.id}`}
                >
                  {clipSettings.muted ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {clipSettings.muted ? 'Unmute clip' : 'Mute clip'}
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => onSplitClip(clip, clipIndex)}
                  data-testid={`split-clip-${clip.id}`}
                >
                  <Scissors className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Split clip
              </TooltipContent>
            </Tooltip>
            
            <button
              {...attributes}
              {...listeners}
              className="h-7 w-7 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none rounded-md hover:bg-muted"
              data-testid={`drag-handle-${clip.id}`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => onOpenSettings(clip, clipIndex)}
                  data-testid={`settings-clip-${clip.id}`}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Clip settings
              </TooltipContent>
            </Tooltip>
          </div>
          
          {clipSettings.volume < 1 && !clipSettings.muted && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Volume2 className="h-3 w-3" />
              <span>{Math.round(clipSettings.volume * 100)}%</span>
            </div>
          )}
        </div>
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
        {generation.resultUrl ? (
          <video
            src={generation.resultUrl}
            poster={generation.thumbnailUrl || undefined}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
          />
        ) : generation.thumbnailUrl ? (
          <img
            src={generation.thumbnailUrl}
            alt={generation.prompt}
            className="w-full h-full object-cover"
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
  const { getModelCost } = usePricing();
  const isMobile = useIsMobile();
  
  const baseCreditCost = getModelCost('video-combiner', 150);

  const [step, setStep] = useState<WizardStep>(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [orderedClips, setOrderedClips] = useState<VideoClip[]>([]);
  const [page, setPage] = useState(1);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Enhanced editor state
  const [clipSettings, setClipSettings] = useState<Map<string, ClipSettingsLocal>>(new Map());
  const [enhancements, setEnhancements] = useState<EnhancementsState>({
    transitionMode: 'none',
    transitionDuration: 1.0,
    fadeIn: false,
    fadeOut: false,
    fadeDuration: 0.5,
    aspectRatio: '16:9',
    textOverlays: [],
  });
  const [showClipSettingsModal, setShowClipSettingsModal] = useState(false);
  const [editingClip, setEditingClip] = useState<{ clip: VideoClip; index: number } | null>(null);
  const [enhancementsPanelOpen, setEnhancementsPanelOpen] = useState(true);
  
  // Split dialog state
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splittingClip, setSplittingClip] = useState<{ clip: VideoClip; index: number } | null>(null);
  const [splitTime, setSplitTime] = useState(0);
  const [clipDuration, setClipDuration] = useState(0);
  const splitVideoRef = useRef<HTMLVideoElement>(null);
  
  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const ITEMS_PER_PAGE = 12;
  
  // Get clip settings for a clip, with defaults
  const getClipSettings = useCallback((clipId: string): ClipSettingsLocal => {
    return clipSettings.get(clipId) || {
      clipId,
      muted: false,
      volume: 1,
      speed: 1.0,
    };
  }, [clipSettings]);
  
  // Toggle mute for a clip
  const toggleClipMute = useCallback((clipId: string) => {
    setClipSettings(prev => {
      const newMap = new Map(prev);
      const current = getClipSettings(clipId);
      newMap.set(clipId, { ...current, muted: !current.muted });
      return newMap;
    });
  }, [getClipSettings]);
  
  // Update clip settings
  const updateClipSettings = useCallback((clipId: string, updates: Partial<ClipSettingsLocal>) => {
    setClipSettings(prev => {
      const newMap = new Map(prev);
      const current = getClipSettings(clipId);
      newMap.set(clipId, { ...current, ...updates });
      return newMap;
    });
  }, [getClipSettings]);
  
  // Open clip settings modal
  const openClipSettings = useCallback((clip: VideoClip, index: number) => {
    setEditingClip({ clip, index });
    setShowClipSettingsModal(true);
  }, []);
  
  // Open split dialog
  const openSplitDialog = useCallback((clip: VideoClip, index: number) => {
    setSplittingClip({ clip, index });
    setSplitTime(0);
    setClipDuration(0);
    setShowSplitModal(true);
  }, []);
  
  // Handle video loaded metadata to get duration
  const handleSplitVideoLoaded = useCallback(() => {
    if (splitVideoRef.current) {
      const duration = splitVideoRef.current.duration;
      setClipDuration(duration);
      setSplitTime(duration / 2); // Default to middle
    }
  }, []);
  
  // Handle split time change from slider
  const handleSplitTimeChange = useCallback((value: number[]) => {
    const newTime = value[0];
    setSplitTime(newTime);
    if (splitVideoRef.current) {
      splitVideoRef.current.currentTime = newTime;
    }
  }, []);
  
  // Format time as MM:SS.ms
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(2).padStart(5, '0')}`;
  };
  
  // Confirm split operation
  const confirmSplit = useCallback(() => {
    if (!splittingClip || splitTime <= 0 || splitTime >= clipDuration) {
      toast({
        title: "Invalid Split Point",
        description: "Please select a valid split point between the start and end of the clip.",
        variant: "destructive",
      });
      return;
    }
    
    const { clip, index } = splittingClip;
    
    // Create two clips from the original
    // First clip: original with trimEnd set to splitTime
    // Second clip: new clip with trimStart set to splitTime
    const firstClipId = clip.id;
    const secondClipId = `${clip.id}_split_${Date.now()}`;
    
    // Create the second clip (the split-off portion)
    const secondClip: VideoClip = {
      ...clip,
      id: secondClipId,
    };
    
    // Update clip settings for both clips
    const currentSettings = getClipSettings(firstClipId);
    const existingTrimStart = currentSettings.trimStartSeconds ?? 0;
    const existingTrimEnd = currentSettings.trimEndSeconds ?? clipDuration;
    
    // First clip: from original start to split point
    updateClipSettings(firstClipId, {
      trimEndSeconds: existingTrimStart + splitTime,
    });
    
    // Second clip: from split point to original end
    setClipSettings(prev => {
      const newMap = new Map(prev);
      newMap.set(secondClipId, {
        clipId: secondClipId,
        muted: currentSettings.muted,
        volume: currentSettings.volume,
        speed: currentSettings.speed,
        trimStartSeconds: existingTrimStart + splitTime,
        trimEndSeconds: existingTrimEnd,
      });
      return newMap;
    });
    
    // Insert the second clip right after the first one
    setOrderedClips(prev => {
      const newClips = [...prev];
      newClips.splice(index + 1, 0, secondClip);
      return newClips;
    });
    
    setShowSplitModal(false);
    setSplittingClip(null);
    
    toast({
      title: "Clip Split",
      description: `Clip has been split at ${formatTime(splitTime)}. You now have ${orderedClips.length + 1} clips.`,
    });
  }, [splittingClip, splitTime, clipDuration, getClipSettings, updateClipSettings, orderedClips.length, toast]);

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
  
  // Use the same generations data to filter for audio/music/avatar (client-side filtering)
  // Filter music tracks from all loaded generations
  const musicTracks = useMemo(() => {
    const items = generationsData?.pages.flatMap(page => page.items) ?? [];
    return items.filter(
      (g) => g.type === "music" && g.status === "completed" && g.resultUrl
    );
  }, [generationsData]);
  
  // Filter audio tracks (TTS, voice) from all loaded generations  
  const voiceTracks = useMemo(() => {
    const items = generationsData?.pages.flatMap(page => page.items) ?? [];
    return items.filter(
      (g) => (g.type === "audio" || g.type === "text-to-speech" || g.type === "sound-effects") && 
             g.status === "completed" && g.resultUrl
    );
  }, [generationsData]);
  
  // Filter avatar videos (InfiniteTalk/talking-avatar) from all loaded generations
  const avatarVideos = useMemo(() => {
    const items = generationsData?.pages.flatMap(page => page.items) ?? [];
    return items.filter((g) => {
      const model = (g.model ?? "").toLowerCase();
      return (g.type === "talking-avatar" || g.type === "avatar" || 
              model.includes("infinitetalk") || 
              model.includes("infinite-talk")) && 
             g.status === "completed" && g.resultUrl;
    });
  }, [generationsData]);
  
  // Loading states derived from main query
  const audioLoading = generationsLoading;
  const avatarLoading = generationsLoading;

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

  // Handle quick action from Library - pre-load clips added via "Add to Video Editor"
  useEffect(() => {
    const storedClips = sessionStorage.getItem('videoEditor_clips');
    
    if (storedClips) {
      try {
        const clips = JSON.parse(storedClips) as Array<{
          id: string;
          url: string;
          prompt: string;
          thumbnailUrl?: string | null;
        }>;
        
        if (clips.length > 0) {
          console.log('[QUICK ACTION] Loading clips for video editor:', clips);
          
          // Convert to VideoClip format and add to ordered clips
          const newClips: VideoClip[] = clips.map(clip => ({
            id: clip.id,
            url: clip.url,
            prompt: clip.prompt,
            thumbnailUrl: clip.thumbnailUrl || null,
            createdAt: new Date().toISOString(),
          }));
          
          setOrderedClips(prev => {
            // Avoid duplicates
            const existingIds = new Set(prev.map(c => c.id));
            const uniqueNewClips = newClips.filter(c => !existingIds.has(c.id));
            return [...prev, ...uniqueNewClips];
          });
          
          // Also add to selected IDs
          setSelectedIds(prev => {
            const newSet = new Set(prev);
            clips.forEach(c => newSet.add(c.id));
            return newSet;
          });
          
          // Move to step 2 (arrange) if clips were added
          if (step === 1) {
            setStep(2);
          }
          
          toast({
            title: `${clips.length} Clip${clips.length > 1 ? 's' : ''} Added`,
            description: "Your clips have been added to the video editor. Arrange and export!",
          });
        }
      } catch (e) {
        console.error('[QUICK ACTION] Failed to parse video editor clips:', e);
      }
      
      // Clear the sessionStorage after consuming
      sessionStorage.removeItem('videoEditor_clips');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - run only once on mount

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const pollExportStatus = async (jobId: string) => {
    try {
      const response = await fetchWithAuth(`/api/video-editor/export/${jobId}`);
      if (!response.ok) return;

      const status: ExportJobStatus = await response.json();

      if (status.status === 'processing') {
        setExportProgress(prev => Math.min(prev + 5, 90));
      } else if (status.status === 'completed' && status.downloadUrl) {
        stopPolling();
        setExportProgress(100);
        setExportedUrl(status.downloadUrl);
        setActiveJobId(null);
        
        queryClient.invalidateQueries({ queryKey: ['/api/generations'] });
        
        toast({
          title: "Export Complete",
          description: "Your video has been successfully exported to cloud storage!",
        });
      } else if (status.status === 'failed') {
        stopPolling();
        setExportProgress(0);
        setActiveJobId(null);
        
        toast({
          title: "Export Failed",
          description: status.error || "Failed to export video",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error polling export status:', error);
    }
  };

  const exportMutation = useMutation({
    mutationFn: async (clips: VideoClip[]) => {
      setExportProgress(10);

      // Build project payload with clip source URLs in order
      const project = {
        clips: clips.map((clip, index) => ({
          id: clip.id,
          sourceUrl: clip.url,
          order: index,
        })),
      };

      // Serialize clip settings from local state (includes trim times for split clips and speed)
      const clipSettingsArray = clips.map((clip, index) => {
        const localSettings = clipSettings.get(clip.id);
        return {
          clipId: clip.id,
          clipIndex: index,
          muted: localSettings?.muted ?? false,
          volume: localSettings?.volume ?? 1,
          speed: localSettings?.speed ?? 1.0,
          trimStartSeconds: localSettings?.trimStartSeconds,
          trimEndSeconds: localSettings?.trimEndSeconds,
        };
      });

      // Build enhancements payload with all enhancement state
      const enhancementsPayload = {
        transitions: enhancements.transitionMode === 'crossfade' ? {
          mode: 'crossfade' as const,
          durationSeconds: enhancements.transitionDuration,
        } : { mode: 'none' as const },
        fadeIn: enhancements.fadeIn,
        fadeOut: enhancements.fadeOut,
        fadeDuration: enhancements.fadeDuration,
        aspectRatio: enhancements.aspectRatio,
        backgroundMusic: enhancements.backgroundMusic ? {
          audioUrl: enhancements.backgroundMusic.audioUrl,
          volume: enhancements.backgroundMusic.volume,
        } : undefined,
        textOverlays: enhancements.textOverlays.map(to => ({
          id: to.id,
          text: to.text,
          position: to.position,
          timing: to.timing,
          fontSize: to.fontSize,
          colorHex: to.colorHex,
        })),
        clipSettings: clipSettingsArray.filter(cs => 
          cs.muted || cs.volume !== 1 || cs.speed !== 1 || cs.trimStartSeconds !== undefined || cs.trimEndSeconds !== undefined
        ),
        audioTrack: enhancements.audioTrack ? {
          audioUrl: enhancements.audioTrack.audioUrl,
          type: enhancements.audioTrack.type,
          volume: enhancements.audioTrack.volume,
          startAtSeconds: 0,
        } : undefined,
        avatarOverlay: enhancements.avatarOverlay ? {
          videoUrl: enhancements.avatarOverlay.videoUrl,
          position: enhancements.avatarOverlay.position,
          size: enhancements.avatarOverlay.size,
        } : undefined,
      };

      const response = await apiRequest("POST", "/api/video-editor/export", { 
        project,
        videoSettings: {
          format: 'mp4',
          quality: 'high',
        },
        enhancements: enhancementsPayload,
      });
      const result = await response.json();

      if (result.status === 'completed' && result.downloadUrl) {
        return { ...result, immediate: true };
      }

      setExportProgress(20);
      return result;
    },
    onSuccess: (data: { status: string; jobId: string; downloadUrl?: string; immediate?: boolean }) => {
      if (data.immediate && data.downloadUrl) {
        setExportProgress(100);
        setExportedUrl(data.downloadUrl);
        queryClient.invalidateQueries({ queryKey: ['/api/generations'] });
        toast({
          title: "Export Complete",
          description: "Your video has been successfully exported!",
        });
        return;
      }

      setActiveJobId(data.jobId);

      stopPolling();
      
      pollingIntervalRef.current = setInterval(() => {
        pollExportStatus(data.jobId);
      }, 3000);
    },
    onError: (error: Error) => {
      setExportProgress(0);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to start video export",
        variant: "destructive",
      });
    },
  });

  // Preview mutation for quick low-res preview
  const previewMutation = useMutation({
    mutationFn: async (clips: VideoClip[]) => {
      // Build project payload (limit to first 3 clips for speed)
      const previewClips = clips.slice(0, 3);
      const project = {
        clips: previewClips.map((clip, index) => ({
          id: clip.id,
          sourceUrl: clip.url,
          order: index,
        })),
      };

      // Serialize clip settings for preview clips
      const clipSettingsArray = previewClips.map((clip, index) => {
        const localSettings = clipSettings.get(clip.id);
        return {
          clipId: clip.id,
          clipIndex: index,
          muted: localSettings?.muted ?? false,
          volume: localSettings?.volume ?? 1,
          speed: localSettings?.speed ?? 1.0,
          trimStartSeconds: localSettings?.trimStartSeconds,
          trimEndSeconds: localSettings?.trimEndSeconds,
        };
      });

      const enhancementsPayload = {
        transitions: enhancements.transitionMode === 'crossfade' ? {
          mode: 'crossfade' as const,
          durationSeconds: enhancements.transitionDuration,
        } : { mode: 'none' as const },
        fadeIn: enhancements.fadeIn,
        fadeOut: enhancements.fadeOut,
        fadeDuration: enhancements.fadeDuration,
        aspectRatio: enhancements.aspectRatio,
        clipSettings: clipSettingsArray.filter(cs => 
          cs.muted || cs.volume !== 1 || cs.speed !== 1 || cs.trimStartSeconds !== undefined || cs.trimEndSeconds !== undefined
        ),
      };

      const response = await apiRequest("POST", "/api/video-editor/preview", { 
        project,
        enhancements: enhancementsPayload,
      });
      return await response.json();
    },
    onSuccess: (data: { status: string; previewUrl?: string; message?: string }) => {
      if (data.status === 'completed' && data.previewUrl) {
        setPreviewUrl(data.previewUrl);
        setShowPreviewModal(true);
        toast({
          title: "Preview Ready",
          description: "Your low-res preview is ready to view.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to generate preview",
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

    exportMutation.mutate(orderedClips);
  };

  const goBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      stopPolling();
      setStep(2);
      setExportProgress(0);
      setExportedUrl(null);
      setActiveJobId(null);
    }
  };

  const resetEditor = () => {
    stopPolling();
    setStep(1);
    setSelectedIds(new Set());
    setOrderedClips([]);
    setExportProgress(0);
    setExportedUrl(null);
    setActiveJobId(null);
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
            
            <Badge variant="secondary" className="flex items-center gap-1.5" data-testid="badge-credit-cost">
              <Coins className="h-3.5 w-3.5" />
              <span>{baseCreditCost} credits</span>
            </Badge>

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
                    <div className="flex flex-col lg:flex-row gap-4 h-full overflow-hidden">
                      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                        <div className="text-sm text-muted-foreground mb-3">
                          Drag clips to reorder. Use controls to mute audio or adjust settings.
                        </div>

                        <div className="border rounded-lg bg-muted/30 p-3 mb-4">
                          <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                            <Film className="h-3.5 w-3.5" />
                            VIDEO TRACK
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
                              <ScrollArea className="w-full">
                                <div
                                  className={cn(
                                    "gap-2 pb-2",
                                    isMobile ? "flex flex-col" : "flex flex-row"
                                  )}
                                >
                                  {orderedClips.map((clip, index) => (
                                    <SortableClip
                                      key={clip.id}
                                      clip={clip}
                                      clipIndex={index}
                                      clipSettings={getClipSettings(clip.id)}
                                      onRemove={removeClip}
                                      onToggleMute={toggleClipMute}
                                      onOpenSettings={openClipSettings}
                                      onSplitClip={openSplitDialog}
                                      isMobile={isMobile}
                                      showTransition={index > 0}
                                      transitionMode={enhancements.transitionMode}
                                    />
                                  ))}
                                </div>
                                {!isMobile && <ScrollBar orientation="horizontal" />}
                              </ScrollArea>
                            </SortableContext>
                          </DndContext>
                        </div>

                        {(enhancements.backgroundMusic || enhancements.audioTrack) && (
                          <div className="border rounded-lg bg-muted/30 p-3 mb-4">
                            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                              <Music className="h-3.5 w-3.5" />
                              AUDIO TRACK
                            </div>
                            <div className="flex items-center gap-2">
                              {enhancements.backgroundMusic && (
                                <Badge variant="secondary" className="gap-1">
                                  <Music className="h-3 w-3" />
                                  {enhancements.backgroundMusic.name || 'Background Music'}
                                  <span className="text-muted-foreground ml-1">
                                    {Math.round(enhancements.backgroundMusic.volume * 100)}%
                                  </span>
                                </Badge>
                              )}
                              {enhancements.audioTrack && (
                                <Badge variant="secondary" className="gap-1">
                                  <Volume2 className="h-3 w-3" />
                                  {enhancements.audioTrack.name || 'Voice Track'}
                                  <span className="text-muted-foreground ml-1">
                                    {Math.round(enhancements.audioTrack.volume * 100)}%
                                  </span>
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="shrink-0 pt-4 border-t flex items-center justify-between gap-2">
                          <Badge variant="secondary">
                            {orderedClips.length} clips
                          </Badge>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              onClick={() => previewMutation.mutate(orderedClips)}
                              disabled={orderedClips.length === 0 || previewMutation.isPending}
                              data-testid="button-preview"
                            >
                              {previewMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Eye className="h-4 w-4 mr-2" />
                              )}
                              Preview
                            </Button>
                            <Button
                              onClick={proceedToExport}
                              disabled={orderedClips.length === 0}
                              data-testid="button-continue-to-export"
                            >
                              Continue to Export
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="lg:w-80 shrink-0">
                        <Collapsible open={enhancementsPanelOpen} onOpenChange={setEnhancementsPanelOpen}>
                          <div className="border rounded-lg overflow-hidden">
                            <CollapsibleTrigger asChild>
                              <Button 
                                variant="ghost" 
                                className="w-full justify-between rounded-none border-b h-10"
                                data-testid="button-toggle-enhancements"
                              >
                                <span className="flex items-center gap-2 text-sm font-medium">
                                  <Sparkles className="h-4 w-4" />
                                  Enhancements
                                </span>
                                <ChevronDown className={cn(
                                  "h-4 w-4 transition-transform",
                                  enhancementsPanelOpen && "rotate-180"
                                )} />
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <Tabs defaultValue="transitions" className="w-full">
                                <TabsList className="w-full grid grid-cols-4 rounded-none h-9">
                                  <TabsTrigger value="transitions" className="text-xs px-2" data-testid="tab-transitions">
                                    <Layers className="h-3.5 w-3.5" />
                                  </TabsTrigger>
                                  <TabsTrigger value="music" className="text-xs px-2" data-testid="tab-music">
                                    <Music className="h-3.5 w-3.5" />
                                  </TabsTrigger>
                                  <TabsTrigger value="text" className="text-xs px-2" data-testid="tab-text">
                                    <Type className="h-3.5 w-3.5" />
                                  </TabsTrigger>
                                  <TabsTrigger value="avatar" className="text-xs px-2" data-testid="tab-avatar">
                                    <User className="h-3.5 w-3.5" />
                                  </TabsTrigger>
                                </TabsList>

                                <TabsContent value="transitions" className="p-3 space-y-4 m-0">
                                  <div className="space-y-2">
                                    <Label className="text-xs">Transition Type</Label>
                                    <Select
                                      value={enhancements.transitionMode}
                                      onValueChange={(v: 'none' | 'crossfade') => 
                                        setEnhancements(prev => ({ ...prev, transitionMode: v }))
                                      }
                                    >
                                      <SelectTrigger className="h-9" data-testid="select-transition-mode">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">None (Hard Cut)</SelectItem>
                                        <SelectItem value="crossfade">Crossfade</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  {enhancements.transitionMode === 'crossfade' && (
                                    <div className="space-y-2">
                                      <Label className="text-xs flex justify-between">
                                        Duration
                                        <span className="text-muted-foreground">{enhancements.transitionDuration}s</span>
                                      </Label>
                                      <Slider
                                        value={[enhancements.transitionDuration]}
                                        min={0.5}
                                        max={3}
                                        step={0.5}
                                        onValueChange={([v]) => 
                                          setEnhancements(prev => ({ ...prev, transitionDuration: v }))
                                        }
                                        data-testid="slider-transition-duration"
                                      />
                                    </div>
                                  )}
                                  
                                  <div className="border-t pt-3 space-y-3">
                                    <Label className="text-xs font-medium">Fade Effects</Label>
                                    <div className="flex items-center gap-4">
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          checked={enhancements.fadeIn}
                                          onCheckedChange={(v) => setEnhancements(prev => ({ ...prev, fadeIn: v }))}
                                          data-testid="switch-fade-in"
                                        />
                                        <Label className="text-xs">Fade In</Label>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          checked={enhancements.fadeOut}
                                          onCheckedChange={(v) => setEnhancements(prev => ({ ...prev, fadeOut: v }))}
                                          data-testid="switch-fade-out"
                                        />
                                        <Label className="text-xs">Fade Out</Label>
                                      </div>
                                    </div>
                                    {(enhancements.fadeIn || enhancements.fadeOut) && (
                                      <div className="space-y-2">
                                        <Label className="text-xs flex justify-between">
                                          Fade Duration
                                          <span className="text-muted-foreground">{enhancements.fadeDuration}s</span>
                                        </Label>
                                        <Slider
                                          value={[enhancements.fadeDuration]}
                                          min={0.3}
                                          max={2}
                                          step={0.1}
                                          onValueChange={([v]) => setEnhancements(prev => ({ ...prev, fadeDuration: v }))}
                                          data-testid="slider-fade-duration"
                                        />
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="border-t pt-3 space-y-2">
                                    <Label className="text-xs">Aspect Ratio</Label>
                                    <Select
                                      value={enhancements.aspectRatio}
                                      onValueChange={(v: '16:9' | '9:16' | '1:1') => 
                                        setEnhancements(prev => ({ ...prev, aspectRatio: v }))
                                      }
                                    >
                                      <SelectTrigger className="h-9" data-testid="select-aspect-ratio">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                                        <SelectItem value="9:16">9:16 (Portrait/TikTok)</SelectItem>
                                        <SelectItem value="1:1">1:1 (Square)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </TabsContent>

                                <TabsContent value="music" className="p-3 space-y-4 m-0">
                                  <ScrollArea className="h-[320px] pr-2">
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-medium">
                                          <Music className="h-3.5 w-3.5" />
                                          Background Music
                                        </div>
                                        {enhancements.backgroundMusic ? (
                                          <div className="p-2 border rounded-md bg-muted/50 space-y-2">
                                            <div className="flex items-center justify-between">
                                              <p className="text-xs font-medium line-clamp-1 flex-1">{enhancements.backgroundMusic.name}</p>
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6 shrink-0"
                                                onClick={() => setEnhancements(prev => ({ ...prev, backgroundMusic: undefined }))}
                                                data-testid="button-remove-music"
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </div>
                                            <audio src={enhancements.backgroundMusic.audioUrl} controls className="w-full h-8" />
                                          </div>
                                        ) : audioLoading ? (
                                          <div className="text-center py-4">
                                            <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
                                          </div>
                                        ) : musicTracks.length === 0 ? (
                                          <div className="text-center py-4 text-muted-foreground border rounded-md">
                                            <Music className="h-6 w-6 mx-auto mb-1 opacity-50" />
                                            <p className="text-[10px]">No music in library</p>
                                          </div>
                                        ) : (
                                          <ScrollArea className="h-24">
                                            <div className="space-y-1 pr-2">
                                              {musicTracks.map((track) => (
                                                <button
                                                  key={track.id}
                                                  className="w-full p-2 border rounded-md text-left hover-elevate transition-colors"
                                                  onClick={() => setEnhancements(prev => ({
                                                    ...prev,
                                                    backgroundMusic: {
                                                      audioUrl: track.resultUrl!,
                                                      volume: 0.5,
                                                      name: track.prompt.slice(0, 40) + (track.prompt.length > 40 ? '...' : ''),
                                                    }
                                                  }))}
                                                  data-testid={`select-music-${track.id}`}
                                                >
                                                  <p className="text-xs font-medium line-clamp-1">{track.prompt}</p>
                                                  <p className="text-[10px] text-muted-foreground">{track.model}</p>
                                                </button>
                                              ))}
                                            </div>
                                          </ScrollArea>
                                        )}
                                      </div>

                                      <div className="border-t pt-4 space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-medium">
                                          <Mic className="h-3.5 w-3.5" />
                                          Voice Overlay
                                        </div>
                                        {enhancements.audioTrack ? (
                                          <div className="p-2 border rounded-md bg-muted/50 space-y-2">
                                            <div className="flex items-center justify-between">
                                              <p className="text-xs font-medium line-clamp-1 flex-1">{enhancements.audioTrack.name}</p>
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6 shrink-0"
                                                onClick={() => setEnhancements(prev => ({ ...prev, audioTrack: undefined }))}
                                                data-testid="button-remove-voice"
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </div>
                                            <audio src={enhancements.audioTrack.audioUrl} controls className="w-full h-8" />
                                          </div>
                                        ) : audioLoading ? (
                                          <div className="text-center py-4">
                                            <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
                                          </div>
                                        ) : voiceTracks.length === 0 ? (
                                          <div className="text-center py-4 text-muted-foreground border rounded-md">
                                            <Mic className="h-6 w-6 mx-auto mb-1 opacity-50" />
                                            <p className="text-[10px]">No voice/TTS in library</p>
                                          </div>
                                        ) : (
                                          <ScrollArea className="h-24">
                                            <div className="space-y-1 pr-2">
                                              {voiceTracks.map((track) => (
                                                <button
                                                  key={track.id}
                                                  className="w-full p-2 border rounded-md text-left hover-elevate transition-colors"
                                                  onClick={() => setEnhancements(prev => ({
                                                    ...prev,
                                                    audioTrack: {
                                                      audioUrl: track.resultUrl!,
                                                      volume: 1.0,
                                                      type: track.type === 'text-to-speech' ? 'tts' : track.type === 'sound-effects' ? 'sfx' : 'voice',
                                                      name: track.prompt.slice(0, 40) + (track.prompt.length > 40 ? '...' : ''),
                                                    }
                                                  }))}
                                                  data-testid={`select-voice-${track.id}`}
                                                >
                                                  <p className="text-xs font-medium line-clamp-1">{track.prompt}</p>
                                                  <p className="text-[10px] text-muted-foreground">
                                                    {track.type === 'text-to-speech' ? 'TTS' : track.type === 'sound-effects' ? 'SFX' : 'Voice'} • {track.model}
                                                  </p>
                                                </button>
                                              ))}
                                            </div>
                                          </ScrollArea>
                                        )}
                                      </div>

                                      {(enhancements.backgroundMusic || enhancements.audioTrack) && (
                                        <div className="border-t pt-4 space-y-3">
                                          <div className="flex items-center gap-2 text-xs font-medium">
                                            <SlidersHorizontal className="h-3.5 w-3.5" />
                                            Audio Mixer
                                          </div>
                                          
                                          <div className="space-y-3 p-2 border rounded-md bg-muted/30">
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                              <Film className="h-3 w-3" />
                                              Clip Audio: Use per-clip mute controls
                                            </div>
                                            
                                            {enhancements.backgroundMusic && (
                                              <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                  <Label className="text-xs flex items-center gap-1.5">
                                                    <Music className="h-3 w-3" />
                                                    Music
                                                  </Label>
                                                  <span className="text-[10px] text-muted-foreground">
                                                    {Math.round(enhancements.backgroundMusic.volume * 100)}%
                                                  </span>
                                                </div>
                                                <Slider
                                                  value={[enhancements.backgroundMusic.volume]}
                                                  min={0}
                                                  max={1}
                                                  step={0.05}
                                                  onValueChange={([v]) => 
                                                    setEnhancements(prev => ({ 
                                                      ...prev, 
                                                      backgroundMusic: prev.backgroundMusic ? { ...prev.backgroundMusic, volume: v } : undefined 
                                                    }))
                                                  }
                                                  data-testid="slider-music-volume"
                                                />
                                              </div>
                                            )}
                                            
                                            {enhancements.audioTrack && (
                                              <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                  <Label className="text-xs flex items-center gap-1.5">
                                                    <Mic className="h-3 w-3" />
                                                    Voice
                                                  </Label>
                                                  <span className="text-[10px] text-muted-foreground">
                                                    {Math.round(enhancements.audioTrack.volume * 100)}%
                                                  </span>
                                                </div>
                                                <Slider
                                                  value={[enhancements.audioTrack.volume]}
                                                  min={0}
                                                  max={1}
                                                  step={0.05}
                                                  onValueChange={([v]) => 
                                                    setEnhancements(prev => ({ 
                                                      ...prev, 
                                                      audioTrack: prev.audioTrack ? { ...prev.audioTrack, volume: v } : undefined 
                                                    }))
                                                  }
                                                  data-testid="slider-voice-volume"
                                                />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </ScrollArea>
                                </TabsContent>

                                <TabsContent value="text" className="p-3 space-y-4 m-0">
                                  {enhancements.textOverlays.length > 0 ? (
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium">Text Overlays</span>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 text-xs px-2"
                                          onClick={() => setEnhancements(prev => ({
                                            ...prev,
                                            textOverlays: [...prev.textOverlays, {
                                              id: `text-${Date.now()}`,
                                              text: '',
                                              position: 'bottom' as const,
                                              timing: 'all' as const,
                                              fontSize: 24,
                                              colorHex: '#ffffff',
                                            }]
                                          }))}
                                          data-testid="button-add-text"
                                        >
                                          <Plus className="h-3 w-3 mr-1" />
                                          Add
                                        </Button>
                                      </div>
                                      <ScrollArea className="max-h-52">
                                        <div className="space-y-2 pr-3">
                                          {enhancements.textOverlays.map((overlay, idx) => (
                                            <div key={overlay.id} className="p-2 border rounded-md space-y-2">
                                              <div className="flex items-center justify-between gap-2">
                                                <Input
                                                  placeholder="Enter caption text..."
                                                  value={overlay.text}
                                                  onChange={(e) => {
                                                    const newOverlays = [...enhancements.textOverlays];
                                                    newOverlays[idx] = { ...overlay, text: e.target.value };
                                                    setEnhancements(prev => ({ ...prev, textOverlays: newOverlays }));
                                                  }}
                                                  className="h-8 text-xs"
                                                  data-testid={`input-text-${idx}`}
                                                />
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-6 w-6 shrink-0"
                                                  onClick={() => {
                                                    setEnhancements(prev => ({
                                                      ...prev,
                                                      textOverlays: prev.textOverlays.filter(t => t.id !== overlay.id)
                                                    }));
                                                  }}
                                                  data-testid={`remove-text-${idx}`}
                                                >
                                                  <X className="h-3 w-3" />
                                                </Button>
                                              </div>
                                              <div className="flex gap-2">
                                                <Select
                                                  value={overlay.position}
                                                  onValueChange={(v: 'top' | 'center' | 'bottom') => {
                                                    const newOverlays = [...enhancements.textOverlays];
                                                    newOverlays[idx] = { ...overlay, position: v };
                                                    setEnhancements(prev => ({ ...prev, textOverlays: newOverlays }));
                                                  }}
                                                >
                                                  <SelectTrigger className="h-7 text-xs flex-1">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="top">Top</SelectItem>
                                                    <SelectItem value="center">Center</SelectItem>
                                                    <SelectItem value="bottom">Bottom</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                                <Select
                                                  value={overlay.timing}
                                                  onValueChange={(v: 'intro' | 'outro' | 'all') => {
                                                    const newOverlays = [...enhancements.textOverlays];
                                                    newOverlays[idx] = { ...overlay, timing: v };
                                                    setEnhancements(prev => ({ ...prev, textOverlays: newOverlays }));
                                                  }}
                                                >
                                                  <SelectTrigger className="h-7 text-xs flex-1">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="intro">Intro Only</SelectItem>
                                                    <SelectItem value="outro">Outro Only</SelectItem>
                                                    <SelectItem value="all">Full Video</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </ScrollArea>
                                    </div>
                                  ) : (
                                    <div className="text-center py-4">
                                      <Type className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                                      <p className="text-xs text-muted-foreground mb-3">Add captions and titles</p>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEnhancements(prev => ({
                                          ...prev,
                                          textOverlays: [{
                                            id: `text-${Date.now()}`,
                                            text: '',
                                            position: 'bottom' as const,
                                            timing: 'all' as const,
                                            fontSize: 24,
                                            colorHex: '#ffffff',
                                          }]
                                        }))}
                                        data-testid="button-add-first-text"
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add Text Overlay
                                      </Button>
                                    </div>
                                  )}
                                </TabsContent>

                                <TabsContent value="avatar" className="p-3 space-y-4 m-0">
                                  {enhancements.avatarOverlay ? (
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium">Avatar Overlay</span>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 text-xs px-2"
                                          onClick={() => setEnhancements(prev => ({ ...prev, avatarOverlay: undefined }))}
                                          data-testid="button-remove-avatar"
                                        >
                                          <X className="h-3 w-3 mr-1" />
                                          Remove
                                        </Button>
                                      </div>
                                      <div className="p-2 border rounded-md bg-muted/50">
                                        <video 
                                          src={enhancements.avatarOverlay.videoUrl} 
                                          className="w-full aspect-video rounded object-cover" 
                                          muted 
                                          controls 
                                        />
                                        <p className="text-xs font-medium mt-2 line-clamp-1">{enhancements.avatarOverlay.name}</p>
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Position</Label>
                                        <Select
                                          value={enhancements.avatarOverlay.position}
                                          onValueChange={(v: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => 
                                            setEnhancements(prev => ({ 
                                              ...prev, 
                                              avatarOverlay: prev.avatarOverlay ? { ...prev.avatarOverlay, position: v } : undefined 
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="top-left">Top Left</SelectItem>
                                            <SelectItem value="top-right">Top Right</SelectItem>
                                            <SelectItem value="bottom-left">Bottom Left</SelectItem>
                                            <SelectItem value="bottom-right">Bottom Right</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Size</Label>
                                        <Select
                                          value={enhancements.avatarOverlay.size}
                                          onValueChange={(v: 'small' | 'medium' | 'large') => 
                                            setEnhancements(prev => ({ 
                                              ...prev, 
                                              avatarOverlay: prev.avatarOverlay ? { ...prev.avatarOverlay, size: v } : undefined 
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="small">Small (15%)</SelectItem>
                                            <SelectItem value="medium">Medium (25%)</SelectItem>
                                            <SelectItem value="large">Large (35%)</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  ) : avatarLoading ? (
                                    <div className="text-center py-6">
                                      <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                                      <p className="text-xs text-muted-foreground mt-2">Loading avatars...</p>
                                    </div>
                                  ) : !avatarVideos || avatarVideos.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground">
                                      <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                      <p className="text-xs">No avatar videos found</p>
                                      <p className="text-[10px] mt-1">Create lip-synced videos with InfiniteTalk first</p>
                                    </div>
                                  ) : (
                                    <ScrollArea className="h-48">
                                      <div className="grid grid-cols-2 gap-2 pr-3">
                                        {avatarVideos.map((avatar) => (
                                          <button
                                            key={avatar.id}
                                            className="group relative aspect-video rounded-md overflow-hidden border hover-elevate"
                                            onClick={() => setEnhancements(prev => ({
                                              ...prev,
                                              avatarOverlay: {
                                                videoUrl: avatar.resultUrl!,
                                                position: 'bottom-right',
                                                size: 'medium',
                                                name: avatar.prompt.slice(0, 30) + (avatar.prompt.length > 30 ? '...' : ''),
                                              }
                                            }))}
                                            data-testid={`select-avatar-${avatar.id}`}
                                          >
                                            <video
                                              src={avatar.resultUrl!}
                                              poster={avatar.thumbnailUrl || undefined}
                                              className="w-full h-full object-cover"
                                              muted
                                            />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Plus className="h-5 w-5 text-white" />
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    </ScrollArea>
                                  )}
                                </TabsContent>
                              </Tabs>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      </div>
                    </div>
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
                        
                        <div className="flex items-center justify-center gap-2 py-3 px-4 bg-muted/50 rounded-lg" data-testid="export-credit-cost">
                          <Coins className="h-5 w-5 text-primary" />
                          <span className="font-medium">Cost: {baseCreditCost} credits</span>
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

      <Dialog open={showClipSettingsModal} onOpenChange={setShowClipSettingsModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Clip Settings
            </DialogTitle>
            <DialogDescription>
              {editingClip && `Adjust settings for clip #${editingClip.index + 1}`}
            </DialogDescription>
          </DialogHeader>
          
          {editingClip && (
            <div className="space-y-6 py-4">
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                <video
                  src={editingClip.clip.url}
                  poster={editingClip.clip.thumbnailUrl || undefined}
                  className="w-full h-full object-cover"
                  controls
                  muted
                />
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="clip-mute" className="flex items-center gap-2">
                    {getClipSettings(editingClip.clip.id).muted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                    Mute Audio
                  </Label>
                  <Switch
                    id="clip-mute"
                    checked={getClipSettings(editingClip.clip.id).muted}
                    onCheckedChange={(checked) => 
                      updateClipSettings(editingClip.clip.id, { muted: checked })
                    }
                    data-testid="switch-clip-mute"
                  />
                </div>
                
                {!getClipSettings(editingClip.clip.id).muted && (
                  <div className="space-y-2">
                    <Label className="text-sm flex justify-between">
                      Volume
                      <span className="text-muted-foreground">
                        {Math.round(getClipSettings(editingClip.clip.id).volume * 100)}%
                      </span>
                    </Label>
                    <Slider
                      value={[getClipSettings(editingClip.clip.id).volume]}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={([v]) => 
                        updateClipSettings(editingClip.clip.id, { volume: v })
                      }
                      data-testid="slider-clip-volume"
                    />
                  </div>
                )}
                
                <div className="pt-4 border-t space-y-2">
                  <Label className="text-sm flex justify-between">
                    <span className="flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      Speed
                    </span>
                    <span className="text-muted-foreground">
                      {getClipSettings(editingClip.clip.id).speed}x
                    </span>
                  </Label>
                  <Slider
                    value={[getClipSettings(editingClip.clip.id).speed]}
                    min={0.5}
                    max={2}
                    step={0.25}
                    onValueChange={([v]) => 
                      updateClipSettings(editingClip.clip.id, { speed: v })
                    }
                    data-testid="slider-clip-speed"
                  />
                  <p className="text-xs text-muted-foreground">
                    0.5x = slow motion, 2x = double speed
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              onClick={() => setShowClipSettingsModal(false)}
              data-testid="button-close-clip-settings"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSplitModal} onOpenChange={setShowSplitModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5" />
              Split Clip
            </DialogTitle>
            <DialogDescription>
              {splittingClip && `Select a split point for clip #${splittingClip.index + 1}`}
            </DialogDescription>
          </DialogHeader>
          
          {splittingClip && (
            <div className="space-y-6 py-4">
              <div className="aspect-video rounded-lg overflow-hidden bg-muted relative">
                <video
                  ref={splitVideoRef}
                  src={splittingClip.clip.url}
                  poster={splittingClip.clip.thumbnailUrl || undefined}
                  className="w-full h-full object-cover"
                  onLoadedMetadata={handleSplitVideoLoaded}
                  muted
                />
                <div className="absolute bottom-2 left-2 right-2 bg-black/60 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between text-white text-sm mb-2">
                    <span>{formatTime(splitTime)}</span>
                    <span className="text-muted-foreground">/</span>
                    <span>{formatTime(clipDuration)}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Split Point
                  </Label>
                  <Slider
                    value={[splitTime]}
                    min={0.1}
                    max={Math.max(0.2, clipDuration - 0.1)}
                    step={0.01}
                    onValueChange={handleSplitTimeChange}
                    disabled={clipDuration === 0}
                    data-testid="slider-split-time"
                  />
                  <p className="text-xs text-muted-foreground">
                    Drag the slider to select where to split the clip. The first part will be from the start to this point, and the second part will be from this point to the end.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">First Part</div>
                    <div className="text-sm font-mono">0:00 → {formatTime(splitTime)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Duration: {formatTime(splitTime)}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Second Part</div>
                    <div className="text-sm font-mono">{formatTime(splitTime)} → {formatTime(clipDuration)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Duration: {formatTime(clipDuration - splitTime)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline"
              onClick={() => setShowSplitModal(false)}
              data-testid="button-cancel-split"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmSplit}
              disabled={clipDuration === 0 || splitTime <= 0 || splitTime >= clipDuration}
              data-testid="button-confirm-split"
            >
              <Scissors className="h-4 w-4 mr-2" />
              Split Clip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview (Low Resolution)
            </DialogTitle>
            <DialogDescription>
              This is a quick low-resolution preview of your combined video. The final export will be higher quality.
            </DialogDescription>
          </DialogHeader>
          
          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
            {previewUrl ? (
              <video
                src={previewUrl}
                className="w-full h-full object-contain"
                controls
                autoPlay
                data-testid="video-preview"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => {
                setShowPreviewModal(false);
                setPreviewUrl(null);
              }}
              data-testid="button-close-preview"
            >
              Close
            </Button>
            <Button 
              onClick={() => {
                setShowPreviewModal(false);
                setPreviewUrl(null);
                proceedToExport();
              }}
              data-testid="button-proceed-to-export-from-preview"
            >
              Continue to Export
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
}
