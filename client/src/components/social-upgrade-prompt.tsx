import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Lock,
  Sparkles,
  Globe,
  Wand2,
  Calendar,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { 
  SiInstagram, 
  SiTiktok, 
  SiLinkedin, 
  SiYoutube, 
  SiFacebook, 
  SiX,
  SiThreads,
  SiPinterest,
  SiBluesky,
} from "react-icons/si";
import { Link } from "wouter";

const PLATFORMS = [
  { name: "Instagram", icon: SiInstagram, color: "from-purple-600 via-pink-500 to-orange-400" },
  { name: "TikTok", icon: SiTiktok, color: "from-zinc-900 to-zinc-700" },
  { name: "LinkedIn", icon: SiLinkedin, color: "from-[#0A66C2] to-[#004182]" },
  { name: "YouTube", icon: SiYoutube, color: "from-[#FF0000] to-[#CC0000]" },
  { name: "Facebook", icon: SiFacebook, color: "from-[#1877F2] to-[#0866FF]" },
  { name: "X", icon: SiX, color: "from-zinc-900 to-zinc-700" },
  { name: "Threads", icon: SiThreads, color: "from-zinc-900 to-zinc-700" },
  { name: "Pinterest", icon: SiPinterest, color: "from-[#E60023] to-[#BD001B]" },
  { name: "Bluesky", icon: SiBluesky, color: "from-[#0085FF] to-[#0066CC]" },
];

const FEATURES = [
  { icon: Globe, title: "Post to 9 Platforms", description: "Reach your audience everywhere" },
  { icon: Wand2, title: "AI Captions", description: "Generate engaging content" },
  { icon: Calendar, title: "Content Calendar", description: "Schedule posts in advance" },
  { icon: BarChart3, title: "Analytics", description: "Track your performance" },
];

interface SocialUpgradePromptProps {
  title?: string;
  description?: string;
}

export function SocialUpgradePrompt({ 
  title = "Unlock Social Media Poster",
  description = "Post AI-generated content to 9 platforms with intelligent scheduling and analytics."
}: SocialUpgradePromptProps) {
  return (
    <div className="container mx-auto max-w-3xl py-8 px-4" data-testid="social-upgrade-prompt">
      <Card className="border-purple-500/30 bg-gradient-to-b from-purple-500/5 to-transparent">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-purple-400" />
            </div>
            
            <Badge 
              variant="outline" 
              className="mb-4 border-purple-500/50 text-purple-400 bg-purple-500/10"
              data-testid="badge-premium"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Premium Add-On
            </Badge>
            
            <h2 
              className="text-2xl md:text-3xl font-bold tracking-tight mb-3"
              data-testid="text-upgrade-title"
            >
              {title}
            </h2>
            
            <p className="text-muted-foreground max-w-lg mx-auto">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {PLATFORMS.map((platform) => {
              const Icon = platform.icon;
              return (
                <div 
                  key={platform.name}
                  className={`w-9 h-9 bg-gradient-to-br ${platform.color} rounded-lg flex items-center justify-center opacity-80`}
                  title={platform.name}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={index}
                  className="text-center p-3 rounded-lg bg-muted/30"
                  data-testid={`feature-${index}`}
                >
                  <Icon className="w-5 h-5 text-purple-400 mx-auto mb-2" />
                  <p className="text-sm font-medium">{feature.title}</p>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>

          <div className="text-center">
            <div className="flex items-baseline gap-2 justify-center mb-4">
              <span className="text-4xl font-bold" data-testid="text-price">$25</span>
              <span className="text-lg text-muted-foreground">/month</span>
            </div>
            
            <Button 
              size="lg"
              asChild
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8"
              data-testid="button-upgrade"
            >
              <Link href="/social/upgrade">
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            
            <p className="text-xs text-muted-foreground mt-3">
              Add to your existing subscription. Cancel anytime.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
