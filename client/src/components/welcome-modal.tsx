import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  DollarSign,
  Wand2,
  Palette,
  Layers,
  Video,
  Image,
  Music,
  Mic,
  ChevronRight,
  X,
  Play,
  Zap,
  TrendingDown,
  Lightbulb,
  LayoutGrid,
  ArrowRight,
  Star,
  Check,
  Users,
  Settings,
  Home,
  FileText,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Sparkles,
  DollarSign,
  Wand2,
  Palette,
  Layers,
  Video,
  Image,
  Music,
  Mic,
  ChevronRight,
  X,
  Play,
  Zap,
  TrendingDown,
  Lightbulb,
  LayoutGrid,
  ArrowRight,
  Star,
  Check,
  Users,
  Settings,
  Home,
  FileText,
};

export interface WelcomeSlide {
  id: string;
  title: string;
  description: string;
  icon?: string;
  highlight?: string;
}

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  welcomeVideoUrl?: string;
  slides?: WelcomeSlide[];
}

const DEFAULT_SLIDES: WelcomeSlide[] = [
  {
    id: "welcome",
    title: "Welcome to Artivio AI",
    description: "Your all-in-one creative platform for AI-powered content generation. Create stunning videos, images, music, and more with cutting-edge AI models.",
    icon: "Sparkles",
    highlight: "Start creating in minutes",
  },
  {
    id: "lower-costs",
    title: "Save Up to 70% on AI Generation",
    description: "We've optimized our infrastructure to deliver enterprise-quality results at a fraction of the cost of other platforms.",
    icon: "TrendingDown",
    highlight: "Industry-leading value",
  },
  {
    id: "prompt-assistant",
    title: "AI Prompt Assistant",
    description: "Struggling with prompts? Our built-in AI assistant helps you craft perfect prompts for any generation type. Get suggestions, refine your ideas, and achieve better results.",
    icon: "Lightbulb",
    highlight: "Never face a blank prompt again",
  },
  {
    id: "brand-builder",
    title: "Brand Builder Workflows",
    description: "Access 10+ pre-built marketing workflows designed for creators and marketers. From product ads to social promos, generate professional content with just a few clicks.",
    icon: "LayoutGrid",
    highlight: "Perfect for marketers & creators",
  },
  {
    id: "all-in-one",
    title: "All-in-One Creative Platform",
    description: "Video generation, image creation, music composition, voice cloning, text-to-speech, and more. Everything you need to bring your creative vision to life in one place.",
    icon: "Layers",
    highlight: "Video • Images • Music • Voice",
  },
];

function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;

  try {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) {
      let videoId = "";
      
      if (lowerUrl.includes("youtu.be")) {
        const match = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
        if (match) videoId = match[1];
      } else if (lowerUrl.includes("embed")) {
        const match = url.match(/embed\/([a-zA-Z0-9_-]+)/);
        if (match) videoId = match[1];
      } else {
        const urlObj = new URL(url);
        videoId = urlObj.searchParams.get("v") || "";
      }
      
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?rel=0`;
      }
    }

    if (lowerUrl.includes("vimeo.com")) {
      const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (match) {
        return `https://player.vimeo.com/video/${match[1]}`;
      }
    }

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

    if (url.includes("embed") || url.includes("player")) {
      return url;
    }

    return null;
  } catch {
    return null;
  }
}

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = iconMap[name];
  if (!IconComponent) {
    return <Sparkles className={className} />;
  }
  return <IconComponent className={className} />;
}

export function WelcomeModal({
  isOpen,
  onClose,
  welcomeVideoUrl,
  slides = DEFAULT_SLIDES,
}: WelcomeModalProps) {
  const [phase, setPhase] = useState<"video" | "slideshow">(
    welcomeVideoUrl ? "video" : "slideshow"
  );
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showContinueButton, setShowContinueButton] = useState(false);

  const embedUrl = useMemo(() => {
    if (!welcomeVideoUrl) return null;
    return getVideoEmbedUrl(welcomeVideoUrl);
  }, [welcomeVideoUrl]);

  useEffect(() => {
    if (phase === "video" && welcomeVideoUrl) {
      const timer = setTimeout(() => {
        setShowContinueButton(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [phase, welcomeVideoUrl]);

  useEffect(() => {
    if (isOpen) {
      setPhase(welcomeVideoUrl ? "video" : "slideshow");
      setCurrentSlide(0);
      setShowContinueButton(false);
    }
  }, [isOpen, welcomeVideoUrl]);

  const handleSkipVideo = () => {
    setPhase("slideshow");
    setCurrentSlide(0);
  };

  const handleContinueToTour = () => {
    setPhase("slideshow");
    setCurrentSlide(0);
  };

  const handleNextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const handleGetStarted = () => {
    onClose();
  };

  const handleSkipTour = () => {
    onClose();
  };

  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-full p-0 bg-card border-border overflow-hidden">
        <AnimatePresence mode="wait">
          {phase === "video" && embedUrl && (
            <motion.div
              key="video-phase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                  title="Welcome Video"
                />
              </div>
              
              <div className="p-6 flex items-center justify-between gap-4 flex-wrap">
                <Button
                  variant="ghost"
                  onClick={handleSkipVideo}
                  data-testid="button-skip-video"
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4 mr-2" />
                  Skip Video
                </Button>
                
                <AnimatePresence>
                  {showContinueButton && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      <Button
                        onClick={handleContinueToTour}
                        data-testid="button-continue-video"
                        className="gap-2"
                      >
                        Continue to Tour
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {phase === "slideshow" && (
            <motion.div
              key="slideshow-phase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="p-6 sm:p-8"
            >
              <div className="min-h-[320px] sm:min-h-[280px] flex flex-col">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="flex-1"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center mb-6">
                        <DynamicIcon
                          name={slides[currentSlide].icon || "Sparkles"}
                          className="h-10 w-10 text-white"
                        />
                      </div>

                      <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                        {slides[currentSlide].title}
                      </h2>

                      <p className="text-muted-foreground text-base sm:text-lg max-w-lg mb-4">
                        {slides[currentSlide].description}
                      </p>

                      {slides[currentSlide].highlight && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                          <Star className="h-4 w-4 text-primary" />
                          <span className="text-primary font-medium">
                            {slides[currentSlide].highlight}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex items-center justify-center gap-2 my-6">
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    onClick={() => setCurrentSlide(index)}
                    data-testid={`slide-indicator-${index}`}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      index === currentSlide
                        ? "bg-primary w-8"
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  onClick={handleSkipTour}
                  data-testid="button-skip-tour"
                  className="text-muted-foreground"
                >
                  Skip Tour
                </Button>

                {isLastSlide ? (
                  <Button
                    onClick={handleGetStarted}
                    data-testid="button-get-started"
                    className="gap-2"
                    size="lg"
                  >
                    <Zap className="h-4 w-4" />
                    Get Started
                  </Button>
                ) : (
                  <Button
                    onClick={handleNextSlide}
                    data-testid="button-next-slide"
                    className="gap-2"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export { DEFAULT_SLIDES };
export type { WelcomeSlide as Slide };
