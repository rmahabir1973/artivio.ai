import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { fetchWithAuth } from "@/lib/authBridge";
import { SocialUpgradePrompt } from "@/components/social-upgrade-prompt";

const PLATFORM_ICONS: Record<string, any> = {
  instagram: SiInstagram,
  tiktok: SiTiktok,
  linkedin: SiLinkedin,
  youtube: SiYoutube,
  facebook: SiFacebook,
  x: SiX,
  threads: SiThreads,
  pinterest: SiPinterest,
  bluesky: SiBluesky,
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "from-purple-600 via-pink-500 to-orange-400",
  tiktok: "from-black to-gray-800",
  linkedin: "from-[#0A66C2] to-[#0077B5]",
  youtube: "from-[#FF0000] to-[#CC0000]",
  facebook: "from-[#1877F2] to-[#166FE5]",
  x: "from-black to-gray-800",
  threads: "from-black to-gray-800",
  pinterest: "from-[#E60023] to-[#BD001D]",
  bluesky: "from-[#0085FF] to-[#0066CC]",
};

interface PlatformAnalytics {
  platform: string;
  followers: number;
  followersChange: number;
  impressions: number;
  impressionsChange: number;
  engagement: number;
  engagementChange: number;
  postsThisWeek: number;
  topPost?: {
    caption: string;
    likes: number;
    comments: number;
    shares: number;
  };
}

interface OverallStats {
  totalFollowers: number;
  totalImpressions: number;
  avgEngagement: number;
  postsPublished: number;
}

interface SubscriptionStatus {
  hasSocialPoster: boolean;
  status?: string;
}

export default function SocialAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [timeRange, setTimeRange] = useState("7days");
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const { data: subscriptionStatus, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/social/subscription-status"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/social/subscription-status");
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.requiresSubscription) {
          return { hasSocialPoster: false };
        }
        throw new Error("Failed to fetch subscription status");
      }
      return response.json();
    },
    enabled: !!user,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const { data: connectedAccounts = [] } = useQuery<any[]>({
    queryKey: ["/api/social/accounts"],
    enabled: !!user && subscriptionStatus?.hasSocialPoster === true,
  });

  const { data: analytics, isLoading } = useQuery<{
    overall: OverallStats;
    platforms: PlatformAnalytics[];
  }>({
    queryKey: ["/api/social/analytics", timeRange],
    enabled: !!user && connectedAccounts.length > 0 && subscriptionStatus?.hasSocialPoster === true,
  });

  const connectedPlatformIds = connectedAccounts
    .filter((acc: any) => acc.connected)
    .map((acc: any) => acc.platform);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const renderChangeIndicator = (change: number) => {
    const isPositive = change >= 0;
    return (
      <div className={`flex items-center gap-1 text-sm ${isPositive ? "text-green-500" : "text-red-500"}`}>
        {isPositive ? (
          <ArrowUpRight className="w-4 h-4" />
        ) : (
          <ArrowDownRight className="w-4 h-4" />
        )}
        <span>{Math.abs(change)}%</span>
      </div>
    );
  };

  if (statusLoading) {
    return (
      <div className="container mx-auto max-w-6xl py-8 px-4">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-loading-status">
            Checking subscription status...
          </p>
        </div>
      </div>
    );
  }

  if (!subscriptionStatus?.hasSocialPoster) {
    return (
      <SocialUpgradePrompt 
        title="Unlock Analytics Dashboard"
        description="Track your social media performance across all platforms with comprehensive analytics and insights."
      />
    );
  }

  if (connectedAccounts.length === 0) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Connected Accounts</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Connect your social media accounts to start tracking your performance and engagement.
            </p>
            <Button asChild>
              <Link href="/social/connect">Connect Accounts</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your social media performance across all platforms.
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40" data-testid="select-time-range">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Last 7 days</SelectItem>
            <SelectItem value="30days">Last 30 days</SelectItem>
            <SelectItem value="90days">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : analytics ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Total Followers</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(analytics.overall.totalFollowers)}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">Impressions</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(analytics.overall.totalImpressions)}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Heart className="w-4 h-4" />
                  <span className="text-sm">Avg. Engagement</span>
                </div>
                <p className="text-2xl font-bold">{analytics.overall.avgEngagement}%</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Share2 className="w-4 h-4" />
                  <span className="text-sm">Posts Published</span>
                </div>
                <p className="text-2xl font-bold">{analytics.overall.postsPublished}</p>
              </CardContent>
            </Card>
          </div>

          <h2 className="text-xl font-semibold mb-4">Platform Performance</h2>
          <div className="grid gap-4">
            {analytics.platforms.map((platform) => {
              const Icon = PLATFORM_ICONS[platform.platform];
              const colors = PLATFORM_COLORS[platform.platform];
              
              return (
                <Card key={platform.platform} data-testid={`card-analytics-${platform.platform}`}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className={`w-12 h-12 bg-gradient-to-br ${colors} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        {Icon && <Icon className="w-6 h-6 text-white" />}
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="font-semibold capitalize mb-2">{platform.platform}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Followers</p>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{formatNumber(platform.followers)}</p>
                              {renderChangeIndicator(platform.followersChange)}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Impressions</p>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{formatNumber(platform.impressions)}</p>
                              {renderChangeIndicator(platform.impressionsChange)}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Engagement</p>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{platform.engagement}%</p>
                              {renderChangeIndicator(platform.engagementChange)}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Posts this week</p>
                            <p className="font-semibold">{platform.postsThisWeek}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {platform.topPost && (
                      <>
                        <Separator className="my-4" />
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Top Performing Post</p>
                          <p className="text-sm line-clamp-2 mb-2">{platform.topPost.caption}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Heart className="w-4 h-4" />
                              {formatNumber(platform.topPost.likes)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="w-4 h-4" />
                              {formatNumber(platform.topPost.comments)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Share2 className="w-4 h-4" />
                              {formatNumber(platform.topPost.shares)}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Analytics Data</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start posting content to see your analytics data here. It may take 24-48 hours for data to appear.
            </p>
            <Button asChild>
              <Link href="/social/strategist">Create Content</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
