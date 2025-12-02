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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Clock,
  CheckCircle,
  XCircle,
  Bot,
  Sparkles,
  Target,
  Activity,
  PieChart,
  FileText,
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
  SiReddit,
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
  twitter: SiX,
  threads: SiThreads,
  pinterest: SiPinterest,
  bluesky: SiBluesky,
  reddit: SiReddit,
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "from-purple-600 via-pink-500 to-orange-400",
  tiktok: "from-black to-gray-800",
  linkedin: "from-[#0A66C2] to-[#0077B5]",
  youtube: "from-[#FF0000] to-[#CC0000]",
  facebook: "from-[#1877F2] to-[#166FE5]",
  x: "from-black to-gray-800",
  twitter: "from-black to-gray-800",
  threads: "from-black to-gray-800",
  pinterest: "from-[#E60023] to-[#BD001D]",
  bluesky: "from-[#0085FF] to-[#0066CC]",
  reddit: "from-[#FF4500] to-[#CC3700]",
};

const PLATFORM_NAMES: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  facebook: "Facebook",
  x: "X",
  twitter: "X (Twitter)",
  threads: "Threads",
  pinterest: "Pinterest",
  bluesky: "Bluesky",
  reddit: "Reddit",
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
  postsTotal: number;
  postsScheduled: number;
  postsFailed: number;
  successRate: number;
  aiGeneratedCount: number;
  manualCount: number;
  avgPostsPerDay: number;
  contentTypes: Record<string, number>;
  lastPostDate: string | null;
}

interface OverallStats {
  totalFollowers: number;
  totalImpressions: number;
  avgEngagement: number;
  postsPublished: number;
  totalPosts: number;
  scheduledPosts: number;
  failedPosts: number;
  successRate: number;
  aiGeneratedRatio: number;
  platformCount: number;
  avgPostsPerDay: number;
}

interface TimelineEntry {
  date: string;
  postsCount: number;
  publishedCount: number;
  failedCount: number;
  platforms: Record<string, number>;
}

interface ContentTypeEntry {
  type: string;
  count: number;
  percentage: number;
}

interface PostingTimeEntry {
  hour: number;
  successRate: number;
  count: number;
}

interface AnalyticsData {
  overall: OverallStats;
  platforms: PlatformAnalytics[];
  timeline: TimelineEntry[];
  topContentTypes: ContentTypeEntry[];
  bestPostingTimes: PostingTimeEntry[];
  connectedPlatforms: string[];
  timeRange: string;
}

interface SubscriptionStatus {
  hasSocialPoster: boolean;
  status?: string;
}

export default function SocialAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [timeRange, setTimeRange] = useState("7days");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");

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

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/social/analytics", timeRange, selectedPlatform === "all" ? undefined : selectedPlatform],
    queryFn: async () => {
      const params = new URLSearchParams({ timeRange });
      if (selectedPlatform !== "all") {
        params.set("platform", selectedPlatform);
      }
      const response = await fetchWithAuth(`/api/social/analytics?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
    enabled: !!user && connectedAccounts.length > 0 && subscriptionStatus?.hasSocialPoster === true,
    refetchOnWindowFocus: false,
  });

  const connectedPlatformIds = connectedAccounts
    .filter((acc: any) => acc.connected)
    .map((acc: any) => acc.platform);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
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
            <Button asChild data-testid="button-connect-accounts">
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
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="w-40" data-testid="select-platform-filter">
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {analytics?.connectedPlatforms?.map((platform) => {
                const Icon = PLATFORM_ICONS[platform];
                return (
                  <SelectItem key={platform} value={platform}>
                    <div className="flex items-center gap-2">
                      {Icon && <Icon className="w-4 h-4" />}
                      <span className="capitalize">{PLATFORM_NAMES[platform] || platform}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
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
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : analytics ? (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="platforms" data-testid="tab-platforms">Platforms</TabsTrigger>
            <TabsTrigger value="content" data-testid="tab-content">Content</TabsTrigger>
            <TabsTrigger value="timing" data-testid="tab-timing">Timing</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm">Total Posts</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="stat-total-posts">{analytics.overall.totalPosts}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics.overall.avgPostsPerDay} per day avg
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Published</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600" data-testid="stat-published-posts">{analytics.overall.postsPublished}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics.overall.successRate}% success rate
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Scheduled</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600" data-testid="stat-scheduled-posts">{analytics.overall.scheduledPosts}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Waiting to publish
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm">Failed</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600" data-testid="stat-failed-posts">{analytics.overall.failedPosts}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Need attention
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Success Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-4xl font-bold">{analytics.overall.successRate}%</span>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Publishing Success</p>
                        <p className="text-xs text-muted-foreground">
                          {analytics.overall.postsPublished} of {analytics.overall.postsPublished + analytics.overall.failedPosts} attempted
                        </p>
                      </div>
                    </div>
                    <Progress value={analytics.overall.successRate} className="h-3" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    AI vs Manual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-4xl font-bold">{analytics.overall.aiGeneratedRatio}%</span>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">AI Generated</p>
                        <p className="text-xs text-muted-foreground">
                          Using AI Strategist
                        </p>
                      </div>
                    </div>
                    <Progress value={analytics.overall.aiGeneratedRatio} className="h-3" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        AI Generated
                      </span>
                      <span>Manual Posts</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Posting Activity
                </CardTitle>
                <CardDescription>Posts created over time</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.timeline.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.timeline.slice(-14).map((day) => (
                      <div key={day.date} className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground w-20">
                          {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <div className="flex-1 flex items-center gap-2">
                          <div 
                            className="bg-green-500 h-4 rounded"
                            style={{ width: `${Math.max(day.publishedCount * 20, day.publishedCount > 0 ? 8 : 0)}px` }}
                          />
                          <div 
                            className="bg-blue-500 h-4 rounded"
                            style={{ width: `${Math.max((day.postsCount - day.publishedCount - day.failedCount) * 20, 0)}px` }}
                          />
                          <div 
                            className="bg-red-500 h-4 rounded"
                            style={{ width: `${Math.max(day.failedCount * 20, day.failedCount > 0 ? 8 : 0)}px` }}
                          />
                          <span className="text-xs text-muted-foreground">{day.postsCount} posts</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-500 rounded" /> Published
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-500 rounded" /> Scheduled
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-500 rounded" /> Failed
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No posting activity in this period
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="platforms" className="space-y-4">
            <div className="grid gap-4">
              {analytics.platforms.length > 0 ? (
                analytics.platforms.map((platform) => {
                  const Icon = PLATFORM_ICONS[platform.platform];
                  const colors = PLATFORM_COLORS[platform.platform] || "from-gray-600 to-gray-800";
                  
                  return (
                    <Card key={platform.platform} data-testid={`card-analytics-${platform.platform}`}>
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-start gap-4">
                          <div className={`w-14 h-14 bg-gradient-to-br ${colors} rounded-xl flex items-center justify-center flex-shrink-0`}>
                            {Icon && <Icon className="w-7 h-7 text-white" />}
                          </div>
                          
                          <div className="flex-1 space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-lg capitalize">
                                {PLATFORM_NAMES[platform.platform] || platform.platform}
                              </h3>
                              {platform.lastPostDate && (
                                <Badge variant="outline" className="text-xs">
                                  Last post: {new Date(platform.lastPostDate).toLocaleDateString()}
                                </Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Total Posts</p>
                                <p className="font-semibold text-lg">{platform.postsTotal}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Published</p>
                                <p className="font-semibold text-lg text-green-600">{platform.postsThisWeek}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Scheduled</p>
                                <p className="font-semibold text-lg text-blue-600">{platform.postsScheduled}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Failed</p>
                                <p className="font-semibold text-lg text-red-600">{platform.postsFailed}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Success Rate</p>
                                <p className="font-semibold text-lg">{platform.successRate}%</p>
                              </div>
                            </div>

                            <Separator />

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Avg Posts/Day</p>
                                <p className="font-medium">{platform.avgPostsPerDay}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">AI Generated</p>
                                <p className="font-medium flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  {platform.aiGeneratedCount}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Manual</p>
                                <p className="font-medium">{platform.manualCount}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Content Types</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {Object.entries(platform.contentTypes).slice(0, 3).map(([type, count]) => (
                                    <Badge key={type} variant="secondary" className="text-xs">
                                      {type}: {count}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Platform Data</h3>
                    <p className="text-muted-foreground">
                      Start posting content to see platform-specific analytics.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Content Type Breakdown
                </CardTitle>
                <CardDescription>
                  Distribution of content types across your posts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.topContentTypes.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.topContentTypes.map((item) => (
                      <div key={item.type} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="capitalize font-medium">{item.type}</span>
                          <span className="text-sm text-muted-foreground">
                            {item.count} posts ({item.percentage}%)
                          </span>
                        </div>
                        <Progress value={item.percentage} className="h-2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No content data available yet
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Content Strategy Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Mix Content Types</p>
                    <p className="text-sm text-muted-foreground">
                      Vary between posts, reels, stories, and carousels to maximize engagement
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Target className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Platform-Specific Content</p>
                    <p className="text-sm text-muted-foreground">
                      Tailor content types to each platform's strengths for better reach
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Bot className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Use AI Strategist</p>
                    <p className="text-sm text-muted-foreground">
                      Let AI generate optimized content plans based on your brand
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Best Posting Times
                </CardTitle>
                <CardDescription>
                  Times when your posts have the highest success rate
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.bestPostingTimes.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.bestPostingTimes.map((time, index) => (
                      <div key={time.hour} className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">{formatHour(time.hour)}</span>
                            <span className="text-sm text-muted-foreground">
                              {time.successRate}% success ({time.count} posts)
                            </span>
                          </div>
                          <Progress value={time.successRate} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Post more content to see optimal timing insights
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timing Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="font-medium mb-1">General Best Times</p>
                    <p className="text-sm text-muted-foreground">
                      9-11 AM and 1-3 PM on weekdays typically see highest engagement
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="font-medium mb-1">Weekend Strategy</p>
                    <p className="text-sm text-muted-foreground">
                      Saturday mornings and Sunday evenings work well for leisure content
                    </p>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>The AI Strategist automatically schedules posts at optimal times based on your audience and platform best practices.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Analytics Data</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start posting content to see your analytics data here.
            </p>
            <Button asChild data-testid="button-create-content">
              <Link href="/social/strategist">Create Content</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
