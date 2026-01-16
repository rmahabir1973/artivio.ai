import { useState, useMemo, useEffect, useRef, useCallback, memo, useReducer } from "react";
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
  DragStartEvent,
  DragMoveEvent,
  DragOverlay,
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
import { EditorSidebar, PreviewSurface, CanvasPreview, TimelineTrack, DraggableMediaItem, MultiTrackTimeline, TextOverlayEditor, TextOverlayRenderer, DraggableTransition, TransitionDropZone, TransitionEditDialog, PropertiesPanel, AdvancedTimeline } from "./video-editor/components";
import type { EditorCategory, MultiTrackTimelineItem, DroppedMediaItem } from "./video-editor/components";
import { useTextOverlay, DEFAULT_TEXT_OVERLAY } from "@/hooks/useTextOverlay";
import debounce from "lodash/debounce";

// ==========================================
// Constants
// ==========================================
const PIXELS_PER_SECOND_BASE = 100;
const TRACK_HEIGHT = 48;
const DEFAULT_IMAGE_DURATION = 5;
const DEFAULT_VIDEO_DURATION = 8;
const DEFAULT_AUDIO_DURATION = 30;
const DRAG_ACTIVATION_DISTANCE = 3;
const LAYER_DRAG_THRESHOLD = 20;
const HORIZONTAL_DRAG_THRESHOLD = 5;
const DURATION_LOAD_TIMEOUT = 10000;
const SESSION_EXPIRY_HOURS = 24;
const AUTO_SAVE_DEBOUNCE_MS = 1000;
const MIN_TRIM_GAP = 0.5;
const MAX_LAYERS = 10;

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
  type: 'video' | 'image';
  trackId?: string;
}

interface ClipSettingsLocal {
  clipId: string;
  muted: boolean;
  volume: number;
  speed: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  originalDuration?: number;
  displayDuration?: number;
  positionSeconds?: number;
}

interface ClipTransitionLocal {
  afterClipIndex: number;
  type: TransitionType | string;
  durationSeconds: number;
  trackId?: string;
}

interface CrossLayerTransitionLocal {
  id: string;
  fromClipId: string;
  toClipId: string;
  type: string;
  durationSeconds: number;
}

interface EnhancementsState {
  transitionMode: 'none' | 'crossfade' | 'perClip';
  transitionDuration: number;
  clipTransitions: ClipTransitionLocal[];
  crossLayerTransitions: CrossLayerTransitionLocal[];
  fadeIn: boolean;
  fadeOut: boolean;
  fadeDuration: number;
  aspectRatio: '16:9' | '9:16' | '1:1';
  snapEnabled: boolean;
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
    size: number;
    opacity: number;
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

// ==========================================
// Error Boundary Component
// ==========================================
class VideoEditorErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Video Editor Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Film className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold">Video Editor Error</h3>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message || 'An unexpected error occurred in the video editor.'}
            </p>
            <Button onClick={() => window.location.reload()}>
              Reload Editor
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ==========================================
// Optimized Components with proper memoization
// ==========================================
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

const SortableClip = memo(function SortableClip({
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
    transition: transformTransition,
    isDragging,
  } = useSortable({ id: clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transformTransition,
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
              playsInline
              disablePictureInPicture
              disableRemotePlayback
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
});

interface VideoCardProps {
  generation: Generation;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

const VideoCard = memo(function VideoCard({ generation, isSelected, onToggle }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
        videoRef.current.load();
      }
    };
  }, []);

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
            ref={videoRef}
            src={generation.resultUrl}
            poster={generation.thumbnailUrl || undefined}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
            playsInline
            disablePictureInPicture
            disableRemotePlayback
            onError={(e) => {
              console.warn(`Failed to load video: ${generation.id}`, e);
            }}
          />
        ) : generation.thumbnailUrl ? (
          <img
            src={generation.thumbnailUrl}
            alt={generation.prompt}
            className="w-full h-full object-cover"
            loading="lazy"
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
});

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

// ==========================================
// Custom Hooks for Performance
// ==========================================
function useVideoMetadataLoader() {
  const loadingElementsRef = useRef<Map<string, HTMLVideoElement | HTMLAudioElement>>(new Map());
  const attemptedLoadsRef = useRef<Set<string>>(new Set());

  const loadMediaDuration = useCallback((id: string, url: string, mediaType: 'video' | 'audio' | 'image' = 'video') => {
    if (!url || !url.startsWith('http')) return null;

    const cacheKey = `${id}:${url}`;
    if (attemptedLoadsRef.current.has(cacheKey)) return null;
    attemptedLoadsRef.current.add(cacheKey);

    const prevElement = loadingElementsRef.current.get(id);
    if (prevElement) {
      prevElement.src = '';
      prevElement.load();
      loadingElementsRef.current.delete(id);
    }

    const element = mediaType === 'audio'
      ? document.createElement('audio')
      : document.createElement('video');

    element.preload = 'metadata';
    (element as any).crossOrigin = 'anonymous';
    element.src = url;

    return new Promise<number>((resolve) => {
      const fallbackDuration = mediaType === 'audio' ? DEFAULT_AUDIO_DURATION : DEFAULT_VIDEO_DURATION;
      const timeoutId = setTimeout(() => {
        console.warn(`[DURATION] Timeout loading ${mediaType} metadata for ${id}`);
        resolve(fallbackDuration);
        cleanup();
      }, DURATION_LOAD_TIMEOUT);

      const onLoaded = () => {
        clearTimeout(timeoutId);
        const duration = element.duration;
        resolve(isFinite(duration) ? duration : fallbackDuration);
        cleanup();
      };

      const onError = () => {
        clearTimeout(timeoutId);
        resolve(fallbackDuration);
        cleanup();
      };

      const cleanup = () => {
        element.removeEventListener('loadedmetadata', onLoaded);
        element.removeEventListener('error', onError);
        element.src = '';
        element.load();
        loadingElementsRef.current.delete(id);
      };

      element.addEventListener('loadedmetadata', onLoaded, { once: true });
      element.addEventListener('error', onError, { once: true });
      loadingElementsRef.current.set(id, element);
    });
  }, []);

  useEffect(() => {
    return () => {
      loadingElementsRef.current.forEach(element => {
        element.src = '';
        element.load();
      });
      loadingElementsRef.current.clear();
    };
  }, []);

  return loadMediaDuration;
}

// ==========================================
// State Management
// ==========================================
interface EditorState {
  step: WizardStep;
  selectedIds: Set<string>;
  orderedClips: VideoClip[];
  audioTracks: Array<{
    id: string;
    url: string;
    name: string;
    type: 'music' | 'voice' | 'sfx';
    volume: number;
    trackId?: string;
    positionSeconds?: number;
    duration?: number;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
    fadeOutSeconds?: number;
  }>;
  multiTrackItems: MultiTrackTimelineItem[];
  useMultiTrack: boolean;
  clipSettings: Map<string, ClipSettingsLocal>;
  enhancements: EnhancementsState;
  currentProject: VideoProject | null;
}

type EditorAction =
  | { type: 'SET_STEP'; payload: WizardStep }
  | { type: 'TOGGLE_SELECTION'; payload: string }
  | { type: 'SET_SELECTIONS'; payload: Set<string> }
  | { type: 'ADD_CLIP'; payload: VideoClip }
  | { type: 'REMOVE_CLIP'; payload: string }
  | { type: 'REORDER_CLIPS'; payload: { oldIndex: number; newIndex: number } }
  | { type: 'UPDATE_CLIP_SETTINGS'; payload: { clipId: string; updates: Partial<ClipSettingsLocal> } }
  | { type: 'UPDATE_ENHANCEMENTS'; payload: Partial<EnhancementsState> }
  | { type: 'ADD_AUDIO_TRACK'; payload: any }
  | { type: 'REMOVE_AUDIO_TRACK'; payload: string }
  | { type: 'UPDATE_AUDIO_TRACK'; payload: { trackId: string; updates: any } }
  | { type: 'SET_MULTI_TRACK_ITEMS'; payload: MultiTrackTimelineItem[] }
  | { type: 'SET_USE_MULTI_TRACK'; payload: boolean }
  | { type: 'CLEAR_EDITOR' }
  | { type: 'SET_PROJECT'; payload: VideoProject | null };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload };

    case 'TOGGLE_SELECTION': {
      const newSelectedIds = new Set(state.selectedIds);
      if (newSelectedIds.has(action.payload)) {
        newSelectedIds.delete(action.payload);
      } else {
        newSelectedIds.add(action.payload);
      }
      return { ...state, selectedIds: newSelectedIds };
    }

    case 'SET_SELECTIONS':
      return { ...state, selectedIds: action.payload };

    case 'ADD_CLIP': {
      if (state.orderedClips.some(clip => clip.id === action.payload.id)) {
        return state;
      }
      return { ...state, orderedClips: [...state.orderedClips, action.payload] };
    }

    case 'REMOVE_CLIP': {
      const newClips = state.orderedClips.filter(clip => clip.id !== action.payload);
      const newSelectedIds = new Set(state.selectedIds);
      newSelectedIds.delete(action.payload);
      return { ...state, orderedClips: newClips, selectedIds: newSelectedIds };
    }

    case 'REORDER_CLIPS': {
      const newClips = [...state.orderedClips];
      const [movedClip] = newClips.splice(action.payload.oldIndex, 1);
      newClips.splice(action.payload.newIndex, 0, movedClip);
      return { ...state, orderedClips: newClips };
    }

    case 'UPDATE_CLIP_SETTINGS': {
      const newClipSettings = new Map(state.clipSettings);
      const current = newClipSettings.get(action.payload.clipId) || {
        clipId: action.payload.clipId,
        muted: false,
        volume: 1,
        speed: 1.0,
      };

      const hasChanges = Object.keys(action.payload.updates).some(
        key => current[key as keyof ClipSettingsLocal] !== action.payload.updates[key as keyof ClipSettingsLocal]
      );

      if (!hasChanges) return state;

      newClipSettings.set(action.payload.clipId, { ...current, ...action.payload.updates });
      return { ...state, clipSettings: newClipSettings };
    }

    case 'UPDATE_ENHANCEMENTS':
      return { ...state, enhancements: { ...state.enhancements, ...action.payload } };

    case 'ADD_AUDIO_TRACK':
      return { ...state, audioTracks: [...state.audioTracks, action.payload] };

    case 'REMOVE_AUDIO_TRACK':
      return { ...state, audioTracks: state.audioTracks.filter(track => track.id !== action.payload) };

    case 'UPDATE_AUDIO_TRACK': {
      const newAudioTracks = state.audioTracks.map(track =>
        track.id === action.payload.trackId ? { ...track, ...action.payload.updates } : track
      );
      return { ...state, audioTracks: newAudioTracks };
    }

    case 'SET_MULTI_TRACK_ITEMS':
      return { ...state, multiTrackItems: action.payload };

    case 'SET_USE_MULTI_TRACK':
      return { ...state, useMultiTrack: action.payload };

    case 'CLEAR_EDITOR':
      return {
        step: 1,
        selectedIds: new Set(),
        orderedClips: [],
        audioTracks: [],
        multiTrackItems: [],
        useMultiTrack: false,
        clipSettings: new Map(),
        enhancements: {
          transitionMode: 'none',
          transitionDuration: 1.0,
          clipTransitions: [],
          crossLayerTransitions: [],
          fadeIn: false,
          fadeOut: false,
          fadeDuration: 0.5,
          aspectRatio: '16:9',
          snapEnabled: false,
          textOverlays: [],
          captions: [],
        },
        currentProject: null,
      };

    case 'SET_PROJECT':
      return { ...state, currentProject: action.payload };

    default:
      return state;
  }
}

// ==========================================
// Volume and Speed Sliders
// ==========================================
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

// ==========================================
// Main Video Editor Component
// ==========================================
function VideoEditor() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { getModelCost } = usePricing();
  const isMobile = useIsMobile();

  const baseCreditCost = getModelCost('video-combiner', 150);

  // State management with reducer
  const [state, dispatch] = useReducer(editorReducer, {
    step: 1,
    selectedIds: new Set(),
    orderedClips: [],
    audioTracks: [],
    multiTrackItems: [],
    useMultiTrack: false,
    clipSettings: new Map(),
    enhancements: {
      transitionMode: 'none',
      transitionDuration: 1.0,
      clipTransitions: [],
      crossLayerTransitions: [],
      fadeIn: false,
      fadeOut: false,
      fadeDuration: 0.5,
      aspectRatio: '16:9',
      snapEnabled: false,
      textOverlays: [],
      captions: [],
    },
    currentProject: null,
  });

  const {
    step,
    selectedIds,
    orderedClips,
    audioTracks,
    multiTrackItems,
    useMultiTrack,
    clipSettings,
    enhancements,
    currentProject,
  } = state;

  // Text overlays hook
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

  // UI state
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<EditorCategory>('media');
  const [mediaPanelOpen, setMediaPanelOpen] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<any>(null);
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragInitialPosition, setDragInitialPosition] = useState<number>(0);
  const [lastPointerPosition, setLastPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const [timelineZoom, setTimelineZoom] = useState<number>(1);
  const [showClipSettingsModal, setShowClipSettingsModal] = useState(false);
  const [editingClip, setEditingClip] = useState<{ clip: VideoClip; index: number } | null>(null);
  const [enhancementsPanelOpen, setEnhancementsPanelOpen] = useState(true);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splittingClip, setSplittingClip] = useState<{ clip: VideoClip; index: number } | null>(null);
  const [splitTime, setSplitTime] = useState(0);
  const [clipDuration, setClipDuration] = useState(0);
  const splitVideoRef = useRef<HTMLVideoElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'stale' | 'refreshing' | 'ready' | 'error'>('idle');
  const [previewError, setPreviewError] = useState<string | undefined>(undefined);
  const [useCanvasPreview, setUseCanvasPreview] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isSaveAs, setIsSaveAs] = useState(false);
  const [showTransitionEditModal, setShowTransitionEditModal] = useState(false);
  const [editingTransition, setEditingTransition] = useState<{ position: number; transition: ClipTransitionLocal } | null>(null);
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false);
  const [selectedClip, setSelectedClip] = useState<{ clip: VideoClip; index: number } | null>(null);
  const [timelineCurrentTime, setTimelineCurrentTime] = useState(0);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const [propertiesPanelOpen, setPropertiesPanelOpen] = useState(true);

  // Refs for cleanup
  const timelinePlayIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoringRef = useRef(false);
  const timelineDurationRef = useRef(0);
  const previewDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const multiTrackKeyRef = useRef(0);

  // Custom hooks
  const loadMediaDuration = useVideoMetadataLoader();

  // Memoized values for better performance
  const getClipSettings = useCallback((clipId: string): ClipSettingsLocal => {
    return clipSettings.get(clipId) || {
      clipId,
      muted: false,
      volume: 1,
      speed: 1.0,
    };
  }, [clipSettings]);

  const totalDuration = useMemo(() => {
    let maxEndTime = 0;
    const runningTimeByLayer: Record<string, number> = {};

    // Calculate video/image clips
    orderedClips.forEach((clip) => {
      const settings = getClipSettings(clip.id);
      const trackId = clip.trackId || 'layer-1';
      const speed = settings?.speed || 1;
      const originalDuration = settings?.originalDuration || (clip.type === 'image' ? 5 : 8);
      const trimStart = settings?.trimStartSeconds || 0;
      const trimEnd = settings?.trimEndSeconds || originalDuration;
      const effectiveDuration = (trimEnd - trimStart) / speed;
      const displayDuration = clip.type === 'image'
        ? (settings?.displayDuration || 5)
        : effectiveDuration;

      const startTime = settings?.positionSeconds !== undefined
        ? settings.positionSeconds
        : (runningTimeByLayer[trackId] || 0);

      const endTime = startTime + displayDuration;
      runningTimeByLayer[trackId] = Math.max(runningTimeByLayer[trackId] || 0, endTime);
      maxEndTime = Math.max(maxEndTime, endTime);
    });

    // Calculate audio tracks
    audioTracks.forEach((audio) => {
      const trackId = audio.trackId || 'layer-1';
      const startTime = audio.positionSeconds || 0;
      const duration = audio.duration || 30;
      const trimStart = audio.trimStartSeconds || 0;
      const trimEnd = audio.trimEndSeconds || duration;
      const effectiveDuration = trimEnd - trimStart;
      const endTime = startTime + effectiveDuration;

      runningTimeByLayer[trackId] = Math.max(runningTimeByLayer[trackId] || 0, endTime);
      maxEndTime = Math.max(maxEndTime, endTime);
    });

    return maxEndTime;
  }, [orderedClips, audioTracks, getClipSettings]);

  // Update ref for timeline playback
  timelineDurationRef.current = totalDuration;

  // Cleanup effects
  useEffect(() => {
    return () => {
      if (timelinePlayIntervalRef.current) {
        clearInterval(timelinePlayIntervalRef.current);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (autoSaveDebounceRef.current) {
        clearTimeout(autoSaveDebounceRef.current);
      }
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current);
      }
    };
  }, []);

  // Load media durations
  useEffect(() => {
    const loadDurations = async () => {
      for (const clip of orderedClips) {
        if (clip.url && !clipSettings.get(clip.id)?.originalDuration) {
          try {
            const duration = await loadMediaDuration(clip.id, clip.url, clip.type || 'video');
            if (duration) {
              dispatch({
                type: 'UPDATE_CLIP_SETTINGS',
                payload: { clipId: clip.id, updates: { originalDuration: duration } }
              });
            }
          } catch (error) {
            console.warn(`Failed to load duration for clip ${clip.id}:`, error);
          }
        }
      }
    };

    loadDurations();
  }, [orderedClips, clipSettings, loadMediaDuration]);

  // Load audio durations
  useEffect(() => {
    const loadAudioDurations = async () => {
      for (const track of audioTracks) {
        if (track.url && !track.duration) {
          try {
            const duration = await loadMediaDuration(track.id, track.url, 'audio');
            if (duration) {
              dispatch({
                type: 'UPDATE_AUDIO_TRACK',
                payload: { trackId: track.id, updates: { duration } }
              });
            }
          } catch (error) {
            console.warn(`Failed to load duration for audio track ${track.id}:`, error);
          }
        }
      }
    };

    loadAudioDurations();
  }, [audioTracks, loadMediaDuration]);

  // Auto-save to localStorage
  const LOCAL_STORAGE_KEY = useMemo(() => {
    const userId = user?.id || 'guest';
    return `artivio-video-editor-session-${userId}`;
  }, [user?.id]);

  useEffect(() => {
    if (isRestoringRef.current) return;

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
      } catch (error) {
        console.error('[VIDEO-EDITOR] Failed to auto-save session:', error);
      }
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (autoSaveDebounceRef.current) {
        clearTimeout(autoSaveDebounceRef.current);
      }
    };
  }, [orderedClips, audioTracks, multiTrackItems, useMultiTrack, clipSettings, enhancements, step, LOCAL_STORAGE_KEY]);

  // Restore session
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!savedSession) return;

      const sessionData = JSON.parse(savedSession);
      if (!sessionData.version || !sessionData.savedAt) return;

      const savedAt = new Date(sessionData.savedAt);
      const hoursSinceSave = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceSave > SESSION_EXPIRY_HOURS) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        return;
      }

      isRestoringRef.current = true;

      // Restore state
      if (sessionData.orderedClips?.length > 0) {
        sessionData.orderedClips.forEach((clip: VideoClip) => {
          dispatch({ type: 'ADD_CLIP', payload: clip });
        });
      }

      if (sessionData.audioTracks?.length > 0) {
        sessionData.audioTracks.forEach((track: any) => {
          dispatch({ type: 'ADD_AUDIO_TRACK', payload: track });
        });
      }

      if (sessionData.multiTrackItems?.length > 0) {
        dispatch({ type: 'SET_MULTI_TRACK_ITEMS', payload: sessionData.multiTrackItems });
      }

      if (sessionData.useMultiTrack !== undefined) {
        dispatch({ type: 'SET_USE_MULTI_TRACK', payload: sessionData.useMultiTrack });
      }

      if (sessionData.clipSettings?.length > 0) {
        sessionData.clipSettings.forEach(([clipId, settings]: [string, ClipSettingsLocal]) => {
          dispatch({ type: 'UPDATE_CLIP_SETTINGS', payload: { clipId, updates: settings } });
        });
      }

      if (sessionData.enhancements) {
        dispatch({ type: 'UPDATE_ENHANCEMENTS', payload: sessionData.enhancements });
      }

      if (sessionData.step) {
        dispatch({ type: 'SET_STEP', payload: sessionData.step });
      }

      setTimeout(() => {
        isRestoringRef.current = false;
      }, 500);
    } catch (error) {
      console.error('[VIDEO-EDITOR] Failed to restore session:', error);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [LOCAL_STORAGE_KEY]);

  // Queries
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
      return response.json();
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isAuthenticated,
  });

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
      return response.json();
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isAuthenticated,
  });

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
      return response.json();
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isAuthenticated,
  });

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
      return response.json();
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isAuthenticated,
  });

  const isValidGeneration = useCallback((g: Generation): boolean => {
    if (g.status !== "completed") return false;
    if (g.errorMessage && g.errorMessage.trim() !== '') return false;
    if (!g.resultUrl || g.resultUrl.trim() === '') return false;
    if (g.resultUrl.includes('undefined') || g.resultUrl.includes('null')) return false;
    try {
      new URL(g.resultUrl);
      return true;
    } catch {
      return false;
    }
  }, []);

  const allVideos = useMemo(() => {
    const items = videoData?.pages.flatMap(page => page.items) ?? [];
    return items.filter(isValidGeneration);
  }, [videoData, isValidGeneration]);

  const musicTracks = useMemo(() => {
    const items = musicData?.pages.flatMap(page => page.items) ?? [];
    return items.filter(isValidGeneration);
  }, [musicData, isValidGeneration]);

  const voiceTracks = useMemo(() => {
    const items = audioData?.pages.flatMap(page => page.items) ?? [];
    return items.filter(isValidGeneration);
  }, [audioData, isValidGeneration]);

  const allImages = useMemo(() => {
    const items = imageData?.pages.flatMap(page => page.items) ?? [];
    return items.filter(isValidGeneration);
  }, [imageData, isValidGeneration]);

  const avatarVideos = useMemo(() => {
    const items = videoData?.pages.flatMap(page => page.items) ?? [];
    return items.filter((g) => {
      const model = (g.model ?? "").toLowerCase();
      const isAvatar = g.type === "talking-avatar" || 
                       g.type === "avatar" || 
                       model.includes("infinitetalk") || 
                       model.includes("infinite-talk");
      return isAvatar && isValidGeneration(g);
    });
  }, [videoData, isValidGeneration]);

  const generationsLoading = videoLoading;
  const avatarLoading = videoLoading;

  // Event handlers
  const toggleClipMute = useCallback((clipId: string) => {
    const current = getClipSettings(clipId);
    dispatch({
      type: 'UPDATE_CLIP_SETTINGS',
      payload: { clipId, updates: { muted: !current.muted } }
    });
  }, [getClipSettings]);

  const removeClipFromTimeline = useCallback((clipId: string) => {
    dispatch({ type: 'REMOVE_CLIP', payload: clipId });
  }, []);

  const removeAudioTrack = useCallback((trackId: string) => {
    const removedTrack = audioTracks.find(t => t.id === trackId);
    if (removedTrack) {
      if (enhancements.backgroundMusic?.audioUrl === removedTrack.url) {
        dispatch({
          type: 'UPDATE_ENHANCEMENTS',
          payload: { backgroundMusic: undefined }
        });
      }
      if (enhancements.audioTrack?.audioUrl === removedTrack.url) {
        dispatch({
          type: 'UPDATE_ENHANCEMENTS',
          payload: { audioTrack: undefined }
        });
      }
    }
    dispatch({ type: 'REMOVE_AUDIO_TRACK', payload: trackId });
    toast({ title: "Audio Removed", description: "Audio track removed from timeline" });
  }, [audioTracks, enhancements, toast]);

  const openClipSettings = useCallback((clip: VideoClip, index: number) => {
    setEditingClip({ clip, index });
    setShowClipSettingsModal(true);
  }, []);

  const openSplitDialog = useCallback((clip: VideoClip, index: number) => {
    setSplittingClip({ clip, index });
    const settings = getClipSettings(clip.id);
    const fallbackDuration = settings?.originalDuration ?? 8;
    const trimStart = settings?.trimStartSeconds ?? 0;
    const trimEnd = settings?.trimEndSeconds ?? fallbackDuration;
    setClipDuration(trimEnd - trimStart);
    setSplitTime((trimEnd - trimStart) / 2);
    setShowSplitModal(true);
  }, [getClipSettings]);

  const handleSplitVideoLoaded = useCallback(() => {
    if (splitVideoRef.current) {
      const duration = splitVideoRef.current.duration;
      setClipDuration(duration);
      setSplitTime(duration / 2);
    }
  }, []);

  const handleSplitTimeChange = useCallback((value: number[]) => {
    const newTime = value[0];
    setSplitTime(newTime);
    if (splitVideoRef.current) {
      splitVideoRef.current.currentTime = newTime;
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(2).padStart(5, '0')}`;
  };

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
    const currentSettings = getClipSettings(clip.id);
    const existingTrimStart = currentSettings.trimStartSeconds ?? 0;
    const existingTrimEnd = currentSettings.trimEndSeconds ?? clipDuration;

    const firstClipId = clip.id;
    const secondClipId = `${clip.id}_split_${Date.now()}`;
    const secondClip: VideoClip = { ...clip, id: secondClipId };

    // Update first clip
    dispatch({
      type: 'UPDATE_CLIP_SETTINGS',
      payload: { 
        clipId: firstClipId, 
        updates: { trimEndSeconds: existingTrimStart + splitTime }
      }
    });

    // Create second clip settings
    dispatch({
      type: 'UPDATE_CLIP_SETTINGS',
      payload: {
        clipId: secondClipId,
        updates: {
          clipId: secondClipId,
          muted: currentSettings.muted,
          volume: currentSettings.volume,
          speed: currentSettings.speed,
          trimStartSeconds: existingTrimStart + splitTime,
          trimEndSeconds: existingTrimEnd,
        }
      }
    });

    // Insert second clip at correct position
    const newOrderedClips = [...orderedClips];
    newOrderedClips.splice(index + 1, 0, secondClip);

    // We need to update the ordered clips array
    // For now, we'll clear and rebuild
    dispatch({ type: 'CLEAR_EDITOR' });
    newOrderedClips.forEach(clip => dispatch({ type: 'ADD_CLIP', payload: clip }));

    setShowSplitModal(false);
    setSplittingClip(null);
    toast({
      title: "Clip Split",
      description: `Clip has been split at ${formatTime(splitTime)}.`,
    });
  }, [splittingClip, splitTime, clipDuration, getClipSettings, orderedClips, toast]);

  // Drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    const rectCollisions = rectIntersection(args);
    const allCollisions = [...pointerCollisions, ...rectCollisions];

    const activeData = args.active.data.current;
    const isMediaDrag = activeData?.type === 'media-item';
    const isTransitionDrag = activeData?.type === 'transition';

    if (isTransitionDrag) {
      const transitionZoneHits = allCollisions.filter(
        collision => collision.data?.droppableContainer?.data?.current?.type === 'transition-zone'
      );
      if (transitionZoneHits.length > 0) return [transitionZoneHits[0]];
    }

    if (isMediaDrag) {
      const trackDropHits = allCollisions.filter(
        collision => collision.data?.droppableContainer?.data?.current?.type === 'track-drop-zone'
      );
      if (trackDropHits.length > 0) return [trackDropHits[0]];
    }

    const filteredDroppableContainers = args.droppableContainers.filter(
      container => container.data?.current?.type !== 'transition-zone'
    );

    if (filteredDroppableContainers.length > 0) {
      const filteredResult = closestCenter({
        ...args,
        droppableContainers: filteredDroppableContainers,
      });
      if (filteredResult.length > 0) return filteredResult;
    }

    return closestCenter(args);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      console.log('[DRAG] No drop target, ignoring');
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeData = active.data.current;
    const overData = over.data.current;

    // Handle transition drag
    if (activeData?.type === 'transition' && overData?.type === 'transition-zone') {
      const transitionType = activeData.transitionType as TransitionType;
      const position = overData.position as number;
      const trackId = (overData.trackId as string) || 'layer-1';

      const newTransitions = [...enhancements.clipTransitions];
      const existingIndex = newTransitions.findIndex(
        t => t.afterClipIndex === position && (t.trackId || 'layer-1') === trackId
      );

      const newTransition = {
        afterClipIndex: position,
        type: transitionType,
        durationSeconds: 1.0,
        trackId: trackId,
      };

      if (existingIndex >= 0) {
        newTransitions[existingIndex] = newTransition;
        toast({
          title: "Transition Replaced",
          description: `${transitionType} transition now on ${trackId}`,
        });
      } else {
        newTransitions.push(newTransition);
        toast({
          title: "Transition Added",
          description: `${transitionType} transition added on ${trackId}`,
        });
      }

      dispatch({
        type: 'UPDATE_ENHANCEMENTS',
        payload: {
          transitionMode: 'perClip',
          clipTransitions: newTransitions,
        }
      });

      setPreviewStatus('stale');
      return;
    }

    // Handle clip reordering
    if (active.id !== over.id && !activeId.startsWith('draggable-')) {
      const oldIndex = orderedClips.findIndex((i) => i.id === active.id);
      const newIndex = orderedClips.findIndex((i) => i.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        dispatch({
          type: 'REORDER_CLIPS',
          payload: { oldIndex, newIndex }
        });
      }
    }

    // Handle media drag to timeline
    if (activeId.startsWith('draggable-') && overId.startsWith('track-drop-')) {
      const dragData = active.data.current as { 
        type: string; 
        mediaType: 'video' | 'image' | 'audio';
        item: DroppedMediaItem;
      };

      const dropData = over.data.current as { trackId: string; type?: string } | undefined;

      if (dragData?.type === 'media-item' && dragData.item?.url) {
        const mediaType = dragData.mediaType;
        const item = dragData.item;
        const trackId = dropData?.trackId || 'layer-1';
        const instanceId = `${item.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        let dropTimeSeconds = 0;
        const pixelsPerSecond = PIXELS_PER_SECOND_BASE * timelineZoom;

        if (lastPointerPosition) {
          const scrollContainer = document.querySelector('[data-testid="timeline-scroll-container"]');
          if (scrollContainer) {
            const rect = scrollContainer.getBoundingClientRect();
            const scrollLeft = scrollContainer.scrollLeft;
            const relativeX = lastPointerPosition.x - rect.left + scrollLeft;
            dropTimeSeconds = Math.max(0, relativeX / pixelsPerSecond);
          }
        }

        if (useMultiTrack) {
          const getTrackNumberFromId = (id: string): number => {
            const mapping: Record<string, number> = {
              'layer-1': 0,
              'layer-2': 1,
              'layer-3': 2,
              'layer-4': 3,
              'video-0': 0,
              'video-1': 1,
              'text-0': 2,
              'audio-0': 3,
              'audio-1': 4,
            };
            return mapping[id] ?? 0;
          };

          const trackNumber = getTrackNumberFromId(trackId);
          const itemDuration = item.duration || (mediaType === 'image' ? 5 : 10);

          const newItem: MultiTrackTimelineItem = {
            id: instanceId,
            type: mediaType,
            track: trackNumber,
            startTime: dropTimeSeconds,
            duration: itemDuration,
            originalDuration: itemDuration,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl,
            name: item.name,
            volume: mediaType === 'audio' ? 100 : undefined,
            speed: 1,
          };

          dispatch({ type: 'SET_MULTI_TRACK_ITEMS', payload: [...multiTrackItems, newItem] });
          multiTrackKeyRef.current += 1;

          const layerLabel = trackId.startsWith('layer-') ? `Layer ${trackId.split('-')[1]}` : trackId.replace('-', ' ').toUpperCase();
          toast({
            title: "Added to Timeline",
            description: `${mediaType} added to ${layerLabel} at ${dropTimeSeconds.toFixed(1)}s`,
          });
        } else {
          if (mediaType === 'audio') {
            const audioTrack = {
              id: instanceId,
              url: item.url,
              name: item.name || 'Audio track',
              type: 'music' as const,
              volume: 1,
              positionSeconds: dropTimeSeconds,
              trackId: trackId.startsWith('layer-') ? trackId : 'layer-1',
            };
            dispatch({ type: 'ADD_AUDIO_TRACK', payload: audioTrack });
          } else {
            const clip: VideoClip = {
              id: instanceId,
              url: item.url,
              thumbnailUrl: item.thumbnailUrl || null,
              prompt: item.name || '',
              createdAt: new Date().toISOString(),
              type: mediaType,
              trackId: trackId.startsWith('layer-') ? trackId : 'layer-1',
            };
            dispatch({ type: 'ADD_CLIP', payload: clip });
            dispatch({
              type: 'UPDATE_CLIP_SETTINGS',
              payload: { clipId: instanceId, updates: { positionSeconds: dropTimeSeconds } }
            });
          }

          const layerLabel = trackId.startsWith('layer-') ? `Layer ${trackId.split('-')[1]}` : 'timeline';
          toast({
            title: "Added to timeline",
            description: `${mediaType === 'video' ? 'Video' : mediaType === 'image' ? 'Image' : 'Audio'} added to ${layerLabel} at ${dropTimeSeconds.toFixed(1)}s`,
          });
        }
      }

      return;
    }

    setActiveDragId(null);
    setActiveDragData(null);
    setDragDelta({ x: 0, y: 0 });
    setLastPointerPosition(null);
  }, [orderedClips, enhancements, useMultiTrack, multiTrackItems, timelineZoom, lastPointerPosition, toast]);

  // Keyboard shortcuts with proper cleanup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Delete/Backspace: Remove selected clip
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClip) {
        e.preventDefault();
        removeClipFromTimeline(selectedClip.clip.id);
        setSelectedClip(null);
      }

      // Space: Play/pause timeline
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        handleTimelinePlayPause();
      }

      // Cmd/Ctrl+S: Save project
      if (cmdOrCtrl && e.key === 's') {
        e.preventDefault();
        if (isAuthenticated) {
          openSaveDialog(false);
        }
      }

      // Escape: Deselect and close modals
      if (e.key === 'Escape') {
        setSelectedClip(null);
        setShowSplitModal(false);
        setShowClipSettingsModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClip, isAuthenticated, removeClipFromTimeline, openSaveDialog]);

  // Timeline play/pause
  const handleTimelinePlayPause = useCallback(() => {
    setIsTimelinePlaying(prev => {
      if (!prev) {
        if (!useCanvasPreview) {
          timelinePlayIntervalRef.current = setInterval(() => {
            setTimelineCurrentTime(t => {
              if (t >= timelineDurationRef.current) {
                setIsTimelinePlaying(false);
                if (timelinePlayIntervalRef.current) {
                  clearInterval(timelinePlayIntervalRef.current);
                }
                return 0;
              }
              return t + 1/30;
            });
          }, 1000/30);
        }
      } else {
        if (timelinePlayIntervalRef.current) {
          clearInterval(timelinePlayIntervalRef.current);
        }
      }
      return !prev;
    });
  }, [useCanvasPreview]);

  useEffect(() => {
    if (useCanvasPreview && isTimelinePlaying && timelineCurrentTime >= totalDuration) {
      setIsTimelinePlaying(false);
      setTimelineCurrentTime(0);
    }
  }, [useCanvasPreview, isTimelinePlaying, timelineCurrentTime, totalDuration]);

  const addClipToTimeline = useCallback((video: Generation, mediaType: 'video' | 'image' = 'video') => {
    if (!video.resultUrl) return;

    const instanceId = `${video.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const clip: VideoClip = {
      id: instanceId,
      url: video.resultUrl,
      thumbnailUrl: video.thumbnailUrl || null,
      prompt: video.prompt || '',
      createdAt: video.createdAt.toString(),
      type: mediaType,
    };

    dispatch({ type: 'ADD_CLIP', payload: clip });

    if (mediaType === 'image') {
      dispatch({
        type: 'UPDATE_CLIP_SETTINGS',
        payload: { clipId: instanceId, updates: { displayDuration: 5, originalDuration: 5 } }
      });
    }

    toast({
      title: mediaType === 'image' ? "Image Added" : "Clip Added",
      description: mediaType === 'image' ? "Image added to timeline (5s default)" : "Video added to timeline",
    });
  }, [toast]);

  const toggleVideoSelection = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_SELECTION', payload: id });
  }, []);

  const proceedToArrange = useCallback(() => {
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

    // Clear existing clips first
    dispatch({ type: 'CLEAR_EDITOR' });
    clips.forEach(clip => dispatch({ type: 'ADD_CLIP', payload: clip }));
    dispatch({ type: 'SET_STEP', payload: 2 });
  }, [selectedIds, allVideos, toast]);

  const proceedToExport = useCallback(() => {
    if (orderedClips.length === 0) {
      toast({
        title: "No Clips",
        description: "Please add at least one clip to continue.",
        variant: "destructive",
      });
      return;
    }
    dispatch({ type: 'SET_STEP', payload: 3 });
    setExportProgress(0);
    setExportedUrl(null);
  }, [orderedClips.length, toast]);

  const goBack = useCallback(() => {
    if (step === 2) {
      dispatch({ type: 'SET_STEP', payload: 1 });
    } else if (step === 3) {
      stopPolling();
      dispatch({ type: 'SET_STEP', payload: 2 });
      setExportProgress(0);
      setExportedUrl(null);
      setActiveJobId(null);
    }
  }, [step]);

  const resetEditor = useCallback(() => {
    stopPolling();
    dispatch({ type: 'CLEAR_EDITOR' });
    setExportProgress(0);
    setExportedUrl(null);
    setActiveJobId(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }, [LOCAL_STORAGE_KEY]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const pollExportStatus = useCallback(async (jobId: string) => {
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
  }, [stopPolling, toast]);

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async (clips: VideoClip[]) => {
      setExportProgress(10);

      const project = {
        clips: clips.map((clip, index) => ({
          id: clip.id,
          sourceUrl: clip.url,
          order: index,
        })),
      };

      const clipSettingsArray = clips.map((clip, index) => {
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
          positionSeconds: localSettings?.positionSeconds,
          trackId: clip.trackId || 'layer-1',
          isImage,
          displayDuration: isImage ? (localSettings?.displayDuration ?? 5) : undefined,
        };
      });

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
        backgroundMusic: enhancements.backgroundMusic ? {
          audioUrl: enhancements.backgroundMusic.audioUrl,
          volume: enhancements.backgroundMusic.volume,
        } : undefined,
        audioTrack: enhancements.audioTrack ? {
          audioUrl: enhancements.audioTrack.audioUrl,
          type: enhancements.audioTrack.type,
          volume: enhancements.audioTrack.volume,
          startAtSeconds: 0,
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
      };

      const response = await apiRequest("POST", "/api/video-editor/export", { 
        project,
        videoSettings: {
          format: 'mp4',
          quality: 'high',
        },
        enhancements: enhancementsPayload,
      });
      return response.json();
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

  const startExport = useCallback(() => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }
    exportMutation.mutate(orderedClips);
  }, [isAuthenticated, exportMutation, orderedClips]);

  // Preview generation (debounced)
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
        const previewItems = multiTrackItems;

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
            crossLayerTransitions: enhancements.crossLayerTransitions,
            backgroundMusic: enhancements.backgroundMusic,
            audioTrack: enhancements.audioTrack,
          },
          previewMode: true,
        };
      } else {
        const previewClips = orderedClips;

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
            audioTrack: enhancements.audioTrack ? {
              audioUrl: enhancements.audioTrack.audioUrl,
              type: enhancements.audioTrack.type,
              volume: enhancements.audioTrack.volume,
              startAtSeconds: 0,
            } : undefined,
          },
          previewMode: true,
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
      } else if (data.status === 'processing' && data.jobId) {
        toast({
          title: "Processing",
          description: "Preview is being generated, this may take a few moments...",
        });

        const pollInterval = 2000;
        const maxPolls = 60;
        let pollCount = 0;

        const pollForCompletion = async () => {
          try {
            const statusResponse = await apiRequest("GET", `/api/video-editor/preview-status/${data.jobId}`);
            const statusData = await statusResponse.json();

            if (statusData.status === 'completed' && statusData.previewUrl) {
              setPreviewUrl(statusData.previewUrl);
              setPreviewStatus('ready');
              toast({
                title: "Preview Ready",
                description: "Your preview has been generated!",
              });
              return;
            } else if (statusData.status === 'failed') {
              throw new Error(statusData.error || 'Preview generation failed');
            } else if (pollCount < maxPolls) {
              pollCount++;
              setTimeout(pollForCompletion, pollInterval);
            } else {
              throw new Error('Preview generation timed out');
            }
          } catch (pollError: any) {
            console.error('Preview polling error:', pollError);
            setPreviewStatus('error');
            setPreviewError(pollError.message || 'Preview generation failed');
            toast({
              title: "Preview Failed",
              description: pollError.message || 'Preview generation failed',
              variant: "destructive",
            });
          }
        };

        setTimeout(pollForCompletion, pollInterval);
      } else if (data.status === 'processing') {
        toast({
          title: "Processing",
          description: "Preview is being generated...",
        });
        setPreviewStatus('idle');
      } else {
        throw new Error(data.message || 'Preview generation failed');
      }
    } catch (error) {
      console.error('Preview generation error:', error);
      setPreviewStatus('error');

      let errorTitle = "Preview Failed";
      let errorMessage = "Failed to generate preview";

      if (error instanceof Error) {
        if (error.message.includes('fetch') || error.message.includes('network') || error.name === 'TypeError') {
          errorTitle = "Network Error";
          errorMessage = "Unable to connect to the server. Please check your internet connection.";
        } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          errorTitle = "Request Timeout";
          errorMessage = "The preview is taking too long. Try with fewer clips or shorter videos.";
        } else if (error.message.includes('500') || error.message.includes('server')) {
          errorTitle = "Server Error";
          errorMessage = "The server encountered an error. Please try again later.";
        } else if (error.message.includes('429') || error.message.includes('rate') || error.message.includes('limit')) {
          errorTitle = "Rate Limited";
          errorMessage = "Too many requests. Please wait a moment before trying again.";
        } else if (error.message.includes('ffmpeg') || error.message.includes('processing')) {
          errorTitle = "Processing Error";
          errorMessage = "Error processing video. One or more clips may be corrupted.";
        } else if (error.message && error.message !== 'Preview generation failed') {
          errorMessage = error.message;
        }
      }

      setPreviewError(errorMessage);
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [orderedClips, multiTrackItems, useMultiTrack, getClipSettings, enhancements, toast]);

  // Project management
  const { data: savedProjects = [], isLoading: projectsLoading } = useQuery<VideoProject[]>({
    queryKey: ['/api/video-projects'],
    enabled: isAuthenticated,
  });

  const saveProjectMutation = useMutation({
    mutationFn: async ({ title, description, isNew }: { title: string; description: string; isNew: boolean }) => {
      const timelineData = {
        version: 1,
        clips: orderedClips.map((clip, index) => ({
          id: clip.id,
          url: clip.url,
          thumbnailUrl: clip.thumbnailUrl,
          prompt: clip.prompt,
          createdAt: clip.createdAt,
          order: index,
          settings: getClipSettings(clip.id),
        })),
        enhancements,
        selectedIds: Array.from(selectedIds),
      };

      if (isNew || !currentProject) {
        const response = await apiRequest("POST", "/api/video-projects", {
          title,
          description,
          timelineData,
          settings: { step },
          durationSeconds: totalDuration,
        });
        return response.json();
      } else {
        const response = await apiRequest("PATCH", `/api/video-projects/${currentProject.id}`, {
          title,
          description,
          timelineData,
          settings: { step },
          durationSeconds: totalDuration,
          status: 'saved',
        });
        return response.json();
      }
    },
    onSuccess: (project: VideoProject) => {
      dispatch({ type: 'SET_PROJECT', payload: project });
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

  const cloneProjectMutation = useMutation({
    mutationFn: async ({ projectId, title }: { projectId: string; title: string }) => {
      const response = await apiRequest("POST", `/api/video-projects/${projectId}/clone`, { title });
      return response.json();
    },
    onSuccess: (project: VideoProject) => {
      dispatch({ type: 'SET_PROJECT', payload: project });
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

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      await apiRequest("DELETE", `/api/video-projects/${projectId}`);
      return projectId;
    },
    onSuccess: (deletedId: string) => {
      if (currentProject?.id === deletedId) {
        dispatch({ type: 'SET_PROJECT', payload: null });
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

  const openSaveDialog = useCallback((saveAs: boolean = false) => {
    setIsSaveAs(saveAs);
    setProjectTitle(currentProject?.title || '');
    setProjectDescription(currentProject?.description || '');
    setShowSaveModal(true);
  }, [currentProject]);

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
      cloneProjectMutation.mutate({ projectId: currentProject.id, title: projectTitle });
    } else {
      saveProjectMutation.mutate({ 
        title: projectTitle, 
        description: projectDescription, 
        isNew: isSaveAs || !currentProject 
      });
    }
  }, [projectTitle, projectDescription, isSaveAs, currentProject, saveProjectMutation, cloneProjectMutation, toast]);

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

    // Clear current editor
    dispatch({ type: 'CLEAR_EDITOR' });

    // Restore clips
    timeline.clips.forEach((c: any) => {
      const clip: VideoClip = {
        id: c.id,
        url: c.url,
        thumbnailUrl: c.thumbnailUrl,
        prompt: c.prompt,
        createdAt: c.createdAt,
        type: 'video',
      };
      dispatch({ type: 'ADD_CLIP', payload: clip });

      if (c.settings) {
        dispatch({
          type: 'UPDATE_CLIP_SETTINGS',
          payload: { clipId: c.id, updates: c.settings }
        });
      }
    });

    // Restore selected IDs
    if (timeline.selectedIds) {
      dispatch({ type: 'SET_SELECTIONS', payload: new Set(timeline.selectedIds) });
    }

    // Restore enhancements
    if (timeline.enhancements) {
      dispatch({ type: 'UPDATE_ENHANCEMENTS', payload: timeline.enhancements });
    }

    // Set current project
    dispatch({ type: 'SET_PROJECT', payload: project });
    setShowLoadModal(false);

    // Navigate to arrange step
    if (timeline.clips.length > 0) {
      dispatch({ type: 'SET_STEP', payload: 2 });
    }

    toast({
      title: "Project Loaded",
      description: `"${project.title}" has been loaded into the editor.`,
    });
  }, [toast]);

  // Transition handlers
  const handleTransitionEdit = useCallback((position: number) => {
    const transition = enhancements.clipTransitions.find(t => t.afterClipIndex === position);
    if (!transition) return;
    setEditingTransition({ position, transition });
    setShowTransitionEditModal(true);
  }, [enhancements.clipTransitions]);

  const handleTransitionRemove = useCallback((position: number) => {
    const newTransitions = enhancements.clipTransitions.filter(t => t.afterClipIndex !== position);
    dispatch({
      type: 'UPDATE_ENHANCEMENTS',
      payload: {
        clipTransitions: newTransitions,
        transitionMode: newTransitions.length === 0 ? 'none' : 'perClip',
      }
    });
    setPreviewStatus('stale');
    toast({
      title: "Transition Removed",
      description: `Transition between clips ${position + 1} and ${position + 2} removed`,
    });
  }, [enhancements.clipTransitions, toast]);

  const handleTransitionSave = useCallback((position: number, updates: Partial<ClipTransitionLocal>) => {
    const newTransitions = enhancements.clipTransitions.map(t => 
      t.afterClipIndex === position ? { ...t, ...updates } : t
    );
    dispatch({
      type: 'UPDATE_ENHANCEMENTS',
      payload: { clipTransitions: newTransitions }
    });
    setPreviewStatus('stale');
    toast({
      title: "Transition Updated",
      description: `Transition between clips ${position + 1} and ${position + 2} updated`,
    });
  }, [enhancements.clipTransitions, toast]);

  const getTransitionAtPosition = useCallback((position: number) => {
    return enhancements.clipTransitions.find(t => t.afterClipIndex === position);
  }, [enhancements.clipTransitions]);

  // Cross-layer transition handlers
  const handleCrossLayerTransitionAdd = useCallback((fromClipId: string, toClipId: string, type: string, durationSeconds: number) => {
    const newTransition: CrossLayerTransitionLocal = {
      id: `clt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      fromClipId,
      toClipId,
      type,
      durationSeconds,
    };

    dispatch({
      type: 'UPDATE_ENHANCEMENTS',
      payload: {
        crossLayerTransitions: [
          ...enhancements.crossLayerTransitions.filter(t => !(t.fromClipId === fromClipId && t.toClipId === toClipId)),
          newTransition,
        ],
      }
    });
    setPreviewStatus('stale');

    toast({
      title: "Cross-Layer Transition Added",
      description: `${type.charAt(0).toUpperCase() + type.slice(1)} effect applied between layers`,
    });
  }, [enhancements.crossLayerTransitions, toast]);

  const handleCrossLayerTransitionEdit = useCallback((transitionId: string, type: string, durationSeconds: number) => {
    dispatch({
      type: 'UPDATE_ENHANCEMENTS',
      payload: {
        crossLayerTransitions: enhancements.crossLayerTransitions.map(t =>
          t.id === transitionId ? { ...t, type, durationSeconds } : t
        ),
      }
    });
    setPreviewStatus('stale');

    toast({
      title: "Cross-Layer Transition Updated",
      description: `Effect updated to ${type} (${durationSeconds.toFixed(1)}s)`,
    });
  }, [enhancements.crossLayerTransitions, toast]);

  const handleCrossLayerTransitionRemove = useCallback((transitionId: string) => {
    dispatch({
      type: 'UPDATE_ENHANCEMENTS',
      payload: {
        crossLayerTransitions: enhancements.crossLayerTransitions.filter(t => t.id !== transitionId),
      }
    });
    setPreviewStatus('stale');

    toast({
      title: "Cross-Layer Transition Removed",
      description: "Effect between layers has been removed",
    });
  }, [enhancements.crossLayerTransitions, toast]);

  // Multi-track toggle
  const handleMultiTrackToggle = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_USE_MULTI_TRACK', payload: enabled });
    multiTrackKeyRef.current += 1;

    if (enabled) {
      setUseCanvasPreview(true);
    }

    if (enabled && orderedClips.length > 0 && multiTrackItems.length === 0) {
      let currentTime = 0;
      const convertedItems: MultiTrackTimelineItem[] = orderedClips.map((clip) => {
        const settings = getClipSettings(clip.id);
        const speed = settings?.speed || 1;
        const originalDuration = settings?.originalDuration || (clip.type === 'image' ? 5 : 8);
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

      dispatch({ type: 'SET_MULTI_TRACK_ITEMS', payload: [...convertedItems, ...audioItems] });

      toast({
        title: "Multi-Track Mode",
        description: `Converted ${convertedItems.length} clips and ${audioItems.length} audio tracks to multi-track timeline`,
      });
    }
  }, [orderedClips, multiTrackItems.length, getClipSettings, audioTracks, toast]);

  // Quick action from Library
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
          clips.forEach(clip => {
            const newClip: VideoClip = {
              id: clip.id,
              url: clip.url,
              prompt: clip.prompt,
              thumbnailUrl: clip.thumbnailUrl || null,
              createdAt: new Date().toISOString(),
              type: 'video',
            };
            dispatch({ type: 'ADD_CLIP', payload: newClip });
            dispatch({ type: 'TOGGLE_SELECTION', payload: clip.id });
          });

          if (step === 1) {
            dispatch({ type: 'SET_STEP', payload: 2 });
          }

          toast({
            title: `${clips.length} Clip${clips.length > 1 ? 's' : ''} Added`,
            description: "Your clips have been added to the video editor. Arrange and export!",
          });
        }
      } catch (e) {
        console.error('[QUICK ACTION] Failed to parse video editor clips:', e);
      }
      sessionStorage.removeItem('videoEditor_clips');
    }
  }, [step, toast]);

  // Canvas items memoization
  const canvasItems = useMemo(() => {
    const items: MultiTrackTimelineItem[] = [];
    const runningTimeByLayer: Record<string, number> = {};
    const maxLayers = 10;

    for (let i = 1; i <= maxLayers; i++) {
      runningTimeByLayer[`layer-${i}`] = 0;
    }

    // Add video/image clips
    orderedClips.forEach((clip) => {
      const settings = getClipSettings(clip.id);
      const trackId = clip.trackId || 'layer-1';
      const speed = settings?.speed || 1;
      const originalDuration = settings?.originalDuration || (clip.type === 'image' ? 5 : 8);
      const trimStart = settings?.trimStartSeconds || 0;
      const trimEnd = settings?.trimEndSeconds || originalDuration;
      const effectiveDuration = (trimEnd - trimStart) / speed;
      const displayDuration = clip.type === 'image'
        ? (settings?.displayDuration || 5)
        : effectiveDuration;

      const trackNumber = Math.max(0, parseInt(trackId.split('-')[1] || '1') - 1);
      const startTime = settings?.positionSeconds !== undefined
        ? settings.positionSeconds
        : (runningTimeByLayer[trackId] || 0);

      items.push({
        id: clip.id,
        type: clip.type || 'video',
        track: trackNumber,
        startTime: startTime,
        duration: displayDuration,
        originalDuration: originalDuration,
        url: clip.url,
        thumbnailUrl: clip.thumbnailUrl,
        name: clip.prompt || `${clip.type || 'video'} clip`,
        speed: speed !== 1 ? speed : undefined,
        trim: trimStart > 0 || trimEnd < originalDuration ? { start: trimStart, end: trimEnd } : undefined,
        volume: settings?.volume !== undefined ? Math.round(settings.volume * 100) : 100,
        muted: settings?.muted || false,
        zIndex: trackNumber,
      });

      runningTimeByLayer[trackId] = startTime + displayDuration;
    });

    // Add audio tracks
    audioTracks.forEach((audio) => {
      const trackId = audio.trackId || 'layer-1';
      const trackNumber = Math.max(0, parseInt(trackId.split('-')[1] || '1') - 1);
      const startTime = audio.positionSeconds || 0;
      const duration = audio.duration || 30;
      const trimStart = audio.trimStartSeconds || 0;
      const trimEnd = audio.trimEndSeconds || duration;
      const effectiveDuration = trimEnd - trimStart;

      items.push({
        id: audio.id,
        type: 'audio' as const,
        track: trackNumber + 10,
        startTime: startTime,
        duration: effectiveDuration,
        originalDuration: duration,
        url: audio.url,
        name: audio.name,
        volume: Math.round(audio.volume * 100),
        muted: false,
        trim: trimStart > 0 || trimEnd < duration ? { start: trimStart, end: trimEnd } : undefined,
        fadeOut: audio.fadeOutSeconds,
      });
    });

    return items;
  }, [orderedClips, audioTracks, getClipSettings]);

  if (authLoading) {
    return (
      <SidebarInset>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </SidebarInset>
    );
  }

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

  // ==========================================
  // RENDER UI - Complete with all features
  // ==========================================
  return (
    <VideoEditorErrorBoundary>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={propertiesPanelOpen ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPropertiesPanelOpen(prev => !prev)}
                    data-testid="button-toggle-properties"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {propertiesPanelOpen ? "Hide Properties" : "Show Properties"}
                </TooltipContent>
              </Tooltip>

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
                    <DropdownMenuItem onClick={() => setShowResetConfirmDialog(true)} data-testid="menu-item-new">
                      <Plus className="h-4 w-4 mr-2" />
                      New Project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </header>

          {/* Main Editor Container */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 48px)', maxHeight: 'calc(100vh - 48px)' }}>
            <DndContext
              sensors={sensors}
              collisionDetection={customCollisionDetection}
              onDragStart={(event: DragStartEvent) => {
                console.log('[DRAG START]', event.active.id, event.active.data.current);
                setActiveDragId(String(event.active.id));
                setActiveDragData(event.active.data.current);
                setDragDelta({ x: 0, y: 0 });

                const data = event.active.data.current;
                if (data?.type === 'clip' && data?.clip?.id) {
                  const settings = getClipSettings(data.clip.id);
                  setDragInitialPosition(settings.positionSeconds ?? 0);
                }
                if (data?.type === 'audio' && data?.track?.id) {
                  const track = audioTracks.find(t => t.id === data.track.id);
                  setDragInitialPosition(track?.positionSeconds ?? 0);
                }
              }}
              onDragMove={(event: DragMoveEvent) => {
                setDragDelta({ x: event.delta.x, y: event.delta.y });
                const activatorEvent = event.activatorEvent as PointerEvent | MouseEvent | TouchEvent;
                if (activatorEvent) {
                  let clientX = 0, clientY = 0;
                  if ('touches' in activatorEvent && activatorEvent.touches.length > 0) {
                    clientX = activatorEvent.touches[0].clientX + event.delta.x;
                    clientY = activatorEvent.touches[0].clientY + event.delta.y;
                  } else if ('clientX' in activatorEvent) {
                    clientX = activatorEvent.clientX + event.delta.x;
                    clientY = activatorEvent.clientY + event.delta.y;
                  }
                  setLastPointerPosition({ x: clientX, y: clientY });
                }
              }}
              onDragEnd={handleDragEnd}
              onDragCancel={() => {
                console.log('[DRAG] Drag cancelled');
                setActiveDragId(null);
                setActiveDragData(null);
                setDragDelta({ x: 0, y: 0 });
                setLastPointerPosition(null);
              }}
            >
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Top Section: Editor Area (60% of remaining height) */}
                <div className="flex-[6] flex overflow-hidden min-h-0">
                  {/* Left Icon Sidebar */}
                  <EditorSidebar 
                    activeCategory={activeCategory} 
                    onCategoryChange={setActiveCategory} 
                  />

                  {/* Collapsible Media/Asset Panel */}
                  {mediaPanelOpen && (
                    <div 
                      className="w-72 border-r flex flex-col shrink-0 bg-background overflow-hidden" 
                      style={{ maxHeight: 'calc(60vh - 48px)' }}
                      data-testid="media-panel"
                    >
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

                      <ScrollArea className="flex-1 min-h-0">
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
                              ) : allVideos.length === 0 ? (
                                <div className="text-center py-8">
                                  <Video className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                                  <p className="text-sm text-muted-foreground">No videos yet</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-2">
                                  {allVideos.map((video) => (
                                    <DraggableMediaItem
                                      key={video.id}
                                      item={video}
                                      mediaType="video"
                                      onClick={() => addClipToTimeline(video)}
                                    />
                                  ))}
                                </div>
                              )}

                              {hasNextVideoPage && (
                                <div className="pt-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full"
                                    onClick={() => fetchNextVideoPage()}
                                    disabled={isFetchingNextVideoPage}
                                    data-testid="button-load-more-videos"
                                  >
                                    {isFetchingNextVideoPage ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load More'}
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
                              <p className="text-xs text-muted-foreground px-1">Drag music to timeline or click to add to audio layer</p>
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
                                    <DraggableMediaItem
                                      key={track.id}
                                      item={track}
                                      mediaType="audio"
                                      onClick={() => {
                                        const usedLayers = new Set(audioTracks.map(t => t.trackId || 'layer-1'));
                                        orderedClips.forEach(c => usedLayers.add(c.trackId || 'layer-1'));

                                        let targetLayer = 'layer-2';
                                        const layerOptions = ['layer-2', 'layer-3', 'layer-4', 'layer-5', 'layer-1'];
                                        for (const layer of layerOptions) {
                                          if (!usedLayers.has(layer)) {
                                            targetLayer = layer;
                                            break;
                                          }
                                        }

                                        const trackId = `music_${track.id}_${Date.now()}`;
                                        dispatch({ type: 'ADD_AUDIO_TRACK', payload: {
                                          id: trackId,
                                          url: track.resultUrl!,
                                          name: track.prompt || 'Music Track',
                                          type: 'music',
                                          volume: 0.5,
                                          trackId: targetLayer,
                                          positionSeconds: 0,
                                        }});

                                        dispatch({
                                          type: 'UPDATE_ENHANCEMENTS',
                                          payload: {
                                            backgroundMusic: {
                                              audioUrl: track.resultUrl!,
                                              volume: 0.5,
                                              name: track.prompt || 'Music Track',
                                            },
                                          }
                                        });
                                        toast({
                                          title: "Music Added",
                                          description: `Music track added to Layer ${targetLayer.split('-')[1]}. Drag to reposition.`
                                        });
                                      }}
                                    />
                                  ))}

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
                              <p className="text-xs text-muted-foreground px-1">Drag audio to timeline or click to add to voice layer</p>
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
                                    <DraggableMediaItem
                                      key={track.id}
                                      item={track}
                                      mediaType="audio"
                                      onClick={() => {
                                        const usedLayers = new Set(audioTracks.map(t => t.trackId || 'layer-1'));
                                        orderedClips.forEach(c => usedLayers.add(c.trackId || 'layer-1'));

                                        let targetLayer = 'layer-3';
                                        const layerOptions = ['layer-3', 'layer-2', 'layer-4', 'layer-5', 'layer-1'];
                                        for (const layer of layerOptions) {
                                          if (!usedLayers.has(layer)) {
                                            targetLayer = layer;
                                            break;
                                          }
                                        }

                                        const trackId = `voice_${track.id}_${Date.now()}`;
                                        dispatch({ type: 'ADD_AUDIO_TRACK', payload: {
                                          id: trackId,
                                          url: track.resultUrl!,
                                          name: track.prompt || 'Voice Track',
                                          type: 'voice',
                                          volume: 1.0,
                                          trackId: targetLayer,
                                          positionSeconds: 0,
                                        }});

                                        dispatch({
                                          type: 'UPDATE_ENHANCEMENTS',
                                          payload: {
                                            audioTrack: {
                                              audioUrl: track.resultUrl!,
                                              volume: 1.0,
                                              type: 'tts',
                                              name: track.prompt || 'Voice Track',
                                            },
                                          }
                                        });
                                        toast({
                                          title: "Audio Added",
                                          description: `Voice track added to Layer ${targetLayer.split('-')[1]}. Drag to reposition.`
                                        });
                                      }}
                                    />
                                  ))}

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
                              {(enhancements.clipTransitions.length > 0 || enhancements.crossLayerTransitions.length > 0) && (
                                <div className="mt-4 space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground">Active Transitions</p>
                                  {/* Same-layer transitions */}
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
                                  {/* Cross-layer transitions */}
                                  {enhancements.crossLayerTransitions.map((transition) => {
                                    const fromClip = orderedClips.find(c => c.id === transition.fromClipId);
                                    const toClip = orderedClips.find(c => c.id === transition.toClipId);
                                    const fromIndex = fromClip ? orderedClips.indexOf(fromClip) + 1 : '?';
                                    const toIndex = toClip ? orderedClips.indexOf(toClip) + 1 : '?';
                                    return (
                                      <div key={transition.id} className="p-2 border border-purple-500/30 bg-purple-500/5 rounded-md flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <Layers className="h-3 w-3 text-purple-500" />
                                          <span className="text-xs">
                                            Clip {fromIndex} ↔ Clip {toIndex}
                                          </span>
                                          <Badge variant="secondary" className="text-[10px] bg-purple-500/20">{transition.type}</Badge>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-destructive"
                                            onClick={() => handleCrossLayerTransitionRemove(transition.id)}
                                            data-testid={`remove-cross-transition-${transition.id}`}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
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
                                        dispatch({
                                          type: 'UPDATE_ENHANCEMENTS',
                                          payload: {
                                            avatarOverlay: {
                                              videoUrl: avatar.resultUrl!,
                                              position: 'bottom-right',
                                              size: 'medium',
                                              name: avatar.prompt || 'Avatar',
                                            },
                                          }
                                        });
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
                                          dispatch({ type: 'ADD_CLIP', payload: newClip });
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
                                          dispatch({ type: 'ADD_CLIP', payload: newClip });
                                          dispatch({
                                            type: 'UPDATE_CLIP_SETTINGS',
                                            payload: {
                                              clipId: newClip.id,
                                              updates: { displayDuration: 5 }
                                            }
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
                                          dispatch({
                                            type: 'UPDATE_ENHANCEMENTS',
                                            payload: {
                                              backgroundMusic: {
                                                audioUrl: result.url,
                                                volume: 0.5,
                                                name: file.name,
                                              },
                                            }
                                          });
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
                                    dispatch({
                                      type: 'UPDATE_ENHANCEMENTS',
                                      payload: { aspectRatio: value }
                                    });
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
                                  onCheckedChange={(checked) => 
                                    dispatch({
                                      type: 'UPDATE_ENHANCEMENTS',
                                      payload: { fadeIn: checked }
                                    })
                                  }
                                  data-testid="switch-fade-in"
                                />
                              </div>

                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Fade Out</Label>
                                <Switch
                                  checked={enhancements.fadeOut}
                                  onCheckedChange={(checked) => 
                                    dispatch({
                                      type: 'UPDATE_ENHANCEMENTS',
                                      payload: { fadeOut: checked }
                                    })
                                  }
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
                                        dispatch({
                                          type: 'UPDATE_ENHANCEMENTS',
                                          payload: { backgroundMusic: undefined }
                                        });
                                        const tracksToRemove = audioTracks.filter(t => t.url === musicUrl);
                                        tracksToRemove.forEach(track => {
                                          dispatch({ type: 'REMOVE_AUDIO_TRACK', payload: track.id });
                                        });
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
                                        dispatch({
                                          type: 'UPDATE_ENHANCEMENTS',
                                          payload: {
                                            backgroundMusic: enhancements.backgroundMusic ? {
                                              ...enhancements.backgroundMusic,
                                              volume: v,
                                            } : undefined,
                                          }
                                        })
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
                                        dispatch({
                                          type: 'UPDATE_ENHANCEMENTS',
                                          payload: { audioTrack: undefined }
                                        });
                                        const tracksToRemove = audioTracks.filter(t => t.url === voiceUrl);
                                        tracksToRemove.forEach(track => {
                                          dispatch({ type: 'REMOVE_AUDIO_TRACK', payload: track.id });
                                        });
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
                                        dispatch({
                                          type: 'UPDATE_ENHANCEMENTS',
                                          payload: {
                                            audioTrack: enhancements.audioTrack ? {
                                              ...enhancements.audioTrack,
                                              volume: v,
                                            } : undefined,
                                          }
                                        })
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
                                Max processing time: 5 min for 2 mins of video.
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

                  {/* Center: Preview Surface */}
                  <div className="flex-1 flex flex-col min-w-0 relative">
                    {/* Preview Mode Toggle and Actions */}
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
                      {/* Generate Server Preview Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generatePreview}
                        disabled={previewStatus === 'refreshing' || orderedClips.length === 0}
                        className="bg-background/80 backdrop-blur-sm shadow-sm h-8"
                      >
                        {previewStatus === 'refreshing' ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                            <span className="text-xs">Generating...</span>
                          </>
                        ) : (
                          <>
                            <Film className="h-3 w-3 mr-1.5" />
                            <span className="text-xs">Server Preview</span>
                          </>
                        )}
                      </Button>

                      {/* Real-time Toggle */}
                      <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border shadow-sm h-8">
                        <span className="text-xs text-muted-foreground">
                          {useCanvasPreview ? 'Real-time' : 'Rendered'}
                        </span>
                        <Switch
                          checked={useCanvasPreview}
                          onCheckedChange={setUseCanvasPreview}
                        />
                        <Sparkles className={cn("h-3 w-3", useCanvasPreview ? "text-primary" : "text-muted-foreground")} />
                      </div>
                    </div>

                    {useCanvasPreview && orderedClips.length > 0 ? (
                      <CanvasPreview
                        items={canvasItems}
                        currentTime={timelineCurrentTime}
                        isPlaying={isTimelinePlaying}
                        onTimeUpdate={setTimelineCurrentTime}
                        className="flex-1"
                      />
                    ) : (
                      <PreviewSurface
                        previewUrl={previewUrl}
                        status={previewStatus}
                        clipCount={orderedClips.length}
                        totalDuration={totalDuration}
                        onForceRefresh={generatePreview}
                        errorMessage={previewError}
                        className="flex-1"
                        timelineTime={timelineCurrentTime}
                        isTimelinePlaying={isTimelinePlaying}
                        onTimelineTimeChange={setTimelineCurrentTime}
                      />
                    )}
                    {textOverlays.length > 0 && (
                      <TextOverlayRenderer
                        overlays={textOverlays}
                        currentTime={timelineCurrentTime}
                        selectedOverlayId={selectedOverlayId}
                        onSelectOverlay={setSelectedOverlayId}
                        isPlaying={isTimelinePlaying}
                      />
                    )}

                  </div>

                  {/* Right: Properties Panel */}
                  {propertiesPanelOpen && (
                    <div className="w-72 border-l bg-background shrink-0" data-testid="properties-panel-container">
                      <PropertiesPanel
                        selectedClip={selectedClip}
                        clipSettings={selectedClip ? getClipSettings(selectedClip.clip.id) : null}
                        enhancements={enhancements}
                        onClipSettingsChange={(updates) => {
                          if (selectedClip) {
                            dispatch({
                              type: 'UPDATE_CLIP_SETTINGS',
                              payload: { clipId: selectedClip.clip.id, updates }
                            });
                          }
                        }}
                        onEnhancementsChange={(updates) => 
                          dispatch({ type: 'UPDATE_ENHANCEMENTS', payload: updates })
                        }
                        onMuteToggle={() => {
                          if (selectedClip) {
                            toggleClipMute(selectedClip.clip.id);
                          }
                        }}
                        totalDuration={totalDuration}
                        clipCount={orderedClips.length}
                        className="h-full"
                      />
                    </div>
                  )}
                </div>

                {/* Bottom Section: Advanced Timeline (40% of remaining height) */}
                <div className="flex-[4] border-t min-h-0 flex flex-col">
                  <AdvancedTimeline
                    clips={orderedClips}
                    audioTracks={audioTracks}
                    getClipSettings={getClipSettings}
                    clipTransitions={enhancements.clipTransitions}
                    onClipSelect={(clip, index) => {
                      setSelectedClip({ clip, index });
                    }}
                    onClipRemove={removeClipFromTimeline}
                    onClipReorder={(fromIndex, toIndex) => {
                      dispatch({
                        type: 'REORDER_CLIPS',
                        payload: { oldIndex: fromIndex, newIndex: toIndex }
                      });
                    }}
                    onClipDuplicate={(clip, afterIndex) => {
                      const duplicatedClip = { ...clip, id: `${clip.id}-dup-${Date.now()}` };
                      dispatch({ type: 'ADD_CLIP', payload: duplicatedClip });
                      const originalSettings = getClipSettings(clip.id);
                      if (originalSettings) {
                        dispatch({
                          type: 'UPDATE_CLIP_SETTINGS',
                          payload: { 
                            clipId: duplicatedClip.id, 
                            updates: { ...originalSettings, clipId: duplicatedClip.id }
                          }
                        });
                      }
                    }}
                    onClipSplit={(clipId, splitTimeInClip) => {
                      const clipIndex = orderedClips.findIndex(c => c.id === clipId);
                      if (clipIndex === -1) return;

                      const originalClip = orderedClips[clipIndex];
                      const originalSettings = getClipSettings(clipId);
                      const originalDuration = originalSettings.originalDuration ?? 5;
                      const trimStart = originalSettings.trimStartSeconds ?? 0;
                      const trimEnd = originalSettings.trimEndSeconds ?? originalDuration;
                      const speed = originalSettings.speed ?? 1;

                      if (splitTimeInClip <= trimStart || splitTimeInClip >= trimEnd) {
                        toast({ title: "Cannot Split", description: "Playhead must be inside the clip", variant: "destructive" });
                        return;
                      }

                      const clip1Id = `${clipId}-split-a-${Date.now()}`;
                      const clip2Id = `${clipId}-split-b-${Date.now()}`;
                      const clip1 = { ...originalClip, id: clip1Id };
                      const clip2 = { ...originalClip, id: clip2Id };

                      const originalPosition = originalSettings.positionSeconds ?? 0;
                      const clip1Duration = (splitTimeInClip - trimStart) / speed;
                      const clip2Position = originalPosition + clip1Duration;

                      // Remove original and add both split clips
                      const newClips = [...orderedClips];
                      newClips.splice(clipIndex, 1, clip1, clip2);

                      // Clear and rebuild
                      dispatch({ type: 'CLEAR_EDITOR' });
                      newClips.forEach(clip => dispatch({ type: 'ADD_CLIP', payload: clip }));

                      // Update settings
                      dispatch({
                        type: 'UPDATE_CLIP_SETTINGS',
                        payload: { 
                          clipId: clip1Id, 
                          updates: { 
                            ...originalSettings,
                            clipId: clip1Id,
                            trimEndSeconds: splitTimeInClip,
                            positionSeconds: originalPosition 
                          }
                        }
                      });
                      dispatch({
                        type: 'UPDATE_CLIP_SETTINGS',
                        payload: { 
                          clipId: clip2Id, 
                          updates: { 
                            ...originalSettings,
                            clipId: clip2Id,
                            trimStartSeconds: splitTimeInClip,
                            positionSeconds: clip2Position 
                          }
                        }
                      });

                      toast({ title: "Clip Split", description: "Clip has been split at playhead position" });
                    }}
                    onClipTrackChange={(clipId, newTrackId) => {
                      const newClips = orderedClips.map(clip => 
                        clip.id === clipId ? { ...clip, trackId: newTrackId } : clip
                      );
                      dispatch({ type: 'CLEAR_EDITOR' });
                      newClips.forEach(clip => dispatch({ type: 'ADD_CLIP', payload: clip }));
                      toast({ title: "Clip Moved", description: `Clip moved to ${newTrackId.replace('-', ' ').replace('layer', 'Layer')}` });
                    }}
                    onTransitionEdit={handleTransitionEdit}
                    onTransitionRemove={handleTransitionRemove}
                    onAudioRemove={removeAudioTrack}
                    onAudioUpdate={(trackId, updates) => {
                      dispatch({
                        type: 'UPDATE_AUDIO_TRACK',
                        payload: { trackId, updates }
                      });
                    }}
                    onAudioSplit={(trackId, splitTimeInTrack) => {
                      const trackIndex = audioTracks.findIndex(t => t.id === trackId);
                      if (trackIndex === -1) return;

                      const originalTrack = audioTracks[trackIndex];
                      const originalDuration = originalTrack.duration ?? 60;
                      const trimStart = originalTrack.trimStartSeconds ?? 0;
                      const trimEnd = originalTrack.trimEndSeconds ?? originalDuration;
                      const positionSeconds = originalTrack.positionSeconds ?? 0;

                      const MIN_SEGMENT_LENGTH = 0.5;
                      if (splitTimeInTrack <= trimStart + MIN_SEGMENT_LENGTH || 
                          splitTimeInTrack >= trimEnd - MIN_SEGMENT_LENGTH) {
                        toast({ title: "Cannot Split", description: "Playhead must be at least 0.5 seconds from either edge", variant: "destructive" });
                        return;
                      }

                      const track1Id = `${trackId}-split-a-${Date.now()}`;
                      const track2Id = `${trackId}-split-b-${Date.now()}`;

                      const track1Duration = splitTimeInTrack - trimStart;
                      const track2Position = positionSeconds + track1Duration;

                      const track1 = { 
                        ...originalTrack, 
                        id: track1Id, 
                        trimEndSeconds: splitTimeInTrack,
                        positionSeconds: positionSeconds
                      };
                      const track2 = { 
                        ...originalTrack, 
                        id: track2Id, 
                        trimStartSeconds: splitTimeInTrack,
                        positionSeconds: track2Position,
                        fadeOutSeconds: originalTrack.fadeOutSeconds
                      };

                      const newAudioTracks = [...audioTracks];
                      newAudioTracks.splice(trackIndex, 1, track1, track2);

                      // Update audio tracks
                      dispatch({ type: 'CLEAR_EDITOR' });
                      newAudioTracks.forEach(track => dispatch({ type: 'ADD_AUDIO_TRACK', payload: track }));
                      orderedClips.forEach(clip => dispatch({ type: 'ADD_CLIP', payload: clip }));

                      toast({ title: "Audio Split", description: "Audio track has been split at playhead position" });
                    }}
                    onClipSettingsChange={(clipId, settings) => {
                      dispatch({
                        type: 'UPDATE_CLIP_SETTINGS',
                        payload: { clipId, updates: settings }
                      });
                    }}
                    snapEnabled={enhancements.snapEnabled}
                    onSnapChange={(enabled) => 
                      dispatch({
                        type: 'UPDATE_ENHANCEMENTS',
                        payload: { snapEnabled: enabled }
                      })
                    }
                    selectedClipId={selectedClip?.clip.id ?? null}
                    totalDuration={totalDuration}
                    currentTime={timelineCurrentTime}
                    onTimeChange={setTimelineCurrentTime}
                    onPlayPause={handleTimelinePlayPause}
                    isPlaying={isTimelinePlaying}
                    crossLayerTransitions={enhancements.crossLayerTransitions}
                    onCrossLayerTransitionAdd={handleCrossLayerTransitionAdd}
                    onCrossLayerTransitionEdit={handleCrossLayerTransitionEdit}
                    onCrossLayerTransitionRemove={handleCrossLayerTransitionRemove}
                    isDraggingClip={!!(activeDragData && (activeDragData.type === 'clip' || activeDragData.type === 'audio'))}
                    zoom={timelineZoom}
                    onZoomChange={setTimelineZoom}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Drag Overlay */}
              <DragOverlay>
                {activeDragId && activeDragData && (
                  <div className="p-2 bg-primary/20 rounded border-2 border-primary backdrop-blur-sm shadow-lg pointer-events-none">
                    <div className="flex items-center gap-2">
                      {activeDragData.type === 'media-item' && (
                        <>
                          <Video className="h-4 w-4 text-primary" />
                          <span className="text-xs font-medium text-foreground">
                            {activeDragData.mediaType || 'Media'}
                          </span>
                        </>
                      )}
                      {activeDragData.type === 'transition' && (
                        <>
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-xs font-medium text-foreground">
                            {activeDragData.transitionType || 'Transition'}
                          </span>
                        </>
                      )}
                      {!activeDragData.type && (
                        <span className="text-xs font-medium text-foreground">Dragging...</span>
                      )}
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
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

        {/* Clip Settings Dialog */}
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
                            dispatch({
                              type: 'UPDATE_CLIP_SETTINGS',
                              payload: { 
                                clipId: editingClip.clip.id, 
                                updates: { displayDuration: v, originalDuration: v }
                              }
                            })
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
                            dispatch({
                              type: 'UPDATE_CLIP_SETTINGS',
                              payload: { 
                                clipId: editingClip.clip.id, 
                                updates: { muted: checked }
                              }
                            })
                          }
                          data-testid="switch-clip-mute"
                        />
                      </div>

                      {!getClipSettings(editingClip.clip.id).muted && (
                        <ClipVolumeSlider
                          key={`volume-${editingClip.clip.id}`}
                          clipId={editingClip.clip.id}
                          initialVolume={getClipSettings(editingClip.clip.id).volume}
                          onCommit={(v) => 
                            dispatch({
                              type: 'UPDATE_CLIP_SETTINGS',
                              payload: { 
                                clipId: editingClip.clip.id, 
                                updates: { volume: v }
                              }
                            })
                          }
                        />
                      )}

                      <ClipSpeedSlider
                        key={`speed-${editingClip.clip.id}`}
                        clipId={editingClip.clip.id}
                        initialSpeed={getClipSettings(editingClip.clip.id).speed}
                        onCommit={(v) => 
                          dispatch({
                            type: 'UPDATE_CLIP_SETTINGS',
                            payload: { 
                              clipId: editingClip.clip.id, 
                              updates: { speed: v }
                            }
                          })
                        }
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

        {/* Split Dialog */}
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
                    crossOrigin="anonymous"
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
                      Drag the slider to select where to split the clip.
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

        {/* Preview Modal */}
        <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview (Low Resolution)
              </DialogTitle>
              <DialogDescription>
                This is a quick low-resolution preview of your combined video.
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

        {/* Reset Editor Confirmation Dialog */}
        <Dialog open={showResetConfirmDialog} onOpenChange={setShowResetConfirmDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Start New Project?
              </DialogTitle>
              <DialogDescription>
                This will clear your current timeline, all clips, audio tracks, and settings.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 text-sm text-muted-foreground">
              {orderedClips.length > 0 && (
                <p>You have {orderedClips.length} clip{orderedClips.length !== 1 ? 's' : ''} in your timeline.</p>
              )}
              {audioTracks.length > 0 && (
                <p>You have {audioTracks.length} audio track{audioTracks.length !== 1 ? 's' : ''} added.</p>
              )}
              {currentProject && (
                <p className="mt-2">
                  <span className="font-medium">Tip:</span> Save your project first if you want to keep your work.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResetConfirmDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  resetEditor();
                  setShowResetConfirmDialog(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear & Start New
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
    </VideoEditorErrorBoundary>
  );
}

export default VideoEditor;