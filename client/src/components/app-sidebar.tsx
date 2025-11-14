import { Home, Video, Image, Music, Mic, Volume2, FileText, UserCircle, Repeat, MessageSquare, History, Settings, Shield, Scan } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
    adminOnly: false,
  },
  {
    title: "AI Chat",
    url: "/chat",
    icon: MessageSquare,
    adminOnly: false,
  },
  {
    title: "Video Generation",
    url: "/generate/video",
    icon: Video,
    adminOnly: false,
  },
  {
    title: "Image Generation",
    url: "/generate/image",
    icon: Image,
    adminOnly: false,
  },
  {
    title: "Music Generation",
    url: "/generate/music",
    icon: Music,
    adminOnly: false,
  },
  {
    title: "Voice Cloning",
    url: "/voice-clone",
    icon: Mic,
    adminOnly: false,
  },
  {
    title: "Text-to-Speech",
    url: "/text-to-speech",
    icon: Volume2,
    adminOnly: false,
  },
  {
    title: "Speech-to-Text",
    url: "/speech-to-text",
    icon: FileText,
    adminOnly: false,
  },
  {
    title: "Image Analysis",
    url: "/analyze-image",
    icon: Scan,
    adminOnly: false,
  },
  {
    title: "Talking Avatars",
    url: "/talking-avatars",
    icon: UserCircle,
    adminOnly: false,
  },
  {
    title: "Audio Converter",
    url: "/audio-converter",
    icon: Repeat,
    adminOnly: false,
  },
  {
    title: "History",
    url: "/history",
    icon: History,
    adminOnly: false,
  },
  {
    title: "Admin Panel",
    url: "/admin",
    icon: Shield,
    adminOnly: true,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const filteredItems = navItems.filter(item => 
    !item.adminOnly || (user as any)?.isAdmin
  );

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Artivio AI</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
