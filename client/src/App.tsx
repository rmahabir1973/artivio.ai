import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ModernHeader } from "@/components/modern-header";
import { AnnouncementBar } from "@/components/announcement-bar";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Pages
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Pricing from "@/pages/pricing";
import Affiliates from "@/pages/affiliates";
import Home from "@/pages/home";
import GenerateVideo from "@/pages/generate-video";
import GenerateSora from "@/pages/generate-sora";
import GenerateImage from "@/pages/generate-image";
import GenerateMusic from "@/pages/generate-music";
import VoiceClone from "@/pages/voice-clone";
import TextToSpeech from "@/pages/text-to-speech";
import SpeechToText from "@/pages/speech-to-text";
import AnalyzeImage from "@/pages/analyze-image";
import TalkingAvatars from "@/pages/talking-avatars";
import AudioConverter from "@/pages/audio-converter";
import VideoEditor from "@/pages/video-editor";
import QRGenerator from "@/pages/qr-generator";
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
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/contact" component={Contact} />

      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/pricing" component={Pricing} />
        </>
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/generate/video" component={GenerateVideo} />
          <Route path="/generate/sora" component={GenerateSora} />
          <Route path="/generate/image" component={GenerateImage} />
          <Route path="/generate/music" component={GenerateMusic} />
          <Route path="/voice-clone" component={VoiceClone} />
          <Route path="/text-to-speech" component={TextToSpeech} />
          <Route path="/speech-to-text" component={SpeechToText} />
          <Route path="/analyze-image" component={AnalyzeImage} />
          <Route path="/talking-avatars" component={TalkingAvatars} />
          <Route path="/audio-converter" component={AudioConverter} />
          <Route path="/video-editor" component={VideoEditor} />
          <Route path="/qr-generator" component={QRGenerator} />
          <Route path="/chat" component={Chat} />
          <Route path="/history" component={History} />
          <Route path="/generations" component={History} /> {/* Alias for /history */}
          <Route path="/profile" component={Profile} />
          <Route path="/referrals" component={Referrals} />
          <Route path="/admin" component={Admin} />
          <Route path="/billing" component={Billing} />
          <Route path="/billing/success" component={BillingSuccess} />
          <Route path="/billing/canceled" component={BillingCanceled} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

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

  // Handle login - invalidate cache to fetch fresh data
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      console.log('[AUTH] Login detected - invalidating cache to fetch fresh data');
      
      // Invalidate all queries to force fresh data fetch
      queryClient.invalidateQueries();
    }
  }, [isAuthenticated, isLoading]);

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

  // Show header and announcement for all users (authenticated and unauthenticated)
  return (
    <div className="flex flex-col h-screen bg-background">
      <ModernHeader />
      {isAuthenticated && <AnnouncementBar />}
      <main className="flex-1 overflow-y-auto">
        <Router />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
