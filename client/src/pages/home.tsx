import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
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
  Scissors,
  History,
  Search,
  Sparkles,
  Zap,
  TrendingUp,
  Mic2
} from "lucide-react";

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: any;
  route: string;
  category: 'video' | 'image' | 'audio' | 'ai' | 'tools';
  featured?: boolean;
  badge?: string;
  modelCost?: string;
}

export default function Home() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { getModelCost } = usePricing();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

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
      id: 'image-analysis',
      title: 'Image Analysis',
      description: 'Analyze images with GPT-4o Vision for insights and descriptions',
      icon: ScanEye,
      route: '/analyze-image',
      category: 'ai',
      modelCost: 'gpt-4o-vision'
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
      id: 'video-editor',
      title: 'Video Editor',
      description: 'Combine and edit AI-generated videos with transitions',
      icon: Scissors,
      route: '/video-editor',
      category: 'tools'
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
      id: 'history',
      title: 'Generation History',
      description: 'View and manage all your AI-generated content',
      icon: History,
      route: '/history',
      category: 'tools'
    }
  ];

  const categories = [
    { id: 'all', label: 'All Features', icon: Sparkles },
    { id: 'video', label: 'Video', icon: Video },
    { id: 'image', label: 'Image', icon: ImageIcon },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'ai', label: 'AI Tools', icon: Zap },
    { id: 'tools', label: 'Utilities', icon: TrendingUp }
  ];

  const filteredFeatures = features.filter(feature => {
    const matchesCategory = selectedCategory === 'all' || feature.category === selectedCategory;
    const matchesSearch = feature.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         feature.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredFeatures = features.filter(f => f.featured);

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

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-purple-500/10 border-b">
        <div className="absolute inset-0 bg-grid-white/5 bg-[size:20px_20px]" style={{ maskImage: 'linear-gradient(to bottom, transparent, black, transparent)' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="text-center space-y-4 sm:space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Welcome back, {(user as any)?.firstName || 'Creator'}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Create Anything
              </span>
              <br />
              <span className="text-foreground">with AI Power</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              12+ powerful AI tools at your fingertips. Generate videos, images, music, voices, and more.
            </p>
            <div className="flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-medium">{(user as any)?.credits || 0} credits</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
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
          <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
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

        {/* All Features Grid */}
        <div>
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
      </div>
    </div>
  );
}
