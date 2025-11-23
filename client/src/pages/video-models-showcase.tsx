import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Loader2, Play, Zap, Sparkles, Wand2, Volume2, ImageIcon, RotateCcw, Tv } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const VIDEO_MODELS = [
  {
    value: "veo-3.1",
    label: "Veo 3.1 Quality",
    description: "HD quality with synchronized audio",
    duration: "8s",
    supportsImages: false,
    icon: <Sparkles className="w-5 h-5" />,
    features: [
      "Highest Quality Video Output",
      "Professional HD Generation",
      "Smart Audio Integration for Immersive Feel",
      "Advanced Scene Understanding"
    ],
    useCases: ["Visual Storytellers & Artists", "Social Media Creators", "Educators & Presenters"]
  },
  {
    value: "veo-3.1-fast",
    label: "Veo 3.1 Fast",
    description: "Faster generation, great quality",
    duration: "8s",
    supportsImages: true,
    icon: <Zap className="w-5 h-5" />,
    features: [
      "Turn Photos into Motion Visuals",
      "Studio-Quality Results from a Single Image",
      "Smart Audio Integration for Immersive Feel",
      "Style-Aware Scene Animation"
    ],
    useCases: ["Visual Storytellers & Artists", "Social Media Creators", "Educators & Presenters"]
  },
  {
    value: "veo-3",
    label: "Veo 3",
    description: "High-quality video generation",
    duration: "8s",
    supportsImages: true,
    icon: <Tv className="w-5 h-5" />,
    features: [
      "Turn Photos into Motion Visuals",
      "Studio-Quality Results from a Single Image",
      "Smart Audio Integration for Immersive Feel",
      "Style-Aware Scene Animation"
    ],
    useCases: ["Visual Storytellers & Artists", "Social Media Creators", "Product Designers & Brand Marketers"]
  },
  {
    value: "runway-gen3-alpha-turbo",
    label: "Runway Gen-3",
    description: "HD quality video generation",
    duration: "5s, 10s",
    supportsImages: true,
    icon: <Wand2 className="w-5 h-5" />,
    features: [
      "Advanced scene reasoning and camera control",
      "Professional HD quality (720p)",
      "Multi-aspect ratio support (16:9, 4:3, 1:1, 3:4, 9:16)",
      "Realistic physics simulation"
    ],
    useCases: ["Visual Storytellers & Artists", "Social Media Creators", "Product Designers & Brand Marketers"]
  },
  {
    value: "seedance-1-pro",
    label: "Seedance 1.0 Pro",
    description: "1080p cinematic quality with camera control",
    duration: "10s",
    supportsImages: true,
    icon: <Sparkles className="w-5 h-5" />,
    features: [
      "1080p cinematic quality",
      "Advanced camera control",
      "Professional-grade motion",
      "Detailed scene generation"
    ],
    useCases: ["Visual Storytellers & Artists", "Product Designers & Brand Marketers", "Wedding & Portrait Photographers"]
  },
  {
    value: "seedance-1-lite",
    label: "Seedance 1.0 Lite",
    description: "720p fast generation",
    duration: "10s",
    supportsImages: true,
    icon: <Zap className="w-5 h-5" />,
    features: [
      "Fast 720p generation",
      "Great for quick iterations",
      "Smooth motion synthesis",
      "Cost-effective generation"
    ],
    useCases: ["Social Media Creators", "Educators & Presenters", "Visual Storytellers & Artists"]
  },
  {
    value: "wan-2.5",
    label: "Wan 2.5",
    description: "Native audio sync & lip-sync support",
    duration: "10s",
    supportsImages: true,
    icon: <Volume2 className="w-5 h-5" />,
    features: [
      "Native audio sync & lip-sync",
      "Perfect for video content",
      "Natural motion synthesis",
      "Professional audio integration"
    ],
    useCases: ["Educators & Presenters", "Social Media Creators", "Visual Storytellers & Artists"]
  },
  {
    value: "kling-2.5-turbo",
    label: "Kling 2.5 Turbo",
    description: "Fast, fluid motion with realistic physics",
    duration: "5s, 10s",
    supportsImages: true,
    icon: <Zap className="w-5 h-5" />,
    features: [
      "Fast, fluid motion generation",
      "Realistic physics simulation",
      "Quick generation times",
      "Professional quality output"
    ],
    useCases: ["Social Media Creators", "Visual Storytellers & Artists", "Product Designers & Brand Marketers"]
  },
  {
    value: "kling-2.1",
    label: "Kling 2.1",
    description: "Professional hyper-realistic video generation",
    duration: "5s, 10s",
    supportsImages: true,
    icon: <Sparkles className="w-5 h-5" />,
    features: [
      "Hyper-realistic video generation",
      "Professional-grade quality",
      "Advanced motion control",
      "Cinematic output"
    ],
    useCases: ["Visual Storytellers & Artists", "Product Designers & Brand Marketers", "Wedding & Portrait Photographers"]
  }
];

export default function VideoModelsShowcase() {
  const [, navigate] = useLocation();

  const { data: showcaseVideos = [], isLoading } = useQuery({
    queryKey: ["/api/showcase-videos"],
  });

  const handleSelectModel = (modelValue: string) => {
    // Sora has its own separate page
    if (modelValue === "sora-2-pro") {
      navigate("/generate/sora");
    } else {
      // All other models use the main video generation page
      navigate("/generate/video");
    }
    sessionStorage.setItem("selectedModel", modelValue);
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Hero Section */}
      <section className="w-full bg-gradient-to-b from-muted/50 to-transparent py-12 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold">AI Video Generation Models</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Bring still images to life using advanced AI. Explore our collection of video generation models with different capabilities, speeds, and quality levels.
          </p>
        </div>
      </section>

      {/* Showcase Videos Section */}
      {showcaseVideos && showcaseVideos.length > 0 && (
        <section className="w-full py-12 px-4 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">Featured Generations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {showcaseVideos.slice(0, 6).map((video: any) => (
                <Card key={video.id} className="overflow-hidden hover-elevate">
                  <div className="relative w-full aspect-video bg-black">
                    <video
                      src={video.resultUrl}
                      className="w-full h-full object-cover"
                      controls
                      loop
                      playsInline
                    />
                  </div>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">{video.model.toUpperCase()}</CardTitle>
                    <CardDescription className="text-xs line-clamp-2">{video.prompt}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All Models Grid */}
      <section className="w-full py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Available Models</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {VIDEO_MODELS.map((model) => (
              <Card key={model.value} className="hover-elevate flex flex-col h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-primary">{model.icon}</div>
                        <CardTitle className="text-xl">{model.label}</CardTitle>
                      </div>
                      <CardDescription>{model.description}</CardDescription>
                    </div>
                    {model.supportsImages && (
                      <Badge variant="secondary" className="shrink-0">
                        I2V
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-4">
                  {/* Features */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Key Features</h4>
                    <ul className="space-y-1">
                      {model.features.map((feature, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Use Cases */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Best For</h4>
                    <div className="flex flex-wrap gap-2">
                      {model.useCases.map((useCase, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {useCase}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Duration & Specs */}
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-4">Duration: {model.duration}</p>
                    <Button
                      onClick={() => handleSelectModel(model.value)}
                      className="w-full"
                      size="sm"
                      data-testid={`button-select-model-${model.value}`}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Generate with this model
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How to Use Section */}
      <section className="w-full py-12 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">How to Use AI Video Generator</h2>
          <div className="space-y-4 max-w-3xl mx-auto">
            {[
              { step: 1, title: "Sign Up or Log In", desc: "Get started by creating a free account or logging in." },
              { step: 2, title: "Access the Video Tool", desc: "Open the feature from your dashboard to start creating." },
              { step: 3, title: "Upload Your Image", desc: "Use a JPG or PNG image. Portraits, landscapes, product shots, and illustrations are all supported." },
              { step: 4, title: "Write a Prompt", desc: "Enter a text prompt describing the desired video scene. For example: \"A slow cinematic zoom into a woman's face as wind blows through her hair\" or \"Product rotating on a glossy black background with dramatic lighting\"" },
              { step: 5, title: "Generate & Export", desc: "Click Generate. The AI interprets your prompt and animates your image into a complete short-form video." }
            ].map((item) => (
              <Card key={item.step}>
                <CardContent className="p-4 flex gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold shrink-0">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{item.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
