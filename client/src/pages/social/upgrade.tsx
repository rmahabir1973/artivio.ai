import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  Check, 
  Sparkles,
  Calendar,
  BarChart3,
  Wand2,
  Upload,
  ArrowRight,
  Zap,
  Globe,
  Clock,
  TrendingUp,
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
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/authBridge";

const SOCIAL_POSTER_PRICE_ID = "price_1SZa3PKvkQlROMzf7X2POgZX";

interface SubscriptionStatus {
  hasSocialPoster: boolean;
  status?: string;
}

interface UserSubscriptionInfo {
  hasSubscription: boolean;
  isPaidPlan: boolean;
  planName?: string;
  billingPeriod?: string;
}

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
  {
    icon: Globe,
    title: "Post to 9 Platforms",
    description: "Reach your audience everywhere with one click. Instagram, TikTok, LinkedIn, YouTube, Facebook, X, Threads, Pinterest, and Bluesky.",
  },
  {
    icon: Wand2,
    title: "AI-Powered Captions",
    description: "Generate engaging captions and trending hashtags automatically using our advanced AI assistant.",
  },
  {
    icon: Calendar,
    title: "Content Calendar",
    description: "Plan and schedule your posts in advance with our intuitive drag-and-drop calendar interface.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description: "Track performance across all platforms with comprehensive analytics and insights.",
  },
  {
    icon: Upload,
    title: "Drag-and-Drop Uploads",
    description: "Easily upload and organize your media with our streamlined drag-and-drop interface.",
  },
  {
    icon: Clock,
    title: "Smart Scheduling",
    description: "AI-optimized posting times to maximize engagement based on your audience activity.",
  },
];

export default function SocialUpgrade() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: subscriptionStatus, isLoading: isLoadingStatus } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/social/subscription-status"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/social/subscription-status");
      if (!response.ok) {
        throw new Error("Failed to fetch subscription status");
      }
      return response.json();
    },
    enabled: !!user,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Fetch user's main subscription to check if they have a paid plan
  const { data: userSubscription, isLoading: isLoadingSubscription } = useQuery<UserSubscriptionInfo>({
    queryKey: ["/api/billing/subscription-info"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/billing/subscription-info");
      if (!response.ok) {
        // If no subscription, return default values
        if (response.status === 404) {
          return { hasSubscription: false, isPaidPlan: false };
        }
        throw new Error("Failed to fetch subscription info");
      }
      return response.json();
    },
    enabled: !!user,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (subscriptionStatus?.hasSocialPoster) {
      setLocation("/social/connect");
    }
  }, [subscriptionStatus, setLocation]);

  const handleGetStarted = async () => {
    if (!user) {
      window.location.href = "/login?redirect=/social/upgrade";
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetchWithAuth("/api/stripe/add-social-poster", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          priceId: SOCIAL_POSTER_PRICE_ID,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error codes for subscription requirements
        if (data.code === 'NO_SUBSCRIPTION' || data.code === 'FREE_TRIAL') {
          toast({
            title: "Paid Subscription Required",
            description: data.message || "Please upgrade to a paid plan to access Social Media Poster.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error("Error initiating checkout:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  // Determine if user can purchase Social Media Poster
  const canPurchase = userSubscription?.isPaidPlan === true;
  const isOnFreeTrial = userSubscription?.hasSubscription && !userSubscription?.isPaidPlan;
  const hasNoSubscription = !userSubscription?.hasSubscription;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-5xl py-12 px-4">
          <UpgradeContent 
            isSubmitting={isSubmitting}
            onGetStarted={handleGetStarted}
            isAuthenticated={false}
          />
        </div>
      </div>
    );
  }

  if (isLoadingStatus || isLoadingSubscription) {
    return (
      <div className="container mx-auto max-w-4xl py-16 px-4">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-loading">
            Checking subscription status...
          </p>
        </div>
      </div>
    );
  }

  if (subscriptionStatus?.hasSocialPoster) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-5xl py-12 px-4">
        <UpgradeContent 
          isSubmitting={isSubmitting}
          onGetStarted={handleGetStarted}
          isAuthenticated={true}
          canPurchase={canPurchase}
          isOnFreeTrial={isOnFreeTrial}
          hasNoSubscription={hasNoSubscription}
          planName={userSubscription?.planName}
        />
      </div>
    </div>
  );
}

interface UpgradeContentProps {
  isSubmitting: boolean;
  onGetStarted: () => void;
  isAuthenticated: boolean;
  canPurchase?: boolean;
  isOnFreeTrial?: boolean;
  hasNoSubscription?: boolean;
  planName?: string;
}

function UpgradeContent({ isSubmitting, onGetStarted, isAuthenticated, canPurchase, isOnFreeTrial, hasNoSubscription, planName }: UpgradeContentProps) {
  // Determine if user needs to upgrade first (authenticated but not on a paid plan)
  const needsUpgrade = isAuthenticated && (isOnFreeTrial || hasNoSubscription);
  
  return (
    <>
      <div className="text-center mb-12">
        <Badge 
          variant="outline" 
          className="mb-4 border-purple-500/50 text-purple-400 bg-purple-500/10"
          data-testid="badge-addon"
        >
          <Sparkles className="w-3 h-3 mr-1" />
          Premium Add-On
        </Badge>
        
        <h1 
          className="text-4xl md:text-5xl font-bold tracking-tight mb-4"
          data-testid="text-page-title"
        >
          Social Media Poster
        </h1>
        
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
          Supercharge your social media presence. Post AI-generated content to 9 platforms 
          with intelligent scheduling and analytics.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {PLATFORMS.map((platform) => {
            const Icon = platform.icon;
            return (
              <div 
                key={platform.name}
                className={`w-10 h-10 bg-gradient-to-br ${platform.color} rounded-lg flex items-center justify-center`}
                title={platform.name}
                data-testid={`icon-platform-${platform.name.toLowerCase()}`}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>
            );
          })}
        </div>
      </div>

      <Card className="mb-12 border-purple-500/30 bg-gradient-to-b from-purple-500/5 to-transparent">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <div className="flex items-baseline gap-2 justify-center md:justify-start">
                <span className="text-5xl font-bold" data-testid="text-price">$25</span>
                <span className="text-xl text-muted-foreground">/month</span>
              </div>
              <p className="text-muted-foreground mt-2">
                Add to your existing subscription
              </p>
              <div className="flex items-center gap-2 mt-3 justify-center md:justify-start">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">
                  Requires a paid plan
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto">
              {needsUpgrade ? (
                <>
                  <Card className="bg-amber-500/10 border-amber-500/30 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-amber-500" data-testid="text-upgrade-required">
                          Paid Subscription Required
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {isOnFreeTrial 
                            ? `Your ${planName || 'Free Trial'} doesn't include add-ons. Upgrade to a paid plan to access Social Media Poster.`
                            : 'You need an active paid subscription to add Social Media Poster.'}
                        </p>
                      </div>
                    </div>
                  </Card>
                  <Button 
                    size="lg"
                    onClick={() => window.location.href = '/pricing'}
                    className="gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 h-12"
                    data-testid="button-upgrade-plan"
                  >
                    View Plans
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    size="lg"
                    onClick={onGetStarted}
                    disabled={isSubmitting}
                    className="gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 h-12"
                    data-testid="button-get-started"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {isAuthenticated ? "Get Started" : "Sign Up to Get Started"}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Cancel anytime. Billed monthly.
                  </p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-12">
        <h2 
          className="text-2xl font-semibold text-center mb-8"
          data-testid="text-features-heading"
        >
          Everything You Need to Grow
        </h2>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={index} 
                className="hover-elevate"
                data-testid={`card-feature-${index}`}
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Separator className="my-12" />

      <div className="mb-12">
        <h2 
          className="text-2xl font-semibold text-center mb-8"
          data-testid="text-included-heading"
        >
          What's Included
        </h2>
        
        <div className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto">
          {[
            "Unlimited scheduled posts",
            "AI caption and hashtag generation",
            "Content calendar with drag-and-drop",
            "Analytics across all platforms",
            "Bulk upload support",
            "Optimal posting time suggestions",
            "Post templates library",
            "Cross-platform content adaptation",
          ].map((item, index) => (
            <div 
              key={index} 
              className="flex items-center gap-3"
              data-testid={`item-included-${index}`}
            >
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-green-500" />
              </div>
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <TrendingUp className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Ready to Grow Your Audience?</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Join thousands of creators using AI-powered social media management to 
            save time and increase engagement.
          </p>
          {needsUpgrade ? (
            <Button 
              size="lg"
              onClick={() => window.location.href = '/pricing'}
              className="gap-2"
              data-testid="button-upgrade-plan-bottom"
            >
              View Plans to Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button 
              size="lg"
              onClick={onGetStarted}
              disabled={isSubmitting}
              className="gap-2"
              data-testid="button-get-started-bottom"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Start Posting Today
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}
