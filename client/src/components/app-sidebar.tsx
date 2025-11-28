import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Home,
  Video,
  Image as ImageIcon,
  Music,
  MessageSquare,
  Mic,
  Headphones,
  ScanEye,
  UserCircle,
  AudioWaveform,
  Sparkles,
  Mic2,
  QrCode,
  Zap,
  Library,
  Settings,
  CreditCard,
  Shield,
  ArrowLeftRight,
  DollarSign,
  Film,
  ChevronDown,
  Volume2,
  Eraser,
  Maximize,
  Users,
} from "lucide-react";
import { CreditDisplay } from "@/components/credit-display";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type CategoryType = 'main' | 'video' | 'image' | 'audio' | 'tools' | 'community' | 'account';

interface MenuItem {
  title: string;
  url: string;
  icon: any;
}

interface MenuSection {
  label: string;
  category: CategoryType;
  items: MenuItem[];
}

const categoryGradients: Record<CategoryType, string> = {
  main: "from-gray-400 to-gray-600",
  video: "from-blue-400 to-cyan-500",
  image: "from-pink-400 to-rose-500",
  audio: "from-purple-400 to-violet-500",
  tools: "from-emerald-400 to-teal-500",
  community: "from-orange-400 to-amber-500",
  account: "from-slate-400 to-zinc-500",
};

const categoryIconColors: Record<CategoryType, string> = {
  main: "text-gray-400",
  video: "text-blue-400",
  image: "text-pink-400",
  audio: "text-purple-400",
  tools: "text-emerald-400",
  community: "text-orange-400",
  account: "text-slate-400",
};

const menuSections: MenuSection[] = [
  {
    label: "Main",
    category: "main",
    items: [
      { title: "Home", url: "/", icon: Home },
      { title: "My Library", url: "/history", icon: Library },
    ],
  },
  {
    label: "Video",
    category: "video",
    items: [
      { title: "Video Generation", url: "/generate/video", icon: Video },
      { title: "Video Editor", url: "/video-editor", icon: Film },
      { title: "Transition", url: "/generate/transition", icon: ArrowLeftRight },
      { title: "Sora 2 Pro", url: "/generate/sora", icon: Sparkles },
      { title: "Talking Avatars", url: "/talking-avatars", icon: UserCircle },
      { title: "Video Upscaler", url: "/topaz-video-upscaler", icon: Maximize },
    ],
  },
  {
    label: "Image",
    category: "image",
    items: [
      { title: "Image Generation", url: "/generate/image", icon: ImageIcon },
      { title: "Image Analysis", url: "/analyze-image", icon: ScanEye },
      { title: "Image Upscaler", url: "/topaz-upscaler", icon: Zap },
      { title: "Background Remover", url: "/background-remover", icon: Eraser },
    ],
  },
  {
    label: "Audio & Music",
    category: "audio",
    items: [
      { title: "Music Generation", url: "/generate/music", icon: Music },
      { title: "Sound Effects", url: "/sound-effects", icon: Volume2 },
      { title: "Voice Cloning", url: "/voice-clone", icon: Mic },
      { title: "Text to Speech", url: "/text-to-speech", icon: Headphones },
      { title: "Story Studio", url: "/story-studio", icon: Sparkles },
      { title: "Speech to Text", url: "/speech-to-text", icon: Mic2 },
      { title: "Audio Converter", url: "/audio-converter", icon: AudioWaveform },
      { title: "Lip Sync", url: "/lip-sync", icon: Video },
    ],
  },
  {
    label: "Tools",
    category: "tools",
    items: [
      { title: "AI Chat", url: "/chat", icon: MessageSquare },
      { title: "QR Generator", url: "/qr-generator", icon: QrCode },
    ],
  },
  {
    label: "Community",
    category: "community",
    items: [
      { title: "Workflows", url: "/workflows", icon: Users },
      { title: "Affiliates", url: "/affiliates", icon: DollarSign },
    ],
  },
  {
    label: "Account",
    category: "account",
    items: [
      { title: "Profile", url: "/profile", icon: Settings },
      { title: "Billing", url: "/billing", icon: CreditCard },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const isAdmin = (user as any)?.isAdmin;
  
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  
  const toggleSection = (label: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(label)) {
        newSet.delete(label);
      } else {
        newSet.add(label);
      }
      return newSet;
    });
  };
  
  const fullUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : location;
  
  const isItemActive = (itemUrl: string) => {
    if (itemUrl.includes('?')) {
      return fullUrl === itemUrl;
    }
    if (location === itemUrl && !window.location.search) {
      return true;
    }
    if (!itemUrl.startsWith('/generate/video')) {
      return location === itemUrl;
    }
    return false;
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href="/">
          <div className="flex items-center gap-2 px-3 py-3 cursor-pointer group" data-testid="sidebar-logo">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-violet-600 rounded-lg blur-sm group-hover:blur-md transition-all" />
              <div className="relative bg-gradient-to-r from-purple-500 to-violet-600 p-2 rounded-lg">
                <span className="text-white font-bold text-base">A</span>
              </div>
            </div>
            <span className="font-bold text-base bg-gradient-to-r from-purple-400 to-violet-500 bg-clip-text text-transparent">
              Artivio AI
            </span>
          </div>
        </Link>
        <div className="px-3 pb-3">
          <CreditDisplay />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {menuSections.map((section) => {
          const isCollapsed = collapsedSections.has(section.label);
          const iconColor = categoryIconColors[section.category];
          
          return (
            <SidebarGroup key={section.label} className="py-1">
              <button
                onClick={() => toggleSection(section.label)}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-md hover:bg-sidebar-accent/50 transition-colors group"
                data-testid={`sidebar-section-${section.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wider text-purple-400 m-0 p-0 pointer-events-none">
                  {section.label}
                </SidebarGroupLabel>
                <ChevronDown 
                  className={cn(
                    "h-4 w-4 text-purple-400/70 transition-transform duration-200",
                    isCollapsed && "-rotate-90"
                  )}
                />
              </button>
              <div
                className={cn(
                  "overflow-hidden transition-all duration-300 ease-in-out",
                  isCollapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
                )}
              >
                <SidebarGroupContent className="pt-1">
                  <SidebarMenu>
                    {section.items.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={isItemActive(item.url)}
                          className="text-sm font-medium py-2.5 px-3"
                          data-testid={`sidebar-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <Link href={item.url}>
                            <div className={cn(
                              "flex items-center justify-center w-7 h-7 rounded-md",
                              "bg-gradient-to-br",
                              categoryGradients[section.category],
                              "opacity-90"
                            )}>
                              <item.icon className="h-4 w-4 text-white" />
                            </div>
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </div>
            </SidebarGroup>
          );
        })}

        {isAdmin && (
          <SidebarGroup className="py-1">
            <button
              onClick={() => toggleSection("Admin")}
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-md hover:bg-sidebar-accent/50 transition-colors group"
              data-testid="sidebar-section-admin"
            >
              <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wider text-purple-400 m-0 p-0 pointer-events-none">
                Admin
              </SidebarGroupLabel>
              <ChevronDown 
                className={cn(
                  "h-4 w-4 text-purple-400/70 transition-transform duration-200",
                  collapsedSections.has("Admin") && "-rotate-90"
                )}
              />
            </button>
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                collapsedSections.has("Admin") ? "max-h-0 opacity-0" : "max-h-[200px] opacity-100"
              )}
            >
              <SidebarGroupContent className="pt-1">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/admin"}
                      className="text-sm font-medium py-2.5 px-3"
                      data-testid="sidebar-admin-panel"
                    >
                      <Link href="/admin">
                        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-red-400 to-rose-500 opacity-90">
                          <Shield className="h-4 w-4 text-white" />
                        </div>
                        <span>Admin Panel</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </div>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarSeparator className="opacity-0" />
        <div className="px-4 py-3 text-xs text-muted-foreground">
          Artivio AI v1.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
