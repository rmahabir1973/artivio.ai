import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SidebarInset } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { GenerationsQueue } from "@/components/generations-queue";
import { apiRequest } from "@/lib/queryClient";
import { 
  Video, 
  Image as ImageIcon, 
  Music, 
  MessageSquare, 
  Mic, 
  Headphones,
  ScanEye,
  UserCircle,
  AudioWaveform,
  Library,
  Search,
  Sparkles,
  Zap,
  TrendingUp,
  Mic2,
  Star,
  ArrowRight,
  DollarSign,
  Gift,
  ExternalLink,
  QrCode,
  Users,
  Volume2,
  ZoomIn,
  Maximize2,
  Film,
  Wand2,
  Mail,
  CheckCircle,
  Loader2
} from "lucide-react";

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: any;
  route: string;
  category: 'video' | 'image' | 'audio' | 'ai' | 'tools' | 'community';
  featured?: boolean;
  badge?: string;
  modelCost?: string;
}

interface UserSubscription {
  id: string;
  planId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  plan: {
    id: string;
    name: string;
    credits: number;
    price: number;
  };
}

export default function Home() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { getModelCost } = usePricing();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: subscription } = useQuery<UserSubscription>({
    queryKey: ['/api/subscriptions/current'],
    enabled: !!user,
  });

  // Newsletter signup state
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  const newsletterMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/public/newsletter-signup", { email });
      return await response.json();
    },
    onSuccess: () => {
      setNewsletterSubscribed(true);
      setNewsletterEmail("");
      toast({
        title: "Subscribed!",
        description: "Check your email for AI tips and exclusive offers.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Subscription failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail) {
      newsletterMutation.mutate(newsletterEmail);
    }
  };

  // Fetch user's favorite workflows
  type FavoriteWorkflow = {
    id: string;
    userId: string;
    workflowId: number;
    workflowTitle: string;
    createdAt: string;
  };

  const { data: favoriteWorkflows = [] } = useQuery<FavoriteWorkflow[]>({
    queryKey: ["/api/favorites"],
    enabled: isAuthenticated && !!user,
  });

  // Map workflow ID to route for deep-linking
  const getWorkflowRoute = (workflowId: number): string => {
    // Map workflow IDs to their primary feature routes
    const routeMap: Record<number, string> = {
      1: '/generate/video',   // One-Click Ad Generation
      2: '/generate/image',   // Social Media Content Factory  
      3: '/generate/video',   // Product Demo Video Creator
      4: '/generate/music',   // Music Video Production
      5: '/chat',            // Educational Course Content
      6: '/generate/music',   // Podcast to Video Converter
      7: '/generate/image',   // Brand Identity Package
      8: '/generate/video',   // Documentary Short Creator
      9: '/generate/music',   // Audiobook Production
      10: '/generate/video',  // Event Highlight Reel
      11: '/generate/image',  // Real Estate Virtual Tour
      12: '/chat',           // Customer Service Chatbot
      13: '/voice-clone',    // Voice Acting Portfolio
      14: '/generate/music', // Meditation Audio Creator
      15: '/generate/video', // Tutorial Video Series
      16: '/generate/video', // Recipe Tutorial Series
      17: '/generate/video', // Corporate Training Module
      18: '/generate/video', // Travel Vlog Creator
      19: '/generate/video', // Gaming Highlight Montage
      20: '/generate/video', // Motivational Quote Videos
    };
    return routeMap[workflowId] || '/workflows';
  };

  // Guest mode: Allow unauthenticated users to explore the dashboard
  // They can browse features but will be prompted to sign up when trying to use them
  const isGuestMode = !isAuthenticated && !isLoading;

  const features: FeatureCard[] = [
    {
      id: 'video-gen',
      title: 'Video Generation',
      description: 'Create stunning videos with Veo 3.1, Runway Aleph, and more AI models',
      icon: Video,
      route: '/generate/video',
      category: 'video',
      featured: true,
      badge: 'Popular',
      modelCost: 'veo-3.1'
    },
    {
      id: 'sora-pro',
      title: 'Sora 2 Pro',
      description: 'Next-generation video creation with OpenAI Sora 2 Pro and Storyboard',
      icon: Sparkles,
      route: '/generate/sora',
      category: 'video',
      featured: true,
      badge: 'Premium',
      modelCost: 'sora-2-pro'
    },
    {
      id: 'image-gen',
      title: 'Image Generation',
      description: 'Generate images with 4o Image, Flux Kontext, and Nano Banana',
      icon: ImageIcon,
      route: '/generate/image',
      category: 'image',
      featured: true,
      modelCost: '4o-image'
    },
    {
      id: 'music-gen',
      title: 'Music Generation',
      description: 'Compose original music with Suno V3.5, V4, and V4.5 models',
      icon: Music,
      route: '/generate/music',
      category: 'audio',
      featured: true,
      badge: 'New',
      modelCost: 'suno-v4'
    },
    {
      id: 'sound-effects',
      title: 'Sound Effects',
      description: 'Generate custom AI-powered sound effects with ElevenLabs',
      icon: Volume2,
      route: '/sound-effects',
      category: 'audio',
      modelCost: 'elevenlabs-sound-effect-v2'
    },
    {
      id: 'ai-chat',
      title: 'AI Chat',
      description: 'Chat with Deepseek and OpenAI models including GPT-4o and o1',
      icon: MessageSquare,
      route: '/chat',
      category: 'ai',
      badge: 'Free'
    },
    {
      id: 'voice-clone',
      title: 'Voice Cloning',
      description: 'Clone voices with ElevenLabs technology for natural speech',
      icon: Mic,
      route: '/voice-clone',
      category: 'audio',
      modelCost: 'elevenlabs-voice-clone'
    },
    {
      id: 'text-to-speech',
      title: 'Text to Speech',
      description: 'Convert text to natural speech with multiple AI voices',
      icon: Headphones,
      route: '/text-to-speech',
      category: 'audio',
      modelCost: 'elevenlabs-tts'
    },
    {
      id: 'talking-avatars',
      title: 'Talking Avatars',
      description: 'Create realistic talking avatars from images and audio',
      icon: UserCircle,
      route: '/talking-avatars',
      category: 'video',
      badge: 'Hot',
      modelCost: 'kling-avatar'
    },
    {
      id: 'lip-sync',
      title: 'Lip Sync',
      description: 'Create lip-synced videos from images and audio with InfiniteTalk',
      icon: Film,
      route: '/lip-sync',
      category: 'video',
      modelCost: 'infinitalk-480p'
    },
    {
      id: 'video-editor',
      title: 'Video Editor',
      description: 'Professional video editing with timeline, effects, and export to AWS',
      icon: Film,
      route: '/video-editor',
      category: 'video',
      badge: 'New'
    },
    {
      id: 'image-analysis',
      title: 'Image Analysis',
      description: 'Analyze images with GPT-4o Vision for insights and descriptions',
      icon: ScanEye,
      route: '/analyze-image',
      category: 'ai',
      modelCost: 'gpt-4o-vision'
    },
    {
      id: 'image-upscaler',
      title: 'Image Upscaler',
      description: 'Upscale images 2x, 4x, or 8x with Topaz AI enhancement',
      icon: ZoomIn,
      route: '/topaz-image-upscaler',
      category: 'image',
      modelCost: 'topaz-image-2x'
    },
    {
      id: 'background-remover',
      title: 'Background Remover',
      description: 'Remove backgrounds from images with AI-powered precision using Recraft',
      icon: Wand2,
      route: '/background-remover',
      category: 'image',
      modelCost: 'recraft-remove-background'
    },
    {
      id: 'audio-converter',
      title: 'Audio Converter',
      description: 'Convert audio between formats and enhance quality',
      icon: AudioWaveform,
      route: '/audio-converter',
      category: 'tools'
    },
    {
      id: 'video-upscaler',
      title: 'Video Upscaler',
      description: 'Enhance video quality with Topaz AI upscaling (2x, 4x)',
      icon: Maximize2,
      route: '/topaz-video-upscaler',
      category: 'tools',
      modelCost: 'topaz-video-2x-10s'
    },
    {
      id: 'speech-to-text',
      title: 'Speech to Text',
      description: 'Transcribe audio to text with high accuracy',
      icon: Mic2,
      route: '/speech-to-text',
      category: 'audio'
    },
    {
      id: 'qr-generator',
      title: 'QR Code Generator',
      description: 'Create custom QR codes with logos and styling',
      icon: QrCode,
      route: '/qr-generator',
      category: 'tools',
      badge: 'Free'
    },
    {
      id: 'history',
      title: 'My Library',
      description: 'View and manage all your AI-generated content',
      icon: Library,
      route: '/history',
      category: 'tools'
    },
    {
      id: 'brand-builder',
      title: 'Brand Builder',
      description: 'Explore pre-built workflow templates to automate your content creation',
      icon: Zap,
      route: '/brand-builder',
      category: 'community',
      badge: 'Community'
    }
  ];

  const categories = [
    { id: 'all', label: 'All Features', icon: Sparkles },
    { id: 'video', label: 'Video', icon: Video },
    { id: 'image', label: 'Image', icon: ImageIcon },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'ai', label: 'AI Tools', icon: Zap },
    { id: 'tools', label: 'Utilities', icon: TrendingUp },
    { id: 'community', label: 'Community', icon: Users }
  ];

  const filteredFeatures = features.filter(feature => {
    const matchesCategory = selectedCategory === 'all' || feature.category === selectedCategory;
    const matchesSearch = feature.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         feature.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredFeatures = features.filter(f => f.featured);

  // Guard: Only show loading state while auth is loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // User info (for authenticated users) or guest defaults
  const userCredits = isGuestMode ? 0 : ((user as any)?.credits ?? 0);
  const userFirstName = isGuestMode ? 'Explorer' : ((user as any)?.firstName ?? 'Creator');

  return (
    <SidebarInset className="overflow-x-hidden">
      <div className="flex flex-col min-h-screen w-full">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-purple-500/10 border-b w-full">
        <div className="absolute inset-0 bg-grid-white/5 bg-[size:20px_20px]" style={{ maskImage: 'linear-gradient(to bottom, transparent, black, transparent)' }} />
        <div className="relative max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="text-center space-y-4 sm:space-y-6">
            <p className="text-base sm:text-lg text-muted-foreground mb-2">
              Welcome back, {userFirstName}
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight break-words px-2 leading-tight">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-violet-500 bg-clip-text text-transparent">
                What will you create today?
              </span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl font-semibold text-muted-foreground max-w-2xl mx-auto px-2">
              Powered by advanced AI technology.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              {isGuestMode ? (
                <>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium">Start with 1,000 free credits</span>
                  </div>
                  <Link href="/register">
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="gap-2"
                      data-testid="button-signup-hero"
                    >
                      <Zap className="h-4 w-4" />
                      Sign Up Free
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button 
                      variant="outline" 
                      size="sm"
                      data-testid="button-login-hero"
                    >
                      Log In
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-medium">{userCredits} credits</span>
                  </div>
                  {subscription?.plan && (
                    <Badge variant="outline" className="px-4 py-2 text-sm font-medium">
                      {subscription.plan.name} Plan
                    </Badge>
                  )}
                  <Link href="/billing">
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="gap-2"
                      data-testid="button-upgrade-hero"
                    >
                      <Zap className="h-4 w-4" />
                      Upgrade Now
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {/* Guest Mode Banner */}
        {isGuestMode && (
          <div className="mb-8">
            <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10">
              <CardContent className="py-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">You're exploring as a guest</h3>
                      <p className="text-sm text-muted-foreground">
                        Sign up now to get <span className="font-semibold text-foreground">1,000 free credits</span> and start creating amazing AI content!
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Link href="/register">
                      <Button className="gap-2" data-testid="button-signup-banner">
                        <Zap className="h-4 w-4" />
                        Sign Up Free
                      </Button>
                    </Link>
                    <Link href="/login">
                      <Button variant="outline" data-testid="button-login-banner">
                        Log In
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Affiliate Promotion Cards - Only for authenticated users */}
        {!isGuestMode && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Main Affiliate CTA Card */}
          <Card className="hover-elevate border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-purple-500/5">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Earn 30% Commission</CardTitle>
                  <CardDescription>Join our affiliate program today</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground break-words">
                Share Artivio AI with your audience and earn <span className="font-bold text-foreground">30% recurring commission</span> for every paying customer. Average affiliates earn $500-$2,000/month!
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  asChild 
                  size="lg"
                  className="flex-1 whitespace-nowrap"
                  data-testid="button-join-affiliate-dashboard"
                >
                  <a 
                    href="https://artivio-ai.getrewardful.com/signup?campaign=artivio-affiliate-team&code=F4Ng9WuVZ9mhUHVjYMpAxkqM" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center"
                  >
                    <Gift className="mr-2 h-5 w-5 shrink-0" />
                    <span className="truncate">Join Program Free</span>
                    <ExternalLink className="ml-2 h-4 w-4 shrink-0" />
                  </a>
                </Button>
                <Button 
                  asChild 
                  variant="outline" 
                  size="lg"
                  className="flex-1"
                  data-testid="button-learn-more-affiliate"
                >
                  <Link href="/affiliates">
                    Learn More
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Affiliate Benefits Card */}
          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="text-lg">Why Become an Affiliate?</CardTitle>
              <CardDescription>Everything you need to succeed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">92% Conversion Rate</p>
                  <p className="text-xs text-muted-foreground">Industry-leading trial-to-paid conversion</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Gift className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Ready-Made Materials</p>
                  <p className="text-xs text-muted-foreground">7-day email funnel, banners, templates included</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">$750+ Average Monthly</p>
                  <p className="text-xs text-muted-foreground">Passive recurring income from referrals</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Favorite Brand Builder Quick Launch - Only for authenticated users */}
        {!isGuestMode && favoriteWorkflows.length > 0 && (
          <div className="mb-8">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary fill-primary" />
                    <CardTitle>Favorite Brand Builder</CardTitle>
                  </div>
                  <Link href="/brand-builder">
                    <Button variant="ghost" size="sm" className="gap-2" data-testid="button-view-all-brand-builder">
                      View All
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <CardDescription>
                  Quick access to your bookmarked automation workflows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {favoriteWorkflows.slice(0, 6).map((favorite) => (
                    <Link key={favorite.id} href={getWorkflowRoute(favorite.workflowId)}>
                      <Card className="hover-elevate cursor-pointer group">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Zap className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                {favorite.workflowTitle}
                              </span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
                {favoriteWorkflows.length > 6 && (
                  <div className="mt-3 text-center">
                    <Link href="/brand-builder">
                      <Button variant="outline" size="sm" data-testid="button-more-favorites">
                        View {favoriteWorkflows.length - 6} More Favorites
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
              data-testid="input-search-features"
            />
          </div>

          {/* Category Tabs - Scrollable on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className="flex-shrink-0"
                data-testid={`button-category-${cat.id}`}
              >
                <cat.icon className="h-4 w-4 mr-2" />
                {cat.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Featured Section */}
        {selectedCategory === 'all' && !searchQuery && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Featured Tools</h2>
              <Badge variant="secondary" className="hidden sm:flex">Most Popular</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredFeatures.map((feature) => (
                <Link key={feature.id} href={feature.route}>
                  <Card className="group cursor-pointer hover-elevate active-elevate-2 h-full border-2 transition-all">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 group-hover:from-primary/30 group-hover:to-primary/20 transition-all">
                          <feature.icon className="h-6 w-6 text-primary" />
                        </div>
                        {feature.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {feature.badge}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {feature.modelCost ? `From ${getModelCost(feature.modelCost, 100)} credits` : 'Variable cost'}
                        </span>
                        <span className="text-sm font-medium text-primary group-hover:translate-x-1 transition-transform">
                          Start →
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Upgrade CTA - Only show for Free plan */}
        {selectedCategory === 'all' && !searchQuery && subscription?.plan?.name === 'Free' && (
          <div className="mb-12">
            <Card className="bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 border-2 border-primary/20 overflow-hidden relative">
              <div className="absolute inset-0 bg-grid-white/5 bg-[size:20px_20px]" />
              <CardContent className="relative py-8 px-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-center md:text-left space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 mb-2">
                      <Sparkles className="h-3 w-3 text-primary" />
                      <span className="text-xs font-medium text-primary">Limited Credits Remaining</span>
                    </div>
                    <h3 className="text-2xl font-bold">Unlock Unlimited Creativity</h3>
                    <p className="text-muted-foreground max-w-xl">
                      Upgrade to Pro or Starter to get more credits, faster generation, and access to premium features. 
                      Create professional content without limits.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Badge variant="secondary">15,000 credits/month (Pro)</Badge>
                      <Badge variant="secondary">5,000 credits/month (Starter)</Badge>
                      <Badge variant="secondary">Priority Support</Badge>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Link href="/billing">
                      <Button size="lg" className="gap-2" data-testid="button-upgrade-cta">
                        <Zap className="h-5 w-5" />
                        Upgrade Now
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* All Features Grid */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">
              {selectedCategory === 'all' ? 'All Features' : categories.find(c => c.id === selectedCategory)?.label}
            </h2>
            <span className="text-sm text-muted-foreground">
              {filteredFeatures.length} {filteredFeatures.length === 1 ? 'tool' : 'tools'}
            </span>
          </div>
          
          {filteredFeatures.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No features found matching your search.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredFeatures.map((feature) => (
                <Link key={feature.id} href={feature.route}>
                  <Card className="group cursor-pointer hover-elevate active-elevate-2 h-full transition-all">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <feature.icon className="h-5 w-5 text-primary" />
                        </div>
                        {feature.badge && (
                          <Badge variant="outline" className="text-xs">
                            {feature.badge}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {feature.description}
                      </p>
                      <div className="text-xs font-medium text-primary">
                        {feature.modelCost ? `${getModelCost(feature.modelCost, 100)}+ credits` : 'Free'}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Newsletter Signup Section */}
        <div className="mb-12">
          <Card className="bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5 border border-primary/20">
            <CardContent className="py-8 px-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left space-y-2 flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-2">
                    <Mail className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium text-primary">Weekly AI Tips</span>
                  </div>
                  <h3 className="text-xl font-bold">Get AI Creation Tips in Your Inbox</h3>
                  <p className="text-muted-foreground text-sm max-w-md">
                    Join thousands of creators getting weekly tips, tutorials, and exclusive offers for AI video, image, and music generation.
                  </p>
                </div>
                <div className="w-full md:w-auto md:min-w-[320px]">
                  {newsletterSubscribed ? (
                    <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-green-600 dark:text-green-400 font-medium">You're subscribed! Check your email.</span>
                    </div>
                  ) : (
                    <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-2">
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        value={newsletterEmail}
                        onChange={(e) => setNewsletterEmail(e.target.value)}
                        required
                        className="flex-1"
                        data-testid="input-newsletter-email"
                      />
                      <Button 
                        type="submit" 
                        disabled={newsletterMutation.isPending}
                        className="whitespace-nowrap"
                        data-testid="button-newsletter-subscribe"
                      >
                        {newsletterMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Subscribing...
                          </>
                        ) : (
                          "Subscribe"
                        )}
                      </Button>
                    </form>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 text-center md:text-left">
                    No spam. Unsubscribe anytime.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Generations */}
        <div className="mb-8">
          <GenerationsQueue />
        </div>
      </div>
      </div>
    </SidebarInset>
  );
}
