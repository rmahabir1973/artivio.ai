import { useEffect } from "react";
import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ModernHeader } from "@/components/modern-header";
import { AnnouncementBar } from "@/components/announcement-bar";
import { Footer } from "@/components/footer";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthProvider, useAuth } from "@/contexts/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { 
  Loader2, 
  User, 
  LogOut, 
  Home as HomeIcon, 
  DollarSign,
  Video,
  Image as ImageIcon,
  Music,
  Sparkles,
  Wrench,
  Users,
  ChevronDown,
  Settings,
  CreditCard,
  BookOpen,
  MessageSquare,
  Scissors,
  ScanSearch,
  ZoomIn,
  Eraser,
  QrCode,
  Workflow,
} from "lucide-react";
import { CreditDisplay } from "@/components/credit-display";
import { AIAssistantWidget } from "@/components/ai-assistant-widget";

// Pages
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Pricing from "@/pages/pricing";
import Affiliates from "@/pages/affiliates";
import Home from "@/pages/home";
import GenerateVideo from "@/pages/generate-video";
import GenerateTransition from "@/pages/generate-transition";
import GenerateSora from "@/pages/generate-sora";
import GenerateImage from "@/pages/generate-image";
import GenerateMusic from "@/pages/generate-music";
import SoundEffects from "@/pages/sound-effects";
import VoiceClone from "@/pages/voice-clone";
import TextToSpeech from "@/pages/text-to-speech";
import StoryStudio from "@/pages/story-studio";
import SpeechToText from "@/pages/speech-to-text";
import AnalyzeImage from "@/pages/analyze-image";
import TalkingAvatars from "@/pages/talking-avatars";
import LipSync from "@/pages/lip-sync";
import AudioConverter from "@/pages/audio-converter";
import QRGenerator from "@/pages/qr-generator";
import TopazUpscaler from "@/pages/topaz-upscaler";
import TopazVideoUpscaler from "@/pages/topaz-video-upscaler";
import BackgroundRemover from "@/pages/background-remover";
import VideoEditor from "@/pages/video-editor";
import Chat from "@/pages/chat";
import History from "@/pages/history";
import Profile from "@/pages/profile";
import Admin from "@/pages/admin";
import Billing from "@/pages/billing";
import BillingSuccess from "@/pages/billing-success";
import BillingCanceled from "@/pages/billing-canceled";
import Support from "@/pages/support";
import Workflows from "@/pages/workflows";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Contact from "@/pages/contact";
import Referrals from "@/pages/referrals";
import Leaderboard from "@/pages/leaderboard";
import VideoModelsShowcase from "@/pages/video-models-showcase";
import Newsletter from "@/pages/newsletter";
import Blog from "@/pages/blog";
import BlogPost from "@/pages/blog-post";
import Tutorials from "@/pages/tutorials";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      {/* Public routes available to all users */}
      <Route path="/support" component={Support} />
      <Route path="/workflows" component={Workflows} />
      <Route path="/templates" component={Workflows} /> {/* Alias for /workflows */}
      <Route path="/affiliates" component={Affiliates} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/video-models" component={VideoModelsShowcase} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/contact" component={Contact} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/newsletter" component={Newsletter} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/tutorials" component={Tutorials} />

      {/* Auth routes - only show when not authenticated */}
      {!isAuthenticated && (
        <>
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
        </>
      )}

      {/* Dashboard route - accessible to all users (guests can explore in guest mode) */}
      <Route path="/dashboard" component={Home} />

      {/* Home route - Landing for guests, Dashboard for authenticated */}
      <Route path="/">
        {isAuthenticated ? <Home /> : <Landing />}
      </Route>

      {/* Tool pages - accessible to guests for browsing (auth required at generation time) */}
      <Route path="/generate/video" component={GenerateVideo} />
      <Route path="/generate/transition" component={GenerateTransition} />
      <Route path="/generate/sora" component={GenerateSora} />
      <Route path="/generate/image" component={GenerateImage} />
      <Route path="/generate/music" component={GenerateMusic} />
      <Route path="/sound-effects" component={SoundEffects} />
      <Route path="/voice-clone" component={VoiceClone} />
      <Route path="/text-to-speech" component={TextToSpeech} />
      <Route path="/story-studio" component={StoryStudio} />
      <Route path="/speech-to-text" component={SpeechToText} />
      <Route path="/analyze-image" component={AnalyzeImage} />
      <Route path="/talking-avatars" component={TalkingAvatars} />
      <Route path="/lip-sync" component={LipSync} />
      <Route path="/audio-converter" component={AudioConverter} />
      <Route path="/qr-generator" component={QRGenerator} />
      <Route path="/topaz-upscaler" component={TopazUpscaler} />
      <Route path="/topaz-video-upscaler" component={TopazVideoUpscaler} />
      <Route path="/background-remover" component={BackgroundRemover} />
      <Route path="/video-editor" component={VideoEditor} />
      <Route path="/chat" component={Chat} />

      {/* Account pages - require authentication */}
      <Route path="/history">
        <ProtectedRoute><History /></ProtectedRoute>
      </Route>
      <Route path="/generations">
        <ProtectedRoute><History /></ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute><Profile /></ProtectedRoute>
      </Route>
      <Route path="/referrals">
        <ProtectedRoute><Referrals /></ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute><Admin /></ProtectedRoute>
      </Route>
      <Route path="/billing">
        <ProtectedRoute><Billing /></ProtectedRoute>
      </Route>
      <Route path="/billing/success">
        <ProtectedRoute><BillingSuccess /></ProtectedRoute>
      </Route>
      <Route path="/billing/canceled">
        <ProtectedRoute><BillingCanceled /></ProtectedRoute>
      </Route>

      {/* 404 - Always at the end */}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [location] = useLocation();

  // Handle logout - clear React Query cache when redirected after logout
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('logout') === 'success') {
      console.log('[AUTH] Logout detected - clearing all cached data');
      
      // Clear ALL React Query cache
      queryClient.clear();
      
      // Remove the logout query parameter from URL
      searchParams.delete('logout');
      const newSearch = searchParams.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
      window.history.replaceState({}, '', newUrl);
      
      console.log('[AUTH] ✓ Cache cleared and URL cleaned');
    }
  }, [location]);

  // Determine if we're on an "app page" that should show the sidebar layout
  // vs a "public page" that should show the traditional header/footer layout
  const appPages = [
    '/dashboard',
    '/generate/',
    '/sound-effects',
    '/voice-clone',
    '/text-to-speech',
    '/speech-to-text',
    '/analyze-image',
    '/talking-avatars',
    '/lip-sync',
    '/audio-converter',
    '/qr-generator',
    '/topaz-upscaler',
    '/topaz-video-upscaler',
    '/background-remover',
    '/video-editor',
    '/chat',
    '/history',
    '/generations',
    '/profile',
    '/admin',
    '/billing',
    '/story-studio',
    '/workflows',
    '/tutorials',
  ];
  
  const isAppPage = appPages.some(page => location.startsWith(page));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Sidebar layout for app pages (both authenticated AND guest users exploring)
  if (isAuthenticated || isAppPage) {
    const sidebarStyle = {
      "--sidebar-width": "16rem",
      "--sidebar-width-icon": "3rem",
    } as React.CSSProperties;

    return (
      <SidebarProvider style={sidebarStyle}>
        <div className="flex h-screen w-full overflow-x-hidden">
          <AppSidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <header className="flex items-center justify-between px-4 border-b border-sidebar-border h-14 flex-shrink-0 gap-3 bg-sidebar/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                
                {/* Top Navigation with Dropdowns - visible on larger screens */}
                <nav className="hidden lg:flex items-center gap-1">
                  <Link href="/dashboard">
                    <Button 
                      variant={location === "/" || location === "/dashboard" ? "secondary" : "ghost"} 
                      size="sm" 
                      className="text-sm font-medium"
                      data-testid="nav-home"
                    >
                      <HomeIcon className="h-4 w-4 mr-1.5" />
                      Home
                    </Button>
                  </Link>
                  
                  {/* Create Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-sm font-medium gap-1" data-testid="nav-create">
                        <Sparkles className="h-4 w-4" />
                        Create
                        <ChevronDown className="h-3 w-3 opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Video</DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link href="/generate/video" className="cursor-pointer">
                          <Video className="h-4 w-4 mr-2 text-blue-400" />
                          Video Generation
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/generate/sora" className="cursor-pointer">
                          <Sparkles className="h-4 w-4 mr-2 text-purple-400" />
                          Sora 2 Pro
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Image</DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link href="/generate/image" className="cursor-pointer">
                          <ImageIcon className="h-4 w-4 mr-2 text-pink-400" />
                          Image Generation
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Audio</DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link href="/generate/music" className="cursor-pointer">
                          <Music className="h-4 w-4 mr-2 text-violet-400" />
                          Music Generation
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Tools Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-sm font-medium gap-1" data-testid="nav-tools">
                        <Wrench className="h-4 w-4 text-emerald-400" />
                        Tools
                        <ChevronDown className="h-3 w-3 opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuItem asChild>
                        <Link href="/chat" className="cursor-pointer">
                          <MessageSquare className="h-4 w-4 mr-2 text-emerald-400" />
                          AI Chat
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/video-editor" className="cursor-pointer">
                          <Scissors className="h-4 w-4 mr-2 text-blue-400" />
                          Video Editor
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/analyze-image" className="cursor-pointer">
                          <ScanSearch className="h-4 w-4 mr-2 text-amber-400" />
                          Image Analysis
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/topaz-upscaler" className="cursor-pointer">
                          <ZoomIn className="h-4 w-4 mr-2 text-cyan-400" />
                          Image Upscaler
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/background-remover" className="cursor-pointer">
                          <Eraser className="h-4 w-4 mr-2 text-pink-400" />
                          Background Remover
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/qr-generator" className="cursor-pointer">
                          <QrCode className="h-4 w-4 mr-2 text-violet-400" />
                          QR Generator
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Community Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-sm font-medium gap-1" data-testid="nav-community">
                        <Users className="h-4 w-4 text-orange-400" />
                        Community
                        <ChevronDown className="h-3 w-3 opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuItem asChild>
                        <Link href="/workflows" className="cursor-pointer">
                          <Workflow className="h-4 w-4 mr-2 text-orange-400" />
                          Workflows
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/blog" className="cursor-pointer">
                          <BookOpen className="h-4 w-4 mr-2 text-teal-400" />
                          Blog
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Link href="/pricing">
                    <Button 
                      variant={location === "/pricing" ? "secondary" : "ghost"} 
                      size="sm" 
                      className="text-sm font-medium"
                      data-testid="nav-pricing"
                    >
                      Pricing
                    </Button>
                  </Link>
                  
                  <Link href="/affiliates">
                    <Button 
                      size="sm" 
                      className="text-sm font-medium bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white"
                      data-testid="nav-affiliates"
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Earn 30%
                    </Button>
                  </Link>
                </nav>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Credits display for authenticated users */}
                {isAuthenticated && (
                  <div className="hidden sm:block">
                    <CreditDisplay />
                  </div>
                )}
                
                <ThemeToggle />
                
                {/* User menu for authenticated users */}
                {isAuthenticated ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid="button-user-menu">
                        <User className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">{user ? (user as any).firstName || "User" : "My Account"}</p>
                          <p className="text-xs text-muted-foreground truncate">{user ? (user as any).email : ""}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/profile" className="cursor-pointer" data-testid="menu-profile">
                          <Settings className="h-4 w-4 mr-2" />
                          Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/billing" className="cursor-pointer" data-testid="menu-billing">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Billing
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={logout}
                        className="text-destructive focus:text-destructive cursor-pointer"
                        data-testid="menu-logout"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  /* Login button for guest users */
                  <Button asChild size="sm" data-testid="nav-login">
                    <Link href="/login">Log in</Link>
                  </Button>
                )}
              </div>
            </header>
            {isAuthenticated && <AnnouncementBar />}
            <main className="flex-1 overflow-y-auto overflow-x-hidden">
              <Router />
            </main>
          </div>
        </div>
        <AIAssistantWidget />
      </SidebarProvider>
    );
  }

  // Traditional header/footer layout for public pages (landing, pricing, etc.)
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ModernHeader />
      <main className="flex-1 overflow-y-auto">
        <Router />
      </main>
      <Footer />
      <AIAssistantWidget />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
