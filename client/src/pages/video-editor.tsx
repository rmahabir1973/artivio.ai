import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { LivePlayerProvider } from "@twick/live-player";
import { TwickStudio } from "@twick/studio";
import { TimelineProvider, INITIAL_TIMELINE_DATA } from "@twick/timeline";
import "@twick/studio/dist/studio.css";
import { SidebarInset } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { useQuery } from "@tanstack/react-query";
import { 
  Loader2, Download, Film, AlertCircle, Monitor, Smartphone, Square, 
  Library, Copy, Video, Image, Music, X, Check, Settings2, Keyboard
} from "lucide-react";
import { SiYoutube, SiTiktok, SiInstagram, SiX } from "react-icons/si";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CanvasPreset = {
  name: string;
  width: number;
  height: number;
  icon: typeof Monitor;
  ratio: string;
};

const CANVAS_PRESETS: CanvasPreset[] = [
  { name: "Landscape", width: 1920, height: 1080, icon: Monitor, ratio: "16:9" },
  { name: "Portrait", width: 1080, height: 1920, icon: Smartphone, ratio: "9:16" },
  { name: "Square", width: 1080, height: 1080, icon: Square, ratio: "1:1" },
];

type QualityPreset = {
  name: string;
  width: number;
  height: number;
  label: string;
};

const QUALITY_PRESETS: QualityPreset[] = [
  { name: "720p", width: 1280, height: 720, label: "720p (HD)" },
  { name: "1080p", width: 1920, height: 1080, label: "1080p (Full HD)" },
  { name: "4K", width: 3840, height: 2160, label: "4K (Ultra HD)" },
];

type FPSPreset = {
  value: number;
  name: string;
  label: string;
};

const FPS_PRESETS: FPSPreset[] = [
  { value: 24, name: "24fps", label: "24 FPS (Cinematic)" },
  { value: 30, name: "30fps", label: "30 FPS (Standard)" },
  { value: 60, name: "60fps", label: "60 FPS (Smooth)" },
];

type PlatformPreset = {
  id: string;
  name: string;
  icon: typeof SiYoutube;
  ratio: string;
  quality: string;
  fps: number;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
};

const PLATFORM_PRESETS: PlatformPreset[] = [
  { 
    id: "youtube", 
    name: "YouTube", 
    icon: SiYoutube, 
    ratio: "16:9", 
    quality: "1080p", 
    fps: 30,
    width: 1920,
    height: 1080,
    canvasWidth: 1920,
    canvasHeight: 1080
  },
  { 
    id: "tiktok", 
    name: "TikTok", 
    icon: SiTiktok, 
    ratio: "9:16", 
    quality: "1080p", 
    fps: 30,
    width: 1920,
    height: 1080,
    canvasWidth: 1080,
    canvasHeight: 1920
  },
  { 
    id: "instagram-reels", 
    name: "Instagram Reels", 
    icon: SiInstagram, 
    ratio: "9:16", 
    quality: "1080p", 
    fps: 30,
    width: 1920,
    height: 1080,
    canvasWidth: 1080,
    canvasHeight: 1920
  },
  { 
    id: "instagram-feed", 
    name: "Instagram Feed", 
    icon: SiInstagram, 
    ratio: "1:1", 
    quality: "1080p", 
    fps: 30,
    width: 1920,
    height: 1080,
    canvasWidth: 1080,
    canvasHeight: 1080
  },
  { 
    id: "twitter", 
    name: "Twitter/X", 
    icon: SiX, 
    ratio: "16:9", 
    quality: "720p", 
    fps: 30,
    width: 1280,
    height: 720,
    canvasWidth: 1280,
    canvasHeight: 720
  },
];

type ExportSettings = {
  quality: QualityPreset;
  fps: FPSPreset;
  platform: PlatformPreset | null;
};

const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  quality: QUALITY_PRESETS[1],
  fps: FPS_PRESETS[1],
  platform: null,
};

type MediaItem = {
  id: string;
  name: string;
  url: string;
  thumbnail?: string;
  type: 'video' | 'image' | 'audio';
  duration?: number;
  createdAt: Date;
};

type ShortcutCategory = {
  name: string;
  shortcuts: { keys: string[]; description: string }[];
};

const KEYBOARD_SHORTCUTS: ShortcutCategory[] = [
  {
    name: "Playback",
    shortcuts: [
      { keys: ["Space"], description: "Play / Pause" },
      { keys: ["←"], description: "Previous frame / Rewind" },
      { keys: ["→"], description: "Next frame / Forward" },
    ],
  },
  {
    name: "Editing",
    shortcuts: [
      { keys: ["⌘/Ctrl", "Z"], description: "Undo" },
      { keys: ["⌘/Ctrl", "Shift", "Z"], description: "Redo" },
      { keys: ["⌘/Ctrl", "C"], description: "Copy" },
      { keys: ["⌘/Ctrl", "V"], description: "Paste" },
      { keys: ["⌘/Ctrl", "X"], description: "Cut" },
      { keys: ["Delete/⌫"], description: "Delete selected element" },
    ],
  },
  {
    name: "Selection",
    shortcuts: [
      { keys: ["⌘/Ctrl", "A"], description: "Select all" },
      { keys: ["Esc"], description: "Deselect / Close modals" },
    ],
  },
  {
    name: "File",
    shortcuts: [
      { keys: ["⌘/Ctrl", "S"], description: "Save project" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
    ],
  },
];

function useKeyboardShortcuts({
  onSave,
  onShowShortcuts,
  editorContainerRef,
}: {
  onSave: () => void;
  onShowShortcuts: () => void;
  editorContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { toast } = useToast();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const isInInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable;
    
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? event.metaKey : event.ctrlKey;
    
    if (event.key === '?' && !isInInput) {
      event.preventDefault();
      onShowShortcuts();
      return;
    }

    if (modKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      onSave();
      toast({
        title: "Project Saved",
        description: "Your project has been saved.",
      });
      return;
    }
    
    if (event.key === 'Escape') {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement !== document.body) {
        activeElement.blur();
      }
      return;
    }

    if (isInInput) {
      return;
    }

    const editorContainer = editorContainerRef.current;
    if (!editorContainer) return;

    switch (event.key) {
      case ' ':
        event.preventDefault();
        editorContainer.dispatchEvent(
          new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })
        );
        break;
      case 'ArrowLeft':
        event.preventDefault();
        editorContainer.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true })
        );
        break;
      case 'ArrowRight':
        event.preventDefault();
        editorContainer.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true })
        );
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        editorContainer.dispatchEvent(
          new KeyboardEvent('keydown', { key: event.key, code: event.code, bubbles: true })
        );
        break;
      case 'z':
      case 'Z':
        if (modKey) {
          event.preventDefault();
          const isRedo = event.shiftKey;
          editorContainer.dispatchEvent(
            new KeyboardEvent('keydown', { 
              key: 'z', 
              code: 'KeyZ', 
              ctrlKey: !isMac, 
              metaKey: isMac, 
              shiftKey: isRedo,
              bubbles: true 
            })
          );
        }
        break;
      case 'c':
      case 'C':
        if (modKey) {
          editorContainer.dispatchEvent(
            new KeyboardEvent('keydown', { 
              key: 'c', 
              code: 'KeyC', 
              ctrlKey: !isMac, 
              metaKey: isMac, 
              bubbles: true 
            })
          );
        }
        break;
      case 'v':
      case 'V':
        if (modKey) {
          editorContainer.dispatchEvent(
            new KeyboardEvent('keydown', { 
              key: 'v', 
              code: 'KeyV', 
              ctrlKey: !isMac, 
              metaKey: isMac, 
              bubbles: true 
            })
          );
        }
        break;
      case 'x':
      case 'X':
        if (modKey) {
          event.preventDefault();
          editorContainer.dispatchEvent(
            new KeyboardEvent('keydown', { 
              key: 'x', 
              code: 'KeyX', 
              ctrlKey: !isMac, 
              metaKey: isMac, 
              bubbles: true 
            })
          );
        }
        break;
      case 'a':
      case 'A':
        if (modKey) {
          event.preventDefault();
          editorContainer.dispatchEvent(
            new KeyboardEvent('keydown', { 
              key: 'a', 
              code: 'KeyA', 
              ctrlKey: !isMac, 
              metaKey: isMac, 
              bubbles: true 
            })
          );
        }
        break;
    }
  }, [onSave, onShowShortcuts, editorContainerRef, toast]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

function KeyboardShortcutKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-2 py-1 text-xs font-semibold bg-muted border rounded-md shadow-sm min-w-[24px] text-center">
      {children}
    </kbd>
  );
}

function KeyboardShortcutsDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to speed up your video editing workflow.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {KEYBOARD_SHORTCUTS.map((category) => (
            <div key={category.name}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {category.name}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center gap-1">
                          <KeyboardShortcutKey>{key}</KeyboardShortcutKey>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LibraryItem({ item, onCopy }: { item: MediaItem; onCopy: (url: string) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopied(true);
      onCopy(item.url);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const TypeIcon = item.type === 'video' ? Video : item.type === 'image' ? Image : Music;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover-elevate transition-colors group">
      <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted">
        {item.type === 'image' ? (
          <img 
            src={item.thumbnail || item.url} 
            alt={item.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : item.type === 'video' ? (
          <video 
            src={item.url} 
            className="w-full h-full object-cover"
            muted
            preload="metadata"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
        <div className="absolute bottom-1 right-1">
          <Badge variant="secondary" className="text-[10px] px-1 py-0">
            <TypeIcon className="w-3 h-3" />
          </Badge>
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.createdAt.toLocaleDateString()}
          {item.duration && ` • ${item.duration}s`}
        </p>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className="flex-shrink-0"
        data-testid={`button-copy-${item.id}`}
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

export default function VideoEditor() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [selectedCanvas, setSelectedCanvas] = useState<CanvasPreset>(CANVAS_PRESETS[0]);
  const [studioKey, setStudioKey] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const handleSaveProject = useCallback(() => {
    toast({
      title: "Project Saved",
      description: "Your project has been saved locally.",
    });
  }, [toast]);

  useKeyboardShortcuts({
    onSave: handleSaveProject,
    onShowShortcuts: () => setShortcutsDialogOpen(true),
    editorContainerRef,
  });
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const { data: userGenerations } = useQuery<any[]>({
    queryKey: ['/api/generations'],
    enabled: isAuthenticated,
  });

  const userMedia = useMemo(() => {
    if (!userGenerations) return { videos: [] as MediaItem[], images: [] as MediaItem[], audio: [] as MediaItem[] };
    
    const videos: MediaItem[] = [];
    const images: MediaItem[] = [];
    const audio: MediaItem[] = [];
    
    userGenerations.forEach((gen: any) => {
      if (gen.status !== 'completed' || !gen.resultUrl) return;
      
      const mediaItem: MediaItem = {
        id: gen.id,
        name: gen.prompt?.substring(0, 50) || `${gen.type} - ${gen.model}`,
        url: gen.resultUrl,
        thumbnail: gen.resultUrl,
        createdAt: new Date(gen.createdAt),
        type: 'video',
      };
      
      if (gen.type === 'video' || gen.type === 'talking-avatar' || gen.type === 'avatar' || gen.type === 'transition') {
        videos.push({ ...mediaItem, type: 'video', duration: gen.metadata?.duration || 5 });
      } else if (gen.type === 'image' || gen.type === 'upscaling' || gen.type === 'background-remover') {
        images.push({ ...mediaItem, type: 'image' });
      } else if (gen.type === 'music' || gen.type === 'sound-effects') {
        audio.push({ ...mediaItem, type: 'audio', duration: gen.metadata?.duration || 30 });
      }
    });
    
    return { videos, images, audio };
  }, [userGenerations]);

  const totalMediaCount = userMedia.videos.length + userMedia.images.length + userMedia.audio.length;

  const handleCanvasChange = (preset: CanvasPreset) => {
    setSelectedCanvas(preset);
    setStudioKey(prev => prev + 1);
    toast({
      title: "Canvas Updated",
      description: `Canvas set to ${preset.name} (${preset.ratio})`,
    });
  };

  const handleCopyUrl = (url: string) => {
    toast({
      title: "URL Copied",
      description: "Paste this URL in the editor's media panel to add it to your project.",
    });
  };

  const handleQualityChange = (quality: QualityPreset) => {
    setExportSettings(prev => ({ ...prev, quality, platform: null }));
    toast({
      title: "Quality Updated",
      description: `Export quality set to ${quality.label}`,
    });
  };

  const handleFPSChange = (fps: FPSPreset) => {
    setExportSettings(prev => ({ ...prev, fps, platform: null }));
    toast({
      title: "Frame Rate Updated", 
      description: `Export frame rate set to ${fps.label}`,
    });
  };

  const handlePlatformPreset = (platform: PlatformPreset) => {
    const matchingQuality = QUALITY_PRESETS.find(q => q.name === platform.quality) || QUALITY_PRESETS[1];
    const matchingFPS = FPS_PRESETS.find(f => f.value === platform.fps) || FPS_PRESETS[1];
    
    const matchingCanvas = CANVAS_PRESETS.find(
      c => c.width === platform.canvasWidth && c.height === platform.canvasHeight
    );
    
    if (matchingCanvas) {
      setSelectedCanvas(matchingCanvas);
      setStudioKey(prev => prev + 1);
    }
    
    setExportSettings({
      quality: matchingQuality,
      fps: matchingFPS,
      platform,
    });
    
    toast({
      title: `${platform.name} Preset Applied`,
      description: `Canvas: ${platform.ratio}, Quality: ${platform.quality}, FPS: ${platform.fps}`,
    });
  };

  const handleExportVideo = async (project: any, videoSettings: any) => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return { status: false, message: "Please sign in to export videos" };
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsExporting(true);
    setExportProgress("Preparing export...");
    setExportedVideoUrl(null);

    try {
      setExportProgress("Sending to cloud renderer...");
      
      const response = await apiRequest("POST", "/api/video-editor/export", {
        project,
        videoSettings: {
          ...videoSettings,
          quality: exportSettings.quality.name,
          width: exportSettings.quality.width,
          height: exportSettings.quality.height,
          fps: exportSettings.fps.value,
          platform: exportSettings.platform?.id || null,
        },
      });
      
      const data = await response.json();
      
      if (data.status === "processing") {
        setExportProgress("Rendering video in the cloud...");
        
        const pollForResult = async (jobId: string): Promise<any> => {
          const maxAttempts = 60;
          let attempts = 0;
          
          while (attempts < maxAttempts && !signal.aborted) {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(resolve, 5000);
              signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new Error('Export cancelled'));
              });
            });
            
            if (!isMountedRef.current || signal.aborted) {
              throw new Error('Export cancelled');
            }
            
            attempts++;
            setExportProgress(`Rendering... (${Math.min(attempts * 5, 95)}%)`);
            
            const statusResponse = await apiRequest("GET", `/api/video-editor/export/${jobId}`);
            const statusData = await statusResponse.json();
            
            if (statusData.status === "completed") {
              return statusData;
            } else if (statusData.status === "failed") {
              throw new Error(statusData.error || "Export failed");
            }
          }
          
          throw new Error("Export timed out");
        };
        
        const result = await pollForResult(data.jobId);
        
        if (isMountedRef.current) {
          setExportedVideoUrl(result.downloadUrl);
          toast({
            title: "Export Complete!",
            description: "Your video is ready to download.",
          });
        }
        
        return { status: true, message: "Video exported successfully" };
      }
      
      if (data.downloadUrl) {
        if (isMountedRef.current) {
          setExportedVideoUrl(data.downloadUrl);
          toast({
            title: "Export Complete!",
            description: "Your video is ready to download.",
          });
        }
        return { status: true, message: "Video exported successfully" };
      }
      
      throw new Error("Unexpected response from export service");
    } catch (error: any) {
      if (error.message !== 'Export cancelled' && isMountedRef.current) {
        toast({
          title: "Export Failed",
          description: error.message || "Failed to export video",
          variant: "destructive",
        });
      }
      return { status: false, message: error.message || "Failed to export video" };
    } finally {
      if (isMountedRef.current) {
        setIsExporting(false);
        setExportProgress(null);
      }
      abortControllerRef.current = null;
    }
  };

  const SelectedIcon = selectedCanvas.icon;

  return (
    <SidebarInset>
      <div className="flex flex-col h-full w-full">
        <div className="flex items-center justify-between p-4 border-b flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Film className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Video Editor</h1>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShortcutsDialogOpen(true)}
              title="Keyboard Shortcuts (?)"
              data-testid="button-keyboard-shortcuts"
            >
              <Keyboard className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-canvas-size">
                  <SelectedIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{selectedCanvas.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {selectedCanvas.ratio}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {CANVAS_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <DropdownMenuItem
                      key={preset.name}
                      onClick={() => handleCanvasChange(preset)}
                      className="gap-2"
                      data-testid={`menu-item-canvas-${preset.name.toLowerCase()}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{preset.name}</span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {preset.ratio}
                      </Badge>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-export-settings">
                  <Settings2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Export Settings</span>
                  {exportSettings.platform ? (
                    <Badge variant="secondary" className="text-xs">
                      {exportSettings.platform.name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {exportSettings.quality.name} • {exportSettings.fps.value}fps
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Platform Presets</DropdownMenuLabel>
                {PLATFORM_PRESETS.map((platform) => {
                  const PlatformIcon = platform.icon;
                  const isSelected = exportSettings.platform?.id === platform.id;
                  return (
                    <DropdownMenuItem
                      key={platform.id}
                      onClick={() => handlePlatformPreset(platform)}
                      className="gap-2"
                      data-testid={`menu-item-platform-${platform.id}`}
                    >
                      <PlatformIcon className="h-4 w-4" />
                      <div className="flex-1">
                        <span>{platform.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {platform.ratio} • {platform.quality}
                        </span>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                  );
                })}
                
                <DropdownMenuSeparator />
                
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger data-testid="menu-quality-submenu">
                    <Video className="h-4 w-4 mr-2" />
                    <span>Quality</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {exportSettings.quality.name}
                    </Badge>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {QUALITY_PRESETS.map((quality) => {
                        const isSelected = exportSettings.quality.name === quality.name;
                        return (
                          <DropdownMenuItem
                            key={quality.name}
                            onClick={() => handleQualityChange(quality)}
                            data-testid={`menu-item-quality-${quality.name}`}
                          >
                            <span className="flex-1">{quality.label}</span>
                            {isSelected && <Check className="h-4 w-4 text-primary" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger data-testid="menu-fps-submenu">
                    <Film className="h-4 w-4 mr-2" />
                    <span>Frame Rate</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {exportSettings.fps.value}fps
                    </Badge>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {FPS_PRESETS.map((fps) => {
                        const isSelected = exportSettings.fps.value === fps.value;
                        return (
                          <DropdownMenuItem
                            key={fps.name}
                            onClick={() => handleFPSChange(fps)}
                            data-testid={`menu-item-fps-${fps.value}`}
                          >
                            <span className="flex-1">{fps.label}</span>
                            {isSelected && <Check className="h-4 w-4 text-primary" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

            {isAuthenticated && (
              <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    data-testid="button-open-library"
                  >
                    <Library className="h-4 w-4" />
                    <span className="hidden sm:inline">My Library</span>
                    {totalMediaCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {totalMediaCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Library className="h-5 w-5" />
                      My Library
                    </SheetTitle>
                    <SheetDescription>
                      Copy URLs of your generated content to use in the editor. Paste URLs in the video, image, or audio panels.
                    </SheetDescription>
                  </SheetHeader>
                  
                  <Tabs defaultValue="videos" className="mt-6">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="videos" className="gap-1">
                        <Video className="h-4 w-4" />
                        Videos ({userMedia.videos.length})
                      </TabsTrigger>
                      <TabsTrigger value="images" className="gap-1">
                        <Image className="h-4 w-4" />
                        Images ({userMedia.images.length})
                      </TabsTrigger>
                      <TabsTrigger value="audio" className="gap-1">
                        <Music className="h-4 w-4" />
                        Audio ({userMedia.audio.length})
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="videos" className="mt-4">
                      <ScrollArea className="h-[calc(100vh-280px)]">
                        {userMedia.videos.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No videos yet</p>
                            <p className="text-sm">Generate videos to see them here</p>
                          </div>
                        ) : (
                          <div className="space-y-2 pr-4">
                            {userMedia.videos.map((item) => (
                              <LibraryItem key={item.id} item={item} onCopy={handleCopyUrl} />
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                    
                    <TabsContent value="images" className="mt-4">
                      <ScrollArea className="h-[calc(100vh-280px)]">
                        {userMedia.images.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No images yet</p>
                            <p className="text-sm">Generate images to see them here</p>
                          </div>
                        ) : (
                          <div className="space-y-2 pr-4">
                            {userMedia.images.map((item) => (
                              <LibraryItem key={item.id} item={item} onCopy={handleCopyUrl} />
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                    
                    <TabsContent value="audio" className="mt-4">
                      <ScrollArea className="h-[calc(100vh-280px)]">
                        {userMedia.audio.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Music className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No audio yet</p>
                            <p className="text-sm">Generate music or sound effects to see them here</p>
                          </div>
                        ) : (
                          <div className="space-y-2 pr-4">
                            {userMedia.audio.map((item) => (
                              <LibraryItem key={item.id} item={item} onCopy={handleCopyUrl} />
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </SheetContent>
              </Sheet>
            )}
            
            {exportedVideoUrl && (
              <a
                href={exportedVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                data-testid="button-download-video"
              >
                <Download className="h-4 w-4" />
                Download Video
              </a>
            )}
          </div>
        </div>

        {isExporting && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card border rounded-lg p-8 text-center space-y-4 max-w-md">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Exporting Video</h3>
                <p className="text-muted-foreground">{exportProgress}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                This may take a few minutes depending on video length.
              </p>
            </div>
          </div>
        )}

        {!isAuthenticated && (
          <Alert className="m-4 border-blue-500/50 bg-blue-500/10">
            <AlertCircle className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              You're exploring as a guest. Sign in to access your library, save projects, and export videos.
            </AlertDescription>
          </Alert>
        )}

        <div ref={editorContainerRef} className="flex-1 relative twick-studio-wrapper" data-testid="video-editor-container">
          <LivePlayerProvider>
            <TimelineProvider
              key={studioKey}
              initialData={INITIAL_TIMELINE_DATA}
              contextId="artivio-video-editor"
            >
              <TwickStudio
                studioConfig={{
                  videoProps: {
                    width: selectedCanvas.width,
                    height: selectedCanvas.height,
                  },
                  timelineTickConfigs: [
                    { durationThreshold: 30, majorInterval: 5, minorTicks: 5 },
                    { durationThreshold: 300, majorInterval: 30, minorTicks: 6 },
                  ],
                  timelineZoomConfig: {
                    min: 0.5,
                    max: 2.0,
                    step: 0.25,
                    default: 1.0,
                  },
                  exportVideo: handleExportVideo,
                }}
              />
            </TimelineProvider>
          </LivePlayerProvider>
        </div>

        <GuestGenerateModal
          open={showGuestModal}
          onOpenChange={setShowGuestModal}
          featureName="Video Editor"
        />

        <KeyboardShortcutsDialog
          open={shortcutsDialogOpen}
          onOpenChange={setShortcutsDialogOpen}
        />
      </div>
    </SidebarInset>
  );
}
