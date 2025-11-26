import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { LivePlayerProvider } from "@twick/live-player";
import { TwickStudio } from "@twick/studio";
import { TimelineProvider, INITIAL_TIMELINE_DATA } from "@twick/timeline";
import "@twick/studio/dist/studio.css";
import { SidebarInset } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Loader2, Download, Film, AlertCircle, Monitor, Smartphone, Square, 
  Library, Copy, Video, Image, Music, X, Check, Settings2, Keyboard,
  Save, FolderOpen, Trash2, MoreVertical, Plus, Cloud, CloudOff,
  LayoutTemplate, Play, Quote, Briefcase, User, FileVideo, Droplets,
  Type, ImageIcon, Palette
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
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

type WatermarkPosition = 
  | 'top-left' | 'top-center' | 'top-right' 
  | 'middle-left' | 'center' | 'middle-right' 
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

type WatermarkSettings = {
  enabled: boolean;
  type: 'text' | 'image';
  text?: string;
  imageUrl?: string;
  position: WatermarkPosition;
  opacity: number;
  fontSize?: number;
  color?: string;
};

const WATERMARK_POSITIONS: { id: WatermarkPosition; label: string; row: number; col: number }[] = [
  { id: 'top-left', label: 'Top Left', row: 0, col: 0 },
  { id: 'top-center', label: 'Top Center', row: 0, col: 1 },
  { id: 'top-right', label: 'Top Right', row: 0, col: 2 },
  { id: 'middle-left', label: 'Middle Left', row: 1, col: 0 },
  { id: 'center', label: 'Center', row: 1, col: 1 },
  { id: 'middle-right', label: 'Middle Right', row: 1, col: 2 },
  { id: 'bottom-left', label: 'Bottom Left', row: 2, col: 0 },
  { id: 'bottom-center', label: 'Bottom Center', row: 2, col: 1 },
  { id: 'bottom-right', label: 'Bottom Right', row: 2, col: 2 },
];

const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
  enabled: false,
  type: 'text',
  text: '',
  imageUrl: '',
  position: 'bottom-right',
  opacity: 70,
  fontSize: 24,
  color: '#ffffff',
};

const WATERMARK_STORAGE_KEY = 'artivio-watermark-settings';

const loadWatermarkSettings = (): WatermarkSettings => {
  try {
    const stored = localStorage.getItem(WATERMARK_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_WATERMARK_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load watermark settings:', e);
  }
  return DEFAULT_WATERMARK_SETTINGS;
};

const saveWatermarkSettings = (settings: WatermarkSettings) => {
  try {
    localStorage.setItem(WATERMARK_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save watermark settings:', e);
  }
};

type TemplateCategory = 'social-media' | 'business' | 'personal' | 'blank';

type VideoTemplate = {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  aspectRatio: '16:9' | '9:16' | '1:1';
  duration: number;
  icon: typeof SiYoutube | typeof Play | typeof Quote | typeof Briefcase | typeof User | typeof FileVideo | typeof Film;
  timelineData: any;
};

const TEMPLATE_CATEGORIES: { id: TemplateCategory; name: string; icon: typeof LayoutTemplate }[] = [
  { id: 'social-media', name: 'Social Media', icon: LayoutTemplate },
  { id: 'business', name: 'Business', icon: Briefcase },
  { id: 'personal', name: 'Personal', icon: User },
  { id: 'blank', name: 'Blank Canvas', icon: FileVideo },
];

const createTextElement = (id: string, text: string, options: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  textAlign?: string;
} = {}) => ({
  id,
  type: "text",
  name: text.substring(0, 20),
  x: options.x ?? 0,
  y: options.y ?? 0,
  width: options.width ?? 400,
  height: options.height ?? 100,
  rotation: 0,
  opacity: 1,
  details: {
    text,
    fontSize: options.fontSize ?? 48,
    fontFamily: "Inter",
    fontWeight: options.fontWeight ?? "700",
    color: options.color ?? "#ffffff",
    textAlign: options.textAlign ?? "center",
    lineHeight: 1.2,
  },
});

const createBackgroundElement = (id: string, color: string) => ({
  id,
  type: "shape",
  name: "Background",
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  rotation: 0,
  opacity: 1,
  details: {
    type: "rectangle",
    fill: color,
    stroke: "transparent",
    strokeWidth: 0,
  },
});

const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: 'youtube-intro',
    name: 'YouTube Intro',
    description: 'Professional intro with animated title, perfect for YouTube videos',
    category: 'social-media',
    aspectRatio: '16:9',
    duration: 5,
    icon: SiYoutube,
    timelineData: {
      tracks: [
        {
          id: "track-1",
          name: "Background",
          items: [
            {
              id: "bg-1",
              type: "element",
              elementId: "bg-element-1",
              start: 0,
              duration: 5000,
            },
          ],
        },
        {
          id: "track-2",
          name: "Title",
          items: [
            {
              id: "title-1",
              type: "element",
              elementId: "title-element-1",
              start: 500,
              duration: 4000,
            },
          ],
        },
        {
          id: "track-3",
          name: "Subtitle",
          items: [
            {
              id: "subtitle-1",
              type: "element",
              elementId: "subtitle-element-1",
              start: 1500,
              duration: 3000,
            },
          ],
        },
      ],
      elements: [
        createBackgroundElement("bg-element-1", "#1a1a2e"),
        { ...createTextElement("title-element-1", "YOUR CHANNEL NAME", { fontSize: 72, y: 400, x: 760, width: 400 }) },
        { ...createTextElement("subtitle-element-1", "Subscribe for more content", { fontSize: 28, fontWeight: "400", y: 500, x: 760, width: 400 }) },
      ],
      duration: 5000,
    },
  },
  {
    id: 'tiktok-story',
    name: 'TikTok Story',
    description: 'Vertical format with bold text overlay for TikTok and stories',
    category: 'social-media',
    aspectRatio: '9:16',
    duration: 15,
    icon: SiTiktok,
    timelineData: {
      tracks: [
        {
          id: "track-1",
          name: "Background",
          items: [
            {
              id: "bg-1",
              type: "element",
              elementId: "bg-element-1",
              start: 0,
              duration: 15000,
            },
          ],
        },
        {
          id: "track-2",
          name: "Hook Text",
          items: [
            {
              id: "hook-1",
              type: "element",
              elementId: "hook-element-1",
              start: 0,
              duration: 4000,
            },
          ],
        },
        {
          id: "track-3",
          name: "Main Content",
          items: [
            {
              id: "main-1",
              type: "element",
              elementId: "main-element-1",
              start: 4000,
              duration: 8000,
            },
          ],
        },
        {
          id: "track-4",
          name: "CTA",
          items: [
            {
              id: "cta-1",
              type: "element",
              elementId: "cta-element-1",
              start: 12000,
              duration: 3000,
            },
          ],
        },
      ],
      elements: [
        { ...createBackgroundElement("bg-element-1", "#0f0f0f"), width: 1080, height: 1920 },
        { ...createTextElement("hook-element-1", "Wait for it...", { fontSize: 56, y: 800, x: 340, width: 400 }) },
        { ...createTextElement("main-element-1", "Your amazing content goes here", { fontSize: 48, y: 850, x: 240, width: 600 }) },
        { ...createTextElement("cta-element-1", "Follow for more!", { fontSize: 42, y: 1600, x: 340, width: 400 }) },
      ],
      duration: 15000,
    },
  },
  {
    id: 'instagram-reel',
    name: 'Instagram Reel',
    description: 'Trendy vertical format with animated text for Instagram Reels',
    category: 'social-media',
    aspectRatio: '9:16',
    duration: 30,
    icon: SiInstagram,
    timelineData: {
      tracks: [
        {
          id: "track-1",
          name: "Background",
          items: [
            {
              id: "bg-1",
              type: "element",
              elementId: "bg-element-1",
              start: 0,
              duration: 30000,
            },
          ],
        },
        {
          id: "track-2",
          name: "Title",
          items: [
            {
              id: "title-1",
              type: "element",
              elementId: "title-element-1",
              start: 1000,
              duration: 6000,
            },
          ],
        },
        {
          id: "track-3",
          name: "Point 1",
          items: [
            {
              id: "point-1",
              type: "element",
              elementId: "point-element-1",
              start: 8000,
              duration: 6000,
            },
          ],
        },
        {
          id: "track-4",
          name: "Point 2",
          items: [
            {
              id: "point-2",
              type: "element",
              elementId: "point-element-2",
              start: 15000,
              duration: 6000,
            },
          ],
        },
        {
          id: "track-5",
          name: "Point 3",
          items: [
            {
              id: "point-3",
              type: "element",
              elementId: "point-element-3",
              start: 22000,
              duration: 8000,
            },
          ],
        },
      ],
      elements: [
        { ...createBackgroundElement("bg-element-1", "#1e1e1e"), width: 1080, height: 1920 },
        { ...createTextElement("title-element-1", "3 Things You Need to Know", { fontSize: 52, y: 850, x: 140, width: 800 }) },
        { ...createTextElement("point-element-1", "1. First important point", { fontSize: 44, y: 900, x: 140, width: 800 }) },
        { ...createTextElement("point-element-2", "2. Second key insight", { fontSize: 44, y: 900, x: 140, width: 800 }) },
        { ...createTextElement("point-element-3", "3. Final takeaway", { fontSize: 44, y: 900, x: 140, width: 800 }) },
      ],
      duration: 30000,
    },
  },
  {
    id: 'instagram-post',
    name: 'Instagram Post',
    description: 'Square format with clean layout for Instagram feed posts',
    category: 'social-media',
    aspectRatio: '1:1',
    duration: 10,
    icon: SiInstagram,
    timelineData: {
      tracks: [
        {
          id: "track-1",
          name: "Background",
          items: [
            {
              id: "bg-1",
              type: "element",
              elementId: "bg-element-1",
              start: 0,
              duration: 10000,
            },
          ],
        },
        {
          id: "track-2",
          name: "Main Text",
          items: [
            {
              id: "main-1",
              type: "element",
              elementId: "main-element-1",
              start: 500,
              duration: 9000,
            },
          ],
        },
        {
          id: "track-3",
          name: "Handle",
          items: [
            {
              id: "handle-1",
              type: "element",
              elementId: "handle-element-1",
              start: 500,
              duration: 9000,
            },
          ],
        },
      ],
      elements: [
        { ...createBackgroundElement("bg-element-1", "#262626"), width: 1080, height: 1080 },
        { ...createTextElement("main-element-1", "Your Message Here", { fontSize: 64, y: 450, x: 240, width: 600 }) },
        { ...createTextElement("handle-element-1", "@yourhandle", { fontSize: 28, fontWeight: "400", y: 950, x: 340, width: 400 }) },
      ],
      duration: 10000,
    },
  },
  {
    id: 'twitter-video',
    name: 'Twitter/X Video',
    description: 'Landscape format optimized for Twitter/X video posts',
    category: 'social-media',
    aspectRatio: '16:9',
    duration: 30,
    icon: SiX,
    timelineData: {
      tracks: [
        {
          id: "track-1",
          name: "Background",
          items: [
            {
              id: "bg-1",
              type: "element",
              elementId: "bg-element-1",
              start: 0,
              duration: 30000,
            },
          ],
        },
        {
          id: "track-2",
          name: "Main Message",
          items: [
            {
              id: "main-1",
              type: "element",
              elementId: "main-element-1",
              start: 1000,
              duration: 28000,
            },
          ],
        },
        {
          id: "track-3",
          name: "Subtitle",
          items: [
            {
              id: "subtitle-1",
              type: "element",
              elementId: "subtitle-element-1",
              start: 2000,
              duration: 27000,
            },
          ],
        },
      ],
      elements: [
        createBackgroundElement("bg-element-1", "#15202b"),
        { ...createTextElement("main-element-1", "Your Tweet Video", { fontSize: 64, y: 450, x: 560, width: 800 }) },
        { ...createTextElement("subtitle-element-1", "Engage your audience", { fontSize: 32, fontWeight: "400", y: 550, x: 560, width: 800 }) },
      ],
      duration: 30000,
    },
  },
  {
    id: 'product-showcase',
    name: 'Product Showcase',
    description: 'Professional product presentation with multiple scene placeholders',
    category: 'business',
    aspectRatio: '16:9',
    duration: 30,
    icon: Briefcase,
    timelineData: {
      tracks: [
        {
          id: "track-1",
          name: "Background",
          items: [
            {
              id: "bg-1",
              type: "element",
              elementId: "bg-element-1",
              start: 0,
              duration: 30000,
            },
          ],
        },
        {
          id: "track-2",
          name: "Product Name",
          items: [
            {
              id: "product-1",
              type: "element",
              elementId: "product-element-1",
              start: 0,
              duration: 8000,
            },
          ],
        },
        {
          id: "track-3",
          name: "Feature 1",
          items: [
            {
              id: "feature-1",
              type: "element",
              elementId: "feature-element-1",
              start: 8000,
              duration: 7000,
            },
          ],
        },
        {
          id: "track-4",
          name: "Feature 2",
          items: [
            {
              id: "feature-2",
              type: "element",
              elementId: "feature-element-2",
              start: 15000,
              duration: 7000,
            },
          ],
        },
        {
          id: "track-5",
          name: "CTA",
          items: [
            {
              id: "cta-1",
              type: "element",
              elementId: "cta-element-1",
              start: 22000,
              duration: 8000,
            },
          ],
        },
      ],
      elements: [
        createBackgroundElement("bg-element-1", "#111827"),
        { ...createTextElement("product-element-1", "Product Name", { fontSize: 72, y: 400, x: 660, width: 600 }) },
        { ...createTextElement("feature-element-1", "Feature One: Description", { fontSize: 48, y: 450, x: 460, width: 1000 }) },
        { ...createTextElement("feature-element-2", "Feature Two: Description", { fontSize: 48, y: 450, x: 460, width: 1000 }) },
        { ...createTextElement("cta-element-1", "Get Started Today", { fontSize: 56, y: 450, x: 560, width: 800 }) },
      ],
      duration: 30000,
    },
  },
  {
    id: 'testimonial',
    name: 'Testimonial',
    description: 'Quote layout with customer name for testimonial videos',
    category: 'business',
    aspectRatio: '16:9',
    duration: 15,
    icon: Quote,
    timelineData: {
      tracks: [
        {
          id: "track-1",
          name: "Background",
          items: [
            {
              id: "bg-1",
              type: "element",
              elementId: "bg-element-1",
              start: 0,
              duration: 15000,
            },
          ],
        },
        {
          id: "track-2",
          name: "Quote",
          items: [
            {
              id: "quote-1",
              type: "element",
              elementId: "quote-element-1",
              start: 1000,
              duration: 12000,
            },
          ],
        },
        {
          id: "track-3",
          name: "Author",
          items: [
            {
              id: "author-1",
              type: "element",
              elementId: "author-element-1",
              start: 2000,
              duration: 11000,
            },
          ],
        },
        {
          id: "track-4",
          name: "Company",
          items: [
            {
              id: "company-1",
              type: "element",
              elementId: "company-element-1",
              start: 2500,
              duration: 10500,
            },
          ],
        },
      ],
      elements: [
        createBackgroundElement("bg-element-1", "#1f2937"),
        { ...createTextElement("quote-element-1", "\"This product changed everything for our business.\"", { fontSize: 42, y: 380, x: 260, width: 1400 }) },
        { ...createTextElement("author-element-1", "— Jane Smith", { fontSize: 32, fontWeight: "600", y: 520, x: 260, width: 1400 }) },
        { ...createTextElement("company-element-1", "CEO, Example Company", { fontSize: 24, fontWeight: "400", color: "#9ca3af", y: 570, x: 260, width: 1400 }) },
      ],
      duration: 15000,
    },
  },
  {
    id: 'birthday-greeting',
    name: 'Birthday Greeting',
    description: 'Celebratory video greeting with animated text for birthdays',
    category: 'personal',
    aspectRatio: '16:9',
    duration: 15,
    icon: User,
    timelineData: {
      tracks: [
        {
          id: "track-1",
          name: "Background",
          items: [
            {
              id: "bg-1",
              type: "element",
              elementId: "bg-element-1",
              start: 0,
              duration: 15000,
            },
          ],
        },
        {
          id: "track-2",
          name: "Greeting",
          items: [
            {
              id: "greeting-1",
              type: "element",
              elementId: "greeting-element-1",
              start: 500,
              duration: 5000,
            },
          ],
        },
        {
          id: "track-3",
          name: "Name",
          items: [
            {
              id: "name-1",
              type: "element",
              elementId: "name-element-1",
              start: 6000,
              duration: 8000,
            },
          ],
        },
        {
          id: "track-4",
          name: "Message",
          items: [
            {
              id: "message-1",
              type: "element",
              elementId: "message-element-1",
              start: 8000,
              duration: 6000,
            },
          ],
        },
      ],
      elements: [
        createBackgroundElement("bg-element-1", "#7c3aed"),
        { ...createTextElement("greeting-element-1", "Happy Birthday!", { fontSize: 80, y: 400, x: 460, width: 1000 }) },
        { ...createTextElement("name-element-1", "Dear [Name]", { fontSize: 56, y: 450, x: 560, width: 800 }) },
        { ...createTextElement("message-element-1", "Wishing you all the best!", { fontSize: 36, fontWeight: "400", y: 550, x: 560, width: 800 }) },
      ],
      duration: 15000,
    },
  },
  {
    id: 'personal-vlog',
    name: 'Personal Vlog',
    description: 'Clean intro for personal vlogs and casual content',
    category: 'personal',
    aspectRatio: '16:9',
    duration: 10,
    icon: Film,
    timelineData: {
      tracks: [
        {
          id: "track-1",
          name: "Background",
          items: [
            {
              id: "bg-1",
              type: "element",
              elementId: "bg-element-1",
              start: 0,
              duration: 10000,
            },
          ],
        },
        {
          id: "track-2",
          name: "Vlog Title",
          items: [
            {
              id: "title-1",
              type: "element",
              elementId: "title-element-1",
              start: 1000,
              duration: 8000,
            },
          ],
        },
        {
          id: "track-3",
          name: "Date/Episode",
          items: [
            {
              id: "date-1",
              type: "element",
              elementId: "date-element-1",
              start: 2000,
              duration: 7000,
            },
          ],
        },
      ],
      elements: [
        createBackgroundElement("bg-element-1", "#18181b"),
        { ...createTextElement("title-element-1", "My Vlog", { fontSize: 72, y: 420, x: 660, width: 600 }) },
        { ...createTextElement("date-element-1", "Episode 1 | Today's Date", { fontSize: 28, fontWeight: "400", color: "#a1a1aa", y: 520, x: 560, width: 800 }) },
      ],
      duration: 10000,
    },
  },
  {
    id: 'blank-landscape',
    name: 'Blank Landscape',
    description: 'Start with a clean 16:9 canvas for custom creations',
    category: 'blank',
    aspectRatio: '16:9',
    duration: 10,
    icon: FileVideo,
    timelineData: {
      tracks: [
        {
          id: "track-1",
          name: "Background",
          items: [
            {
              id: "bg-1",
              type: "element",
              elementId: "bg-element-1",
              start: 0,
              duration: 10000,
            },
          ],
        },
      ],
      elements: [
        createBackgroundElement("bg-element-1", "#000000"),
      ],
      duration: 10000,
    },
  },
  {
    id: 'blank-portrait',
    name: 'Blank Portrait',
    description: 'Start with a clean 9:16 canvas for vertical videos',
    category: 'blank',
    aspectRatio: '9:16',
    duration: 10,
    icon: FileVideo,
    timelineData: {
      tracks: [
        {
          id: "track-1",
          name: "Background",
          items: [
            {
              id: "bg-1",
              type: "element",
              elementId: "bg-element-1",
              start: 0,
              duration: 10000,
            },
          ],
        },
      ],
      elements: [
        { ...createBackgroundElement("bg-element-1", "#000000"), width: 1080, height: 1920 },
      ],
      duration: 10000,
    },
  },
  {
    id: 'blank-square',
    name: 'Blank Square',
    description: 'Start with a clean 1:1 canvas for square videos',
    category: 'blank',
    aspectRatio: '1:1',
    duration: 10,
    icon: FileVideo,
    timelineData: {
      tracks: [
        {
          id: "track-1",
          name: "Background",
          items: [
            {
              id: "bg-1",
              type: "element",
              elementId: "bg-element-1",
              start: 0,
              duration: 10000,
            },
          ],
        },
      ],
      elements: [
        { ...createBackgroundElement("bg-element-1", "#000000"), width: 1080, height: 1080 },
      ],
      duration: 10000,
    },
  },
];

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

type VideoProject = {
  id: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  timelineData: any;
  settings: any;
  isTemplate: boolean;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

const saveProjectSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(1000).optional(),
  isTemplate: z.boolean().default(false),
});

type SaveProjectFormData = z.infer<typeof saveProjectSchema>;

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

function WatermarkPositionGrid({
  value,
  onChange,
}: {
  value: WatermarkPosition;
  onChange: (position: WatermarkPosition) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 w-24 h-16 border rounded-md p-1 bg-muted/50">
      {WATERMARK_POSITIONS.map((pos) => (
        <button
          key={pos.id}
          type="button"
          onClick={() => onChange(pos.id)}
          className={`w-full h-full rounded-sm transition-colors ${
            value === pos.id
              ? 'bg-primary'
              : 'bg-background hover:bg-accent'
          }`}
          title={pos.label}
          data-testid={`watermark-position-${pos.id}`}
        />
      ))}
    </div>
  );
}

function WatermarkConfigDialog({
  open,
  onOpenChange,
  watermarkSettings,
  onWatermarkChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  watermarkSettings: WatermarkSettings;
  onWatermarkChange: (settings: WatermarkSettings) => void;
}) {
  const [localSettings, setLocalSettings] = useState(watermarkSettings);

  useEffect(() => {
    if (open) {
      setLocalSettings(watermarkSettings);
    }
  }, [open, watermarkSettings]);

  const handleSave = () => {
    onWatermarkChange(localSettings);
    onOpenChange(false);
  };

  const updateLocalSettings = (updates: Partial<WatermarkSettings>) => {
    setLocalSettings(prev => ({ ...prev, ...updates }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5" />
            Watermark Settings
          </DialogTitle>
          <DialogDescription>
            Add a watermark to your exported video. Text or image watermarks are supported.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="watermark-enabled" className="text-sm font-medium">
              Enable Watermark
            </Label>
            <Switch
              id="watermark-enabled"
              checked={localSettings.enabled}
              onCheckedChange={(checked) => updateLocalSettings({ enabled: checked })}
              data-testid="switch-watermark-enabled"
            />
          </div>

          {localSettings.enabled && (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-medium">Watermark Type</Label>
                <RadioGroup
                  value={localSettings.type}
                  onValueChange={(value: 'text' | 'image') => updateLocalSettings({ type: value })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="text" id="type-text" data-testid="radio-watermark-text" />
                    <Label htmlFor="type-text" className="flex items-center gap-1.5 cursor-pointer">
                      <Type className="h-4 w-4" />
                      Text
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="image" id="type-image" data-testid="radio-watermark-image" />
                    <Label htmlFor="type-image" className="flex items-center gap-1.5 cursor-pointer">
                      <ImageIcon className="h-4 w-4" />
                      Image
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {localSettings.type === 'text' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="watermark-text" className="text-sm font-medium">
                      Watermark Text
                    </Label>
                    <Input
                      id="watermark-text"
                      value={localSettings.text || ''}
                      onChange={(e) => updateLocalSettings({ text: e.target.value })}
                      placeholder="Your brand name..."
                      data-testid="input-watermark-text"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="font-size" className="text-sm font-medium">
                        Font Size
                      </Label>
                      <Select
                        value={String(localSettings.fontSize || 24)}
                        onValueChange={(value) => updateLocalSettings({ fontSize: parseInt(value) })}
                      >
                        <SelectTrigger id="font-size" data-testid="select-font-size">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[12, 16, 20, 24, 28, 32, 36, 48, 64].map((size) => (
                            <SelectItem key={size} value={String(size)}>
                              {size}px
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="watermark-color" className="text-sm font-medium flex items-center gap-1.5">
                        <Palette className="h-3.5 w-3.5" />
                        Color
                      </Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          id="watermark-color"
                          value={localSettings.color || '#ffffff'}
                          onChange={(e) => updateLocalSettings({ color: e.target.value })}
                          className="w-8 h-8 rounded border cursor-pointer"
                          data-testid="input-watermark-color"
                        />
                        <Input
                          value={localSettings.color || '#ffffff'}
                          onChange={(e) => updateLocalSettings({ color: e.target.value })}
                          placeholder="#ffffff"
                          className="flex-1"
                          data-testid="input-watermark-color-hex"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="watermark-image-url" className="text-sm font-medium">
                    Image URL
                  </Label>
                  <Input
                    id="watermark-image-url"
                    value={localSettings.imageUrl || ''}
                    onChange={(e) => updateLocalSettings({ imageUrl: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    data-testid="input-watermark-image-url"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a URL to your logo or watermark image. PNG with transparency works best.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Position</Label>
                  <span className="text-xs text-muted-foreground">
                    {WATERMARK_POSITIONS.find(p => p.id === localSettings.position)?.label}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <WatermarkPositionGrid
                    value={localSettings.position}
                    onChange={(position) => updateLocalSettings({ position })}
                  />
                  <div className="flex-1 aspect-video rounded-md border bg-muted/30 relative overflow-hidden">
                    <div
                      className={`absolute w-6 h-3 bg-primary/70 rounded-sm transition-all ${
                        localSettings.position.includes('top') ? 'top-1' : 
                        localSettings.position.includes('middle') ? 'top-1/2 -translate-y-1/2' : 'bottom-1'
                      } ${
                        localSettings.position.includes('left') ? 'left-1' :
                        localSettings.position.includes('center') || localSettings.position === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-1'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Opacity</Label>
                  <span className="text-sm text-muted-foreground">{localSettings.opacity}%</span>
                </div>
                <Slider
                  value={[localSettings.opacity]}
                  onValueChange={([value]) => updateLocalSettings({ opacity: value })}
                  min={10}
                  max={100}
                  step={5}
                  data-testid="slider-watermark-opacity"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-watermark-cancel"
          >
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-watermark-save">
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  template,
  onSelect,
}: {
  template: VideoTemplate;
  onSelect: (template: VideoTemplate) => void;
}) {
  const Icon = template.icon;

  return (
    <button
      onClick={() => onSelect(template)}
      className="flex flex-col items-start gap-3 p-4 rounded-lg border bg-card hover-elevate transition-all text-left w-full group"
      data-testid={`template-card-${template.id}`}
    >
      <div className="w-full aspect-video rounded-md bg-muted flex items-center justify-center relative overflow-hidden">
        <Icon className="h-8 w-8 text-muted-foreground" />
        <Badge 
          variant="secondary" 
          className="absolute top-2 right-2 text-xs"
        >
          {template.aspectRatio}
        </Badge>
      </div>
      <div className="w-full">
        <h4 className="text-sm font-medium group-hover:text-primary transition-colors">
          {template.name}
        </h4>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {template.description}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-xs">
            {template.duration}s
          </Badge>
        </div>
      </div>
    </button>
  );
}

function TemplatesSheet({
  open,
  onOpenChange,
  onSelectTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: VideoTemplate) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') {
      return VIDEO_TEMPLATES;
    }
    return VIDEO_TEMPLATES.filter(t => t.category === selectedCategory);
  }, [selectedCategory]);

  const handleSelectTemplate = (template: VideoTemplate) => {
    onSelectTemplate(template);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5" />
            Video Templates
          </SheetTitle>
          <SheetDescription>
            Choose a template to start your project quickly. Templates set up the canvas and add sample elements.
          </SheetDescription>
        </SheetHeader>

        <Tabs 
          defaultValue="all" 
          className="mt-6"
          onValueChange={(v) => setSelectedCategory(v as TemplateCategory | 'all')}
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
            {TEMPLATE_CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id} className="text-xs">
                {cat.name.split(' ')[0]}
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="h-[calc(100vh-280px)] mt-4">
            <div className="grid grid-cols-2 gap-3 pr-4">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={handleSelectTemplate}
                />
              ))}
            </div>

            {filteredTemplates.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <LayoutTemplate className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No templates in this category</p>
              </div>
            )}
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function ApplyTemplateDialog({
  open,
  onOpenChange,
  template,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: VideoTemplate | null;
  onConfirm: () => void;
}) {
  if (!template) return null;

  const Icon = template.icon;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            Apply Template
          </AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes in your current project. Applying the "{template.name}" template will replace your current work.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-apply-template">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            data-testid="button-confirm-apply-template"
          >
            Apply Template
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SaveProjectDialog({
  open,
  onOpenChange,
  currentProject,
  timelineData,
  settings,
  onSaveSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProject: VideoProject | null;
  timelineData: any;
  settings: any;
  onSaveSuccess: (project: VideoProject) => void;
}) {
  const { toast } = useToast();
  
  const form = useForm<SaveProjectFormData>({
    resolver: zodResolver(saveProjectSchema),
    defaultValues: {
      title: currentProject?.title || "",
      description: currentProject?.description || "",
      isTemplate: currentProject?.isTemplate || false,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: currentProject?.title || "",
        description: currentProject?.description || "",
        isTemplate: currentProject?.isTemplate || false,
      });
    }
  }, [open, currentProject, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: SaveProjectFormData) => {
      const payload = {
        ...data,
        timelineData,
        settings,
      };

      if (currentProject) {
        const response = await apiRequest("PATCH", `/api/editor/projects/${currentProject.id}`, payload);
        return response.json();
      } else {
        const response = await apiRequest("POST", "/api/editor/projects", payload);
        return response.json();
      }
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['/api/editor/projects'] });
      toast({
        title: "Project Saved",
        description: `"${project.title}" has been saved successfully.`,
      });
      onSaveSuccess(project);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save project",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SaveProjectFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            {currentProject ? "Update Project" : "Save Project"}
          </DialogTitle>
          <DialogDescription>
            {currentProject 
              ? "Update your project with the latest changes."
              : "Save your project to access it later."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Title</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="My Awesome Video" 
                      {...field} 
                      data-testid="input-project-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add a description for your project..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      data-testid="input-project-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isTemplate"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-save-as-template"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Save as Template</FormLabel>
                    <FormDescription>
                      Make this project available as a starting point for new projects.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-save"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saveMutation.isPending}
                data-testid="button-save-project"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {currentProject ? "Update" : "Save"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
  onDuplicate,
}: {
  project: VideoProject;
  onOpen: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div 
      className="flex items-center gap-4 p-4 rounded-lg border bg-card hover-elevate transition-colors"
      data-testid={`project-card-${project.id}`}
    >
      <div className="w-20 h-14 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
        {project.thumbnailUrl ? (
          <img 
            src={project.thumbnailUrl} 
            alt={project.title}
            className="w-full h-full object-cover rounded-md"
          />
        ) : (
          <Film className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium truncate">{project.title}</h4>
          {project.isTemplate && (
            <Badge variant="secondary" className="text-xs">Template</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Last modified: {new Date(project.updatedAt).toLocaleDateString()}
        </p>
        {project.description && (
          <p className="text-xs text-muted-foreground truncate mt-1">
            {project.description}
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button 
          variant="default" 
          size="sm" 
          onClick={onOpen}
          data-testid={`button-open-project-${project.id}`}
        >
          Open
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              data-testid={`button-project-menu-${project.id}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={onDuplicate}
              data-testid={`button-duplicate-project-${project.id}`}
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
              data-testid={`button-delete-project-${project.id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ProjectsDialog({
  open,
  onOpenChange,
  onOpenProject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenProject: (project: VideoProject) => void;
}) {
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<VideoProject | null>(null);

  const { data: projects, isLoading } = useQuery<VideoProject[]>({
    queryKey: ['/api/editor/projects'],
    enabled: open,
  });

  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      await apiRequest("DELETE", `/api/editor/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/editor/projects'] });
      toast({
        title: "Project Deleted",
        description: "The project has been deleted.",
      });
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete project",
        variant: "destructive",
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (project: VideoProject) => {
      const response = await apiRequest("POST", "/api/editor/projects", {
        title: `${project.title} (Copy)`,
        description: project.description,
        timelineData: project.timelineData,
        settings: project.settings,
        isTemplate: false,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/editor/projects'] });
      toast({
        title: "Project Duplicated",
        description: "A copy of the project has been created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Duplicate Failed",
        description: error.message || "Failed to duplicate project",
        variant: "destructive",
      });
    },
  });

  const handleOpenProject = (project: VideoProject) => {
    onOpenProject(project);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              My Projects
            </DialogTitle>
            <DialogDescription>
              Open, manage, or duplicate your saved video projects.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
                    <Skeleton className="w-20 h-14 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-9 w-16" />
                  </div>
                ))}
              </div>
            ) : !projects || projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No projects yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Save your first project to see it here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={() => handleOpenProject(project)}
                    onDelete={() => setDeleteConfirm(project)}
                    onDuplicate={() => duplicateMutation.mutate(project)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SaveStatusIndicator({ 
  hasUnsavedChanges,
  currentProject,
}: { 
  hasUnsavedChanges: boolean;
  currentProject: VideoProject | null;
}) {
  if (!currentProject && !hasUnsavedChanges) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {currentProject && (
        <span className="text-muted-foreground truncate max-w-32">
          {currentProject.title}
        </span>
      )}
      {hasUnsavedChanges ? (
        <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-600">
          <CloudOff className="h-3 w-3" />
          <span className="hidden sm:inline">Unsaved</span>
        </Badge>
      ) : currentProject ? (
        <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
          <Cloud className="h-3 w-3" />
          <span className="hidden sm:inline">Saved</span>
        </Badge>
      ) : null}
    </div>
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
  const [watermarkSettings, setWatermarkSettings] = useState<WatermarkSettings>(loadWatermarkSettings);
  const [watermarkDialogOpen, setWatermarkDialogOpen] = useState(false);
  
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [projectsDialogOpen, setProjectsDialogOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<VideoProject | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadedTimelineData, setLoadedTimelineData] = useState<any>(null);
  
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<VideoTemplate | null>(null);
  const [confirmTemplateOpen, setConfirmTemplateOpen] = useState(false);
  
  const currentTimelineDataRef = useRef<any>(INITIAL_TIMELINE_DATA);
  const lastSavedDataRef = useRef<string>("");
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const handleOpenSaveDialog = useCallback(() => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }
    setSaveDialogOpen(true);
  }, [isAuthenticated]);

  useKeyboardShortcuts({
    onSave: handleOpenSaveDialog,
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

  const checkForChanges = useCallback(() => {
    const currentData = JSON.stringify(currentTimelineDataRef.current);
    const hasChanges = currentData !== lastSavedDataRef.current;
    setHasUnsavedChanges(hasChanges);
  }, []);

  useEffect(() => {
    const interval = setInterval(checkForChanges, 2000);
    return () => clearInterval(interval);
  }, [checkForChanges]);

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
    setHasUnsavedChanges(true);
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

  const handleWatermarkChange = (settings: WatermarkSettings) => {
    setWatermarkSettings(settings);
    saveWatermarkSettings(settings);
    toast({
      title: settings.enabled ? "Watermark Updated" : "Watermark Disabled",
      description: settings.enabled 
        ? `${settings.type === 'text' ? 'Text' : 'Image'} watermark set to ${WATERMARK_POSITIONS.find(p => p.id === settings.position)?.label}`
        : "Watermark has been disabled for exports",
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

  const applyTemplate = useCallback((template: VideoTemplate) => {
    const matchingCanvas = CANVAS_PRESETS.find(
      c => c.ratio === template.aspectRatio
    );
    
    if (matchingCanvas) {
      setSelectedCanvas(matchingCanvas);
    }
    
    setLoadedTimelineData(template.timelineData);
    currentTimelineDataRef.current = template.timelineData;
    lastSavedDataRef.current = "";
    setHasUnsavedChanges(true);
    setCurrentProject(null);
    setStudioKey(prev => prev + 1);
    
    toast({
      title: "Template Applied",
      description: `"${template.name}" template has been loaded. Canvas set to ${template.aspectRatio}.`,
    });
  }, [toast]);

  const handleSelectTemplate = useCallback((template: VideoTemplate) => {
    if (hasUnsavedChanges) {
      setPendingTemplate(template);
      setConfirmTemplateOpen(true);
    } else {
      applyTemplate(template);
    }
  }, [hasUnsavedChanges, applyTemplate]);

  const handleConfirmApplyTemplate = useCallback(() => {
    if (pendingTemplate) {
      applyTemplate(pendingTemplate);
      setPendingTemplate(null);
      setConfirmTemplateOpen(false);
    }
  }, [pendingTemplate, applyTemplate]);

  const handleSaveSuccess = useCallback((project: VideoProject) => {
    setCurrentProject(project);
    lastSavedDataRef.current = JSON.stringify(currentTimelineDataRef.current);
    setHasUnsavedChanges(false);
  }, []);

  const handleOpenProject = useCallback((project: VideoProject) => {
    setCurrentProject(project);
    setLoadedTimelineData(project.timelineData);
    currentTimelineDataRef.current = project.timelineData;
    lastSavedDataRef.current = JSON.stringify(project.timelineData);
    setHasUnsavedChanges(false);
    
    if (project.settings?.canvasWidth && project.settings?.canvasHeight) {
      const matchingCanvas = CANVAS_PRESETS.find(
        c => c.width === project.settings.canvasWidth && c.height === project.settings.canvasHeight
      );
      if (matchingCanvas) {
        setSelectedCanvas(matchingCanvas);
      }
    }
    
    setStudioKey(prev => prev + 1);
    
    toast({
      title: "Project Loaded",
      description: `"${project.title}" has been loaded.`,
    });
  }, [toast]);

  const handleExportVideo = async (project: any, videoSettings: any) => {
    currentTimelineDataRef.current = project;
    setHasUnsavedChanges(true);
    
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
        watermarkSettings: watermarkSettings.enabled ? watermarkSettings : null,
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

  const currentSettings = useMemo(() => ({
    canvasWidth: selectedCanvas.width,
    canvasHeight: selectedCanvas.height,
    quality: exportSettings.quality.name,
    fps: exportSettings.fps.value,
  }), [selectedCanvas, exportSettings]);

  const initialTimelineData = loadedTimelineData || INITIAL_TIMELINE_DATA;

  return (
    <SidebarInset>
      <div className="flex flex-col h-full w-full">
        <div className="flex items-center justify-between p-4 border-b flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Film className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Video Editor</h1>
            </div>
            {isAuthenticated && (
              <SaveStatusIndicator 
                hasUnsavedChanges={hasUnsavedChanges} 
                currentProject={currentProject}
              />
            )}
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

            <Button
              variant="outline"
              size="sm"
              onClick={() => setTemplatesOpen(true)}
              className="gap-2"
              data-testid="button-templates"
            >
              <LayoutTemplate className="h-4 w-4" />
              <span className="hidden sm:inline">Templates</span>
            </Button>

            {isAuthenticated && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenSaveDialog}
                  className="gap-2"
                  data-testid="button-save-project"
                >
                  <Save className="h-4 w-4" />
                  <span className="hidden sm:inline">Save</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setProjectsDialogOpen(true)}
                  className="gap-2"
                  data-testid="button-my-projects"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">My Projects</span>
                </Button>
              </>
            )}

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
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem
                  onClick={() => setWatermarkDialogOpen(true)}
                  className="gap-2"
                  data-testid="menu-item-watermark"
                >
                  <Droplets className="h-4 w-4" />
                  <div className="flex-1">
                    <span>Watermark</span>
                  </div>
                  <Badge 
                    variant={watermarkSettings.enabled ? "default" : "outline"} 
                    className="text-xs"
                  >
                    {watermarkSettings.enabled ? 'On' : 'Off'}
                  </Badge>
                </DropdownMenuItem>
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
              initialData={initialTimelineData}
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

        <SaveProjectDialog
          open={saveDialogOpen}
          onOpenChange={setSaveDialogOpen}
          currentProject={currentProject}
          timelineData={currentTimelineDataRef.current}
          settings={currentSettings}
          onSaveSuccess={handleSaveSuccess}
        />

        <ProjectsDialog
          open={projectsDialogOpen}
          onOpenChange={setProjectsDialogOpen}
          onOpenProject={handleOpenProject}
        />

        <TemplatesSheet
          open={templatesOpen}
          onOpenChange={setTemplatesOpen}
          onSelectTemplate={handleSelectTemplate}
        />

        <ApplyTemplateDialog
          open={confirmTemplateOpen}
          onOpenChange={setConfirmTemplateOpen}
          template={pendingTemplate}
          onConfirm={handleConfirmApplyTemplate}
        />

        <WatermarkConfigDialog
          open={watermarkDialogOpen}
          onOpenChange={setWatermarkDialogOpen}
          watermarkSettings={watermarkSettings}
          onWatermarkChange={handleWatermarkChange}
        />
      </div>
    </SidebarInset>
  );
}
