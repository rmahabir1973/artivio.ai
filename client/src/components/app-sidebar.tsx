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
  Scissors,
  Sparkles,
  Mic2,
  QrCode,
  Zap,
  History as HistoryIcon,
  Users,
  Trophy,
  Settings,
  CreditCard,
  Shield,
} from "lucide-react";
import { CreditDisplay } from "@/components/credit-display";
import { useAuth } from "@/hooks/useAuth";

const menuSections = [
  {
    label: "Main",
    items: [
      { title: "Home", url: "/", icon: Home },
      { title: "History", url: "/history", icon: HistoryIcon },
    ],
  },
  {
    label: "Video",
    items: [
      { title: "Video Generation", url: "/generate/video", icon: Video },
      { title: "Sora 2 Pro", url: "/generate/sora", icon: Sparkles },
      { title: "Talking Avatars", url: "/talking-avatars", icon: UserCircle },
      { title: "Video Upscaler", url: "/topaz-video-upscaler", icon: Zap },
      { title: "Video Editor", url: "/video-editor", icon: Scissors },
    ],
  },
  {
    label: "Image",
    items: [
      { title: "Image Generation", url: "/generate/image", icon: ImageIcon },
      { title: "Image Analysis", url: "/analyze-image", icon: ScanEye },
      { title: "Image Upscaler", url: "/topaz-upscaler", icon: Zap },
      { title: "Background Remover", url: "/background-remover", icon: ImageIcon },
    ],
  },
  {
    label: "Audio & Music",
    items: [
      { title: "Music Generation", url: "/generate/music", icon: Music },
      { title: "Sound Effects", url: "/sound-effects", icon: Zap },
      { title: "Voice Cloning", url: "/voice-clone", icon: Mic },
      { title: "Text to Speech", url: "/text-to-speech", icon: Headphones },
      { title: "Speech to Text", url: "/speech-to-text", icon: Mic2 },
      { title: "Audio Converter", url: "/audio-converter", icon: AudioWaveform },
      { title: "Lip Sync", url: "/lip-sync", icon: Video },
    ],
  },
  {
    label: "Tools",
    items: [
      { title: "AI Chat", url: "/chat", icon: MessageSquare },
      { title: "QR Generator", url: "/qr-generator", icon: QrCode },
    ],
  },
  {
    label: "Community",
    items: [
      { title: "Workflows", url: "/workflows", icon: Sparkles },
      { title: "Referrals", url: "/referrals", icon: Users },
      { title: "Leaderboard", url: "/leaderboard", icon: Trophy },
    ],
  },
  {
    label: "Account",
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

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b">
        <Link href="/">
          <div className="flex items-center gap-2 px-2 py-3 cursor-pointer group" data-testid="sidebar-logo">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-purple-500 rounded-md blur-sm group-hover:blur-md transition-all" />
              <div className="relative bg-gradient-to-r from-primary to-purple-500 p-1.5 rounded-md">
                <span className="text-white font-bold text-sm">A</span>
              </div>
            </div>
            <span className="font-bold text-sm bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Artivio AI
            </span>
          </div>
        </Link>
        <div className="px-2 pb-2">
          <CreditDisplay />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {menuSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`sidebar-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/admin"}
                    data-testid="sidebar-admin-panel"
                  >
                    <Link href="/admin">
                      <Shield className="h-4 w-4" />
                      <span>Admin Panel</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <div className="px-2 py-2 text-xs text-muted-foreground">
          Artivio AI v1.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
