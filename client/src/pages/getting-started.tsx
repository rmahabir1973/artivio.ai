import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  PlayCircle, 
  ChevronLeft, 
  ChevronRight, 
  DollarSign, 
  Bot, 
  Rocket, 
  Zap, 
  Layers,
  Sparkles,
  Video,
  Image,
  Music,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";

interface WelcomeSlide {
  title: string;
  description: string;
  icon: string;
  highlight?: string;
}

const defaultSlides: WelcomeSlide[] = [
  {
    title: "Save Up to 80% on AI Generation",
    description: "Access premium AI models at a fraction of the cost. No more expensive monthly subscriptions to multiple services.",
    icon: "dollar",
    highlight: "80% savings"
  },
  {
    title: "Built-in AI Assistant",
    description: "Get help crafting the perfect prompts with our integrated AI assistant. Better prompts mean better results.",
    icon: "bot",
    highlight: "Smart prompts"
  },
  {
    title: "Brand Builder Suite",
    description: "Create professional marketing content in minutes. Product ads, testimonials, and social media videos made easy.",
    icon: "rocket",
    highlight: "10 templates"
  },
  {
    title: "Lightning Fast Generation",
    description: "Our optimized pipeline delivers results faster than competitors. Spend less time waiting, more time creating.",
    icon: "zap",
    highlight: "2x faster"
  },
  {
    title: "All-in-One Platform",
    description: "Video, image, music, voice cloning, and more. Everything you need to create amazing content in one place.",
    icon: "layers",
    highlight: "15+ tools"
  }
];

const iconMap: Record<string, any> = {
  dollar: DollarSign,
  bot: Bot,
  rocket: Rocket,
  zap: Zap,
  layers: Layers,
  sparkles: Sparkles,
};

const quickStartLinks = [
  { title: "Generate Video", url: "/generate/video", icon: Video, color: "from-blue-500 to-cyan-500" },
  { title: "Generate Image", url: "/generate/image", icon: Image, color: "from-pink-500 to-rose-500" },
  { title: "Generate Music", url: "/generate/music", icon: Music, color: "from-purple-500 to-violet-500" },
  { title: "AI Chat", url: "/chat", icon: MessageSquare, color: "from-emerald-500 to-teal-500" },
];

export default function GettingStarted() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const { data: welcomeContent } = useQuery<{ welcomeVideoUrl: string | null; welcomeSlides: WelcomeSlide[] }>({
    queryKey: ['/api/welcome'],
    queryFn: async () => {
      const response = await fetch('/api/welcome');
      if (!response.ok) throw new Error('Failed to fetch welcome content');
      return response.json();
    },
  });

  const slides = welcomeContent?.welcomeSlides?.length ? welcomeContent.welcomeSlides : defaultSlides;
  const rawVideoUrl = welcomeContent?.welcomeVideoUrl;

  // Get video embed URL - supports PeerTube exclusively (per user requirement)
  const getVideoEmbedUrl = (url: string | null | undefined): string | null => {
    if (!url || url.trim() === '') return null;

    try {
      const lowerUrl = url.toLowerCase();

      // PeerTube support (primary - user uses PeerTube exclusively)
      if (lowerUrl.includes("/videos/watch/") || lowerUrl.includes("/w/") || lowerUrl.includes("/videos/embed/")) {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        let videoId = "";
        const watchMatch = url.match(/\/videos\/watch\/([a-zA-Z0-9-]+)/);
        const shortMatch = url.match(/\/w\/([a-zA-Z0-9-]+)/);
        const embedMatch = url.match(/\/videos\/embed\/([a-zA-Z0-9-]+)/);
        
        if (watchMatch) videoId = watchMatch[1];
        else if (shortMatch) videoId = shortMatch[1];
        else if (embedMatch) videoId = embedMatch[1];
        
        if (videoId) {
          return `https://${hostname}/videos/embed/${videoId}`;
        }
      }

      // Already an embed URL
      if (url.includes("embed") || url.includes("player")) {
        return url;
      }

      return null;
    } catch {
      return null;
    }
  };

  // Only show video if we have a valid embed URL
  const videoEmbedUrl = getVideoEmbedUrl(rawVideoUrl);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const currentSlideData = slides[currentSlide];
  const IconComponent = iconMap[currentSlideData?.icon] || Sparkles;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-violet-500 bg-clip-text text-transparent">
            Getting Started with Artivio AI
          </h1>
          <p className="text-muted-foreground">
            Learn how to make the most of our AI-powered creative tools
          </p>
        </div>

        {videoEmbedUrl && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <PlayCircle className="h-5 w-5 text-purple-400" />
                Welcome Video
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video rounded-lg overflow-hidden bg-black/50">
                <iframe
                  src={videoEmbedUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Welcome to Artivio AI"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-purple-400" />
              Platform Highlights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-900/20 to-violet-900/20 p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="text-center space-y-4"
                >
                  <div className="flex justify-center">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600">
                      <IconComponent className="h-10 w-10 text-white" />
                    </div>
                  </div>
                  
                  {currentSlideData?.highlight && (
                    <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {currentSlideData.highlight}
                    </span>
                  )}
                  
                  <h3 className="text-2xl font-bold text-foreground">
                    {currentSlideData?.title}
                  </h3>
                  
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {currentSlideData?.description}
                  </p>
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-between mt-8">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={prevSlide}
                  className="rounded-full"
                  data-testid="button-prev-slide"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                <div className="flex gap-2">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentSlide
                          ? "bg-purple-500 w-6"
                          : "bg-purple-500/30 hover:bg-purple-500/50"
                      }`}
                      data-testid={`button-slide-${index}`}
                    />
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={nextSlide}
                  className="rounded-full"
                  data-testid="button-next-slide"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Rocket className="h-5 w-5 text-purple-400" />
              Quick Start
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickStartLinks.map((link) => (
                <Link key={link.url} href={link.url}>
                  <div className="group p-4 rounded-xl border border-border hover:border-purple-500/50 transition-all cursor-pointer hover:bg-purple-500/5">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${link.color} flex items-center justify-center mb-3`}>
                      <link.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{link.title}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-400 transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
