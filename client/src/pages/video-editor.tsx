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
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
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
  MessageSquare,
  ImageIcon,
  Save,
  FolderOpen,
  Copy,
  MoreHorizontal,
  Upload,
  PanelLeftClose,
  PanelLeft,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { VideoProject } from "@shared/schema";
import { EditorSidebar, PreviewSurface, TimelineTrack } from "./video-editor/components";
import type { EditorCategory } from "./video-editor/components";

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
  originalDuration?: number; // Actual video duration in seconds (loaded from video metadata)
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
  watermark?: {
    imageUrl: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    size: number; // percentage of video width (5-30)
    opacity: number; // 0-1
    name?: string;
  };
  captions: Array<{
    id: string;
    startSeconds: number;
    endSeconds: number;
    text: string;
    style: 'default' | 'bold' | 'outline';
  }>;
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
  const [audioTracks, setAudioTracks] = useState<Array<{ id: string; url: string; name: string; type: 'music' | 'voice' | 'sfx'; volume: number }>>([]);
  const [page, setPage] = useState(1);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // New OpenCut/CapCut-style layout state
  const [activeCategory, setActiveCategory] = useState<EditorCategory>('media');
  const [mediaPanelOpen, setMediaPanelOpen] = useState(true);
  
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
    captions: [],
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

  // Project management state
  const [currentProject, setCurrentProject] = useState<VideoProject | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isSaveAs, setIsSaveAs] = useState(false);

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
  
  // Calculate total timeline duration based on actual clip durations, trim settings, and speed
  const calculateTotalDuration = useCallback((): number => {
    let totalDuration = 0;
    
    for (const clip of orderedClips) {
      const settings = getClipSettings(clip.id);
      // Use original duration if available, otherwise estimate 5 seconds
      const originalDuration = settings.originalDuration ?? 5;
      const trimStart = settings.trimStartSeconds ?? 0;
      const trimEnd = settings.trimEndSeconds ?? originalDuration;
      const speed = settings.speed ?? 1.0;
      
      // Calculate effective duration after trim and speed adjustment
      const trimmedDuration = Math.max(0, trimEnd - trimStart);
      const effectiveDuration = trimmedDuration / speed;
      
      totalDuration += effectiveDuration;
    }
    
    return totalDuration;
  }, [orderedClips, getClipSettings]);
  
  // Load video metadata to get actual duration (defined after updateClipSettings)
  const loadClipDurationRef = useRef<((clipId: string, url: string) => void) | null>(null);
  
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
  
  // Load video metadata to get actual duration for a clip
  const loadClipDuration = useCallback((clipId: string, url: string) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;
    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (duration && isFinite(duration)) {
        updateClipSettings(clipId, { originalDuration: duration });
      }
      video.src = ''; // Clean up
    };
    video.onerror = () => {
      console.warn(`Could not load duration for clip ${clipId}`);
    };
  }, [updateClipSettings]);
  
  // Store ref for use in effects
  loadClipDurationRef.current = loadClipDuration;
  
  // Load durations for newly added clips
  useEffect(() => {
    for (const clip of orderedClips) {
      const settings = clipSettings.get(clip.id);
      // Only load duration if not already loaded
      if (!settings?.originalDuration && clip.url) {
        loadClipDuration(clip.id, clip.url);
      }
    }
  }, [orderedClips, clipSettings, loadClipDuration]);
  
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

  // Separate queries with server-side type filtering for each asset type needed
  // VIDEO GENERATIONS - cursor-based pagination with server-side filtering
  const {
    data: videoData,
    isLoading: videoLoading,
    fetchNextPage: fetchNextVideoPage,
    hasNextPage: hasNextVideoPage,
    isFetchingNextPage: isFetchingNextVideoPage,
  } = useInfiniteQuery({
    queryKey: ["/api/generations", { paginated: true, type: "video" }],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const cursor = pageParam || '';
      const params = new URLSearchParams();
      params.set('cursor', cursor);
      params.set('type', 'video');
      const url = `/api/generations?${params.toString()}`;
      const response = await fetchWithAuth(url);
      if (!response.ok) throw new Error("Failed to fetch videos");
      const result = await response.json() as { items: Generation[]; nextCursor: string | null };
      return result;
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isAuthenticated,
  });

  // MUSIC GENERATIONS - separate query with server-side filtering
  const {
    data: musicData,
    isLoading: musicLoading,
    fetchNextPage: fetchNextMusicPage,
    hasNextPage: hasNextMusicPage,
  } = useInfiniteQuery({
    queryKey: ["/api/generations", { paginated: true, type: "music" }],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const cursor = pageParam || '';
      const params = new URLSearchParams();
      params.set('cursor', cursor);
      params.set('type', 'music');
      const url = `/api/generations?${params.toString()}`;
      const response = await fetchWithAuth(url);
      if (!response.ok) throw new Error("Failed to fetch music");
      const result = await response.json() as { items: Generation[]; nextCursor: string | null };
      return result;
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isAuthenticated,
  });

  // AUDIO GENERATIONS (TTS, voice, sound effects) - separate query with server-side filtering
  const {
    data: audioData,
    isLoading: audioLoading,
    fetchNextPage: fetchNextAudioPage,
    hasNextPage: hasNextAudioPage,
  } = useInfiniteQuery({
    queryKey: ["/api/generations", { paginated: true, type: "audio" }],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const cursor = pageParam || '';
      const params = new URLSearchParams();
      params.set('cursor', cursor);
      params.set('type', 'audio');
      const url = `/api/generations?${params.toString()}`;
      const response = await fetchWithAuth(url);
      if (!response.ok) throw new Error("Failed to fetch audio");
      const result = await response.json() as { items: Generation[]; nextCursor: string | null };
      return result;
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isAuthenticated,
  });

  // Combine loading state for the main display
  const generationsLoading = videoLoading;

  // Flatten video pages and filter for completed videos
  const allVideos = useMemo(() => {
    const items = videoData?.pages.flatMap(page => page.items) ?? [];
    return items.filter(
      (g) => g.status === "completed" && g.resultUrl
    );
  }, [videoData]);
  
  // Flatten and filter music tracks (already filtered by server, just check status)
  const musicTracks = useMemo(() => {
    const items = musicData?.pages.flatMap(page => page.items) ?? [];
    return items.filter(
      (g) => g.status === "completed" && g.resultUrl
    );
  }, [musicData]);
  
  // Flatten and filter audio tracks (TTS, voice, sound effects)
  const voiceTracks = useMemo(() => {
    const items = audioData?.pages.flatMap(page => page.items) ?? [];
    return items.filter(
      (g) => g.status === "completed" && g.resultUrl
    );
  }, [audioData]);
  
  // Avatar videos from video query (filter by model type)
  const avatarVideos = useMemo(() => {
    const items = videoData?.pages.flatMap(page => page.items) ?? [];
    return items.filter((g) => {
      const model = (g.model ?? "").toLowerCase();
      return (g.type === "talking-avatar" || g.type === "avatar" || 
              model.includes("infinitetalk") || 
              model.includes("infinite-talk")) && 
             g.status === "completed" && g.resultUrl;
    });
  }, [videoData]);
  
  // Derived loading states
  const avatarLoading = videoLoading;
  
  // Pagination tracking
  const fetchNextPage = fetchNextVideoPage;
  const hasNextPage = hasNextVideoPage;
  const isFetchingNextPage = isFetchingNextVideoPage;

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

      // Build speed config from clipSettings for per-clip speed adjustments
      const perClipSpeeds = clipSettingsArray
        .filter(cs => cs.speed !== 1.0)
        .map(cs => ({ clipIndex: cs.clipIndex, factor: cs.speed }));
      
      const speedConfig = perClipSpeeds.length > 0 
        ? { mode: 'perClip' as const, perClip: perClipSpeeds }
        : { mode: 'none' as const };

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
        speed: speedConfig,
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
          cs.muted || cs.volume !== 1 || cs.trimStartSeconds !== undefined || cs.trimEndSeconds !== undefined
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
        watermark: enhancements.watermark ? {
          imageUrl: enhancements.watermark.imageUrl,
          position: enhancements.watermark.position,
          size: enhancements.watermark.size,
          opacity: enhancements.watermark.opacity,
        } : undefined,
        captions: enhancements.captions.filter(c => c.text.trim()).map(c => ({
          id: c.id,
          startSeconds: c.startSeconds,
          endSeconds: c.endSeconds,
          text: c.text,
          style: c.style,
        })),
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

      // Build speed config from clipSettings for per-clip speed adjustments
      const perClipSpeeds = clipSettingsArray
        .filter(cs => cs.speed !== 1.0)
        .map(cs => ({ clipIndex: cs.clipIndex, factor: cs.speed }));
      
      const speedConfig = perClipSpeeds.length > 0 
        ? { mode: 'perClip' as const, perClip: perClipSpeeds }
        : { mode: 'none' as const };

      const enhancementsPayload = {
        transitions: enhancements.transitionMode === 'crossfade' ? {
          mode: 'crossfade' as const,
          durationSeconds: enhancements.transitionDuration,
        } : { mode: 'none' as const },
        fadeIn: enhancements.fadeIn,
        fadeOut: enhancements.fadeOut,
        fadeDuration: enhancements.fadeDuration,
        aspectRatio: enhancements.aspectRatio,
        speed: speedConfig,
        clipSettings: clipSettingsArray.filter(cs => 
          cs.muted || cs.volume !== 1 || cs.trimStartSeconds !== undefined || cs.trimEndSeconds !== undefined
        ),
        watermark: enhancements.watermark ? {
          imageUrl: enhancements.watermark.imageUrl,
          position: enhancements.watermark.position,
          size: enhancements.watermark.size,
          opacity: enhancements.watermark.opacity,
        } : undefined,
        captions: enhancements.captions.filter(c => c.text.trim()).map(c => ({
          id: c.id,
          startSeconds: c.startSeconds,
          endSeconds: c.endSeconds,
          text: c.text,
          style: c.style,
        })),
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

  // ==========================================
  // Project Management Queries & Mutations
  // ==========================================

  // Fetch user's saved projects
  const { data: savedProjects = [], isLoading: projectsLoading, refetch: refetchProjects } = useQuery<VideoProject[]>({
    queryKey: ['/api/video-projects'],
    enabled: isAuthenticated,
  });

  // Save project mutation
  const saveProjectMutation = useMutation({
    mutationFn: async ({ title, description, isNew }: { title: string; description: string; isNew: boolean }) => {
      // Build timeline data from current editor state
      const timelineData = {
        version: 1,
        clips: orderedClips.map((clip, index) => ({
          id: clip.id,
          url: clip.url,
          thumbnailUrl: clip.thumbnailUrl,
          prompt: clip.prompt,
          createdAt: clip.createdAt,
          order: index,
          settings: clipSettings.get(clip.id) || { clipId: clip.id, muted: false, volume: 1, speed: 1.0 },
        })),
        enhancements,
        selectedIds: Array.from(selectedIds),
      };

      // Calculate actual timeline duration based on clip durations, trim, and speed
      const durationSeconds = calculateTotalDuration();

      if (isNew || !currentProject) {
        // Create new project
        const response = await apiRequest("POST", "/api/video-projects", {
          title,
          description,
          timelineData,
          settings: { step },
          durationSeconds,
        });
        return await response.json();
      } else {
        // Update existing project
        const response = await apiRequest("PATCH", `/api/video-projects/${currentProject.id}`, {
          title,
          description,
          timelineData,
          settings: { step },
          durationSeconds,
          status: 'saved',
        });
        return await response.json();
      }
    },
    onSuccess: (project: VideoProject) => {
      setCurrentProject(project);
      setShowSaveModal(false);
      queryClient.invalidateQueries({ queryKey: ['/api/video-projects'] });
      toast({
        title: isSaveAs ? "Project Saved As New" : "Project Saved",
        description: `"${project.title}" has been saved successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save project",
        variant: "destructive",
      });
    },
  });

  // Clone project mutation (Save As)
  const cloneProjectMutation = useMutation({
    mutationFn: async ({ projectId, title }: { projectId: string; title: string }) => {
      const response = await apiRequest("POST", `/api/video-projects/${projectId}/clone`, { title });
      return await response.json();
    },
    onSuccess: (project: VideoProject) => {
      setCurrentProject(project);
      setShowSaveModal(false);
      queryClient.invalidateQueries({ queryKey: ['/api/video-projects'] });
      toast({
        title: "Project Cloned",
        description: `Created new project "${project.title}" from the original.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Clone Failed",
        description: error.message || "Failed to clone project",
        variant: "destructive",
      });
    },
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      await apiRequest("DELETE", `/api/video-projects/${projectId}`);
      return projectId;
    },
    onSuccess: (deletedId: string) => {
      if (currentProject?.id === deletedId) {
        setCurrentProject(null);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/video-projects'] });
      toast({
        title: "Project Deleted",
        description: "The project has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete project",
        variant: "destructive",
      });
    },
  });

  // Load a project into the editor
  const loadProject = useCallback((project: VideoProject) => {
    const timeline = project.timelineData as any;
    
    if (!timeline || !timeline.clips) {
      toast({
        title: "Invalid Project",
        description: "This project has no saved timeline data.",
        variant: "destructive",
      });
      return;
    }

    // Restore clips
    const restoredClips: VideoClip[] = timeline.clips.map((c: any) => ({
      id: c.id,
      url: c.url,
      thumbnailUrl: c.thumbnailUrl,
      prompt: c.prompt,
      createdAt: c.createdAt,
    }));
    setOrderedClips(restoredClips);

    // Restore clip settings
    const newClipSettings = new Map<string, ClipSettingsLocal>();
    timeline.clips.forEach((c: any) => {
      if (c.settings) {
        newClipSettings.set(c.id, c.settings);
      }
    });
    setClipSettings(newClipSettings);

    // Restore selected IDs
    if (timeline.selectedIds) {
      setSelectedIds(new Set(timeline.selectedIds));
    }

    // Restore enhancements
    if (timeline.enhancements) {
      setEnhancements(timeline.enhancements);
    }

    // Set current project
    setCurrentProject(project);
    setShowLoadModal(false);

    // Navigate to arrange step if we have clips
    if (restoredClips.length > 0) {
      setStep(2);
    }

    toast({
      title: "Project Loaded",
      description: `"${project.title}" has been loaded into the editor.`,
    });
  }, [toast]);

  // Open save dialog
  const openSaveDialog = useCallback((saveAs: boolean = false) => {
    setIsSaveAs(saveAs);
    setProjectTitle(currentProject?.title || '');
    setProjectDescription(currentProject?.description || '');
    setShowSaveModal(true);
  }, [currentProject]);

  // Handle save form submit
  const handleSaveProject = useCallback(() => {
    if (!projectTitle.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a project title.",
        variant: "destructive",
      });
      return;
    }

    if (isSaveAs && currentProject) {
      // Clone the project with new title
      cloneProjectMutation.mutate({ projectId: currentProject.id, title: projectTitle });
    } else {
      // Save or update
      saveProjectMutation.mutate({ 
        title: projectTitle, 
        description: projectDescription, 
        isNew: isSaveAs || !currentProject 
      });
    }
  }, [projectTitle, projectDescription, isSaveAs, currentProject, saveProjectMutation, cloneProjectMutation, toast]);

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

  // Calculate total timeline duration
  const totalDuration = calculateTotalDuration();

  // Handle adding clip to timeline from media panel
  // Uses unique instance IDs to allow the same video to be added multiple times
  const addClipToTimeline = useCallback((video: Generation) => {
    if (!video.resultUrl) return;
    
    // Generate unique instance ID to allow duplicates
    const instanceId = `${video.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const clip: VideoClip = {
      id: instanceId, // Unique instance ID
      url: video.resultUrl,
      thumbnailUrl: video.thumbnailUrl || null,
      prompt: video.prompt || '',
      createdAt: video.createdAt.toString(),
    };
    
    setOrderedClips(prev => [...prev, clip]);
    
    toast({
      title: "Clip Added",
      description: "Video added to timeline",
    });
  }, [toast]);

  // Handle removing clip from timeline
  const removeClipFromTimeline = useCallback((clipId: string) => {
    setOrderedClips(prev => prev.filter(c => c.id !== clipId));
  }, []);

  // Handle removing audio track from timeline
  const removeAudioTrack = useCallback((trackId: string) => {
    setAudioTracks(prev => prev.filter(t => t.id !== trackId));
  }, []);

  if (authLoading) {
    return (
      <SidebarInset>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </SidebarInset>
    );
  }

  // ==========================================
  // NEW OPENCUT/CAPCUT-STYLE LAYOUT
  // ==========================================
  return (
    <SidebarInset>
      <div className="flex flex-col h-full">
        {/* Compact Header */}
        <header className="shrink-0 border-b px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
              <Film className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-bold">Video Editor</h1>
            {currentProject && (
              <Badge variant="outline" className="flex items-center gap-1 max-w-[120px]" data-testid="badge-current-project">
                <span className="truncate text-xs">{currentProject.title}</span>
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1" data-testid="badge-credit-cost">
              <Coins className="h-3 w-3" />
              <span className="text-xs">{baseCreditCost} credits</span>
            </Badge>
            
            {isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-project-menu">
                    <FolderOpen className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Projects</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowLoadModal(true)} data-testid="menu-item-load">
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Open Project
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => openSaveDialog(false)}
                    disabled={orderedClips.length === 0}
                    data-testid="menu-item-save"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {currentProject ? 'Save' : 'Save As'}
                  </DropdownMenuItem>
                  {currentProject && (
                    <DropdownMenuItem onClick={() => openSaveDialog(true)} data-testid="menu-item-save-as">
                      <Copy className="h-4 w-4 mr-2" />
                      Save As Copy
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={resetEditor} data-testid="menu-item-new">
                    <Plus className="h-4 w-4 mr-2" />
                    New Project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Main Editor Layout: Sidebar + Media Panel + Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Icon Sidebar */}
          <EditorSidebar 
            activeCategory={activeCategory} 
            onCategoryChange={setActiveCategory} 
          />
          
          {/* Collapsible Media/Asset Panel */}
          {mediaPanelOpen && (
            <div className="w-72 border-r flex flex-col shrink-0 bg-background" data-testid="media-panel">
              <div className="flex items-center justify-between p-3 border-b">
                <span className="text-sm font-medium capitalize">{activeCategory}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => setMediaPanelOpen(false)}
                  data-testid="button-close-media-panel"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-3">
                  {/* Media Category Content */}
                  {activeCategory === 'media' && (
                    <div className="space-y-3">
                      {!isAuthenticated ? (
                        <div className="text-center py-8">
                          <Video className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Sign in to access your videos</p>
                          <Button size="sm" className="mt-2" onClick={() => setShowGuestModal(true)}>
                            Sign In
                          </Button>
                        </div>
                      ) : generationsLoading ? (
                        <div className="grid grid-cols-2 gap-2">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="aspect-video rounded-md" />
                          ))}
                        </div>
                      ) : videos.length === 0 ? (
                        <div className="text-center py-8">
                          <Video className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">No videos yet</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {videos.map((video) => (
                            <div 
                              key={video.id}
                              className="group relative aspect-video rounded-md overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary"
                              onClick={() => addClipToTimeline(video)}
                              data-testid={`media-item-${video.id}`}
                            >
                              {video.thumbnailUrl ? (
                                <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                  <Video className="h-6 w-6 text-muted-foreground" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Plus className="h-6 w-6 text-white" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Load More for Media */}
                      {hasNextPage && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => fetchNextPage()}
                          disabled={isFetchingNextPage}
                        >
                          {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load More'}
                        </Button>
                      )}
                    </div>
                  )}
                  
                  {/* Music Category Content */}
                  {activeCategory === 'music' && (
                    <div className="space-y-2">
                      {musicLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 rounded-md" />
                          ))}
                        </div>
                      ) : musicTracks.length === 0 ? (
                        <div className="text-center py-8">
                          <Music className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">No music tracks</p>
                        </div>
                      ) : (
                        musicTracks.map((track) => (
                          <div
                            key={track.id}
                            className="p-2 border rounded-md cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              const trackId = `music_${track.id}_${Date.now()}`;
                              setAudioTracks(prev => [...prev, {
                                id: trackId,
                                url: track.resultUrl!,
                                name: track.prompt || 'Music Track',
                                type: 'music',
                                volume: 0.5,
                              }]);
                              setEnhancements(prev => ({
                                ...prev,
                                backgroundMusic: {
                                  audioUrl: track.resultUrl!,
                                  volume: 0.5,
                                  name: track.prompt || 'Music Track',
                                },
                              }));
                              toast({ title: "Music Added", description: "Music track added to timeline" });
                            }}
                            data-testid={`music-item-${track.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <Music className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm truncate">{track.prompt || 'Music Track'}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  
                  {/* Audio Category Content */}
                  {activeCategory === 'audio' && (
                    <div className="space-y-2">
                      {audioLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 rounded-md" />
                          ))}
                        </div>
                      ) : voiceTracks.length === 0 ? (
                        <div className="text-center py-8">
                          <Mic className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">No audio tracks</p>
                        </div>
                      ) : (
                        voiceTracks.map((track) => (
                          <div
                            key={track.id}
                            className="p-2 border rounded-md cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              const trackId = `voice_${track.id}_${Date.now()}`;
                              setAudioTracks(prev => [...prev, {
                                id: trackId,
                                url: track.resultUrl!,
                                name: track.prompt || 'Voice Track',
                                type: 'voice',
                                volume: 1.0,
                              }]);
                              setEnhancements(prev => ({
                                ...prev,
                                audioTrack: {
                                  audioUrl: track.resultUrl!,
                                  volume: 1.0,
                                  type: 'tts',
                                  name: track.prompt || 'Voice Track',
                                },
                              }));
                              toast({ title: "Audio Added", description: "Audio track added to timeline" });
                            }}
                            data-testid={`audio-item-${track.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm truncate">{track.prompt || 'Audio Track'}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  
                  {/* Text Category Content */}
                  {activeCategory === 'text' && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Add text overlays to your video</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => {
                          const newOverlay = {
                            id: `text_${Date.now()}`,
                            text: 'New Text',
                            position: 'center' as const,
                            timing: 'all' as const,
                            fontSize: 24,
                            colorHex: '#ffffff',
                          };
                          setEnhancements(prev => ({
                            ...prev,
                            textOverlays: [...prev.textOverlays, newOverlay],
                          }));
                        }}
                        data-testid="button-add-text-overlay"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Text Overlay
                      </Button>
                      
                      {enhancements.textOverlays.map((overlay) => (
                        <div key={overlay.id} className="p-3 border rounded-md space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Input
                              value={overlay.text}
                              onChange={(e) => {
                                setEnhancements(prev => ({
                                  ...prev,
                                  textOverlays: prev.textOverlays.map(o => 
                                    o.id === overlay.id ? { ...o, text: e.target.value } : o
                                  ),
                                }));
                              }}
                              placeholder="Enter text..."
                              className="h-8 text-sm"
                              data-testid={`input-text-overlay-${overlay.id}`}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => {
                                setEnhancements(prev => ({
                                  ...prev,
                                  textOverlays: prev.textOverlays.filter(o => o.id !== overlay.id),
                                }));
                              }}
                              data-testid={`button-remove-overlay-${overlay.id}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Select
                              value={overlay.position}
                              onValueChange={(value: 'top' | 'center' | 'bottom') => {
                                setEnhancements(prev => ({
                                  ...prev,
                                  textOverlays: prev.textOverlays.map(o => 
                                    o.id === overlay.id ? { ...o, position: value } : o
                                  ),
                                }));
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
                              onValueChange={(value: 'intro' | 'outro' | 'all') => {
                                setEnhancements(prev => ({
                                  ...prev,
                                  textOverlays: prev.textOverlays.map(o => 
                                    o.id === overlay.id ? { ...o, timing: value } : o
                                  ),
                                }));
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="intro">Intro</SelectItem>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="outro">Outro</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Overlays Category Content */}
                  {activeCategory === 'overlays' && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Add avatar overlays (PiP)</p>
                      {avatarLoading ? (
                        <div className="grid grid-cols-2 gap-2">
                          {Array.from({ length: 2 }).map((_, i) => (
                            <Skeleton key={i} className="aspect-video rounded-md" />
                          ))}
                        </div>
                      ) : avatarVideos.length === 0 ? (
                        <div className="text-center py-4">
                          <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-xs text-muted-foreground">No avatar videos</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {avatarVideos.map((avatar) => (
                            <div
                              key={avatar.id}
                              className="aspect-video rounded-md overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary"
                              onClick={() => {
                                setEnhancements(prev => ({
                                  ...prev,
                                  avatarOverlay: {
                                    videoUrl: avatar.resultUrl!,
                                    position: 'bottom-right',
                                    size: 'medium',
                                    name: avatar.prompt || 'Avatar',
                                  },
                                }));
                                toast({ title: "Avatar Added", description: "Avatar overlay added" });
                              }}
                              data-testid={`avatar-item-${avatar.id}`}
                            >
                              {avatar.thumbnailUrl ? (
                                <img src={avatar.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                  <User className="h-6 w-6 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Export Category Content */}
                  {activeCategory === 'export' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Aspect Ratio</Label>
                        <Select 
                          value={enhancements.aspectRatio} 
                          onValueChange={(value: '16:9' | '9:16' | '1:1') => {
                            setEnhancements(prev => ({ ...prev, aspectRatio: value }));
                          }}
                        >
                          <SelectTrigger data-testid="select-aspect-ratio">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                            <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                            <SelectItem value="1:1">1:1 (Square)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Fade In</Label>
                        <Switch
                          checked={enhancements.fadeIn}
                          onCheckedChange={(checked) => setEnhancements(prev => ({ ...prev, fadeIn: checked }))}
                          data-testid="switch-fade-in"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Fade Out</Label>
                        <Switch
                          checked={enhancements.fadeOut}
                          onCheckedChange={(checked) => setEnhancements(prev => ({ ...prev, fadeOut: checked }))}
                          data-testid="switch-fade-out"
                        />
                      </div>
                      
                      {/* AWS Lambda Timeout Warning */}
                      {totalDuration > 600 && (
                        <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 text-xs space-y-1">
                          <div className="flex items-center gap-2 font-medium">
                            <Clock className="h-4 w-4" />
                            Long Video Warning
                          </div>
                          <p>Videos longer than 10 minutes may take significant time to process. AWS Lambda has a maximum processing time of 15 minutes.</p>
                        </div>
                      )}
                      
                      <div className="p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        Max processing time: 15 minutes (AWS Lambda limit)
                      </div>
                      
                      <div className="pt-2 space-y-2">
                        <Button 
                          className="w-full"
                          onClick={startExport}
                          disabled={orderedClips.length === 0 || exportMutation.isPending}
                          data-testid="button-export"
                        >
                          {exportMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Exporting...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Export Video
                            </>
                          )}
                        </Button>
                        
                        {exportedUrl && (
                          <Button variant="outline" className="w-full" asChild>
                            <a href={exportedUrl} download data-testid="button-download">
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </a>
                          </Button>
                        )}
                        
                        {exportProgress > 0 && exportProgress < 100 && (
                          <Progress value={exportProgress} className="h-2" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
          
          {/* Media Panel Toggle (when closed) */}
          {!mediaPanelOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-full w-8 rounded-none border-r shrink-0"
              onClick={() => setMediaPanelOpen(true)}
              data-testid="button-open-media-panel"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}
          
          {/* Preview Surface - Always Visible */}
          <div className="flex-1 flex flex-col min-w-0">
            <PreviewSurface
              previewUrl={previewUrl}
              isGenerating={previewMutation.isPending}
              clipCount={orderedClips.length}
              totalDuration={totalDuration}
              onGeneratePreview={() => previewMutation.mutate(orderedClips)}
              className="flex-1"
            />
          </div>
        </div>
        
        {/* Timeline at Bottom */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={orderedClips.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            <TimelineTrack
              clips={orderedClips}
              audioTracks={audioTracks}
              getClipSettings={getClipSettings}
              onMuteToggle={toggleClipMute}
              onRemoveClip={removeClipFromTimeline}
              onRemoveAudioTrack={removeAudioTrack}
              onOpenSettings={openClipSettings}
              totalDuration={totalDuration}
            />
          </SortableContext>
        </DndContext>
      </div>

      {/* Dialogs and Modals */}
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

      {/* Save Project Dialog */}
      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              {isSaveAs ? 'Save As New Project' : (currentProject ? 'Save Project' : 'Save New Project')}
            </DialogTitle>
            <DialogDescription>
              {isSaveAs 
                ? 'Create a copy of this project with a new name.'
                : 'Save your current timeline and settings for later.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-title">Project Title</Label>
              <Input
                id="project-title"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="My Video Project"
                data-testid="input-project-title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="project-description">Description (optional)</Label>
              <Input
                id="project-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="A brief description of your project"
                data-testid="input-project-description"
              />
            </div>
            
            <div className="text-sm text-muted-foreground">
              {orderedClips.length} clip{orderedClips.length !== 1 ? 's' : ''} will be saved
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveModal(false)} data-testid="button-cancel-save">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveProject}
              disabled={saveProjectMutation.isPending || cloneProjectMutation.isPending}
              data-testid="button-confirm-save"
            >
              {(saveProjectMutation.isPending || cloneProjectMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Save className="h-4 w-4 mr-2" />
              {isSaveAs ? 'Save Copy' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Project Dialog */}
      <Dialog open={showLoadModal} onOpenChange={setShowLoadModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Open Project
            </DialogTitle>
            <DialogDescription>
              Load a previously saved project to continue editing.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {projectsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : savedProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No saved projects yet.</p>
                <p className="text-sm">Save your current work to see it here.</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {savedProjects.map((project) => (
                    <div
                      key={project.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer",
                        currentProject?.id === project.id && "border-primary bg-primary/5"
                      )}
                      onClick={() => loadProject(project)}
                      data-testid={`project-item-${project.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Film className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{project.title}</span>
                          {currentProject?.id === project.id && (
                            <Badge variant="secondary" className="text-xs">Current</Badge>
                          )}
                        </div>
                        {project.description && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {project.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(project.updatedAt).toLocaleDateString()}
                          </span>
                          {project.durationSeconds && (
                            <span>{Math.round(project.durationSeconds)}s</span>
                          )}
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" data-testid={`project-menu-${project.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              loadProject(project);
                            }}
                          >
                            <FolderOpen className="h-4 w-4 mr-2" />
                            Open
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              cloneProjectMutation.mutate({ projectId: project.id, title: `${project.title} (Copy)` });
                            }}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to delete "${project.title}"?`)) {
                                deleteProjectMutation.mutate(project.id);
                              }
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadModal(false)} data-testid="button-close-load">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
}
