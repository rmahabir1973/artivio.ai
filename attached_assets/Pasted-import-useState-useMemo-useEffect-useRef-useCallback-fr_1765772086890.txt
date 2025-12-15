import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  CollisionDetection,
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
import type { Generation, VideoEnhancements, ClipSetting, TextOverlay, TransitionType, ClipTransition } from "@shared/schema";
import { TRANSITION_TYPES } from "@shared/schema";
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
  Shuffle,
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
import { EditorSidebar, PreviewSurface, TimelineTrack, DraggableMediaItem, MultiTrackTimeline, TextOverlayEditor, TextOverlayRenderer, DraggableTransition, TransitionDropZone, TransitionEditDialog } from "./video-editor/components";
import type { EditorCategory, MultiTrackTimelineItem, DroppedMediaItem } from "./video-editor/components";
import { useTextOverlay, DEFAULT_TEXT_OVERLAY } from "@/hooks/useTextOverlay";

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
  type: 'video' | 'image'; // Type of media
}

interface ClipSettingsLocal {
  clipId: string;
  muted: boolean;
  volume: number;
  speed: number; // 0.5 to 2.0
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  originalDuration?: number; // Actual video duration in seconds (loaded from video metadata)
  displayDuration?: number; // For images: how long to display (default 5 seconds)
}

// Per-clip transition state (for the transition AFTER each clip)
interface ClipTransitionLocal {
  afterClipIndex: number;
  type: TransitionType | string; // Allow string for component compatibility
  durationSeconds: number;
}

interface EnhancementsState {
  transitionMode: 'none' | 'crossfade' | 'perClip';
  transitionDuration: number;
  clipTransitions: ClipTransitionLocal[]; // Per-clip transitions
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

// Volume slider with local state to prevent video stuttering during drag
function ClipVolumeSlider({ 
  clipId, 
  initialVolume, 
  onCommit 
}: { 
  clipId: string; 
  initialVolume: number; 
  onCommit: (v: number) => void;
}) {
  const [localVolume, setLocalVolume] = useState(initialVolume);
  
  return (
    <div className="space-y-2">
      <Label className="text-sm flex justify-between">
        Volume
        <span className="text-muted-foreground">
          {Math.round(localVolume * 100)}%
        </span>
      </Label>
      <Slider
        value={[localVolume]}
        min={0}
        max={1}
        step={0.05}
        onValueChange={([v]) => setLocalVolume(v)}
        onValueCommit={([v]) => onCommit(v)}
        data-testid="slider-clip-volume"
      />
    </div>
  );
}

// Speed slider with local state to prevent video stuttering during drag
function ClipSpeedSlider({ 
  clipId, 
  initialSpeed, 
  onCommit 
}: { 
  clipId: string; 
  initialSpeed: number; 
  onCommit: (v: number) => void;
}) {
  const [localSpeed, setLocalSpeed] = useState(initialSpeed);
  
  return (
    <div className="pt-4 border-t space-y-2">
      <Label className="text-sm flex justify-between">
        <span className="flex items-center gap-2">
          <Play className="h-4 w-4" />
          Speed
        </span>
        <span className="text-muted-foreground">
          {localSpeed}x
        </span>
      </Label>
      <Slider
        value={[localSpeed]}
        min={0.5}
        max={2}
        step={0.25}
        onValueChange={([v]) => setLocalSpeed(v)}
        onValueCommit={([v]) => onCommit(v)}
        data-testid="slider-clip-speed"
      />
      <p className="text-xs text-muted-foreground">
        0.5x = slow motion, 2x = double speed
      </p>
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
  const [multiTrackItems, setMultiTrackItems] = useState<MultiTrackTimelineItem[]>([]);
  const [useMultiTrack, setUseMultiTrack] = useState(false);
  const [multiTrackKey, setMultiTrackKey] = useState(0);

  const {
    overlays: textOverlays,
    addOverlay: addTextOverlay,
    updateOverlay: updateTextOverlay,
    removeOverlay: removeTextOverlay,
    selectedOverlayId,
    setSelectedOverlayId,
    duplicateOverlay: duplicateTextOverlay,
    clearAllOverlays: clearTextOverlays,
  } = useTextOverlay();

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
    clipTransitions: [],
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

  // Preview state with auto-update support
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'stale' | 'refreshing' | 'ready' | 'error'>('idle');
  const [previewError, setPreviewError] = useState<string | undefined>(undefined);
  const previewCacheRef = useRef<Map<string, string>>(new Map());
  const lastPreviewSignatureRef = useRef<string | null>(null);
  const previewDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Project management state
  const [currentProject, setCurrentProject] = useState<VideoProject | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isSaveAs, setIsSaveAs] = useState(false);

  // Transition editing state
  const [showTransitionEditModal, setShowTransitionEditModal] = useState(false);
  const [editingTransition, setEditingTransition] = useState<{ position: number; transition: ClipTransitionLocal } | null>(null);

  // Get clip settings for a clip, with defaults
  const getClipSettings = useCallback((clipId: string): ClipSettingsLocal => {
    return clipSettings.get(clipId) || {
      clipId,
      muted: false,
      volume: 1,
      speed: 1.0,
    };
  }, [clipSettings]);

  // ==========================================
  // Auto-save to localStorage for session persistence
  // ==========================================
  const LOCAL_STORAGE_KEY = 'artivio-video-editor-session';
  const autoSaveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoringRef = useRef(false);

  // Save editor state to localStorage (debounced)
  useEffect(() => {
    // Don't save while restoring to prevent overwriting restored data
    if (isRestoringRef.current) return;
    
    // Skip saving if there's nothing to save
    if (orderedClips.length === 0 && audioTracks.length === 0 && multiTrackItems.length === 0) {
      return;
    }

    if (autoSaveDebounceRef.current) {
      clearTimeout(autoSaveDebounceRef.current);
    }

    autoSaveDebounceRef.current = setTimeout(() => {
      try {
        const sessionData = {
          version: 1,
          savedAt: new Date().toISOString(),
          orderedClips,
          audioTracks,
          multiTrackItems,
          useMultiTrack,
          clipSettings: Array.from(clipSettings.entries()),
          enhancements,
          step,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessionData));
        console.log('[VIDEO-EDITOR] Session auto-saved to localStorage');
      } catch (error) {
        console.error('[VIDEO-EDITOR] Failed to auto-save session:', error);
      }
    }, 1000); // Debounce 1 second

    return () => {
      if (autoSaveDebounceRef.current) {
        clearTimeout(autoSaveDebounceRef.current);
      }
    };
  }, [orderedClips, audioTracks, multiTrackItems, useMultiTrack, clipSettings, enhancements, step]);

  // Restore editor state from localStorage on mount
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!savedSession) return;

      const sessionData = JSON.parse(savedSession);
      
      // Validate session data
      if (!sessionData.version || !sessionData.savedAt) return;
      
      // Check if session is less than 24 hours old
      const savedAt = new Date(sessionData.savedAt);
      const hoursSinceSave = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceSave > 24) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        console.log('[VIDEO-EDITOR] Session expired, cleared localStorage');
        return;
      }

      // Mark as restoring to prevent immediate re-save
      isRestoringRef.current = true;

      // Restore state
      if (sessionData.orderedClips?.length > 0) {
        setOrderedClips(sessionData.orderedClips);
      }
      if (sessionData.audioTracks?.length > 0) {
        setAudioTracks(sessionData.audioTracks);
      }
      if (sessionData.multiTrackItems?.length > 0) {
        setMultiTrackItems(sessionData.multiTrackItems);
      }
      if (sessionData.useMultiTrack !== undefined) {
        setUseMultiTrack(sessionData.useMultiTrack);
      }
      if (sessionData.clipSettings?.length > 0) {
        setClipSettings(new Map(sessionData.clipSettings));
      }
      if (sessionData.enhancements) {
        setEnhancements(sessionData.enhancements);
      }
      if (sessionData.step) {
        setStep(sessionData.step);
      }

      console.log('[VIDEO-EDITOR] Session restored from localStorage');

      // Reset restoring flag after a short delay
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 500);
    } catch (error) {
      console.error('[VIDEO-EDITOR] Failed to restore session:', error);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  // Clear session when user starts a new project or clears the editor
  const clearLocalSession = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    console.log('[VIDEO-EDITOR] Session cleared from localStorage');
  }, []);

  // Calculate total timeline duration based on actual clip durations, trim settings, and speed
  const calculateTotalDuration = useCallback((): number => {
    let totalDuration = 0;

    for (const clip of orderedClips) {
      const settings = getClipSettings(clip.id);

      // For images, use displayDuration; for videos, calculate from trim/speed
      if (clip.type === 'image') {
        totalDuration += settings.displayDuration ?? 5;
      } else {
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
    }

    return totalDuration;
  }, [orderedClips, getClipSettings]);

  // Load video metadata to get actual duration (defined after updateClipSettings)
  const loadClipDurationRef = useRef<((clipId: string, url: string) => void) | null>(null);
  
  // Track which clips have already attempted duration loading to prevent infinite loops
  // Key is "clipId:url" to allow re-loading if URL changes
  const attemptedDurationLoadsRef = useRef<Set<string>>(new Set());

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

  // Load media metadata to get actual duration for a clip (supports both video and audio)
  // Uses attemptedDurationLoadsRef to prevent infinite loops on failed loads
  const loadClipDuration = useCallback((clipId: string, url: string, mediaType: 'video' | 'audio' | 'image' = 'video') => {
    if (!url || !url.startsWith('http')) {
      return;
    }
    
    // Check if we've already attempted to load this clip+url combo to prevent infinite loops
    const cacheKey = `${clipId}:${url}`;
    if (attemptedDurationLoadsRef.current.has(cacheKey)) {
      return; // Already attempted, don't retry
    }
    
    // Mark as attempted before loading
    attemptedDurationLoadsRef.current.add(cacheKey);

    // Images don't need duration loading - use default display duration
    if (mediaType === 'image') {
      updateClipSettings(clipId, { originalDuration: 5 }); // Default image display duration
      return;
    }

    // Use correct element type for media: video for video files, audio for audio/music files
    const element = mediaType === 'audio' 
      ? document.createElement('audio')
      : document.createElement('video');

    element.preload = 'metadata';
    if ('crossOrigin' in element) {
      (element as HTMLVideoElement | HTMLAudioElement).crossOrigin = 'anonymous';
    }
    element.src = url;

    // Timeout after 10 seconds if metadata doesn't load
    const fallbackDuration = mediaType === 'audio' ? 30 : 10;
    const timeoutId = setTimeout(() => {
      console.warn(`[DURATION] Timeout loading ${mediaType} metadata for clip ${clipId}`);
      updateClipSettings(clipId, { originalDuration: fallbackDuration });
      element.src = '';
      element.load();
    }, 10000);

    element.onloadedmetadata = () => {
      clearTimeout(timeoutId);
      const duration = element.duration;
      if (duration && isFinite(duration)) {
        console.log(`[DURATION] Loaded ${mediaType} clip ${clipId}: ${duration}s`);
        updateClipSettings(clipId, { originalDuration: duration });
      } else {
        updateClipSettings(clipId, { originalDuration: fallbackDuration });
      }
      element.src = '';
      element.load(); // Clean up
    };

    element.onerror = () => {
      clearTimeout(timeoutId);
      // Silently use fallback - don't spam console with errors
      updateClipSettings(clipId, { originalDuration: fallbackDuration });
      element.src = '';
      element.load();
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
        loadClipDuration(clip.id, clip.url, clip.type || 'video');
      }
    }
  }, [orderedClips, clipSettings, loadClipDuration]);

  // Load durations for audio tracks
  useEffect(() => {
    for (const track of audioTracks) {
      const settings = clipSettings.get(track.id);
      // Only load duration if not already loaded
      if (!settings?.originalDuration && track.url) {
        // IMPORTANT: Pass 'audio' as the mediaType parameter
        loadClipDuration(track.id, track.url, 'audio');
      }
    }
  }, [audioTracks, clipSettings, loadClipDuration]);

  // Build a signature string that represents the current preview state
  // Used for caching and detecting changes
  const buildPreviewSignature = useCallback(() => {
    if (orderedClips.length === 0) return null;

    const previewClips = orderedClips; // Preview ALL clips - no limit

    const signatureData = {
      clips: previewClips.map((clip, index) => ({
        url: clip.url,
        index,
        settings: {
          muted: getClipSettings(clip.id).muted,
          volume: getClipSettings(clip.id).volume,
          speed: getClipSettings(clip.id).speed,
          trimStart: getClipSettings(clip.id).trimStartSeconds,
          trimEnd: getClipSettings(clip.id).trimEndSeconds,
        }
      })),
      enhancements: {
        transitionMode: enhancements.transitionMode,
        transitionDuration: enhancements.transitionDuration,
        fadeIn: enhancements.fadeIn,
        fadeOut: enhancements.fadeOut,
        fadeDuration: enhancements.fadeDuration,
        aspectRatio: enhancements.aspectRatio,
      },
    };

    return JSON.stringify(signatureData);
  }, [orderedClips, getClipSettings, enhancements]);

  // Backend Lambda preview generation (works for both single and multi-track modes)
  const generatePreview = useCallback(async () => {
    if (orderedClips.length === 0 && multiTrackItems.length === 0) {
      toast({
        title: "No clips",
        description: "Add clips to the timeline to generate a preview.",
        variant: "destructive",
      });
      return;
    }

    setPreviewStatus('refreshing');
    setPreviewError(undefined);

    try {
      let payload: any;

      if (useMultiTrack && multiTrackItems.length > 0) {
        // Multi-track mode: send timeline items to Lambda
        const previewItems = multiTrackItems; // Preview ALL items - no limit

        payload = {
          multiTrackTimeline: {
            enabled: true,
            items: previewItems.map(item => ({
              id: item.id,
              type: item.type,
              track: item.track,
              startTime: item.startTime,
              duration: item.duration,
              url: item.url,
              name: item.name,
              speed: item.speed,
              volume: item.volume,
              muted: item.muted,
              trim: item.trim,
              transition: item.transition,
            })),
          },
          videoSettings: {
            format: 'mp4',
            quality: 'preview',
            resolution: '720p',
          },
          enhancements: {
            aspectRatio: enhancements.aspectRatio,
            fadeIn: enhancements.fadeIn,
            fadeOut: enhancements.fadeOut,
            fadeDuration: enhancements.fadeDuration,
          },
          previewMode: true,
          // Full preview - no duration limit for multi-track mode
        };
      } else {
        // Single-track mode: send ordered clips to Lambda
        const previewClips = orderedClips; // Preview ALL clips - no limit

        const project = {
          clips: previewClips.map((clip, index) => ({
            id: clip.id,
            sourceUrl: clip.url,
            order: index,
          })),
        };

        const clipSettingsArray = previewClips.map((clip, index) => {
          const localSettings = getClipSettings(clip.id);
          const isImage = clip.type === 'image';
          return {
            clipId: clip.id,
            clipIndex: index,
            muted: localSettings?.muted ?? false,
            volume: localSettings?.volume ?? 1,
            speed: localSettings?.speed ?? 1.0,
            trimStartSeconds: localSettings?.trimStartSeconds,
            trimEndSeconds: localSettings?.trimEndSeconds,
            isImage,
            displayDuration: isImage ? (localSettings?.displayDuration ?? 5) : undefined,
          };
        });

        const perClipSpeeds = clipSettingsArray
          .filter(cs => cs.speed !== 1.0 && !cs.isImage)
          .map(cs => ({ clipIndex: cs.clipIndex, factor: cs.speed }));

        const speedConfig = perClipSpeeds.length > 0 
          ? { mode: 'perClip' as const, perClip: perClipSpeeds }
          : { mode: 'none' as const };

        payload = {
          project,
          videoSettings: {
            format: 'mp4',
            quality: 'preview',
            resolution: '720p',
          },
          enhancements: {
            transitions: enhancements.transitionMode === 'perClip' ? {
              mode: 'perClip' as const,
              perClip: enhancements.clipTransitions.map(t => ({
                afterClipIndex: t.afterClipIndex,
                type: t.type,
                durationSeconds: t.durationSeconds,
              })),
            } : enhancements.transitionMode === 'crossfade' ? {
              mode: 'crossfade' as const,
              durationSeconds: enhancements.transitionDuration,
            } : { mode: 'none' as const },
            fadeIn: enhancements.fadeIn,
            fadeOut: enhancements.fadeOut,
            fadeDuration: enhancements.fadeDuration,
            aspectRatio: enhancements.aspectRatio,
            speed: speedConfig,
            clipSettings: clipSettingsArray.filter(cs => 
              cs.muted || 
              cs.volume !== 1 || 
              cs.speed !== 1.0 ||
              cs.trimStartSeconds !== undefined || 
              cs.trimEndSeconds !== undefined || 
              cs.isImage
            ),
            backgroundMusic: enhancements.backgroundMusic ? {
              audioUrl: enhancements.backgroundMusic.audioUrl,
              volume: enhancements.backgroundMusic.volume,
            } : undefined,
            // Audio track (voice/TTS) - Lambda now supports audio mixing with amix filter
            audioTrack: enhancements.audioTrack ? {
              audioUrl: enhancements.audioTrack.audioUrl,
              type: enhancements.audioTrack.type,
              volume: enhancements.audioTrack.volume,
              startAtSeconds: 0,
            } : undefined,
          },
          previewMode: true,
          // Full preview - no duration limit, Lambda processes all clips
        };
      }

      toast({
        title: "Generating Preview",
        description: "Processing on server...",
      });

      const response = await apiRequest("POST", "/api/video-editor/preview", payload);
      const data = await response.json();

      if (data.status === 'completed' && data.previewUrl) {
        setPreviewUrl(data.previewUrl);
        setPreviewStatus('ready');
        toast({
          title: "Preview Ready",
          description: "Your preview has been generated!",
        });
      } else if (data.status === 'processing') {
        // Handle async processing - poll for completion
        toast({
          title: "Processing",
          description: "Preview is being generated, this may take a few moments...",
        });
        // Note: For production, implement polling for jobId
        setPreviewStatus('idle');
      } else {
        throw new Error(data.message || 'Preview generation failed');
      }
    } catch (error) {
      console.error('Preview generation error:', error);
      setPreviewStatus('error');
      setPreviewError(error instanceof Error ? error.message : 'Preview generation failed');
      toast({
        title: "Preview Failed",
        description: error instanceof Error ? error.message : 'Failed to generate preview',
        variant: "destructive",
      });
    }
  }, [orderedClips, multiTrackItems, useMultiTrack, getClipSettings, enhancements, toast]);


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

  // Custom collision detection that prioritizes transition drop zones
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    // First check for transition-zone droppables using pointer intersection
    const pointerCollisions = pointerWithin(args);

    // Filter for transition zones
    const transitionZoneHits = pointerCollisions.filter(
      collision => collision.data?.droppableContainer?.data?.current?.type === 'transition-zone'
    );

    // If we have a transition zone hit, return it (prioritize transitions over clip sorting)
    if (transitionZoneHits.length > 0) {
      console.log('[COLLISION] Transition zone hit:', transitionZoneHits[0].id);
      return transitionZoneHits;
    }

    // Fall back to closestCenter for clip sorting
    return closestCenter(args);
  }, []);

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
      params.set('completedOnly', 'true');
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
    isFetchingNextPage: isFetchingNextMusicPage,
  } = useInfiniteQuery({
    queryKey: ["/api/generations", { paginated: true, type: "music" }],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const cursor = pageParam || '';
      const params = new URLSearchParams();
      params.set('cursor', cursor);
      params.set('type', 'music');
      params.set('completedOnly', 'true');
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
    isFetchingNextPage: isFetchingNextAudioPage,
  } = useInfiniteQuery({
    queryKey: ["/api/generations", { paginated: true, type: "audio" }],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const cursor = pageParam || '';
      const params = new URLSearchParams();
      params.set('cursor', cursor);
      params.set('type', 'audio');
      params.set('completedOnly', 'true');
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

  // IMAGE GENERATIONS - for adding images as timeline clips
  const {
    data: imageData,
    isLoading: imageLoading,
    fetchNextPage: fetchNextImagePage,
    hasNextPage: hasNextImagePage,
    isFetchingNextPage: isFetchingNextImagePage,
  } = useInfiniteQuery({
    queryKey: ["/api/generations", { paginated: true, type: "image" }],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const cursor = pageParam || '';
      const params = new URLSearchParams();
      params.set('cursor', cursor);
      params.set('type', 'image');
      params.set('completedOnly', 'true');
      const url = `/api/generations?${params.toString()}`;
      const response = await fetchWithAuth(url);
      if (!response.ok) throw new Error("Failed to fetch images");
      const result = await response.json() as { items: Generation[]; nextCursor: string | null };
      return result;
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isAuthenticated,
  });

  // Combine loading state for the main display
  const generationsLoading = videoLoading;

  // Helper function for robust generation validation
  // Filters out failed generations even if marked as "completed"
  const isValidGeneration = useCallback((g: Generation): boolean => {
    // Must have completed status
    if (g.status !== "completed") return false;

    // CRITICAL: Must NOT have an error message
    // Failed generations sometimes have status="completed" but errorMessage set
    if (g.errorMessage && g.errorMessage.trim() !== '') return false;

    // Must have a valid resultUrl
    if (!g.resultUrl || g.resultUrl.trim() === '') return false;

    // Must not contain 'undefined' or 'null' as strings in URL
    // Catches backend string interpolation failures
    if (g.resultUrl.includes('undefined') || g.resultUrl.includes('null')) return false;

    // Must have valid URL format (catches malformed URLs)
    try {
      new URL(g.resultUrl);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Flatten video pages and filter for TRULY completed videos with valid URLs
  const allVideos = useMemo(() => {
    const items = videoData?.pages.flatMap(page => page.items) ?? [];
    return items.filter(isValidGeneration);
  }, [videoData, isValidGeneration]);

  // Flatten and filter music tracks (completed with valid URLs)
  const musicTracks = useMemo(() => {
    const items = musicData?.pages.flatMap(page => page.items) ?? [];
    return items.filter(isValidGeneration);
  }, [musicData, isValidGeneration]);

  // Flatten and filter audio tracks (completed with valid URLs)
  const voiceTracks = useMemo(() => {
    const items = audioData?.pages.flatMap(page => page.items) ?? [];
    return items.filter(isValidGeneration);
  }, [audioData, isValidGeneration]);

  // Flatten and filter images (completed with valid URLs)
  const allImages = useMemo(() => {
    const items = imageData?.pages.flatMap(page => page.items) ?? [];
    return items.filter(isValidGeneration);
  }, [imageData, isValidGeneration]);

  // Avatar videos from video query (filter by model type AND validation)
  const avatarVideos = useMemo(() => {
    const items = videoData?.pages.flatMap(page => page.items) ?? [];
    return items.filter((g) => {
      // Must be avatar type
      const model = (g.model ?? "").toLowerCase();
      const isAvatar = g.type === "talking-avatar" || 
                       g.type === "avatar" || 
                       model.includes("infinitetalk") || 
                       model.includes("infinite-talk");

      // Must also pass validation (no errors, valid URL)
      return isAvatar && isValidGeneration(g);
    });
  }, [videoData, isValidGeneration]);

  // Derived loading states
  const avatarLoading = videoLoading;

  // Pagination tracking
  const fetchNextPage = fetchNextVideoPage;
  const hasNextPage = hasNextVideoPage;
  const isFetchingNextPage = isFetchingNextVideoPage;

  // Show all loaded videos (no client-side pagination - use server pagination only)
  const videos = allVideos;

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
            type: 'video' as const,
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

      // Serialize clip settings from local state (includes trim times for split clips, speed, and image settings)
      const clipSettingsArray = clips.map((clip, index) => {
        const localSettings = clipSettings.get(clip.id);
        const isImage = clip.type === 'image';
        return {
          clipId: clip.id,
          clipIndex: index,
          muted: localSettings?.muted ?? false,
          volume: localSettings?.volume ?? 1,
          speed: localSettings?.speed ?? 1.0,
          trimStartSeconds: localSettings?.trimStartSeconds,
          trimEndSeconds: localSettings?.trimEndSeconds,
          isImage,
          displayDuration: isImage ? (localSettings?.displayDuration ?? 5) : undefined,
        };
      });

      // Build speed config from clipSettings for per-clip speed adjustments (skip images)
      const perClipSpeeds = clipSettingsArray
        .filter(cs => cs.speed !== 1.0 && !cs.isImage)
        .map(cs => ({ clipIndex: cs.clipIndex, factor: cs.speed }));

      const speedConfig = perClipSpeeds.length > 0 
        ? { mode: 'perClip' as const, perClip: perClipSpeeds }
        : { mode: 'none' as const };

      // Build enhancements payload with all enhancement state
      const enhancementsPayload = {
        transitions: enhancements.transitionMode === 'perClip' ? {
          mode: 'perClip' as const,
          perClip: enhancements.clipTransitions.map(t => ({
            afterClipIndex: t.afterClipIndex,
            type: t.type,
            durationSeconds: t.durationSeconds,
          })),
        } : enhancements.transitionMode === 'crossfade' ? {
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
        editorTextOverlays: textOverlays.length > 0 ? textOverlays.map(to => ({
          id: to.id,
          text: to.text,
          x: to.x,
          y: to.y,
          fontSize: to.fontSize,
          fontFamily: to.fontFamily,
          color: to.color,
          backgroundColor: to.backgroundColor,
          bold: to.bold,
          italic: to.italic,
          startTime: to.startTime,
          endTime: to.endTime,
          animation: to.animation,
        })) : undefined,
        clipSettings: clipSettingsArray.filter(cs => 
          cs.muted || cs.volume !== 1 || cs.trimStartSeconds !== undefined || cs.trimEndSeconds !== undefined || cs.isImage
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
        multiTrackTimeline: useMultiTrack && multiTrackItems.length > 0 ? {
          enabled: true,
          items: multiTrackItems.map(item => ({
            id: item.id,
            type: item.type,
            track: item.track,
            startTime: item.startTime,
            duration: item.duration,
            url: item.url,
            name: item.name,
          })),
        } : undefined,
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
    // Build project payload - PREVIEW ALL CLIPS (no limit)
    const previewClips = clips; // Preview ALL clips, not just first 3
    const project = {
      clips: previewClips.map((clip, index) => ({
        id: clip.id,
        sourceUrl: clip.url,
        order: index,
      })),
    };
      // Serialize clip settings for preview clips (includes image settings)
      const clipSettingsArray = previewClips.map((clip, index) => {
        const localSettings = clipSettings.get(clip.id);
        const isImage = clip.type === 'image';
        return {
          clipId: clip.id,
          clipIndex: index,
          muted: localSettings?.muted ?? false,
          volume: localSettings?.volume ?? 1,
          speed: localSettings?.speed ?? 1.0,
          trimStartSeconds: localSettings?.trimStartSeconds,
          trimEndSeconds: localSettings?.trimEndSeconds,
          isImage,
          displayDuration: isImage ? (localSettings?.displayDuration ?? 5) : undefined,
        };
      });

      // Build speed config from clipSettings for per-clip speed adjustments (skip images)
      const perClipSpeeds = clipSettingsArray
        .filter(cs => cs.speed !== 1.0 && !cs.isImage)
        .map(cs => ({ clipIndex: cs.clipIndex, factor: cs.speed }));

      const speedConfig = perClipSpeeds.length > 0 
        ? { mode: 'perClip' as const, perClip: perClipSpeeds }
        : { mode: 'none' as const };

      const enhancementsPayload = {
        transitions: enhancements.transitionMode === 'perClip' ? {
          mode: 'perClip' as const,
          perClip: enhancements.clipTransitions.map(t => ({
            afterClipIndex: t.afterClipIndex,
            type: t.type,
            durationSeconds: t.durationSeconds,
          })),
        } : enhancements.transitionMode === 'crossfade' ? {
          mode: 'crossfade' as const,
          durationSeconds: enhancements.transitionDuration,
        } : { mode: 'none' as const },
        fadeIn: enhancements.fadeIn,
        fadeOut: enhancements.fadeOut,
        fadeDuration: enhancements.fadeDuration,
        aspectRatio: enhancements.aspectRatio,
        speed: speedConfig,
        clipSettings: clipSettingsArray.filter(cs => 
          cs.muted || cs.volume !== 1 || cs.trimStartSeconds !== undefined || cs.trimEndSeconds !== undefined || cs.isImage
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
        type: 'video' as const,
      }));

    setOrderedClips(clips);
    setStep(2);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      console.log('[DRAG] No drop target, ignoring');
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    console.log('[DRAG] handleDragEnd:', { activeId, overId, useMultiTrack });

    // ========================================================================
    // Handle transition drag to drop zone (NEW)
    // ========================================================================
    const activeData = active.data.current;
    const overData = over.data.current;

    if (
      activeData?.type === 'transition' && 
      overData?.type === 'transition-zone'
    ) {
      const transitionType = activeData.transitionType as TransitionType;
      const position = overData.position as number;

      console.log('[DRAG] Transition drop:', { transitionType, position });

      setEnhancements(prev => {
        const newTransitions = [...prev.clipTransitions];
        const existingIndex = newTransitions.findIndex(t => t.afterClipIndex === position);

        const newTransition = {
          afterClipIndex: position,
          type: transitionType,
          durationSeconds: 1.0,
        };

        if (existingIndex >= 0) {
          newTransitions[existingIndex] = newTransition;
          toast({
            title: "Transition Replaced",
            description: `${transitionType} transition now between clips ${position + 1} and ${position + 2}`,
          });
        } else {
          newTransitions.push(newTransition);
          toast({
            title: "Transition Added",
            description: `${transitionType} transition added between clips ${position + 1} and ${position + 2}`,
          });
        }

        return {
          ...prev,
          transitionMode: 'perClip',
          clipTransitions: newTransitions,
        };
      });

      setPreviewStatus('stale');
      return;
    }

    // In multi-track mode, ONLY handle media-to-track drops
    if (useMultiTrack) {
      if (!(activeId.startsWith('draggable-') && overId.startsWith('track-drop-'))) {
        console.log('[DRAG] Multi-track mode: ignoring non-media drag');
        return;
      }
    }

    if (activeId.startsWith('draggable-') && overId.startsWith('track-drop-')) {
      const dragData = active.data.current as { 
        type: string; 
        mediaType: 'video' | 'image' | 'audio';
        item: DroppedMediaItem;
      };

      const dropData = over.data.current as { trackId: string; trackType: string } | undefined;

      if (dragData?.type === 'media-item' && dragData.item?.url) {
        const mediaType = dragData.mediaType;
        const item = dragData.item;
        const trackId = dropData?.trackId || 'video-0';

        const instanceId = `${item.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        if (useMultiTrack) {
          const getTrackNumberFromId = (id: string): number => {
            const mapping: Record<string, number> = {
              'video-0': 0,
              'video-1': 1,
              'text-0': 2,
              'audio-0': 3,
              'audio-1': 4,
            };
            return mapping[id] ?? 0;
          };

          const trackNumber = getTrackNumberFromId(trackId);
          const currentMaxEnd = multiTrackItems
            .filter(i => i.track === trackNumber)
            .reduce((max, i) => Math.max(max, i.startTime + i.duration), 0);

          const itemDuration = item.duration || (mediaType === 'image' ? 5 : 10);

          const newItem: MultiTrackTimelineItem = {
            id: instanceId,
            type: mediaType,
            track: trackNumber,
            startTime: currentMaxEnd,
            duration: itemDuration,
            originalDuration: itemDuration,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl,
            name: item.name,
            volume: mediaType === 'audio' ? 100 : undefined,
            speed: 1,
          };

          console.log('[DRAG] Adding to multi-track:', newItem);

          setMultiTrackItems(prev => {
            const updated = [...prev, newItem];
            console.log('[DRAG] Updated multi-track items:', updated);
            return updated;
          });

          setMultiTrackKey(prev => prev + 1);

          toast({
            title: "Added to Timeline",
            description: `${mediaType} added to ${trackId.replace('-', ' ').toUpperCase()} track`,
          });
        } else {
          if (mediaType === 'audio') {
            const audioTrack = {
              id: instanceId,
              url: item.url,
              name: item.name || 'Audio track',
              type: 'music' as const,
              volume: 1,
            };
            setAudioTracks(prev => [...prev, audioTrack]);
          } else {
            const clip: VideoClip = {
              id: instanceId,
              url: item.url,
              thumbnailUrl: item.thumbnailUrl || null,
              prompt: item.name || '',
              createdAt: new Date().toISOString(),
              type: mediaType,
            };
            setOrderedClips(prev => [...prev, clip]);
          }

          toast({
            title: "Added to timeline",
            description: `${mediaType === 'video' ? 'Video' : mediaType === 'image' ? 'Image' : 'Audio'} added to timeline`,
          });
        }
      }

      // IMPORTANT: Return early to prevent fall-through to reordering logic
      return;
    }

    // Handle reordering clips in single-track mode
    if (active.id !== over.id && !activeId.startsWith('draggable-')) {
      setOrderedClips((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return items;
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

  // Transition handlers for drag-and-drop system
  const handleTransitionEdit = useCallback((position: number) => {
    const transition = enhancements.clipTransitions.find(t => t.afterClipIndex === position);
    if (!transition) return;

    setEditingTransition({ position, transition: transition as ClipTransitionLocal });
    setShowTransitionEditModal(true);
  }, [enhancements.clipTransitions]);

  const handleTransitionRemove = useCallback((position: number) => {
    setEnhancements(prev => {
      const newTransitions = prev.clipTransitions.filter(t => t.afterClipIndex !== position);
      return {
        ...prev,
        clipTransitions: newTransitions,
        transitionMode: newTransitions.length === 0 ? 'none' : 'perClip',
      };
    });
    setPreviewStatus('stale');

    toast({
      title: "Transition Removed",
      description: `Transition between clips ${position + 1} and ${position + 2} removed`,
    });
  }, [toast]);

  const handleTransitionSave = useCallback((position: number, updates: Partial<ClipTransitionLocal>) => {
    setEnhancements(prev => {
      const newTransitions = prev.clipTransitions.map(t => 
        t.afterClipIndex === position 
          ? { ...t, ...updates }
          : t
      );

      return {
        ...prev,
        clipTransitions: newTransitions,
      };
    });
    setPreviewStatus('stale');

    toast({
      title: "Transition Updated",
      description: `Transition between clips ${position + 1} and ${position + 2} updated`,
    });
  }, [toast]);

  const getTransitionAtPosition = useCallback((position: number) => {
    return enhancements.clipTransitions.find(t => t.afterClipIndex === position);
  }, [enhancements.clipTransitions]);

  const handleMultiTrackToggle = useCallback((enabled: boolean) => {
    setUseMultiTrack(enabled);
    setMultiTrackKey(prev => prev + 1);

    if (enabled && orderedClips.length > 0 && multiTrackItems.length === 0) {
      let currentTime = 0;
      const convertedItems: MultiTrackTimelineItem[] = orderedClips.map((clip) => {
        const settings = clipSettings.get(clip.id);
        const speed = settings?.speed || 1;
        const originalDuration = settings?.originalDuration || (clip.type === 'image' ? 5 : 10);
        const trimStart = settings?.trimStartSeconds || 0;
        const trimEnd = settings?.trimEndSeconds || originalDuration;
        const effectiveDuration = (trimEnd - trimStart) / speed;
        const displayDuration = clip.type === 'image' 
          ? (settings?.displayDuration || 5)
          : effectiveDuration;

        const item: MultiTrackTimelineItem = {
          id: clip.id,
          type: clip.type || 'video',
          track: 0,
          startTime: currentTime,
          duration: displayDuration,
          originalDuration: originalDuration,
          url: clip.url,
          thumbnailUrl: clip.thumbnailUrl,
          name: clip.prompt || `${clip.type || 'video'} clip`,
          speed: speed !== 1 ? speed : undefined,
          trim: trimStart > 0 || trimEnd < originalDuration ? { start: trimStart, end: trimEnd } : undefined,
          volume: settings?.volume !== undefined ? Math.round(settings.volume * 100) : 100,
          muted: settings?.muted || false,
        };
        currentTime += displayDuration;
        return item;
      });

      const audioItems: MultiTrackTimelineItem[] = audioTracks.map((audio) => ({
        id: audio.id,
        type: 'audio' as const,
        track: 3,
        startTime: 0,
        duration: 10,
        originalDuration: 10,
        url: audio.url,
        name: audio.name,
        volume: Math.round(audio.volume * 100),
      }));

      setMultiTrackItems([...convertedItems, ...audioItems]);

      toast({
        title: "Multi-Track Mode",
        description: `Converted ${convertedItems.length} clips and ${audioItems.length} audio tracks to multi-track timeline`,
      });
    }
  }, [orderedClips, multiTrackItems.length, clipSettings, audioTracks, toast]);

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
    setAudioTracks([]);
    setMultiTrackItems([]);
    setUseMultiTrack(false);
    setClipSettings(new Map());
    setEnhancements({
      transitionMode: 'none',
      transitionDuration: 1.0,
      clipTransitions: [],
      fadeIn: false,
      fadeOut: false,
      fadeDuration: 0.5,
      aspectRatio: '16:9',
      textOverlays: [],
      captions: [],
    });
    setCurrentProject(null);
    setExportProgress(0);
    setExportedUrl(null);
    setActiveJobId(null);
    clearLocalSession(); // Clear saved session from localStorage
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
  const addClipToTimeline = useCallback((video: Generation, mediaType: 'video' | 'image' = 'video') => {
    if (!video.resultUrl) return;

    // Generate unique instance ID to allow duplicates
    const instanceId = `${video.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const clip: VideoClip = {
      id: instanceId, // Unique instance ID
      url: video.resultUrl,
      thumbnailUrl: video.thumbnailUrl || null,
      prompt: video.prompt || '',
      createdAt: video.createdAt.toString(),
      type: mediaType,
    };

    setOrderedClips(prev => [...prev, clip]);

    // For images, set a default display duration
    if (mediaType === 'image') {
      updateClipSettings(instanceId, { displayDuration: 5, originalDuration: 5 });
    }

    toast({
      title: mediaType === 'image' ? "Image Added" : "Clip Added",
      description: mediaType === 'image' ? "Image added to timeline (5s default)" : "Video added to timeline",
    });
  }, [toast, updateClipSettings]);

  // Handle removing clip from timeline
  const removeClipFromTimeline = useCallback((clipId: string) => {
    setOrderedClips(prev => prev.filter(c => c.id !== clipId));
  }, []);

  // Handle removing audio track from timeline
  const removeAudioTrack = useCallback((trackId: string) => {
    // Get the track being removed
    const removedTrack = audioTracks.find(t => t.id === trackId);

    // Remove from audioTracks state
    setAudioTracks(prev => prev.filter(t => t.id !== trackId));

    // CRITICAL: Also remove from enhancements if this was the background music or audio track
    setEnhancements(prev => {
      const updates: Partial<typeof prev> = {};

      // Check if removing background music
      if (removedTrack && prev.backgroundMusic?.audioUrl === removedTrack.url) {
        updates.backgroundMusic = undefined;
      }

      // Check if removing audio track (voice)
      if (removedTrack && prev.audioTrack?.audioUrl === removedTrack.url) {
        updates.audioTrack = undefined;
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        return { ...prev, ...updates };
      }
      return prev;
    });

    toast({
      title: "Audio Removed",
      description: "Audio track removed from timeline",
    });
  }, [audioTracks, toast]);

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
        {/* Single-track mode uses DndContext for reordering, Multi-track mode has its own internal DndContext */}
        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            console.log('[DRAG] Drag cancelled');
          }}
        >
        <div className="flex-1 flex overflow-hidden">
          {/* Left Icon Sidebar */}
          <EditorSidebar 
            activeCategory={activeCategory} 
            onCategoryChange={setActiveCategory} 
          />

          {/* Collapsible Media/Asset Panel */}
          {mediaPanelOpen && (
            <div className="w-72 border-r flex flex-col shrink-0 bg-background" style={{ height: '100vh' }} data-testid="media-panel">
              <div className="flex items-center justify-between p-3 border-b shrink-0 bg-background">
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

              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="p-3 space-y-3">
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
                            <DraggableMediaItem
                              key={video.id}
                              item={video}
                              mediaType="video"
                              onClick={() => addClipToTimeline(video)}
                            />
                          ))}
                        </div>
                      )}

                      {/* Load More for Media */}
                      {hasNextPage && (
                        <div className="pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                            data-testid="button-load-more-videos"
                          >
                            {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load More'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Images Category Content */}
                  {activeCategory === 'images' && (
                    <div className="space-y-3">
                      {!isAuthenticated ? (
                        <div className="text-center py-8">
                          <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Sign in to access your images</p>
                          <Button size="sm" className="mt-2" onClick={() => setShowGuestModal(true)}>
                            Sign In
                          </Button>
                        </div>
                      ) : imageLoading ? (
                        <div className="grid grid-cols-2 gap-2">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="aspect-square rounded-md" />
                          ))}
                        </div>
                      ) : allImages.length === 0 ? (
                        <div className="text-center py-8">
                          <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">No images yet</p>
                          <p className="text-xs text-muted-foreground mt-1">Generate images to add them to your timeline</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {allImages.map((image) => (
                            <DraggableMediaItem
                              key={image.id}
                              item={image}
                              mediaType="image"
                              onClick={() => addClipToTimeline(image, 'image')}
                            />
                          ))}
                        </div>
                      )}

                      {/* Load More for Images */}
                      {hasNextImagePage && (
                        <div className="pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => fetchNextImagePage()}
                            disabled={isFetchingNextImagePage}
                            data-testid="button-load-more-images"
                          >
                            {isFetchingNextImagePage ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load More'}
                          </Button>
                        </div>
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
                        <>
                          {musicTracks.map((track) => (
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
                                
                                // Initialize audio settings for duration loading
                                updateClipSettings(trackId, { originalDuration: 30 });
                                
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
                          ))}

                          {/* Load More for Music */}
                          {hasNextMusicPage && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full mt-2"
                              onClick={() => fetchNextMusicPage()}
                              disabled={isFetchingNextMusicPage}
                              data-testid="button-load-more-music"
                            >
                              {isFetchingNextMusicPage ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load More'}
                            </Button>
                          )}
                        </>
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
                        <>
                          {voiceTracks.map((track) => (
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
                                
                                // Initialize audio settings for duration loading
                                updateClipSettings(trackId, { originalDuration: 30 });
                                
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
                          ))}

                          {/* Load More for Audio */}
                          {hasNextAudioPage && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full mt-2"
                              onClick={() => fetchNextAudioPage()}
                              disabled={isFetchingNextAudioPage}
                              data-testid="button-load-more-audio"
                            >
                              {isFetchingNextAudioPage ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load More'}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Transitions Category Content - Drag & Drop */}
                  {activeCategory === 'transitions' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Drag transitions to the timeline between clips
                        </p>
                        {orderedClips.length < 2 && (
                          <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 text-xs">
                            <p className="font-medium mb-1">Add more clips</p>
                            <p>You need at least 2 clips to add transitions between them.</p>
                          </div>
                        )}
                      </div>

                      {/* Fade transitions */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Fade Effects</p>
                        <div className="grid grid-cols-2 gap-2">
                          <DraggableTransition type="fade" icon={<Sparkles className="h-4 w-4 text-muted-foreground" />} label="Fade" />
                          <DraggableTransition type="dissolve" icon={<Sparkles className="h-4 w-4 text-muted-foreground" />} label="Dissolve" />
                          <DraggableTransition type="fadeblack" icon={<Sparkles className="h-4 w-4 text-muted-foreground" />} label="Fade Black" />
                          <DraggableTransition type="fadewhite" icon={<Sparkles className="h-4 w-4 text-muted-foreground" />} label="Fade White" />
                        </div>
                      </div>

                      {/* Wipe transitions */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Wipe Effects</p>
                        <div className="grid grid-cols-2 gap-2">
                          <DraggableTransition type="wipeleft" icon={<ArrowLeft className="h-4 w-4 text-muted-foreground" />} label="Wipe Left" />
                          <DraggableTransition type="wiperight" icon={<ArrowRight className="h-4 w-4 text-muted-foreground" />} label="Wipe Right" />
                          <DraggableTransition type="wipeup" icon={<ArrowRight className="h-4 w-4 text-muted-foreground -rotate-90" />} label="Wipe Up" />
                          <DraggableTransition type="wipedown" icon={<ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />} label="Wipe Down" />
                        </div>
                      </div>

                      {/* Slide transitions */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Slide Effects</p>
                        <div className="grid grid-cols-2 gap-2">
                          <DraggableTransition type="slideleft" icon={<Film className="h-4 w-4 text-muted-foreground" />} label="Slide Left" />
                          <DraggableTransition type="slideright" icon={<Film className="h-4 w-4 text-muted-foreground" />} label="Slide Right" />
                          <DraggableTransition type="slideup" icon={<Film className="h-4 w-4 text-muted-foreground" />} label="Slide Up" />
                          <DraggableTransition type="slidedown" icon={<Film className="h-4 w-4 text-muted-foreground" />} label="Slide Down" />
                        </div>
                      </div>

                      {/* Shape transitions */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Shape Effects</p>
                        <div className="grid grid-cols-2 gap-2">
                          <DraggableTransition type="circleopen" icon={<Layers className="h-4 w-4 text-muted-foreground" />} label="Circle Open" />
                          <DraggableTransition type="circleclose" icon={<Layers className="h-4 w-4 text-muted-foreground" />} label="Circle Close" />
                          <DraggableTransition type="radial" icon={<Layers className="h-4 w-4 text-muted-foreground" />} label="Radial" />
                          <DraggableTransition type="pixelize" icon={<Layers className="h-4 w-4 text-muted-foreground" />} label="Pixelize" />
                        </div>
                      </div>

                      {/* Diagonal transitions */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Other Effects</p>
                        <div className="grid grid-cols-2 gap-2">
                          <DraggableTransition type="diagtl" icon={<Shuffle className="h-4 w-4 text-muted-foreground" />} label="Diagonal TL" />
                          <DraggableTransition type="diagtr" icon={<Shuffle className="h-4 w-4 text-muted-foreground" />} label="Diagonal TR" />
                          <DraggableTransition type="diagbl" icon={<Shuffle className="h-4 w-4 text-muted-foreground" />} label="Diagonal BL" />
                          <DraggableTransition type="diagbr" icon={<Shuffle className="h-4 w-4 text-muted-foreground" />} label="Diagonal BR" />
                        </div>
                      </div>

                      {/* Active transitions list */}
                      {enhancements.clipTransitions.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Active Transitions</p>
                          {enhancements.clipTransitions
                            .sort((a, b) => a.afterClipIndex - b.afterClipIndex)
                            .map((transition) => (
                              <div key={transition.afterClipIndex} className="p-2 border rounded-md flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Shuffle className="h-3 w-3 text-primary" />
                                  <span className="text-xs">
                                    Clip {transition.afterClipIndex + 1} → {transition.afterClipIndex + 2}
                                  </span>
                                  <Badge variant="secondary" className="text-[10px]">{transition.type}</Badge>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleTransitionEdit(transition.afterClipIndex)}
                                    data-testid={`edit-transition-${transition.afterClipIndex}`}
                                  >
                                    <Settings className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive"
                                    onClick={() => handleTransitionRemove(transition.afterClipIndex)}
                                    data-testid={`remove-transition-${transition.afterClipIndex}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text Category Content */}
                  {activeCategory === 'text' && (
                    <TextOverlayEditor
                      overlays={textOverlays}
                      selectedOverlayId={selectedOverlayId}
                      currentTime={0}
                      totalDuration={totalDuration || 60}
                      onAddOverlay={addTextOverlay}
                      onUpdateOverlay={updateTextOverlay}
                      onRemoveOverlay={removeTextOverlay}
                      onSelectOverlay={setSelectedOverlayId}
                      onDuplicateOverlay={duplicateTextOverlay}
                    />
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
                              ) : avatar.resultUrl ? (
                                <video 
                                  src={avatar.resultUrl} 
                                  className="w-full h-full object-cover"
                                  preload="metadata"
                                  muted
                                  playsInline
                                />
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

                  {/* Upload Category Content */}
                  {activeCategory === 'upload' && (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">Import your own media to use in the editor</p>

                      {/* Video Upload */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Upload Video</Label>
                        <div className="border-2 border-dashed rounded-md p-4 text-center">
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            id="video-upload"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 500 * 1024 * 1024) {
                                toast({ title: "File Too Large", description: "Maximum video size is 500MB", variant: "destructive" });
                                return;
                              }

                              const formData = new FormData();
                              formData.append('file', file);
                              formData.append('type', 'video');

                              try {
                                toast({ title: "Uploading...", description: "Uploading your video" });
                                const response = await fetchWithAuth('/api/video-editor/upload', {
                                  method: 'POST',
                                  body: formData,
                                });
                                const result = await response.json();
                                if (result.url) {
                                  const newClip: VideoClip = {
                                    id: `upload_${Date.now()}`,
                                    url: result.url,
                                    thumbnailUrl: result.thumbnailUrl || null,
                                    prompt: file.name,
                                    createdAt: new Date().toISOString(),
                                    type: 'video',
                                  };
                                  setOrderedClips(prev => [...prev, newClip]);
                                  toast({ title: "Video Added", description: "Your video has been added to the timeline" });
                                }
                              } catch (error: any) {
                                toast({ title: "Upload Failed", description: error.message || "Failed to upload video", variant: "destructive" });
                              }
                              e.target.value = '';
                            }}
                            data-testid="input-video-upload"
                          />
                          <label htmlFor="video-upload" className="cursor-pointer">
                            <Video className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-xs text-muted-foreground">Click to upload video</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-1">MP4, MOV, WebM (max 500MB)</p>
                          </label>
                        </div>
                      </div>

                      {/* Image Upload */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Upload Image</Label>
                        <div className="border-2 border-dashed rounded-md p-4 text-center">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            id="image-upload"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 50 * 1024 * 1024) {
                                toast({ title: "File Too Large", description: "Maximum image size is 50MB", variant: "destructive" });
                                return;
                              }

                              const formData = new FormData();
                              formData.append('file', file);
                              formData.append('type', 'image');

                              try {
                                toast({ title: "Uploading...", description: "Uploading your image" });
                                const response = await fetchWithAuth('/api/video-editor/upload', {
                                  method: 'POST',
                                  body: formData,
                                });
                                const result = await response.json();
                                if (result.url) {
                                  const newClip: VideoClip = {
                                    id: `upload_${Date.now()}`,
                                    url: result.url,
                                    thumbnailUrl: result.url,
                                    prompt: file.name,
                                    createdAt: new Date().toISOString(),
                                    type: 'image',
                                  };
                                  setOrderedClips(prev => [...prev, newClip]);
                                  setClipSettings(prev => {
                                    const newMap = new Map(prev);
                                    newMap.set(newClip.id, {
                                      clipId: newClip.id,
                                      muted: false,
                                      volume: 1,
                                      speed: 1.0,
                                      displayDuration: 5,
                                    });
                                    return newMap;
                                  });
                                  toast({ title: "Image Added", description: "Your image has been added to the timeline" });
                                }
                              } catch (error: any) {
                                toast({ title: "Upload Failed", description: error.message || "Failed to upload image", variant: "destructive" });
                              }
                              e.target.value = '';
                            }}
                            data-testid="input-image-upload"
                          />
                          <label htmlFor="image-upload" className="cursor-pointer">
                            <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-xs text-muted-foreground">Click to upload image</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-1">JPG, PNG, WebP (max 50MB)</p>
                          </label>
                        </div>
                      </div>

                      {/* Audio Upload */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Upload Audio</Label>
                        <div className="border-2 border-dashed rounded-md p-4 text-center">
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            id="audio-upload"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 100 * 1024 * 1024) {
                                toast({ title: "File Too Large", description: "Maximum audio size is 100MB", variant: "destructive" });
                                return;
                              }

                              const formData = new FormData();
                              formData.append('file', file);
                              formData.append('type', 'audio');

                              try {
                                toast({ title: "Uploading...", description: "Uploading your audio" });
                                const response = await fetchWithAuth('/api/video-editor/upload', {
                                  method: 'POST',
                                  body: formData,
                                });
                                const result = await response.json();
                                if (result.url) {
                                  setEnhancements(prev => ({
                                    ...prev,
                                    backgroundMusic: {
                                      audioUrl: result.url,
                                      volume: 0.5,
                                      name: file.name,
                                    },
                                  }));
                                  toast({ title: "Audio Added", description: "Your audio has been set as background music" });
                                }
                              } catch (error: any) {
                                toast({ title: "Upload Failed", description: error.message || "Failed to upload audio", variant: "destructive" });
                              }
                              e.target.value = '';
                            }}
                            data-testid="input-audio-upload"
                          />
                          <label htmlFor="audio-upload" className="cursor-pointer">
                            <Music className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-xs text-muted-foreground">Click to upload audio</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-1">MP3, WAV, AAC (max 100MB)</p>
                          </label>
                        </div>
                      </div>
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

                      {/* Background Music Controls */}
                      {enhancements.backgroundMusic && (
                        <div className="pt-4 border-t space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs font-medium flex items-center gap-2">
                              <Music className="h-3 w-3" />
                              Background Music
                            </Label>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                const musicUrl = enhancements.backgroundMusic?.audioUrl;
                                setEnhancements(prev => ({ ...prev, backgroundMusic: undefined }));
                                setAudioTracks(prev => prev.filter(t => t.url !== musicUrl));
                                toast({ 
                                  title: "Music Removed", 
                                  description: "Background music removed from timeline" 
                                });
                              }}
                              data-testid="button-remove-background-music"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="p-2 rounded-md bg-muted/50 text-xs truncate flex items-center gap-2">
                            <Music className="h-4 w-4 text-green-500 shrink-0" />
                            <span className="truncate flex-1">
                              {enhancements.backgroundMusic.name || 'Music Track'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs flex justify-between">
                              Volume
                              <span className="text-muted-foreground font-mono">
                                {Math.round(enhancements.backgroundMusic.volume * 100)}%
                              </span>
                            </Label>
                            <Slider
                              value={[enhancements.backgroundMusic.volume]}
                              min={0}
                              max={1}
                              step={0.05}
                              onValueChange={([v]) => 
                                setEnhancements(prev => ({
                                  ...prev,
                                  backgroundMusic: prev.backgroundMusic ? {
                                    ...prev.backgroundMusic,
                                    volume: v,
                                  } : undefined,
                                }))
                              }
                              className="cursor-pointer"
                              data-testid="slider-background-music-volume"
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Silent</span>
                              <span>Loud</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Voice/Audio Track Controls */}
                      {enhancements.audioTrack && (
                        <div className="pt-4 border-t space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs font-medium flex items-center gap-2">
                              <Mic className="h-3 w-3" />
                              Voice Track
                            </Label>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                const voiceUrl = enhancements.audioTrack?.audioUrl;
                                setEnhancements(prev => ({ ...prev, audioTrack: undefined }));
                                setAudioTracks(prev => prev.filter(t => t.url !== voiceUrl));
                                toast({ 
                                  title: "Voice Removed", 
                                  description: "Voice track removed from timeline" 
                                });
                              }}
                              data-testid="button-remove-audio-track"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="p-2 rounded-md bg-muted/50 text-xs truncate flex items-center gap-2">
                            <Mic className="h-4 w-4 text-purple-500 shrink-0" />
                            <span className="truncate flex-1">
                              {enhancements.audioTrack.name || 'Voice Track'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs flex justify-between">
                              Volume
                              <span className="text-muted-foreground font-mono">
                                {Math.round(enhancements.audioTrack.volume * 100)}%
                              </span>
                            </Label>
                            <Slider
                              value={[enhancements.audioTrack.volume]}
                              min={0}
                              max={1}
                              step={0.05}
                              onValueChange={([v]) => 
                                setEnhancements(prev => ({
                                  ...prev,
                                  audioTrack: prev.audioTrack ? {
                                    ...prev.audioTrack,
                                    volume: v,
                                  } : undefined,
                                }))
                              }
                              className="cursor-pointer"
                              data-testid="slider-audio-track-volume"
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Silent</span>
                              <span>Loud</span>
                            </div>
                          </div>
                        </div>
                      )}

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
              </div>
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
          <div className="flex-1 flex flex-col min-w-0 relative">
            <PreviewSurface
              previewUrl={previewUrl}
              status={previewStatus}
              clipCount={useMultiTrack ? multiTrackItems.length : orderedClips.length}
              totalDuration={totalDuration}
              onForceRefresh={generatePreview}
              errorMessage={previewError}
              className="flex-1"
            />
            {textOverlays.length > 0 && (
              <TextOverlayRenderer
                overlays={textOverlays}
                currentTime={0}
                selectedOverlayId={selectedOverlayId}
                onSelectOverlay={setSelectedOverlayId}
                isPlaying={false}
              />
            )}

            {/* Preview Controls - Works for both single and multi-track modes */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={generatePreview}
                disabled={previewStatus === 'refreshing' || (useMultiTrack ? multiTrackItems.length === 0 : orderedClips.length === 0)}
                data-testid="button-generate-preview"
              >
                {previewStatus === 'refreshing' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Preview...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Generate Preview
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Timeline at Bottom */}
        <div className="border-t">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            <span className="text-sm font-medium">Timeline</span>
            {/* Multi-track toggle disabled for now - will be re-enabled later */}
            {/* <div className="flex items-center gap-2">
              <Label htmlFor="multi-track-toggle" className="text-xs text-muted-foreground">
                Multi-Track
              </Label>
              <Switch
                id="multi-track-toggle"
                checked={useMultiTrack}
                onCheckedChange={handleMultiTrackToggle}
                data-testid="switch-multi-track-mode"
              />
            </div> */}
          </div>

          {useMultiTrack ? (
            <MultiTrackTimeline
              key={multiTrackKey}
              items={multiTrackItems}
              onItemsChange={setMultiTrackItems}
              onItemSelect={(item) => {
                if (item) {
                  toast({
                    title: "Clip selected",
                    description: `Selected: ${item.name || item.type} clip`,
                  });
                }
              }}
              totalDuration={Math.max(totalDuration, 60)}
              className="h-[400px]"
            />
          ) : (
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
                clipTransitions={enhancements.clipTransitions}
                onTransitionEdit={handleTransitionEdit}
                onTransitionRemove={handleTransitionRemove}
              />
            </SortableContext>
          )}
        </div>
        </DndContext>
      </div>

      {/* Dialogs and Modals */}
      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="videos"
      />

      {/* Transition Edit Dialog */}
      <TransitionEditDialog
        open={!!editingTransition}
        onOpenChange={(open) => !open && setEditingTransition(null)}
        transition={editingTransition?.transition || null}
        clipIndex={editingTransition?.position ?? 0}
        onSave={handleTransitionSave}
        onRemove={() => editingTransition && handleTransitionRemove(editingTransition.position)}
      />

      <Dialog open={showClipSettingsModal} onOpenChange={setShowClipSettingsModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {editingClip?.clip.type === 'image' ? 'Image Settings' : 'Clip Settings'}
            </DialogTitle>
            <DialogDescription>
              {editingClip && `Adjust settings for ${editingClip.clip.type === 'image' ? 'image' : 'clip'} #${editingClip.index + 1}`}
            </DialogDescription>
          </DialogHeader>

          {editingClip && (
            <div className="space-y-6 py-4">
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                {editingClip.clip.type === 'image' ? (
                  <img
                    src={editingClip.clip.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    src={editingClip.clip.url}
                    poster={editingClip.clip.thumbnailUrl || undefined}
                    className="w-full h-full object-cover"
                    controls
                    muted
                  />
                )}
              </div>

              <div className="space-y-4">
                {/* Image-specific controls */}
                {editingClip.clip.type === 'image' ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm flex justify-between">
                        <span className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Display Duration
                        </span>
                        <span className="text-muted-foreground">
                          {getClipSettings(editingClip.clip.id).displayDuration ?? 5}s
                        </span>
                      </Label>
                      <Slider
                        value={[getClipSettings(editingClip.clip.id).displayDuration ?? 5]}
                        min={1}
                        max={30}
                        step={1}
                        onValueChange={([v]) => 
                          updateClipSettings(editingClip.clip.id, { displayDuration: v, originalDuration: v })
                        }
                        data-testid="slider-image-duration"
                      />
                      <p className="text-xs text-muted-foreground">
                        How long this image will be displayed in the video (1-30 seconds)
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Video-specific controls */}
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
                      <ClipVolumeSlider
                        key={`volume-${editingClip.clip.id}`}
                        clipId={editingClip.clip.id}
                        initialVolume={getClipSettings(editingClip.clip.id).volume}
                        onCommit={(v) => updateClipSettings(editingClip.clip.id, { volume: v })}
                      />
                    )}

                    <ClipSpeedSlider
                      key={`speed-${editingClip.clip.id}`}
                      clipId={editingClip.clip.id}
                      initialSpeed={getClipSettings(editingClip.clip.id).speed}
                      onCommit={(v) => updateClipSettings(editingClip.clip.id, { speed: v })}
                    />
                  </>
                )}
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
