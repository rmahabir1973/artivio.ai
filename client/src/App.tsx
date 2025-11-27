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
import { Loader2, User, LogOut, Home as HomeIcon, DollarSign } from "lucide-react";
import { CreditDisplay } from "@/components/credit-display";

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
            <header className="flex items-center justify-between p-3 border-b h-14 flex-shrink-0 gap-2">
              <div className="flex items-center gap-2">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
              </div>
              
              {/* Navigation links - visible for all users */}
              <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
                <Link href="/dashboard">
                  <Button variant={location === "/dashboard" ? "default" : "ghost"} size="sm" data-testid="nav-home">
                    <HomeIcon className="h-4 w-4 mr-1" />
                    Home
                  </Button>
                </Link>
                <Link href="/affiliates">
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
                    data-testid="nav-affiliates"
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    Earn 30%
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button variant={location === "/pricing" ? "default" : "ghost"} size="sm" data-testid="nav-pricing">
                    Pricing
                  </Button>
                </Link>
              </nav>
              
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
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>
                        {user ? (user as any).email : "My Account"}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/profile" data-testid="menu-profile">
                          Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/billing" data-testid="menu-billing">
                          Billing
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={logout}
                        className="text-destructive focus:text-destructive"
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
