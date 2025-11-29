import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag,
  Presentation,
  ArrowLeftRight,
  Share2,
  Quote,
  Film,
  Zap,
  Package,
  Sparkles,
  Star,
  Clock,
  Coins,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface BrandWorkflow {
  id: string;
  title: string;
  description: string;
  icon: any;
  url: string;
  credits: number;
  difficulty: "Beginner" | "Intermediate";
  estimatedTime: string;
}

const brandWorkflows: BrandWorkflow[] = [
  {
    id: "product-ad",
    title: "Instant Product Ad",
    description: "Upload a product image and generate a professional video advertisement in seconds. Perfect for e-commerce and social media marketing.",
    icon: ShoppingBag,
    url: "/brand-builder/product-ad",
    credits: 150,
    difficulty: "Beginner",
    estimatedTime: "2-3 min",
  },
  {
    id: "showcase",
    title: "Product Showcase",
    description: "Create stunning 360-degree product showcase videos with dynamic camera movements and professional lighting effects.",
    icon: Presentation,
    url: "/brand-builder/showcase",
    credits: 200,
    difficulty: "Beginner",
    estimatedTime: "3-4 min",
  },
  {
    id: "before-after",
    title: "Before & After",
    description: "Generate compelling before and after transformation videos. Ideal for fitness, beauty, home renovation, and product results.",
    icon: ArrowLeftRight,
    url: "/brand-builder/before-after",
    credits: 180,
    difficulty: "Beginner",
    estimatedTime: "2-3 min",
  },
  {
    id: "social-promo",
    title: "Social Media Promo",
    description: "Create eye-catching promotional content optimized for Instagram, TikTok, and other social platforms with trending formats.",
    icon: Share2,
    url: "/brand-builder/social-promo",
    credits: 120,
    difficulty: "Beginner",
    estimatedTime: "2-3 min",
  },
  {
    id: "testimonial",
    title: "Testimonial Video",
    description: "Transform customer reviews into authentic video testimonials with AI-generated visuals and professional voiceover.",
    icon: Quote,
    url: "/brand-builder/testimonial",
    credits: 250,
    difficulty: "Intermediate",
    estimatedTime: "4-5 min",
  },
  {
    id: "brand-story",
    title: "Brand Story",
    description: "Tell your brand's story with cinematic AI-generated videos, custom music, and professional narration. Perfect for about pages.",
    icon: Film,
    url: "/brand-builder/brand-story",
    credits: 350,
    difficulty: "Intermediate",
    estimatedTime: "5-7 min",
  },
  {
    id: "flash-sale",
    title: "Flash Sale Promo",
    description: "Generate high-energy promotional videos for flash sales, limited offers, and time-sensitive campaigns with countdown elements.",
    icon: Zap,
    url: "/brand-builder/flash-sale",
    credits: 130,
    difficulty: "Beginner",
    estimatedTime: "1-2 min",
  },
  {
    id: "unboxing",
    title: "Product Unboxing",
    description: "Create professional unboxing experience videos that showcase product packaging and reveal moments.",
    icon: Package,
    url: "/brand-builder/unboxing",
    credits: 220,
    difficulty: "Intermediate",
    estimatedTime: "3-4 min",
  },
  {
    id: "logo-animation",
    title: "Logo Animation",
    description: "Transform your static logo into a dynamic animated intro. Perfect for video openings, social media, and brand presence.",
    icon: Sparkles,
    url: "/brand-builder/logo-animation",
    credits: 100,
    difficulty: "Beginner",
    estimatedTime: "1-2 min",
  },
  {
    id: "influencer-ad",
    title: "Influencer Ad",
    description: "Create influencer-style promotional content with AI-generated presenters, authentic voiceovers, and engaging formats.",
    icon: Star,
    url: "/brand-builder/influencer-ad",
    credits: 300,
    difficulty: "Intermediate",
    estimatedTime: "4-6 min",
  },
];

export default function BrandBuilder() {
  return (
    <div className="min-h-full">
      <div className="p-6 md:p-8 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent" data-testid="text-brand-builder-title">
                Brand Builder
              </h1>
              <p className="text-muted-foreground text-sm md:text-base" data-testid="text-brand-builder-subtitle">
                Create professional marketing content with AI-powered workflows
              </p>
            </div>
          </div>
          <p className="text-muted-foreground max-w-3xl" data-testid="text-brand-builder-description">
            Transform your brand with our suite of AI-powered marketing tools. From instant product ads to cinematic brand stories, 
            create professional-quality content in minutes. Each workflow is designed to help you build a stronger brand presence 
            across all platforms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {brandWorkflows.map((workflow) => (
            <Link key={workflow.id} href={workflow.url}>
              <Card 
                className="group relative overflow-visible hover-elevate transition-all duration-200 cursor-pointer h-full"
                data-testid={`card-workflow-${workflow.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-lg flex-shrink-0",
                      "bg-gradient-to-br from-yellow-400 to-orange-500"
                    )}>
                      <workflow.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-lg" data-testid={`text-workflow-title-${workflow.id}`}>
                        {workflow.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge 
                          variant={workflow.difficulty === "Beginner" ? "secondary" : "outline"}
                          className="text-xs"
                          data-testid={`badge-difficulty-${workflow.id}`}
                        >
                          {workflow.difficulty}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <CardDescription className="text-sm leading-relaxed" data-testid={`text-workflow-description-${workflow.id}`}>
                    {workflow.description}
                  </CardDescription>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5" data-testid={`text-credits-${workflow.id}`}>
                        <Coins className="h-4 w-4 text-yellow-500" />
                        <span>{workflow.credits} credits</span>
                      </div>
                      <div className="flex items-center gap-1.5" data-testid={`text-time-${workflow.id}`}>
                        <Clock className="h-4 w-4 text-blue-400" />
                        <span>{workflow.estimatedTime}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full" 
                    data-testid={`button-start-${workflow.id}`}
                  >
                    Start Workflow
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-lg bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold" data-testid="text-explore-more-title">
                Looking for more creative tools?
              </h3>
              <p className="text-muted-foreground text-sm" data-testid="text-explore-more-description">
                Explore our full suite of AI generation tools for video, image, and audio content.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/generate/video">
                <Button variant="outline" data-testid="button-explore-video">
                  Video Generation
                </Button>
              </Link>
              <Link href="/generate/image">
                <Button variant="outline" data-testid="button-explore-image">
                  Image Generation
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
