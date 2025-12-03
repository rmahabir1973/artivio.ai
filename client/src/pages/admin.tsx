import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Shield, Users, Key, Trash2, Edit, Plus, ToggleLeft, ToggleRight, BarChart3, TrendingUp, Activity, DollarSign, Save, X, FileText, ArrowUp, ArrowDown, Info, Eye, BookOpen, ExternalLink, Video, Sparkles, Gift, Globe, Clock, MousePointer, Timer, MapPin, Laptop, Smartphone, Monitor, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { User, ApiKey, Pricing, SubscriptionPlan, HomePageContent, Announcement, Generation, BlogPost } from "@shared/schema";

interface UserWithSubscription extends User {
  subscription: {
    id: string;
    planId: string;
    status: string;
    plan: SubscriptionPlan;
  } | null;
}

interface AnalyticsData {
  totalUsers: number;
  totalCreditsSpent: number;
  totalGenerations: number;
  popularFeatures: Array<{ feature: string; count: number; credits: number }>;
}

interface ErrorLog {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: string;
  message: string;
  details?: string;
  userId?: string;
  endpoint?: string;
  resolved: boolean;
  emailSent: boolean;
}

interface ErrorStats {
  total: number;
  bySeverity: { info: number; warning: number; error: number; critical: number };
  byCategory: Record<string, number>;
  last24Hours: number;
  lastHour: number;
  criticalUnresolved: number;
}

interface RateLimitStats {
  totalTracked: number;
  topConsumers: Array<{ key: string; count: number; endpoint: string }>;
}

function ErrorMonitorSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: errorStats, isLoading: statsLoading } = useQuery<ErrorStats>({
    queryKey: ['/api/admin/errors/stats'],
    refetchInterval: 30000,
  });
  
  const { data: errors, isLoading: errorsLoading } = useQuery<ErrorLog[]>({
    queryKey: ['/api/admin/errors'],
    refetchInterval: 30000,
  });
  
  const { data: rateLimitStats } = useQuery<RateLimitStats>({
    queryKey: ['/api/admin/rate-limits'],
    refetchInterval: 30000,
  });
  
  const resolveMutation = useMutation({
    mutationFn: async (errorId: string) => {
      await apiRequest('PATCH', `/api/admin/errors/${errorId}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/errors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/errors/stats'] });
      toast({ title: "Error marked as resolved" });
    },
    onError: () => {
      toast({ title: "Failed to resolve error", variant: "destructive" });
    }
  });
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'error': return 'bg-orange-500 text-white';
      case 'warning': return 'bg-yellow-500 text-black';
      case 'info': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Error Monitoring & Rate Limits
          </h2>
          <p className="text-muted-foreground">Real-time error tracking with email alerts for critical issues</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/errors'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/errors/stats'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/rate-limits'] });
          }}
          data-testid="button-refresh-errors"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className={errorStats?.criticalUnresolved ? "border-red-500/50 bg-red-500/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Unresolved</CardTitle>
            <Shield className={`h-4 w-4 ${errorStats?.criticalUnresolved ? 'text-red-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${errorStats?.criticalUnresolved ? 'text-red-500' : ''}`}>
              {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : errorStats?.criticalUnresolved || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Needs immediate attention</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Hour</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : errorStats?.lastHour || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Errors in past 60 minutes</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 24 Hours</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : errorStats?.last24Hours || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total errors today</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limit Tracking</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rateLimitStats?.totalTracked || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Active rate limit records</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Errors by Severity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm">Critical</span>
                  </div>
                  <Badge variant="secondary">{errorStats?.bySeverity?.critical || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="text-sm">Error</span>
                  </div>
                  <Badge variant="secondary">{errorStats?.bySeverity?.error || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-sm">Warning</span>
                  </div>
                  <Badge variant="secondary">{errorStats?.bySeverity?.warning || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-sm">Info</span>
                  </div>
                  <Badge variant="secondary">{errorStats?.bySeverity?.info || 0}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Top API Consumers
            </CardTitle>
            <CardDescription>Users/IPs making the most requests</CardDescription>
          </CardHeader>
          <CardContent>
            {!rateLimitStats?.topConsumers?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">No rate limit data yet</p>
            ) : (
              <div className="space-y-2">
                {rateLimitStats.topConsumers.slice(0, 5).map((consumer, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="truncate flex-1 mr-2">
                      <span className="text-xs font-mono">{consumer.key.split(':').slice(0, 2).join(':')}</span>
                    </div>
                    <Badge variant="outline">{consumer.count} req</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Recent Errors
          </CardTitle>
          <CardDescription>Last 50 errors logged (auto-refreshes every 30 seconds)</CardDescription>
        </CardHeader>
        <CardContent>
          {errorsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !errors?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No errors logged yet - that's a good thing!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {errors.map((error) => (
                <div 
                  key={error.id} 
                  className={`p-4 rounded-lg border ${error.resolved ? 'opacity-50 bg-muted/20' : 'bg-card'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={getSeverityColor(error.severity)}>
                          {error.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">{error.category}</Badge>
                        {error.emailSent && (
                          <Badge variant="secondary" className="text-xs">Email sent</Badge>
                        )}
                        {error.resolved && (
                          <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-700">Resolved</Badge>
                        )}
                      </div>
                      <p className="font-medium text-sm">{error.message}</p>
                      {error.details && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{error.details}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{new Date(error.timestamp).toLocaleString()}</span>
                        {error.endpoint && <span>Endpoint: {error.endpoint}</span>}
                        {error.userId && <span>User: {error.userId.slice(0, 8)}...</span>}
                      </div>
                    </div>
                    {!error.resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveMutation.mutate(error.id)}
                        disabled={resolveMutation.isPending}
                        data-testid={`button-resolve-error-${error.id}`}
                      >
                        {resolveMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Resolve"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Email Alerts Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Critical and error-level issues automatically send email alerts to <strong>support@artivio.ai</strong>
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-background/50 rounded-lg border">
                <p className="font-medium">Alert Throttling</p>
                <p className="text-xs text-muted-foreground">Same error type: max 1 email per 15 minutes</p>
              </div>
              <div className="p-3 bg-background/50 rounded-lg border">
                <p className="font-medium">Severity Threshold</p>
                <p className="text-xs text-muted-foreground">Alerts sent for: Critical, Error</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              To change the alert email, set the <code>ADMIN_ALERT_EMAIL</code> environment variable.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Admin() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editCredits, setEditCredits] = useState("");
  const [addingApiKey, setAddingApiKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [editingPricingId, setEditingPricingId] = useState<string | null>(null);
  const [editPricing, setEditPricing] = useState({ feature: "", model: "", category: "", creditCost: "", kieCreditCost: "", description: "" });
  const [addingPricing, setAddingPricing] = useState(false);
  const [newPricing, setNewPricing] = useState({ feature: "", model: "", category: "", creditCost: "", kieCreditCost: "", description: "" });
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPlanData, setEditPlanData] = useState({
    name: "",
    displayName: "",
    description: "",
    price: "",
    billingPeriod: "monthly" as "monthly" | "annual" | "trial",
    creditsPerMonth: "",
    features: "[]",
    stripePriceId: "",
    stripeProductId: ""
  });
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [newPlanData, setNewPlanData] = useState({
    name: "",
    displayName: "",
    description: "",
    price: "",
    billingPeriod: "monthly" as "monthly" | "annual" | "trial",
    creditsPerMonth: "",
    features: "[]",
  });
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [deletingPricingId, setDeletingPricingId] = useState<string | null>(null);
  const [resettingPlans, setResettingPlans] = useState(false);
  
  // Pricing sorting state
  const [pricingSortField, setPricingSortField] = useState<'feature' | 'model' | 'category' | 'creditCost'>('feature');
  const [pricingSortDirection, setPricingSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Home page content state
  const [editingHomePage, setEditingHomePage] = useState(false);
  const [homePageFormData, setHomePageFormData] = useState({
    heroTitle: "",
    heroSubtitle: "",
    heroVideoUrl: "",
    heroImageUrl: "",
    featureVideoUrl: "",
    featureImageUrl: "",
    featureMusicUrl: "",
    pricingVideoUrl: "",
    demoVideoUrl: "",
    creatorsTitle: "",
    creatorsDescription: "",
    creatorsImageUrl: "",
    businessTitle: "",
    businessDescription: "",
    businessImageUrl: "",
    previewVideoVideo: "",
    previewVideoImage: "",
    previewVideoTransition: "",
    previewVideoSora: "",
    previewVideoGrok: "",
    previewVideoSoundEffects: "",
    previewVideoMusic: "",
    previewVideoVoiceClone: "",
    previewVideoLipSync: "",
    previewVideoTts: "",
    previewVideoStt: "",
    previewVideoUpscaler: "",
    previewVideoVideoUpscaler: "",
    previewVideoBgRemover: "",
    previewVideoTalkingAvatar: "",
    previewVideoBrandProductAd: "",
    previewVideoBrandInfluencerAd: "",
    previewVideoBrandLogoAnimation: "",
    previewVideoBrandUnboxing: "",
    previewVideoBrandFlashSale: "",
    previewVideoBrandBrandStory: "",
    previewVideoBrandTestimonial: "",
    previewVideoBrandSocialPromo: "",
    previewVideoBrandBeforeAfter: "",
    previewVideoBrandShowcase: "",
    welcomeVideoUrl: "",
    welcomeSlides: "[]",
  });
  const [showcaseDialogOpen, setShowcaseDialogOpen] = useState(false);
  const [showcaseEditIndex, setShowcaseEditIndex] = useState<number | null>(null);
  const [showcaseVideo, setShowcaseVideo] = useState({ url: "", title: "", description: "" });
  const [faqDialogOpen, setFaqDialogOpen] = useState(false);
  const [faqEditIndex, setFaqEditIndex] = useState<number | null>(null);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  
  // Welcome slides state
  const [welcomeSlideDialogOpen, setWelcomeSlideDialogOpen] = useState(false);
  const [welcomeSlideEditIndex, setWelcomeSlideEditIndex] = useState<number | null>(null);
  const [welcomeSlideData, setWelcomeSlideData] = useState({ title: "", description: "", icon: "", highlight: "" });
  
  // Announcements state
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    message: "",
    type: "info" as "info" | "warning" | "success" | "promo",
    targetPlans: [] as string[],
    isActive: true,
    startDate: "",
    endDate: "",
  });

  // Create User dialog state
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    credits: "0",
    isAdmin: false,
  });

  // Blog management state
  const [creatingBlogPost, setCreatingBlogPost] = useState(false);
  const [editingBlogPostId, setEditingBlogPostId] = useState<string | null>(null);
  const [deletingBlogPostId, setDeletingBlogPostId] = useState<string | null>(null);
  const [blogPostForm, setBlogPostForm] = useState({
    title: "",
    slug: "",
    content: "",
    excerpt: "",
    author: "Artivio Team",
    category: "Announcement" as "Tutorial" | "Case Study" | "Feature" | "Announcement",
    tags: "",
    featuredImageUrl: "",
    metaDescription: "",
    status: "draft" as "draft" | "published",
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }

    if (!authLoading && isAuthenticated && !(user as any)?.isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access the admin panel.",
        variant: "destructive",
      });
    }
  }, [isAuthenticated, authLoading, user, toast]);

  const { data: users = [], isLoading: usersLoading } = useQuery<UserWithSubscription[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/admin/plans"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  const { data: apiKeys = [], isLoading: keysLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/admin/api-keys"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/admin/analytics"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  const { data: pricingList = [], isLoading: pricingLoading } = useQuery<Pricing[]>({
    queryKey: ["/api/admin/pricing"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  // Sorted pricing list
  const sortedPricingList = useMemo(() => {
    return [...pricingList].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      
      if (pricingSortField === 'creditCost') {
        aVal = a.creditCost;
        bVal = b.creditCost;
      } else {
        aVal = (a[pricingSortField] || '').toLowerCase();
        bVal = (b[pricingSortField] || '').toLowerCase();
      }
      
      if (aVal < bVal) return pricingSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return pricingSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [pricingList, pricingSortField, pricingSortDirection]);

  // Toggle pricing sort
  const togglePricingSort = (field: 'feature' | 'model' | 'category' | 'creditCost') => {
    if (pricingSortField === field) {
      setPricingSortDirection(pricingSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setPricingSortField(field);
      setPricingSortDirection('asc');
    }
  };

  const { data: homePageContent, isLoading: homePageLoading } = useQuery<HomePageContent>({
    queryKey: ["/api/admin/homepage"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  const { data: announcements = [], isLoading: announcementsLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/admin/announcements"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  const { data: adminGenerations = [], isLoading: generationsLoading } = useQuery<Generation[]>({
    queryKey: ["/api/admin/generations"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  const { data: blogPosts = [], isLoading: blogPostsLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/admin/blog/posts"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  useEffect(() => {
    if (homePageContent && !editingHomePage) {
      setHomePageFormData({
        heroTitle: homePageContent.heroTitle || "",
        heroSubtitle: homePageContent.heroSubtitle || "",
        heroVideoUrl: homePageContent.heroVideoUrl || "",
        heroImageUrl: homePageContent.heroImageUrl || "",
        featureVideoUrl: homePageContent.featureVideoUrl || "",
        featureImageUrl: homePageContent.featureImageUrl || "",
        featureMusicUrl: homePageContent.featureMusicUrl || "",
        pricingVideoUrl: homePageContent.pricingVideoUrl || "",
        demoVideoUrl: homePageContent.demoVideoUrl || "",
        creatorsTitle: homePageContent.creatorsTitle || "",
        creatorsDescription: homePageContent.creatorsDescription || "",
        creatorsImageUrl: homePageContent.creatorsImageUrl || "",
        businessTitle: homePageContent.businessTitle || "",
        businessDescription: homePageContent.businessDescription || "",
        businessImageUrl: homePageContent.businessImageUrl || "",
        previewVideoVideo: homePageContent.previewVideoVideo || "",
        previewVideoImage: homePageContent.previewVideoImage || "",
        previewVideoTransition: homePageContent.previewVideoTransition || "",
        previewVideoSora: homePageContent.previewVideoSora || "",
        previewVideoGrok: homePageContent.previewVideoGrok || "",
        previewVideoSoundEffects: homePageContent.previewVideoSoundEffects || "",
        previewVideoMusic: homePageContent.previewVideoMusic || "",
        previewVideoVoiceClone: homePageContent.previewVideoVoiceClone || "",
        previewVideoLipSync: homePageContent.previewVideoLipSync || "",
        previewVideoTts: homePageContent.previewVideoTts || "",
        previewVideoStt: homePageContent.previewVideoStt || "",
        previewVideoUpscaler: homePageContent.previewVideoUpscaler || "",
        previewVideoVideoUpscaler: homePageContent.previewVideoVideoUpscaler || "",
        previewVideoBgRemover: homePageContent.previewVideoBgRemover || "",
        previewVideoTalkingAvatar: homePageContent.previewVideoTalkingAvatar || "",
        previewVideoBrandProductAd: homePageContent.previewVideoBrandProductAd || "",
        previewVideoBrandInfluencerAd: homePageContent.previewVideoBrandInfluencerAd || "",
        previewVideoBrandLogoAnimation: homePageContent.previewVideoBrandLogoAnimation || "",
        previewVideoBrandUnboxing: homePageContent.previewVideoBrandUnboxing || "",
        previewVideoBrandFlashSale: homePageContent.previewVideoBrandFlashSale || "",
        previewVideoBrandBrandStory: homePageContent.previewVideoBrandBrandStory || "",
        previewVideoBrandTestimonial: homePageContent.previewVideoBrandTestimonial || "",
        previewVideoBrandSocialPromo: homePageContent.previewVideoBrandSocialPromo || "",
        previewVideoBrandBeforeAfter: homePageContent.previewVideoBrandBeforeAfter || "",
        previewVideoBrandShowcase: homePageContent.previewVideoBrandShowcase || "",
        welcomeVideoUrl: homePageContent.welcomeVideoUrl || "",
        welcomeSlides: JSON.stringify(homePageContent.welcomeSlides || []),
      });
    }
  }, [homePageContent, editingHomePage]);

  const updateCreditsMutation = useMutation({
    mutationFn: async ({ userId, credits }: { userId: string; credits: number }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/credits`, { credits });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Credits updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUserId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update credits",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/admin/users/${userId}`, {});
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; firstName?: string; lastName?: string; credits?: number; isAdmin?: boolean }) => {
      return await apiRequest("POST", "/api/admin/users", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setCreatingUser(false);
      setNewUserData({ email: "", password: "", firstName: "", lastName: "", credits: "0", isAdmin: false });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/admin`, { isAdmin });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Admin status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update admin status",
        variant: "destructive",
      });
    },
  });

  const provisionSocialPosterMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      return await apiRequest("POST", `/api/admin/users/${userId}/social-poster`, {});
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Social Media Poster access granted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to provision Social Media Poster",
        variant: "destructive",
      });
    },
  });

  const revokeSocialPosterMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      return await apiRequest("DELETE", `/api/admin/users/${userId}/social-poster`, undefined);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Social Media Poster access revoked" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke Social Media Poster",
        variant: "destructive",
      });
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, planId }: { userId: string; planId: string | null }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/subscription`, { planId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User plan updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update plan",
        variant: "destructive",
      });
    },
  });

  const toggleApiKeyMutation = useMutation({
    mutationFn: async ({ keyId, isActive }: { keyId: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/api-keys/${keyId}`, { isActive });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "API key status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update API key",
        variant: "destructive",
      });
    },
  });

  const updatePricingMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return await apiRequest("PATCH", `/api/admin/pricing/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing"] });
      setEditingPricingId(null);
      setEditPricing({ feature: "", model: "", category: "", creditCost: "", kieCreditCost: "", description: "" });
      toast({ title: "Success", description: "Pricing updated successfully" });
    },
    onError: (error: Error) => {
      setEditingPricingId(null);
      setEditPricing({ feature: "", model: "", category: "", creditCost: "", kieCreditCost: "", description: "" });
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update pricing", 
        variant: "destructive" 
      });
    },
  });

  const addPricingMutation = useMutation({
    mutationFn: async (data: { feature: string; model: string; category: string; creditCost: number; kieCreditCost?: number; description?: string }) => {
      return await apiRequest("POST", "/api/admin/pricing", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing"] });
      setAddingPricing(false);
      setNewPricing({ feature: "", model: "", category: "", creditCost: "", kieCreditCost: "", description: "" });
      toast({ title: "Success", description: "Pricing entry added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to add pricing", variant: "destructive" });
    },
  });

  const deletePricingMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/pricing/${id}`);
    },
    onSuccess: () => {
      setDeletingPricingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing"] });
      toast({ title: "Success", description: "Pricing entry deleted successfully" });
    },
    onError: (error: Error) => {
      setDeletingPricingId(null);
      toast({ title: "Error", description: error.message || "Failed to delete pricing", variant: "destructive" });
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: { name: string; displayName: string; description: string; price: number; creditsPerMonth: number }) => {
      return await apiRequest("POST", "/api/admin/plans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setCreatingPlan(false);
      setNewPlanData({ name: "", displayName: "", description: "", price: "", billingPeriod: "monthly", creditsPerMonth: "", features: "[]" });
      toast({ title: "Success", description: "Plan created successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create plan", variant: "destructive" });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ planId, ...updates }: { planId: string; [key: string]: any }) => {
      return await apiRequest("PATCH", `/api/admin/plans/${planId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setEditingPlanId(null);
      setEditPlanData({ name: "", displayName: "", description: "", price: "", billingPeriod: "monthly", creditsPerMonth: "", features: "[]", stripePriceId: "", stripeProductId: "" });
      toast({ title: "Success", description: "Plan updated successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update plan", variant: "destructive" });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      return await apiRequest("DELETE", `/api/admin/plans/${planId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setDeletingPlanId(null);
      toast({ title: "Success", description: "Plan deleted successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete plan", variant: "destructive" });
    },
  });

  const reorderPlanMutation = useMutation({
    mutationFn: async ({ planId, direction }: { planId: string; direction: 'up' | 'down' }) => {
      return await apiRequest("PATCH", `/api/admin/plans/${planId}/reorder`, { direction });
    },
    onSuccess: (updatedPlans) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({ 
        title: "Success", 
        description: `Plan reordered successfully!`,
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to reorder plan", 
        variant: "destructive" 
      });
    },
  });

  const resetPlansMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/plans/reset", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setResettingPlans(false);
      toast({ 
        title: "Plans Reset Successfully!", 
        description: `${data.stats.plansCreated} plans created, ${data.stats.plansDeleted} removed, ${data.stats.usersMigrated} users migrated to free trial`,
      });
    },
    onError: (error: Error) => {
      setResettingPlans(false);
      toast({ 
        title: "Reset Failed", 
        description: error.message || "Failed to reset plans", 
        variant: "destructive" 
      });
    },
  });

  const updateHomePageMutation = useMutation({
    mutationFn: async (data: Partial<HomePageContent>) => {
      return await apiRequest("PATCH", "/api/admin/homepage", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homepage"] });
      setEditingHomePage(false);
      toast({ title: "Success", description: "Home page content updated successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update home page content", variant: "destructive" });
    },
  });

  const addApiKeyMutation = useMutation({
    mutationFn: async ({ keyName, keyValue }: { keyName: string; keyValue: string }) => {
      return await apiRequest("POST", "/api/admin/api-keys", { keyName, keyValue });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "API key added successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      setAddingApiKey(false);
      setNewKeyName("");
      setNewKeyValue("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add API key",
        variant: "destructive",
      });
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return await apiRequest("DELETE", `/api/admin/api-keys/${keyId}`, {});
    },
    onSuccess: () => {
      toast({ title: "Success", description: "API key deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete API key",
        variant: "destructive",
      });
    },
  });

  const createBlogPostMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      slug: string;
      content: string;
      excerpt?: string;
      author?: string;
      category?: string;
      tags?: string[];
      featuredImageUrl?: string;
      metaDescription?: string;
      status?: string;
      publishedDate?: string;
    }) => {
      return await apiRequest("POST", "/api/admin/blog/posts", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Blog post created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog/posts"] });
      setCreatingBlogPost(false);
      setBlogPostForm({
        title: "",
        slug: "",
        content: "",
        excerpt: "",
        author: "Artivio Team",
        category: "Announcement",
        tags: "",
        featuredImageUrl: "",
        metaDescription: "",
        status: "draft",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create blog post",
        variant: "destructive",
      });
    },
  });

  const updateBlogPostMutation = useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      title?: string;
      slug?: string;
      content?: string;
      excerpt?: string;
      author?: string;
      category?: string;
      tags?: string[];
      featuredImageUrl?: string;
      metaDescription?: string;
      status?: string;
      publishedDate?: string;
    }) => {
      return await apiRequest("PATCH", `/api/admin/blog/posts/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Blog post updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog/posts"] });
      setEditingBlogPostId(null);
      setBlogPostForm({
        title: "",
        slug: "",
        content: "",
        excerpt: "",
        author: "Artivio Team",
        category: "Announcement",
        tags: "",
        featuredImageUrl: "",
        metaDescription: "",
        status: "draft",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update blog post",
        variant: "destructive",
      });
    },
  });

  const deleteBlogPostMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/blog/posts/${id}`, {});
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Blog post deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog/posts"] });
      setDeletingBlogPostId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete blog post",
        variant: "destructive",
      });
    },
  });

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !(user as any)?.isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Shield className="h-10 w-10 text-primary" />
          Admin Panel
        </h1>
        <p className="text-lg text-muted-foreground">
          Manage users and API keys
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-8">
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="api-keys" data-testid="tab-api-keys">
            <Key className="h-4 w-4 mr-2" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="traffic" data-testid="tab-traffic">
            <Globe className="h-4 w-4 mr-2" />
            Website Traffic
          </TabsTrigger>
          <TabsTrigger value="errors" data-testid="tab-errors">
            <Shield className="h-4 w-4 mr-2" />
            Error Monitor
          </TabsTrigger>
          <TabsTrigger value="pricing" data-testid="tab-pricing">
            <DollarSign className="h-4 w-4 mr-2" />
            Pricing
          </TabsTrigger>
          <TabsTrigger value="plans" data-testid="tab-plans">
            <TrendingUp className="h-4 w-4 mr-2" />
            Subscription Plans
          </TabsTrigger>
          <TabsTrigger value="content" data-testid="tab-content">
            <FileText className="h-4 w-4 mr-2" />
            Home Page
          </TabsTrigger>
          <TabsTrigger value="announcements" data-testid="tab-announcements">
            <Activity className="h-4 w-4 mr-2" />
            Announcements
          </TabsTrigger>
          <TabsTrigger value="showcase" data-testid="tab-showcase">
            <Eye className="h-4 w-4 mr-2" />
            Showcase
          </TabsTrigger>
          <TabsTrigger value="blog" data-testid="tab-blog">
            <BookOpen className="h-4 w-4 mr-2" />
            Blog
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>View and manage all users</CardDescription>
              </div>
              <Button onClick={() => setCreatingUser(true)} data-testid="button-create-user">
                <Plus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Social Poster</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email || 'N/A'}</TableCell>
                        <TableCell>
                          {u.firstName || u.lastName 
                            ? `${u.firstName || ''} ${u.lastName || ''}`.trim() 
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {editingUserId === u.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={editCredits}
                                onChange={(e) => setEditCredits(e.target.value)}
                                className="w-24"
                                data-testid={`input-credits-${u.id}`}
                              />
                              <Button
                                size="sm"
                                onClick={() => {
                                  updateCreditsMutation.mutate({
                                    userId: u.id,
                                    credits: parseInt(editCredits),
                                  });
                                }}
                                data-testid={`button-save-credits-${u.id}`}
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <span>{u.credits?.toLocaleString() ?? 0}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {plansLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-sm text-muted-foreground">Loading...</span>
                            </div>
                          ) : (
                            <Select
                              value={u.subscription?.planId || 'none'}
                              onValueChange={(value) => {
                                updateSubscriptionMutation.mutate({
                                  userId: u.id,
                                  planId: value === 'none' ? null : value,
                                });
                              }}
                              disabled={updateSubscriptionMutation.isPending}
                            >
                              <SelectTrigger className="w-32" data-testid={`select-plan-${u.id}`}>
                                <SelectValue>
                                  {u.subscription?.plan?.name || 'No Plan'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Plan</SelectItem>
                                {plans.map((plan) => (
                                  <SelectItem key={plan.id} value={plan.id}>
                                    {plan.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={u.isAdmin ? "default" : "secondary"}>
                              {u.isAdmin ? 'Admin' : 'User'}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (u.id === user?.id && u.isAdmin) {
                                  toast({
                                    title: "Cannot Remove",
                                    description: "You cannot remove your own admin status",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                toggleAdminMutation.mutate({ userId: u.id, isAdmin: !u.isAdmin });
                              }}
                              disabled={toggleAdminMutation.isPending}
                              data-testid={`button-toggle-admin-${u.id}`}
                            >
                              {u.isAdmin ? (
                                <ToggleRight className="h-4 w-4" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={(u as any).hasSocialPoster ? "default" : "secondary"}>
                              {(u as any).hasSocialPoster ? 'Active' : 'None'}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if ((u as any).hasSocialPoster) {
                                  if (confirm('Revoke Social Media Poster access?')) {
                                    revokeSocialPosterMutation.mutate({ userId: u.id });
                                  }
                                } else {
                                  provisionSocialPosterMutation.mutate({ userId: u.id });
                                }
                              }}
                              disabled={provisionSocialPosterMutation.isPending || revokeSocialPosterMutation.isPending}
                              data-testid={`button-toggle-social-poster-${u.id}`}
                            >
                              {(u as any).hasSocialPoster ? (
                                <ToggleRight className="h-4 w-4" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {u.createdAt ? formatDistanceToNow(new Date(u.createdAt), { addSuffix: true }) : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingUserId(u.id);
                                setEditCredits(u.credits?.toString() ?? "0");
                              }}
                              data-testid={`button-edit-${u.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this user?')) {
                                  deleteUserMutation.mutate(u.id);
                                }
                              }}
                              data-testid={`button-delete-${u.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create User Dialog */}
        <Dialog open={creatingUser} onOpenChange={setCreatingUser}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Create a new user account with email and password
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="new-user-email">Email *</Label>
                <Input
                  id="new-user-email"
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  placeholder="user@example.com"
                  data-testid="input-new-user-email"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-user-password">Password *</Label>
                <Input
                  id="new-user-password"
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  placeholder="Secure password"
                  data-testid="input-new-user-password"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-user-firstname">First Name</Label>
                  <Input
                    id="new-user-firstname"
                    value={newUserData.firstName}
                    onChange={(e) => setNewUserData({ ...newUserData, firstName: e.target.value })}
                    placeholder="John"
                    data-testid="input-new-user-firstname"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-user-lastname">Last Name</Label>
                  <Input
                    id="new-user-lastname"
                    value={newUserData.lastName}
                    onChange={(e) => setNewUserData({ ...newUserData, lastName: e.target.value })}
                    placeholder="Doe"
                    data-testid="input-new-user-lastname"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-user-credits">Starting Credits</Label>
                <Input
                  id="new-user-credits"
                  type="number"
                  value={newUserData.credits}
                  onChange={(e) => setNewUserData({ ...newUserData, credits: e.target.value })}
                  placeholder="0"
                  data-testid="input-new-user-credits"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="new-user-admin"
                  checked={newUserData.isAdmin}
                  onChange={(e) => setNewUserData({ ...newUserData, isAdmin: e.target.checked })}
                  className="h-4 w-4"
                  data-testid="checkbox-new-user-admin"
                />
                <Label htmlFor="new-user-admin">Grant Admin Access</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreatingUser(false)} data-testid="button-cancel-create-user">
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (!newUserData.email || !newUserData.password) {
                    toast({
                      title: "Validation Error",
                      description: "Email and password are required",
                      variant: "destructive",
                    });
                    return;
                  }
                  createUserMutation.mutate({
                    email: newUserData.email,
                    password: newUserData.password,
                    firstName: newUserData.firstName || undefined,
                    lastName: newUserData.lastName || undefined,
                    credits: parseInt(newUserData.credits) || 0,
                    isAdmin: newUserData.isAdmin,
                  });
                }}
                disabled={createUserMutation.isPending}
                data-testid="button-submit-create-user"
              >
                {createUserMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TabsContent value="api-keys">
          <div className="grid gap-6 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {apiKeys.reduce((sum, key) => sum + (key.usageCount || 0), 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all {apiKeys.length} keys
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {apiKeys.filter(k => k.isActive).length} / {apiKeys.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((apiKeys.filter(k => k.isActive).length / Math.max(apiKeys.length, 1)) * 100).toFixed(0)}% active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Usage/Key</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(apiKeys.reduce((sum, key) => sum + (key.usageCount || 0), 0) / Math.max(apiKeys.length, 1)).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Calls per key
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>API Key Management</CardTitle>
                <CardDescription>
                  Manage round-robin API keys for load balancing
                </CardDescription>
              </div>
              <Button onClick={() => setAddingApiKey(true)} data-testid="button-add-api-key">
                <Plus className="h-4 w-4 mr-2" />
                Add Key
              </Button>
            </CardHeader>
            <CardContent>
              {keysLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {apiKeys.map((key) => (
                    <Card key={key.id} className={key.isActive ? "border-primary" : "border-muted"}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{key.keyName}</CardTitle>
                          <Badge variant={key.isActive ? "default" : "secondary"}>
                            {key.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm">
                          <p className="text-muted-foreground">Usage Count</p>
                          <p className="text-2xl font-bold">{key.usageCount}</p>
                        </div>
                        {key.lastUsedAt && (
                          <div className="text-sm">
                            <p className="text-muted-foreground">Last Used</p>
                            <p>{formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}</p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              toggleApiKeyMutation.mutate({
                                keyId: key.id,
                                isActive: !key.isActive,
                              });
                            }}
                            data-testid={`button-toggle-${key.id}`}
                          >
                            {key.isActive ? (
                              <>
                                <ToggleRight className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete the API key "${key.keyName}"?`)) {
                                deleteApiKeyMutation.mutate(key.id);
                              }
                            }}
                            data-testid={`button-delete-key-${key.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {apiKeys.length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      No API keys configured. Add your first key to get started.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalUsers?.toLocaleString() ?? 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Generations</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalGenerations?.toLocaleString() ?? 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Credits Spent</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalCreditsSpent?.toLocaleString() ?? 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active API Keys</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {keysLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <div className="text-2xl font-bold">{apiKeys?.filter(k => k.isActive).length ?? 0}</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Popular Features</CardTitle>
              <CardDescription>Most used AI generation features</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : analytics?.popularFeatures && analytics.popularFeatures.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      <TableHead className="text-right">Generations</TableHead>
                      <TableHead className="text-right">Credits Used</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.popularFeatures.map((feature, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium capitalize">
                          {feature.feature.replace(/-/g, ' ')}
                        </TableCell>
                        <TableCell className="text-right">{feature.count.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{feature.credits.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No generation data available yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traffic">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Globe className="h-6 w-6 text-primary" />
                  Website Traffic & Visitors
                </h2>
                <p className="text-muted-foreground">Real-time and historical website analytics powered by Google Analytics</p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => window.open('https://analytics.google.com/analytics/web/#/p464583799/reports/intelligenthome', '_blank')}
                data-testid="button-open-ga"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Google Analytics
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Live Visitors</CardTitle>
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500 blur-md opacity-50 rounded-full animate-pulse" />
                    <div className="relative w-3 h-3 bg-green-500 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-500">Real-time</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    View in Google Analytics for live data
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Page Views</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">View in GA</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total page views today
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sessions</CardTitle>
                  <MousePointer className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">View in GA</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active sessions today
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Session Duration</CardTitle>
                  <Timer className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">View in GA</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Average time on site
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Top Countries
                  </CardTitle>
                  <CardDescription>Where your visitors are coming from</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <span className="font-medium">Geographic Data</span>
                      <Badge variant="secondary">Google Analytics</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      View detailed geographic breakdown including countries, cities, and regions in Google Analytics.
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.open('https://analytics.google.com/analytics/web/#/p464583799/reports/explorer?params=_u..nav%3Dmaui%26_r.explorerCard..seldim%3D%5B%22country%22%5D&r=user-demographics-detail&ruid=user-demographics-detail,life-cycle,engagement&collectionId=life-cycle', '_blank')}
                      data-testid="button-view-geo"
                    >
                      <Globe className="h-4 w-4 mr-2" />
                      View Geographic Report
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-primary" />
                    Device Breakdown
                  </CardTitle>
                  <CardDescription>Desktop vs Mobile vs Tablet visitors</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <Monitor className="h-6 w-6 mx-auto mb-1 text-blue-500" />
                        <p className="text-xs text-muted-foreground">Desktop</p>
                      </div>
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <Smartphone className="h-6 w-6 mx-auto mb-1 text-green-500" />
                        <p className="text-xs text-muted-foreground">Mobile</p>
                      </div>
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <Laptop className="h-6 w-6 mx-auto mb-1 text-purple-500" />
                        <p className="text-xs text-muted-foreground">Tablet</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.open('https://analytics.google.com/analytics/web/#/p464583799/reports/explorer?params=_u..nav%3Dmaui%26_r.explorerCard..seldim%3D%5B%22deviceCategory%22%5D&r=tech-detail&ruid=tech-detail,life-cycle,engagement&collectionId=life-cycle', '_blank')}
                      data-testid="button-view-devices"
                    >
                      <Monitor className="h-4 w-4 mr-2" />
                      View Device Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Traffic Sources
                  </CardTitle>
                  <CardDescription>How visitors find your website</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 rounded-lg hover-elevate">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-sm font-medium">Direct</span>
                      </div>
                      <span className="text-sm text-muted-foreground">Direct URL visits</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg hover-elevate">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-sm font-medium">Organic Search</span>
                      </div>
                      <span className="text-sm text-muted-foreground">Google, Bing, etc.</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg hover-elevate">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                        <span className="text-sm font-medium">Social</span>
                      </div>
                      <span className="text-sm text-muted-foreground">Facebook, Twitter, etc.</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg hover-elevate">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span className="text-sm font-medium">Referral</span>
                      </div>
                      <span className="text-sm text-muted-foreground">Other websites</span>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full mt-2"
                      onClick={() => window.open('https://analytics.google.com/analytics/web/#/p464583799/reports/dashboard?params=_u..nav%3Dmaui&r=acquisition-overview&ruid=acquisition-overview,life-cycle,acquisition&collectionId=life-cycle', '_blank')}
                      data-testid="button-view-sources"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      View Acquisition Report
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Top Pages
                  </CardTitle>
                  <CardDescription>Most visited pages on your website</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 rounded-lg hover-elevate">
                      <span className="text-sm font-medium truncate">/</span>
                      <Badge variant="secondary">Homepage</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg hover-elevate">
                      <span className="text-sm font-medium truncate">/generate-video</span>
                      <Badge variant="secondary">Video Gen</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg hover-elevate">
                      <span className="text-sm font-medium truncate">/generate-image</span>
                      <Badge variant="secondary">Image Gen</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg hover-elevate">
                      <span className="text-sm font-medium truncate">/pricing</span>
                      <Badge variant="secondary">Pricing</Badge>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full mt-2"
                      onClick={() => window.open('https://analytics.google.com/analytics/web/#/p464583799/reports/explorer?params=_u..nav%3Dmaui%26_r.explorerCard..seldim%3D%5B%22pagePath%22%5D&r=pages-and-screens&ruid=pages-and-screens,life-cycle,engagement&collectionId=life-cycle', '_blank')}
                      data-testid="button-view-pages"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Pages Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Real-time Analytics Dashboard
                </CardTitle>
                <CardDescription>
                  View live visitor activity, current active users, and real-time events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 mb-4">
                  <div className="text-center p-4 bg-background/50 rounded-lg border">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">Active Now</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Users currently on your site</p>
                  </div>
                  <div className="text-center p-4 bg-background/50 rounded-lg border">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Last 30 Minutes</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Recent visitor activity</p>
                  </div>
                  <div className="text-center p-4 bg-background/50 rounded-lg border">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <RefreshCw className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Live Events</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Real-time user interactions</p>
                  </div>
                </div>
                <Button 
                  className="w-full"
                  onClick={() => window.open('https://analytics.google.com/analytics/web/#/p464583799/realtime/overview', '_blank')}
                  data-testid="button-realtime-dashboard"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Open Real-time Dashboard
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Links to Google Analytics Reports</CardTitle>
                <CardDescription>Access detailed reports directly in Google Analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Button 
                    variant="outline" 
                    className="h-auto py-4 flex-col gap-2"
                    onClick={() => window.open('https://analytics.google.com/analytics/web/#/p464583799/reports/dashboard?params=_u..nav%3Dmaui&r=reporting-hub&ruid=reporting-hub', '_blank')}
                    data-testid="button-ga-overview"
                  >
                    <BarChart3 className="h-6 w-6 text-primary" />
                    <span>Overview</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto py-4 flex-col gap-2"
                    onClick={() => window.open('https://analytics.google.com/analytics/web/#/p464583799/reports/dashboard?params=_u..nav%3Dmaui&r=user-demographics-overview&ruid=user-demographics-overview,life-cycle,engagement&collectionId=life-cycle', '_blank')}
                    data-testid="button-ga-demographics"
                  >
                    <Users className="h-6 w-6 text-primary" />
                    <span>Demographics</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto py-4 flex-col gap-2"
                    onClick={() => window.open('https://analytics.google.com/analytics/web/#/p464583799/reports/dashboard?params=_u..nav%3Dmaui&r=engagement-overview&ruid=engagement-overview,life-cycle,engagement&collectionId=life-cycle', '_blank')}
                    data-testid="button-ga-engagement"
                  >
                    <Activity className="h-6 w-6 text-primary" />
                    <span>Engagement</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto py-4 flex-col gap-2"
                    onClick={() => window.open('https://analytics.google.com/analytics/web/#/p464583799/reports/dashboard?params=_u..nav%3Dmaui&r=monetization-overview&ruid=monetization-overview,life-cycle,monetization&collectionId=life-cycle', '_blank')}
                    data-testid="button-ga-monetization"
                  >
                    <DollarSign className="h-6 w-6 text-primary" />
                    <span>Monetization</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="errors">
          <ErrorMonitorSection />
        </TabsContent>

        <TabsContent value="pricing">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pricing Management</CardTitle>
                <CardDescription>Configure credit costs for all AI features and models</CardDescription>
              </div>
              <Button onClick={() => setAddingPricing(true)} data-testid="button-add-pricing">
                <Plus className="h-4 w-4 mr-2" />
                Add Pricing
              </Button>
            </CardHeader>
            <CardContent>
              {pricingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : pricingList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pricing entries found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover-elevate select-none" 
                        onClick={() => togglePricingSort('feature')}
                        data-testid="button-sort-pricing-feature"
                      >
                        <div className="flex items-center gap-1">
                          Feature
                          {pricingSortField === 'feature' && (
                            pricingSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover-elevate select-none" 
                        onClick={() => togglePricingSort('model')}
                        data-testid="button-sort-pricing-model"
                      >
                        <div className="flex items-center gap-1">
                          Model
                          {pricingSortField === 'model' && (
                            pricingSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover-elevate select-none" 
                        onClick={() => togglePricingSort('category')}
                        data-testid="button-sort-pricing-category"
                      >
                        <div className="flex items-center gap-1">
                          Category
                          {pricingSortField === 'category' && (
                            pricingSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="text-right cursor-pointer hover-elevate select-none" 
                        onClick={() => togglePricingSort('creditCost')}
                        data-testid="button-sort-pricing-cost"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Credit Cost
                          {pricingSortField === 'creditCost' && (
                            pricingSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="text-right" data-testid="text-pricing-header-actions">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPricingList.map((pricing) => (
                      <TableRow key={pricing.id} data-testid={`pricing-row-${pricing.id}`}>
                        <TableCell className="font-medium capitalize" data-testid={`text-pricing-feature-${pricing.id}`}>
                          {pricing.feature.replace(/-/g, ' ')}
                        </TableCell>
                        <TableCell className="font-mono text-sm" data-testid={`text-pricing-model-${pricing.id}`}>
                          {pricing.model}
                        </TableCell>
                        <TableCell data-testid={`text-pricing-category-${pricing.id}`}>
                          <Badge variant="outline" className="capitalize">
                            {pricing.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold" data-testid={`text-pricing-cost-value-${pricing.id}`}>
                            {pricing.creditCost.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingPricingId(pricing.id);
                                setEditPricing({
                                  feature: pricing.feature,
                                  model: pricing.model,
                                  category: pricing.category,
                                  creditCost: pricing.creditCost.toString(),
                                  kieCreditCost: pricing.kieCreditCost?.toString() || "",
                                  description: pricing.description || "",
                                });
                              }}
                              data-testid={`button-edit-pricing-${pricing.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (!deletePricingMutation.isPending) {
                                  setDeletingPricingId(pricing.id);
                                }
                              }}
                              disabled={deletePricingMutation.isPending}
                              data-testid={`button-delete-pricing-${pricing.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Subscription Plans</CardTitle>
                <CardDescription>
                  Manage subscription plans, pricing, and Stripe configuration
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setResettingPlans(true)} 
                  variant="destructive"
                  data-testid="button-reset-plans"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset Plans
                </Button>
                <Button onClick={() => setCreatingPlan(true)} data-testid="button-create-plan">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Plan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {plansLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Order</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Billing Period</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Credits/Month</TableHead>
                      <TableHead>Stripe</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan, index) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium" data-testid={`text-plan-sort-order-${plan.id}`}>
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">{plan.sortOrder}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium font-mono text-sm" data-testid={`text-plan-name-${plan.id}`}>
                          {plan.name}
                        </TableCell>
                        <TableCell data-testid={`text-plan-display-name-${plan.id}`}>
                          {plan.displayName}
                        </TableCell>
                        <TableCell data-testid={`text-plan-billing-period-${plan.id}`}>
                          <Badge variant={plan.billingPeriod === 'monthly' ? 'default' : plan.billingPeriod === 'annual' ? 'secondary' : 'outline'} className="capitalize text-xs">
                            {plan.billingPeriod}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-plan-price-${plan.id}`}>
                          ${(plan.price / 100).toFixed(2)}/{plan.billingPeriod === 'monthly' ? 'mo' : 'yr'}
                        </TableCell>
                        <TableCell data-testid={`text-plan-credits-${plan.id}`}>
                          {plan.creditsPerMonth.toLocaleString()}
                        </TableCell>
                        <TableCell data-testid={`text-plan-stripe-status-${plan.id}`}>
                          {plan.stripePriceId && plan.stripeProductId ? (
                            <Badge variant="default" className="text-xs">Configured</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Not Set</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reorderPlanMutation.mutate({ planId: plan.id, direction: 'up' })}
                              disabled={index === 0 || reorderPlanMutation.isPending}
                              title="Move up"
                              data-testid={`button-reorder-up-${plan.id}`}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reorderPlanMutation.mutate({ planId: plan.id, direction: 'down' })}
                              disabled={index === plans.length - 1 || reorderPlanMutation.isPending}
                              title="Move down"
                              data-testid={`button-reorder-down-${plan.id}`}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingPlanId(plan.id);
                                setEditPlanData({
                                  name: plan.name,
                                  displayName: plan.displayName,
                                  description: plan.description || "",
                                  price: (plan.price / 100).toString(),
                                  billingPeriod: plan.billingPeriod as "monthly" | "annual" | "trial",
                                  creditsPerMonth: plan.creditsPerMonth.toString(),
                                  features: JSON.stringify(plan.features || []),
                                  stripePriceId: plan.stripePriceId || "",
                                  stripeProductId: plan.stripeProductId || "",
                                });
                              }}
                              data-testid={`button-edit-plan-${plan.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeletingPlanId(plan.id)}
                              data-testid={`button-delete-plan-${plan.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Hero Section</CardTitle>
                <CardDescription>Manage the main hero section of the home page</CardDescription>
              </CardHeader>
              <CardContent>
                {homePageLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="heroTitle">Hero Title</Label>
                        <Input
                          id="heroTitle"
                          value={homePageFormData.heroTitle}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, heroTitle: e.target.value })}
                          placeholder="Create any video you can imagine"
                          data-testid="input-hero-title"
                        />
                      </div>
                      <div>
                        <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
                        <Input
                          id="heroSubtitle"
                          value={homePageFormData.heroSubtitle}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, heroSubtitle: e.target.value })}
                          placeholder="Generate stunning videos, images, and music"
                          data-testid="input-hero-subtitle"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="heroVideoUrl">Hero Video URL</Label>
                        <Input
                          id="heroVideoUrl"
                          value={homePageFormData.heroVideoUrl}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, heroVideoUrl: e.target.value })}
                          placeholder="https://vimeo.com/... or https://peertube-instance/videos/watch/..."
                          data-testid="input-hero-video-url"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Supports Vimeo and PeerTube URLs</p>
                      </div>
                      <div>
                        <Label htmlFor="heroImageUrl">Hero Image URL (fallback)</Label>
                        <Input
                          id="heroImageUrl"
                          value={homePageFormData.heroImageUrl}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, heroImageUrl: e.target.value })}
                          placeholder="https://..."
                          data-testid="input-hero-image-url"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Used if no video URL provided</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        updateHomePageMutation.mutate({
                          heroTitle: homePageFormData.heroTitle.trim() || undefined,
                          heroSubtitle: homePageFormData.heroSubtitle.trim() || undefined,
                          heroVideoUrl: homePageFormData.heroVideoUrl.trim() || undefined,
                          heroImageUrl: homePageFormData.heroImageUrl.trim() || undefined,
                        });
                      }}
                      disabled={updateHomePageMutation.isPending}
                      data-testid="button-save-hero"
                    >
                      {updateHomePageMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Hero Section
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feature Section Videos</CardTitle>
                <CardDescription>Video URLs for the landing page feature sections (supports Vimeo and PeerTube)</CardDescription>
              </CardHeader>
              <CardContent>
                {homePageLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="featureVideoUrl">"Create videos that captivate" Section Video URL</Label>
                      <Input
                        id="featureVideoUrl"
                        value={homePageFormData.featureVideoUrl}
                        onChange={(e) => setHomePageFormData({ ...homePageFormData, featureVideoUrl: e.target.value })}
                        placeholder="https://vimeo.com/... or https://peertube-instance/videos/watch/..."
                        data-testid="input-feature-video-url"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Supports Vimeo and PeerTube URLs</p>
                    </div>
                    <div>
                      <Label htmlFor="featureImageUrl">"Images that inspire" Section Video URL</Label>
                      <Input
                        id="featureImageUrl"
                        value={homePageFormData.featureImageUrl}
                        onChange={(e) => setHomePageFormData({ ...homePageFormData, featureImageUrl: e.target.value })}
                        placeholder="https://vimeo.com/... or https://peertube-instance/videos/watch/..."
                        data-testid="input-feature-image-url"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Supports Vimeo and PeerTube URLs</p>
                    </div>
                    <div>
                      <Label htmlFor="featureMusicUrl">"Music that moves" Section Video URL</Label>
                      <Input
                        id="featureMusicUrl"
                        value={homePageFormData.featureMusicUrl}
                        onChange={(e) => setHomePageFormData({ ...homePageFormData, featureMusicUrl: e.target.value })}
                        placeholder="https://vimeo.com/... or https://peertube-instance/videos/watch/..."
                        data-testid="input-feature-music-url"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Supports Vimeo and PeerTube URLs</p>
                    </div>
                    <div>
                      <Label htmlFor="pricingVideoUrl">Pricing Page Popup Video URL</Label>
                      <Input
                        id="pricingVideoUrl"
                        value={homePageFormData.pricingVideoUrl}
                        onChange={(e) => setHomePageFormData({ ...homePageFormData, pricingVideoUrl: e.target.value })}
                        placeholder="https://vimeo.com/... or https://peertube-instance/videos/watch/..."
                        data-testid="input-pricing-video-url"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Video that plays in popup when users click "Watch Video" on pricing page (supports Vimeo/PeerTube)</p>
                    </div>
                    <div>
                      <Label htmlFor="demoVideoUrl">Landing Page Demo Video URL</Label>
                      <Input
                        id="demoVideoUrl"
                        value={homePageFormData.demoVideoUrl}
                        onChange={(e) => setHomePageFormData({ ...homePageFormData, demoVideoUrl: e.target.value })}
                        placeholder="https://vimeo.com/... or https://peertube-instance/videos/watch/..."
                        data-testid="input-demo-video-url"
                      />
                      <p className="text-xs text-muted-foreground mt-1">2-minute demo video that plays in popup when users click "Watch Demo" (supports Vimeo/PeerTube)</p>
                    </div>
                    <Button
                      onClick={() => {
                        updateHomePageMutation.mutate({
                          featureVideoUrl: homePageFormData.featureVideoUrl.trim() || undefined,
                          featureImageUrl: homePageFormData.featureImageUrl.trim() || undefined,
                          featureMusicUrl: homePageFormData.featureMusicUrl.trim() || undefined,
                          pricingVideoUrl: homePageFormData.pricingVideoUrl.trim() || undefined,
                          demoVideoUrl: homePageFormData.demoVideoUrl.trim() || undefined,
                        });
                      }}
                      disabled={updateHomePageMutation.isPending}
                      data-testid="button-save-feature-videos"
                    >
                      {updateHomePageMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Feature Videos
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generation Page Previews</CardTitle>
                <CardDescription>PeerTube video URLs shown in the preview panel of each generation page</CardDescription>
              </CardHeader>
              <CardContent>
                {homePageLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="previewVideoVideo">Video Generation Preview</Label>
                        <Input
                          id="previewVideoVideo"
                          value={homePageFormData.previewVideoVideo}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoVideo: e.target.value })}
                          placeholder="https://peertube.example.com/videos/watch/..."
                          data-testid="input-preview-video-video"
                        />
                      </div>
                      <div>
                        <Label htmlFor="previewVideoImage">Image Generation Preview</Label>
                        <Input
                          id="previewVideoImage"
                          value={homePageFormData.previewVideoImage}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoImage: e.target.value })}
                          placeholder="https://peertube.example.com/videos/watch/..."
                          data-testid="input-preview-video-image"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="previewVideoTransition">Transition Video Preview</Label>
                        <Input
                          id="previewVideoTransition"
                          value={homePageFormData.previewVideoTransition}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoTransition: e.target.value })}
                          placeholder="https://peertube.example.com/videos/watch/..."
                          data-testid="input-preview-video-transition"
                        />
                      </div>
                      <div>
                        <Label htmlFor="previewVideoSora">Sora AI Preview</Label>
                        <Input
                          id="previewVideoSora"
                          value={homePageFormData.previewVideoSora}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoSora: e.target.value })}
                          placeholder="https://peertube.example.com/videos/watch/..."
                          data-testid="input-preview-video-sora"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="previewVideoGrok">Grok Imagine Preview</Label>
                        <Input
                          id="previewVideoGrok"
                          value={homePageFormData.previewVideoGrok}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoGrok: e.target.value })}
                          placeholder="https://peertube.example.com/videos/watch/..."
                          data-testid="input-preview-video-grok"
                        />
                      </div>
                      <div>
                        <Label htmlFor="previewVideoSoundEffects">Sound Effects Preview</Label>
                        <Input
                          id="previewVideoSoundEffects"
                          value={homePageFormData.previewVideoSoundEffects}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoSoundEffects: e.target.value })}
                          placeholder="https://peertube.example.com/videos/watch/..."
                          data-testid="input-preview-video-sound-effects"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="previewVideoMusic">Music Generation Preview</Label>
                        <Input
                          id="previewVideoMusic"
                          value={homePageFormData.previewVideoMusic}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoMusic: e.target.value })}
                          placeholder="https://peertube.example.com/videos/watch/..."
                          data-testid="input-preview-video-music"
                        />
                      </div>
                      <div>
                        <Label htmlFor="previewVideoVoiceClone">Voice Clone Preview</Label>
                        <Input
                          id="previewVideoVoiceClone"
                          value={homePageFormData.previewVideoVoiceClone}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoVoiceClone: e.target.value })}
                          placeholder="https://peertube.example.com/videos/watch/..."
                          data-testid="input-preview-video-voice-clone"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="previewVideoTts">Text-to-Speech Preview</Label>
                        <Input
                          id="previewVideoTts"
                          value={homePageFormData.previewVideoTts}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoTts: e.target.value })}
                          placeholder="https://peertube.example.com/videos/watch/..."
                          data-testid="input-preview-video-tts"
                        />
                      </div>
                      <div>
                        <Label htmlFor="previewVideoBgRemover">Background Remover Preview</Label>
                        <Input
                          id="previewVideoBgRemover"
                          value={homePageFormData.previewVideoBgRemover}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoBgRemover: e.target.value })}
                          placeholder="https://peertube.example.com/videos/watch/..."
                          data-testid="input-preview-video-bg-remover"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="previewVideoTalkingAvatar">Talking Avatar Preview</Label>
                        <Input
                          id="previewVideoTalkingAvatar"
                          value={homePageFormData.previewVideoTalkingAvatar}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoTalkingAvatar: e.target.value })}
                          placeholder="https://peertube.example.com/videos/watch/..."
                          data-testid="input-preview-video-talking-avatar"
                        />
                      </div>
                      <div>
                        <Label htmlFor="previewVideoUpscaler">Image Upscaler Preview</Label>
                        <Input
                          id="previewVideoUpscaler"
                          value={homePageFormData.previewVideoUpscaler}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoUpscaler: e.target.value })}
                          placeholder="https://peertube.example.com/videos/watch/..."
                          data-testid="input-preview-video-image-upscaler"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="previewVideoVideoUpscaler">Video Upscaler Preview</Label>
                        <Input
                          id="previewVideoVideoUpscaler"
                          value={homePageFormData.previewVideoVideoUpscaler}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoVideoUpscaler: e.target.value })}
                          placeholder="https://peertube.example.com/videos/watch/..."
                          data-testid="input-preview-video-video-upscaler"
                        />
                      </div>
                      <div>
                        <Label htmlFor="previewVideoLipSync">Lip Sync Preview</Label>
                        <Input
                          id="previewVideoLipSync"
                          value={homePageFormData.previewVideoLipSync}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoLipSync: e.target.value })}
                          placeholder="https://peertube.example.com/videos/watch/..."
                          data-testid="input-preview-video-lip-sync"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="previewVideoStt">Speech-to-Text Preview</Label>
                        <Input
                          id="previewVideoStt"
                          value={homePageFormData.previewVideoStt}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoStt: e.target.value })}
                          placeholder="https://peertube.example.com/videos/watch/..."
                          data-testid="input-preview-video-stt"
                        />
                      </div>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t">
                      <h4 className="text-sm font-medium mb-4">Brand Builder Preview Videos</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="previewVideoBrandProductAd">Product Ad</Label>
                          <Input
                            id="previewVideoBrandProductAd"
                            value={homePageFormData.previewVideoBrandProductAd}
                            onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoBrandProductAd: e.target.value })}
                            placeholder="https://peertube.example.com/videos/watch/..."
                            data-testid="input-preview-video-brand-product-ad"
                          />
                        </div>
                        <div>
                          <Label htmlFor="previewVideoBrandInfluencerAd">Influencer Ad</Label>
                          <Input
                            id="previewVideoBrandInfluencerAd"
                            value={homePageFormData.previewVideoBrandInfluencerAd}
                            onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoBrandInfluencerAd: e.target.value })}
                            placeholder="https://peertube.example.com/videos/watch/..."
                            data-testid="input-preview-video-brand-influencer-ad"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 mt-4">
                        <div>
                          <Label htmlFor="previewVideoBrandLogoAnimation">Logo Animation</Label>
                          <Input
                            id="previewVideoBrandLogoAnimation"
                            value={homePageFormData.previewVideoBrandLogoAnimation}
                            onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoBrandLogoAnimation: e.target.value })}
                            placeholder="https://peertube.example.com/videos/watch/..."
                            data-testid="input-preview-video-brand-logo-animation"
                          />
                        </div>
                        <div>
                          <Label htmlFor="previewVideoBrandUnboxing">Unboxing</Label>
                          <Input
                            id="previewVideoBrandUnboxing"
                            value={homePageFormData.previewVideoBrandUnboxing}
                            onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoBrandUnboxing: e.target.value })}
                            placeholder="https://peertube.example.com/videos/watch/..."
                            data-testid="input-preview-video-brand-unboxing"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 mt-4">
                        <div>
                          <Label htmlFor="previewVideoBrandFlashSale">Flash Sale</Label>
                          <Input
                            id="previewVideoBrandFlashSale"
                            value={homePageFormData.previewVideoBrandFlashSale}
                            onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoBrandFlashSale: e.target.value })}
                            placeholder="https://peertube.example.com/videos/watch/..."
                            data-testid="input-preview-video-brand-flash-sale"
                          />
                        </div>
                        <div>
                          <Label htmlFor="previewVideoBrandBrandStory">Brand Story</Label>
                          <Input
                            id="previewVideoBrandBrandStory"
                            value={homePageFormData.previewVideoBrandBrandStory}
                            onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoBrandBrandStory: e.target.value })}
                            placeholder="https://peertube.example.com/videos/watch/..."
                            data-testid="input-preview-video-brand-brand-story"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 mt-4">
                        <div>
                          <Label htmlFor="previewVideoBrandTestimonial">Testimonial</Label>
                          <Input
                            id="previewVideoBrandTestimonial"
                            value={homePageFormData.previewVideoBrandTestimonial}
                            onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoBrandTestimonial: e.target.value })}
                            placeholder="https://peertube.example.com/videos/watch/..."
                            data-testid="input-preview-video-brand-testimonial"
                          />
                        </div>
                        <div>
                          <Label htmlFor="previewVideoBrandSocialPromo">Social Promo</Label>
                          <Input
                            id="previewVideoBrandSocialPromo"
                            value={homePageFormData.previewVideoBrandSocialPromo}
                            onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoBrandSocialPromo: e.target.value })}
                            placeholder="https://peertube.example.com/videos/watch/..."
                            data-testid="input-preview-video-brand-social-promo"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 mt-4">
                        <div>
                          <Label htmlFor="previewVideoBrandBeforeAfter">Before & After</Label>
                          <Input
                            id="previewVideoBrandBeforeAfter"
                            value={homePageFormData.previewVideoBrandBeforeAfter}
                            onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoBrandBeforeAfter: e.target.value })}
                            placeholder="https://peertube.example.com/videos/watch/..."
                            data-testid="input-preview-video-brand-before-after"
                          />
                        </div>
                        <div>
                          <Label htmlFor="previewVideoBrandShowcase">Showcase</Label>
                          <Input
                            id="previewVideoBrandShowcase"
                            value={homePageFormData.previewVideoBrandShowcase}
                            onChange={(e) => setHomePageFormData({ ...homePageFormData, previewVideoBrandShowcase: e.target.value })}
                            placeholder="https://peertube.example.com/videos/watch/..."
                            data-testid="input-preview-video-brand-showcase"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => {
                        updateHomePageMutation.mutate({
                          previewVideoVideo: homePageFormData.previewVideoVideo.trim() || undefined,
                          previewVideoImage: homePageFormData.previewVideoImage.trim() || undefined,
                          previewVideoTransition: homePageFormData.previewVideoTransition.trim() || undefined,
                          previewVideoSora: homePageFormData.previewVideoSora.trim() || undefined,
                          previewVideoGrok: homePageFormData.previewVideoGrok.trim() || undefined,
                          previewVideoSoundEffects: homePageFormData.previewVideoSoundEffects.trim() || undefined,
                          previewVideoMusic: homePageFormData.previewVideoMusic.trim() || undefined,
                          previewVideoVoiceClone: homePageFormData.previewVideoVoiceClone.trim() || undefined,
                          previewVideoLipSync: homePageFormData.previewVideoLipSync.trim() || undefined,
                          previewVideoTts: homePageFormData.previewVideoTts.trim() || undefined,
                          previewVideoStt: homePageFormData.previewVideoStt.trim() || undefined,
                          previewVideoUpscaler: homePageFormData.previewVideoUpscaler.trim() || undefined,
                          previewVideoVideoUpscaler: homePageFormData.previewVideoVideoUpscaler.trim() || undefined,
                          previewVideoBgRemover: homePageFormData.previewVideoBgRemover.trim() || undefined,
                          previewVideoTalkingAvatar: homePageFormData.previewVideoTalkingAvatar.trim() || undefined,
                          previewVideoBrandProductAd: homePageFormData.previewVideoBrandProductAd.trim() || undefined,
                          previewVideoBrandInfluencerAd: homePageFormData.previewVideoBrandInfluencerAd.trim() || undefined,
                          previewVideoBrandLogoAnimation: homePageFormData.previewVideoBrandLogoAnimation.trim() || undefined,
                          previewVideoBrandUnboxing: homePageFormData.previewVideoBrandUnboxing.trim() || undefined,
                          previewVideoBrandFlashSale: homePageFormData.previewVideoBrandFlashSale.trim() || undefined,
                          previewVideoBrandBrandStory: homePageFormData.previewVideoBrandBrandStory.trim() || undefined,
                          previewVideoBrandTestimonial: homePageFormData.previewVideoBrandTestimonial.trim() || undefined,
                          previewVideoBrandSocialPromo: homePageFormData.previewVideoBrandSocialPromo.trim() || undefined,
                          previewVideoBrandBeforeAfter: homePageFormData.previewVideoBrandBeforeAfter.trim() || undefined,
                          previewVideoBrandShowcase: homePageFormData.previewVideoBrandShowcase.trim() || undefined,
                        });
                      }}
                      disabled={updateHomePageMutation.isPending}
                      data-testid="button-save-preview-videos"
                    >
                      {updateHomePageMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Preview Videos
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 gap-2">
                <div>
                  <CardTitle>Showcase Videos</CardTitle>
                  <CardDescription>Manage the showcase video gallery (max 3 videos)</CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    if ((homePageContent?.showcaseVideos || []).length >= 3) {
                      toast({ title: "Maximum reached", description: "You can only have up to 3 showcase videos", variant: "destructive" });
                      return;
                    }
                    setShowcaseEditIndex(null);
                    setShowcaseVideo({ url: "", title: "", description: "" });
                    setShowcaseDialogOpen(true);
                  }}
                  data-testid="button-add-showcase-video"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Video
                </Button>
              </CardHeader>
              <CardContent>
                {homePageLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (homePageContent?.showcaseVideos || []).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No showcase videos added yet. Click "Add Video" to get started.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(homePageContent?.showcaseVideos || []).map((video, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-medium truncate">{video.url}</p>
                              {video.title && <p className="text-xs text-muted-foreground">{video.title}</p>}
                              {video.description && <p className="text-xs text-muted-foreground">{video.description}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setShowcaseEditIndex(index);
                                  setShowcaseVideo({
                                    url: video.url,
                                    title: video.title || "",
                                    description: video.description || "",
                                  });
                                  setShowcaseDialogOpen(true);
                                }}
                                data-testid={`button-edit-showcase-${index}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const updated = [...(homePageContent?.showcaseVideos || [])];
                                updated.splice(index, 1);
                                updateHomePageMutation.mutate({ showcaseVideos: updated });
                              }}
                              data-testid={`button-delete-showcase-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Creators Section</CardTitle>
                  <CardDescription>Content for creators/individuals</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="creatorsTitle">Title</Label>
                    <Input
                      id="creatorsTitle"
                      value={homePageFormData.creatorsTitle}
                      onChange={(e) => setHomePageFormData({ ...homePageFormData, creatorsTitle: e.target.value })}
                      placeholder="Creators"
                      data-testid="input-creators-title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="creatorsDescription">Description</Label>
                    <Textarea
                      id="creatorsDescription"
                      value={homePageFormData.creatorsDescription}
                      onChange={(e) => setHomePageFormData({ ...homePageFormData, creatorsDescription: e.target.value })}
                      placeholder="Description for creators..."
                      rows={3}
                      data-testid="input-creators-description"
                    />
                  </div>
                  <div>
                    <Label htmlFor="creatorsImageUrl">Image URL</Label>
                    <Input
                      id="creatorsImageUrl"
                      value={homePageFormData.creatorsImageUrl}
                      onChange={(e) => setHomePageFormData({ ...homePageFormData, creatorsImageUrl: e.target.value })}
                      placeholder="https://..."
                      data-testid="input-creators-image-url"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      updateHomePageMutation.mutate({
                        creatorsTitle: homePageFormData.creatorsTitle.trim() || undefined,
                        creatorsDescription: homePageFormData.creatorsDescription.trim() || undefined,
                        creatorsImageUrl: homePageFormData.creatorsImageUrl.trim() || undefined,
                      });
                    }}
                    disabled={updateHomePageMutation.isPending}
                    data-testid="button-save-creators"
                  >
                    {updateHomePageMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Business Section</CardTitle>
                  <CardDescription>Content for businesses</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="businessTitle">Title</Label>
                    <Input
                      id="businessTitle"
                      value={homePageFormData.businessTitle}
                      onChange={(e) => setHomePageFormData({ ...homePageFormData, businessTitle: e.target.value })}
                      placeholder="Businesses"
                      data-testid="input-business-title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="businessDescription">Description</Label>
                    <Textarea
                      id="businessDescription"
                      value={homePageFormData.businessDescription}
                      onChange={(e) => setHomePageFormData({ ...homePageFormData, businessDescription: e.target.value })}
                      placeholder="Description for businesses..."
                      rows={3}
                      data-testid="input-business-description"
                    />
                  </div>
                  <div>
                    <Label htmlFor="businessImageUrl">Image URL</Label>
                    <Input
                      id="businessImageUrl"
                      value={homePageFormData.businessImageUrl}
                      onChange={(e) => setHomePageFormData({ ...homePageFormData, businessImageUrl: e.target.value })}
                      placeholder="https://..."
                      data-testid="input-business-image-url"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      updateHomePageMutation.mutate({
                        businessTitle: homePageFormData.businessTitle.trim() || undefined,
                        businessDescription: homePageFormData.businessDescription.trim() || undefined,
                        businessImageUrl: homePageFormData.businessImageUrl.trim() || undefined,
                      });
                    }}
                    disabled={updateHomePageMutation.isPending}
                    data-testid="button-save-business"
                  >
                    {updateHomePageMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 gap-2">
                <div>
                  <CardTitle>FAQs</CardTitle>
                  <CardDescription>Manage frequently asked questions</CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setFaqEditIndex(null);
                    setFaqQuestion("");
                    setFaqAnswer("");
                    setFaqDialogOpen(true);
                  }}
                  data-testid="button-add-faq"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add FAQ
                </Button>
              </CardHeader>
              <CardContent>
                {homePageLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (homePageContent?.faqs || []).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No FAQs added yet. Click "Add FAQ" to get started.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(homePageContent?.faqs || []).map((faq, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-medium">{faq.question}</p>
                              <p className="text-sm text-muted-foreground">{faq.answer}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setFaqEditIndex(index);
                                  setFaqQuestion(faq.question);
                                  setFaqAnswer(faq.answer);
                                  setFaqDialogOpen(true);
                                }}
                                data-testid={`button-edit-faq-${index}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const updated = [...(homePageContent?.faqs || [])];
                                  updated.splice(index, 1);
                                  updateHomePageMutation.mutate({ faqs: updated });
                                }}
                                data-testid={`button-delete-faq-${index}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5" />
                    Welcome Onboarding
                  </CardTitle>
                  <CardDescription>Configure welcome video and onboarding slides for new users</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {homePageLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="welcomeVideoUrl" className="flex items-center gap-2">
                          <Video className="h-4 w-4" />
                          Welcome Video URL (plays for new users before slideshow)
                        </Label>
                        <Input
                          id="welcomeVideoUrl"
                          value={homePageFormData.welcomeVideoUrl}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, welcomeVideoUrl: e.target.value })}
                          placeholder="https://vimeo.com/... or https://peertube-instance/videos/watch/..."
                          data-testid="input-welcome-video-url"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Supports Vimeo and PeerTube URLs. This video plays before the welcome slideshow for new users.</p>
                      </div>
                      <Button
                        onClick={() => {
                          updateHomePageMutation.mutate({
                            welcomeVideoUrl: homePageFormData.welcomeVideoUrl.trim() || undefined,
                          });
                        }}
                        disabled={updateHomePageMutation.isPending}
                        data-testid="button-save-welcome-video"
                      >
                        {updateHomePageMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Welcome Video
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="border-t pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Welcome Slides
                          </h4>
                          <p className="text-xs text-muted-foreground">Onboarding slides shown to new users after the welcome video</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setWelcomeSlideEditIndex(null);
                            setWelcomeSlideData({ title: "", description: "", icon: "", highlight: "" });
                            setWelcomeSlideDialogOpen(true);
                          }}
                          data-testid="button-add-welcome-slide"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Slide
                        </Button>
                      </div>

                      {(homePageContent?.welcomeSlides || []).length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No welcome slides added yet. Click "Add Slide" to get started.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(homePageContent?.welcomeSlides || []).map((slide, index) => (
                            <Card key={slide.id || index}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium">{slide.title}</p>
                                      {slide.icon && (
                                        <Badge variant="outline" className="text-xs">{slide.icon}</Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">{slide.description}</p>
                                    {slide.highlight && (
                                      <p className="text-xs text-primary font-medium">{slide.highlight}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setWelcomeSlideEditIndex(index);
                                        setWelcomeSlideData({
                                          title: slide.title || "",
                                          description: slide.description || "",
                                          icon: slide.icon || "",
                                          highlight: slide.highlight || "",
                                        });
                                        setWelcomeSlideDialogOpen(true);
                                      }}
                                      data-testid={`button-edit-welcome-slide-${index}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        const updated = [...(homePageContent?.welcomeSlides || [])];
                                        updated.splice(index, 1);
                                        updateHomePageMutation.mutate({ welcomeSlides: updated });
                                      }}
                                      data-testid={`button-delete-welcome-slide-${index}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="announcements">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Announcement Management</CardTitle>
                <CardDescription>Create and manage announcement bars with plan targeting</CardDescription>
              </div>
              <Button
                onClick={() => {
                  setAnnouncementForm({
                    message: "",
                    type: "info",
                    targetPlans: [],
                    isActive: true,
                    startDate: "",
                    endDate: "",
                  });
                  setEditingAnnouncementId(null);
                  setCreatingAnnouncement(true);
                }}
                data-testid="button-create-announcement"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Announcement
              </Button>
            </CardHeader>
            <CardContent>
              {announcementsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No announcements yet. Create one to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((announcement) => (
                    <Card key={announcement.id} className="hover-elevate">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={announcement.type === "warning" ? "destructive" : "default"}>
                                {announcement.type}
                              </Badge>
                              <Badge variant={announcement.isActive ? "default" : "secondary"}>
                                {announcement.isActive ? "Active" : "Inactive"}
                              </Badge>
                              {announcement.targetPlans && announcement.targetPlans.length > 0 ? (
                                <Badge variant="outline">
                                  {announcement.targetPlans.join(", ")}
                                </Badge>
                              ) : (
                                <Badge variant="outline">All Plans</Badge>
                              )}
                            </div>
                            <p className="text-sm">{announcement.message}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {announcement.startDate && (
                                <span>Start: {new Date(announcement.startDate).toLocaleDateString()}</span>
                              )}
                              {announcement.endDate && (
                                <span>End: {new Date(announcement.endDate).toLocaleDateString()}</span>
                              )}
                              <span>Updated {formatDistanceToNow(new Date(announcement.updatedAt))} ago</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAnnouncementForm({
                                  message: announcement.message,
                                  type: announcement.type as any,
                                  targetPlans: announcement.targetPlans || [],
                                  isActive: announcement.isActive,
                                  startDate: announcement.startDate ? new Date(announcement.startDate).toISOString().slice(0, 16) : "",
                                  endDate: announcement.endDate ? new Date(announcement.endDate).toISOString().slice(0, 16) : "",
                                });
                                setEditingAnnouncementId(announcement.id);
                                setCreatingAnnouncement(true);
                              }}
                              data-testid={`button-edit-announcement-${announcement.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (confirm(`Delete announcement: "${announcement.message}"?`)) {
                                  try {
                                    await apiRequest("DELETE", `/api/admin/announcements/${announcement.id}`, {});
                                    queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
                                    toast({
                                      title: "Success",
                                      description: "Announcement deleted successfully",
                                    });
                                  } catch (error: any) {
                                    toast({
                                      title: "Error",
                                      description: error.message || "Failed to delete announcement",
                                      variant: "destructive",
                                    });
                                  }
                                }
                              }}
                              data-testid={`button-delete-announcement-${announcement.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="showcase">
          <Card>
            <CardHeader>
              <CardTitle>Showcase Management</CardTitle>
              <CardDescription>Manage which videos appear on the Video Models showcase page</CardDescription>
            </CardHeader>
            <CardContent>
              {generationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : adminGenerations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No completed video generations found
                </div>
              ) : (
                <>
                  <div className="mb-4 text-sm text-muted-foreground">
                    {adminGenerations.filter(g => g.isShowcase).length} of {adminGenerations.length} videos in showcase
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Preview</TableHead>
                        <TableHead>Prompt</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-center">Showcase</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminGenerations.map((generation) => (
                        <TableRow key={generation.id}>
                          <TableCell>
                            <video 
                              src={generation.resultUrl || ''} 
                              className="w-20 h-12 object-cover rounded"
                              muted
                              data-testid={`video-preview-${generation.id}`}
                            />
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="line-clamp-2 text-sm">{generation.prompt}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{generation.model}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono">
                            {generation.userId.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(generation.createdAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant={generation.isShowcase ? "default" : "outline"}
                              size="sm"
                              onClick={async () => {
                                try {
                                  await apiRequest("PATCH", `/api/admin/generations/${generation.id}/showcase`, {
                                    isShowcase: !generation.isShowcase
                                  });
                                  queryClient.invalidateQueries({ queryKey: ["/api/admin/generations"] });
                                  queryClient.invalidateQueries({ queryKey: ["/api/showcase-videos"] });
                                  toast({
                                    title: "Success",
                                    description: generation.isShowcase ? "Removed from showcase" : "Added to showcase",
                                  });
                                } catch (error: any) {
                                  toast({
                                    title: "Error",
                                    description: error.message || "Failed to update showcase status",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              data-testid={`button-toggle-showcase-${generation.id}`}
                            >
                              {generation.isShowcase ? "Remove" : "Add"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blog">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Blog Management</CardTitle>
                <CardDescription>Create and manage blog posts</CardDescription>
              </div>
              <Button 
                onClick={() => {
                  setBlogPostForm({
                    title: "",
                    slug: "",
                    content: "",
                    excerpt: "",
                    author: "Artivio Team",
                    category: "Announcement",
                    tags: "",
                    featuredImageUrl: "",
                    metaDescription: "",
                    status: "draft",
                  });
                  setEditingBlogPostId(null);
                  setCreatingBlogPost(true);
                }} 
                data-testid="button-create-blog-post"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Post
              </Button>
            </CardHeader>
            <CardContent>
              {blogPostsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : blogPosts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No blog posts found. Create your first post!
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Published Date</TableHead>
                      <TableHead>View Count</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blogPosts.map((post) => (
                      <TableRow key={post.id} data-testid={`row-blog-post-${post.id}`}>
                        <TableCell className="font-medium max-w-[200px]">
                          <div className="line-clamp-1">{post.title}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono max-w-[150px]">
                          <div className="line-clamp-1">{post.slug}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{post.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                            {post.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {post.publishedDate 
                            ? new Date(post.publishedDate).toLocaleDateString() 
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm">{post.viewCount}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => window.open(`/blog/${post.slug}`, '_blank')}
                                  data-testid={`button-preview-blog-post-${post.id}`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Preview</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => {
                                    setBlogPostForm({
                                      title: post.title,
                                      slug: post.slug,
                                      content: post.content,
                                      excerpt: post.excerpt || "",
                                      author: post.author || "Artivio Team",
                                      category: post.category as any || "Announcement",
                                      tags: Array.isArray(post.tags) ? post.tags.join(", ") : "",
                                      featuredImageUrl: post.featuredImageUrl || "",
                                      metaDescription: post.metaDescription || "",
                                      status: post.status as any || "draft",
                                    });
                                    setEditingBlogPostId(post.id);
                                    setCreatingBlogPost(true);
                                  }}
                                  data-testid={`button-edit-blog-post-${post.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => setDeletingBlogPostId(post.id)}
                                  data-testid={`button-delete-blog-post-${post.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Showcase Video Dialog */}
      <Dialog open={showcaseDialogOpen} onOpenChange={setShowcaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{showcaseEditIndex !== null ? "Edit" : "Add"} Showcase Video</DialogTitle>
            <DialogDescription>
              Enter video details for the showcase gallery
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="showcaseVideoUrl">Video URL *</Label>
              <Input
                id="showcaseVideoUrl"
                value={showcaseVideo.url}
                onChange={(e) => setShowcaseVideo({ ...showcaseVideo, url: e.target.value })}
                placeholder="https://vimeo.com/... or https://peertube-instance/videos/watch/..."
                data-testid="input-showcase-video-url"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supports Vimeo URLs (e.g., https://vimeo.com/123456789) and PeerTube URLs
              </p>
            </div>
            <div>
              <Label htmlFor="showcaseVideoTitle">Title (optional)</Label>
              <Input
                id="showcaseVideoTitle"
                value={showcaseVideo.title}
                onChange={(e) => setShowcaseVideo({ ...showcaseVideo, title: e.target.value })}
                placeholder="Video title..."
                data-testid="input-showcase-video-title"
              />
            </div>
            <div>
              <Label htmlFor="showcaseVideoDescription">Description (optional)</Label>
              <Textarea
                id="showcaseVideoDescription"
                value={showcaseVideo.description}
                onChange={(e) => setShowcaseVideo({ ...showcaseVideo, description: e.target.value })}
                placeholder="Video description..."
                rows={3}
                data-testid="input-showcase-video-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowcaseDialogOpen(false)} data-testid="button-cancel-showcase">
              Cancel
            </Button>
            <Button
              onClick={() => {
                const trimmedUrl = showcaseVideo.url.trim();
                const trimmedTitle = showcaseVideo.title.trim();
                const trimmedDescription = showcaseVideo.description.trim();
                
                if (!trimmedUrl) {
                  toast({ title: "Error", description: "Video URL is required", variant: "destructive" });
                  return;
                }
                const isVimeo = trimmedUrl.includes('vimeo.com');
                const isPeerTube = trimmedUrl.includes('/videos/watch/') || trimmedUrl.includes('/w/') || trimmedUrl.includes('/videos/embed/');
                if (!isVimeo && !isPeerTube) {
                  toast({ title: "Error", description: "Must be a Vimeo or PeerTube URL", variant: "destructive" });
                  return;
                }
                
                const updated = [...(homePageContent?.showcaseVideos || [])];
                const videoData: { url: string; title?: string; description?: string } = {
                  url: trimmedUrl,
                };
                
                if (trimmedTitle) {
                  videoData.title = trimmedTitle;
                }
                if (trimmedDescription) {
                  videoData.description = trimmedDescription;
                }
                
                if (showcaseEditIndex !== null) {
                  updated[showcaseEditIndex] = videoData;
                } else {
                  updated.push(videoData);
                }
                
                updateHomePageMutation.mutate({ showcaseVideos: updated });
                setShowcaseDialogOpen(false);
              }}
              disabled={updateHomePageMutation.isPending}
              data-testid="button-save-showcase"
            >
              {updateHomePageMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FAQ Dialog */}
      <Dialog open={faqDialogOpen} onOpenChange={setFaqDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{faqEditIndex !== null ? "Edit" : "Add"} FAQ</DialogTitle>
            <DialogDescription>
              Add a frequently asked question and its answer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="faqQuestion">Question</Label>
              <Input
                id="faqQuestion"
                value={faqQuestion}
                onChange={(e) => setFaqQuestion(e.target.value)}
                placeholder="What is Artivio AI?"
                data-testid="input-faq-question"
              />
            </div>
            <div>
              <Label htmlFor="faqAnswer">Answer</Label>
              <Textarea
                id="faqAnswer"
                value={faqAnswer}
                onChange={(e) => setFaqAnswer(e.target.value)}
                placeholder="Artivio AI is a comprehensive platform..."
                rows={4}
                data-testid="input-faq-answer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFaqDialogOpen(false)} data-testid="button-cancel-faq">
              Cancel
            </Button>
            <Button
              onClick={() => {
                const trimmedQuestion = faqQuestion.trim();
                const trimmedAnswer = faqAnswer.trim();
                
                if (!trimmedQuestion || !trimmedAnswer) {
                  toast({ title: "Error", description: "Question and answer are required", variant: "destructive" });
                  return;
                }
                
                const updated = [...(homePageContent?.faqs || [])];
                if (faqEditIndex !== null) {
                  updated[faqEditIndex] = { question: trimmedQuestion, answer: trimmedAnswer };
                } else {
                  updated.push({ question: trimmedQuestion, answer: trimmedAnswer });
                }
                
                updateHomePageMutation.mutate({ faqs: updated });
                setFaqDialogOpen(false);
              }}
              disabled={updateHomePageMutation.isPending}
              data-testid="button-save-faq"
            >
              {updateHomePageMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Welcome Slide Dialog */}
      <Dialog open={welcomeSlideDialogOpen} onOpenChange={setWelcomeSlideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{welcomeSlideEditIndex !== null ? "Edit" : "Add"} Welcome Slide</DialogTitle>
            <DialogDescription>
              Create an onboarding slide for new users
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="slideTitle">Title *</Label>
              <Input
                id="slideTitle"
                value={welcomeSlideData.title}
                onChange={(e) => setWelcomeSlideData({ ...welcomeSlideData, title: e.target.value })}
                placeholder="Welcome to Artivio AI"
                data-testid="input-slide-title"
              />
            </div>
            <div>
              <Label htmlFor="slideDescription">Description *</Label>
              <Textarea
                id="slideDescription"
                value={welcomeSlideData.description}
                onChange={(e) => setWelcomeSlideData({ ...welcomeSlideData, description: e.target.value })}
                placeholder="Discover the power of AI-driven content creation..."
                rows={3}
                data-testid="input-slide-description"
              />
            </div>
            <div>
              <Label htmlFor="slideIcon">Icon (Lucide icon name, optional)</Label>
              <Input
                id="slideIcon"
                value={welcomeSlideData.icon}
                onChange={(e) => setWelcomeSlideData({ ...welcomeSlideData, icon: e.target.value })}
                placeholder="Sparkles, Video, Image, Music, etc."
                data-testid="input-slide-icon"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter a Lucide icon name (e.g., Sparkles, Video, Gift, Star)
              </p>
            </div>
            <div>
              <Label htmlFor="slideHighlight">Highlight Text (optional)</Label>
              <Input
                id="slideHighlight"
                value={welcomeSlideData.highlight}
                onChange={(e) => setWelcomeSlideData({ ...welcomeSlideData, highlight: e.target.value })}
                placeholder="Get started with 100 free credits!"
                data-testid="input-slide-highlight"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Special highlighted text shown below the description
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWelcomeSlideDialogOpen(false)} data-testid="button-cancel-slide">
              Cancel
            </Button>
            <Button
              onClick={() => {
                const trimmedTitle = welcomeSlideData.title.trim();
                const trimmedDescription = welcomeSlideData.description.trim();
                const trimmedIcon = welcomeSlideData.icon.trim();
                const trimmedHighlight = welcomeSlideData.highlight.trim();
                
                if (!trimmedTitle || !trimmedDescription) {
                  toast({ title: "Error", description: "Title and description are required", variant: "destructive" });
                  return;
                }
                
                const updated = [...(homePageContent?.welcomeSlides || [])];
                const slideData: { id: string; title: string; description: string; icon?: string; highlight?: string } = {
                  id: welcomeSlideEditIndex !== null ? (updated[welcomeSlideEditIndex]?.id || crypto.randomUUID()) : crypto.randomUUID(),
                  title: trimmedTitle,
                  description: trimmedDescription,
                };
                
                if (trimmedIcon) {
                  slideData.icon = trimmedIcon;
                }
                if (trimmedHighlight) {
                  slideData.highlight = trimmedHighlight;
                }
                
                if (welcomeSlideEditIndex !== null) {
                  updated[welcomeSlideEditIndex] = slideData;
                } else {
                  updated.push(slideData);
                }
                
                updateHomePageMutation.mutate({ welcomeSlides: updated });
                setWelcomeSlideDialogOpen(false);
              }}
              disabled={updateHomePageMutation.isPending}
              data-testid="button-save-slide"
            >
              {updateHomePageMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add API Key Dialog */}
      <Dialog open={addingApiKey} onOpenChange={setAddingApiKey}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add API Key</DialogTitle>
            <DialogDescription>
              Add a new Kie.ai API key for round-robin rotation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="keyName">Key Name</Label>
              <Input
                id="keyName"
                placeholder="e.g., My Kie.ai Key #1"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                data-testid="input-new-key-name"
              />
            </div>
            <div>
              <Label htmlFor="keyValue">API Key Value</Label>
              <Input
                id="keyValue"
                type="password"
                placeholder="Paste your Kie.ai API key here"
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                data-testid="input-new-key-value"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (newKeyName.trim() && newKeyValue.trim()) {
                  addApiKeyMutation.mutate({ 
                    keyName: newKeyName.trim(), 
                    keyValue: newKeyValue.trim() 
                  });
                }
              }}
              disabled={!newKeyName.trim() || !newKeyValue.trim() || addApiKeyMutation.isPending}
              data-testid="button-submit-new-key"
            >
              {addApiKeyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Key"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pricing Dialog */}
      <Dialog open={editingPricingId !== null} onOpenChange={(open) => {
        if (!open) {
          setEditingPricingId(null);
          setEditPricing({ feature: "", model: "", category: "", creditCost: "", kieCreditCost: "", description: "" });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pricing Entry</DialogTitle>
            <DialogDescription>
              Update pricing configuration for this model
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-feature">Feature</Label>
              <Input
                id="edit-feature"
                placeholder="e.g., video, image, music, chat"
                value={editPricing.feature}
                onChange={(e) => setEditPricing({ ...editPricing, feature: e.target.value })}
                data-testid="input-edit-pricing-feature"
              />
            </div>
            <div>
              <Label htmlFor="edit-model">Model Name</Label>
              <Input
                id="edit-model"
                placeholder="e.g., veo-3.1, gpt-4o"
                value={editPricing.model}
                onChange={(e) => setEditPricing({ ...editPricing, model: e.target.value })}
                data-testid="input-edit-pricing-model"
              />
            </div>
            <div>
              <Label htmlFor="edit-category">Category</Label>
              <Input
                id="edit-category"
                placeholder="e.g., generation, chat, voice, audio"
                value={editPricing.category}
                onChange={(e) => setEditPricing({ ...editPricing, category: e.target.value })}
                data-testid="input-edit-pricing-category"
              />
            </div>
            <div>
              <Label htmlFor="edit-kieCreditCost">Kie Credit Cost</Label>
              <Input
                id="edit-kieCreditCost"
                type="number"
                min="0"
                step="1"
                placeholder="e.g., 35"
                value={editPricing.kieCreditCost}
                onChange={(e) => setEditPricing({ ...editPricing, kieCreditCost: e.target.value })}
                data-testid="input-edit-kie-credit-cost"
              />
            </div>
            <div>
              <Label htmlFor="edit-creditCost">Credit Cost</Label>
              <Input
                id="edit-creditCost"
                type="number"
                min="0"
                step="1"
                placeholder="e.g., 100"
                value={editPricing.creditCost}
                onChange={(e) => setEditPricing({ ...editPricing, creditCost: e.target.value })}
                data-testid="input-edit-pricing-cost"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Input
                id="edit-description"
                placeholder="e.g., High-quality video generation"
                value={editPricing.description}
                onChange={(e) => setEditPricing({ ...editPricing, description: e.target.value })}
                data-testid="input-edit-pricing-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                const { feature, model, category, creditCost, kieCreditCost, description } = editPricing;
                const trimmedFeature = feature.trim();
                const trimmedModel = model.trim();
                const trimmedCategory = category.trim();
                const trimmedCost = creditCost.trim();
                const trimmedKieCost = kieCreditCost.trim();
                const trimmedDescription = description.trim();
                
                if (!trimmedFeature || !trimmedModel || !trimmedCategory || !trimmedCost) {
                  toast({ title: "Error", description: "Feature, Model, Category, and Cost are required", variant: "destructive" });
                  return;
                }
                
                const cost = Number(trimmedCost);
                if (!Number.isFinite(cost) || !Number.isInteger(cost) || cost < 0) {
                  toast({ title: "Error", description: "Please enter a valid whole number for cost", variant: "destructive" });
                  return;
                }
                
                const updates: any = {
                  feature: trimmedFeature,
                  model: trimmedModel,
                  category: trimmedCategory,
                  creditCost: cost,
                };
                
                if (trimmedKieCost) {
                  const kieCost = Number(trimmedKieCost);
                  if (!Number.isFinite(kieCost) || !Number.isInteger(kieCost) || kieCost < 0) {
                    toast({ title: "Error", description: "Please enter a valid whole number for Kie credit cost", variant: "destructive" });
                    return;
                  }
                  updates.kieCreditCost = kieCost;
                }
                
                if (trimmedDescription) {
                  updates.description = trimmedDescription;
                }
                
                if (editingPricingId) {
                  updatePricingMutation.mutate({ id: editingPricingId, updates });
                }
              }}
              disabled={updatePricingMutation.isPending}
              data-testid="button-submit-edit-pricing"
            >
              {updatePricingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Pricing"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Pricing Dialog */}
      <Dialog open={addingPricing} onOpenChange={setAddingPricing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Pricing Entry</DialogTitle>
            <DialogDescription>
              Add a new pricing configuration for an AI model or feature
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="feature">Feature</Label>
              <Input
                id="feature"
                placeholder="e.g., video, image, music, chat"
                value={newPricing.feature}
                onChange={(e) => setNewPricing({ ...newPricing, feature: e.target.value })}
                data-testid="input-new-pricing-feature"
              />
            </div>
            <div>
              <Label htmlFor="model">Model Name</Label>
              <Input
                id="model"
                placeholder="e.g., veo-3.1, gpt-4o"
                value={newPricing.model}
                onChange={(e) => setNewPricing({ ...newPricing, model: e.target.value })}
                data-testid="input-new-pricing-model"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="e.g., generation, chat, voice, audio"
                value={newPricing.category}
                onChange={(e) => setNewPricing({ ...newPricing, category: e.target.value })}
                data-testid="input-new-pricing-category"
              />
            </div>
            <div>
              <Label htmlFor="kieCreditCost">Kie Credit Cost</Label>
              <Input
                id="kieCreditCost"
                type="number"
                min="0"
                step="1"
                placeholder="e.g., 35"
                value={newPricing.kieCreditCost}
                onChange={(e) => setNewPricing({ ...newPricing, kieCreditCost: e.target.value })}
                data-testid="input-kie-credit-cost"
              />
            </div>
            <div>
              <Label htmlFor="creditCost">Credit Cost</Label>
              <Input
                id="creditCost"
                type="number"
                min="0"
                step="1"
                placeholder="e.g., 100"
                value={newPricing.creditCost}
                onChange={(e) => setNewPricing({ ...newPricing, creditCost: e.target.value })}
                data-testid="input-new-pricing-cost"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="e.g., High-quality video generation"
                value={newPricing.description}
                onChange={(e) => setNewPricing({ ...newPricing, description: e.target.value })}
                data-testid="input-new-pricing-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                const { feature, model, category, creditCost, kieCreditCost, description } = newPricing;
                const trimmedFeature = feature.trim();
                const trimmedModel = model.trim();
                const trimmedCategory = category.trim();
                const trimmedCost = creditCost.trim();
                const trimmedKieCost = kieCreditCost.trim();
                const trimmedDescription = description.trim();
                
                if (!trimmedFeature || !trimmedModel || !trimmedCategory || !trimmedCost) {
                  toast({ title: "Error", description: "Feature, Model, Category, and Cost are required", variant: "destructive" });
                  return;
                }
                
                const cost = Number(trimmedCost);
                if (!Number.isFinite(cost) || !Number.isInteger(cost) || cost < 0) {
                  toast({ title: "Error", description: "Please enter a valid whole number for cost", variant: "destructive" });
                  return;
                }
                
                const mutationData: any = {
                  feature: trimmedFeature,
                  model: trimmedModel,
                  category: trimmedCategory,
                  creditCost: cost,
                  description: trimmedDescription || undefined,
                };
                
                if (trimmedKieCost) {
                  const kieCost = Number(trimmedKieCost);
                  if (!Number.isFinite(kieCost) || !Number.isInteger(kieCost) || kieCost < 0) {
                    toast({ title: "Error", description: "Please enter a valid whole number for Kie credit cost", variant: "destructive" });
                    return;
                  }
                  mutationData.kieCreditCost = kieCost;
                }
                
                addPricingMutation.mutate(mutationData);
              }}
              disabled={addPricingMutation.isPending}
              data-testid="button-submit-new-pricing"
            >
              {addPricingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Pricing"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Plan Dialog */}
      <Dialog open={creatingPlan || editingPlanId !== null} onOpenChange={(open) => {
        if (!open) {
          setCreatingPlan(false);
          setEditingPlanId(null);
          setEditPlanData({ name: "", displayName: "", description: "", price: "", billingPeriod: "monthly", creditsPerMonth: "", features: "[]", stripePriceId: "", stripeProductId: "" });
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPlanId ? "Edit Plan" : "Create New Plan"}</DialogTitle>
            <DialogDescription>
              {editingPlanId ? "Update the subscription plan details below." : "Create a new subscription plan with pricing and credits."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-name">Name (unique ID)</Label>
                <Input
                  id="plan-name"
                  placeholder="e.g., premium, enterprise"
                  value={creatingPlan ? newPlanData.name : editPlanData.name}
                  onChange={(e) => creatingPlan 
                    ? setNewPlanData({ ...newPlanData, name: e.target.value })
                    : setEditPlanData({ ...editPlanData, name: e.target.value })
                  }
                  data-testid="input-plan-name"
                />
              </div>
              <div>
                <Label htmlFor="plan-display-name">Display Name</Label>
                <Input
                  id="plan-display-name"
                  placeholder="e.g., Premium Plan"
                  value={creatingPlan ? newPlanData.displayName : editPlanData.displayName}
                  onChange={(e) => creatingPlan
                    ? setNewPlanData({ ...newPlanData, displayName: e.target.value })
                    : setEditPlanData({ ...editPlanData, displayName: e.target.value })
                  }
                  data-testid="input-plan-display-name"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="plan-description">Description</Label>
              <Textarea
                id="plan-description"
                placeholder="Brief description of the plan"
                value={creatingPlan ? newPlanData.description : editPlanData.description}
                onChange={(e) => creatingPlan
                  ? setNewPlanData({ ...newPlanData, description: e.target.value })
                  : setEditPlanData({ ...editPlanData, description: e.target.value })
                }
                data-testid="input-plan-description"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-price">Price (USD/month) - Legacy</Label>
                <Input
                  id="plan-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="9.99"
                  value={creatingPlan ? newPlanData.price : editPlanData.price}
                  onChange={(e) => creatingPlan
                    ? setNewPlanData({ ...newPlanData, price: e.target.value })
                    : setEditPlanData({ ...editPlanData, price: e.target.value })
                  }
                  data-testid="input-plan-price"
                />
              </div>
              <div>
                <Label htmlFor="plan-credits">Credits/Month</Label>
                <Input
                  id="plan-credits"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="1000"
                  value={creatingPlan ? newPlanData.creditsPerMonth : editPlanData.creditsPerMonth}
                  onChange={(e) => creatingPlan
                    ? setNewPlanData({ ...newPlanData, creditsPerMonth: e.target.value })
                    : setEditPlanData({ ...editPlanData, creditsPerMonth: e.target.value })
                  }
                  data-testid="input-plan-credits"
                />
              </div>
            </div>
            <div className="pt-4 border-t">
              <Label htmlFor="plan-billing-period">Billing Period</Label>
              <Select
                value={creatingPlan ? newPlanData.billingPeriod : editPlanData.billingPeriod}
                onValueChange={(value) => creatingPlan
                  ? setNewPlanData({ ...newPlanData, billingPeriod: value as "monthly" | "annual" | "trial" })
                  : setEditPlanData({ ...editPlanData, billingPeriod: value as "monthly" | "annual" | "trial" })
                }
              >
                <SelectTrigger data-testid="select-plan-billing-period">
                  <SelectValue placeholder="Select billing period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="pt-2">
              <Label htmlFor="plan-features">Features (JSON)</Label>
              <Textarea
                id="plan-features"
                placeholder='["5,000 credits per month", "All AI models access", "Priority generation queue"]'
                value={creatingPlan ? newPlanData.features : editPlanData.features}
                onChange={(e) => creatingPlan
                  ? setNewPlanData({ ...newPlanData, features: e.target.value })
                  : setEditPlanData({ ...editPlanData, features: e.target.value })
                }
                data-testid="input-plan-features"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">Enter features as a JSON array. Each item will display as a checkmark item on the pricing page.</p>
            </div>
            {!creatingPlan && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <Label htmlFor="plan-stripe-price-id">Stripe Price ID (optional)</Label>
                  <Input
                    id="plan-stripe-price-id"
                    placeholder="price_xxxxxxxxxxxxx"
                    value={editPlanData.stripePriceId}
                    onChange={(e) => setEditPlanData({ ...editPlanData, stripePriceId: e.target.value })}
                    data-testid="input-plan-stripe-price-id"
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="plan-stripe-product-id">Stripe Product ID (optional)</Label>
                  <Input
                    id="plan-stripe-product-id"
                    placeholder="prod_xxxxxxxxxxxxx"
                    value={editPlanData.stripeProductId}
                    onChange={(e) => setEditPlanData({ ...editPlanData, stripeProductId: e.target.value })}
                    data-testid="input-plan-stripe-product-id"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreatingPlan(false);
                setEditingPlanId(null);
                setEditPlanData({ name: "", displayName: "", description: "", price: "", billingPeriod: "monthly", creditsPerMonth: "", features: "[]", stripePriceId: "", stripeProductId: "" });
                setNewPlanData({ name: "", displayName: "", description: "", price: "", billingPeriod: "monthly", creditsPerMonth: "", features: "[]" });
              }}
              disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
              data-testid="button-cancel-plan-dialog"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const data = creatingPlan ? newPlanData : editPlanData;
                const name = data.name.trim();
                const displayName = data.displayName.trim();
                const description = data.description.trim();
                const priceStr = data.price.trim();
                const creditsStr = data.creditsPerMonth.trim();

                if (!name || !displayName || !priceStr || !creditsStr) {
                  toast({ title: "Error", description: "Name, Display Name, Price, and Credits are required", variant: "destructive" });
                  return;
                }

                const price = parseFloat(priceStr);
                const credits = parseInt(creditsStr);

                if (isNaN(price) || price < 0) {
                  toast({ title: "Error", description: "Price must be a valid positive number", variant: "destructive" });
                  return;
                }

                if (isNaN(credits) || credits < 0) {
                  toast({ title: "Error", description: "Credits must be a valid positive number", variant: "destructive" });
                  return;
                }

                const priceInCents = Math.round(price * 100);

                if (creatingPlan) {
                  // Parse features JSON
                  let features: string[] = [];
                  try {
                    const parsed = JSON.parse(newPlanData.features.trim() || "[]");
                    if (Array.isArray(parsed)) {
                      features = parsed;
                    } else {
                      toast({ title: "Error", description: "Features must be a JSON array", variant: "destructive" });
                      return;
                    }
                  } catch {
                    toast({ title: "Error", description: "Invalid JSON format for features", variant: "destructive" });
                    return;
                  }

                  const createData: any = {
                    name,
                    displayName,
                    description,
                    price: priceInCents,
                    billingPeriod: newPlanData.billingPeriod,
                    creditsPerMonth: credits,
                    features,
                  };
                  createPlanMutation.mutate(createData);
                } else {
                  // Parse features JSON
                  let features: string[] = [];
                  try {
                    const parsed = JSON.parse(editPlanData.features.trim() || "[]");
                    if (Array.isArray(parsed)) {
                      features = parsed;
                    } else {
                      toast({ title: "Error", description: "Features must be a JSON array", variant: "destructive" });
                      return;
                    }
                  } catch {
                    toast({ title: "Error", description: "Invalid JSON format for features", variant: "destructive" });
                    return;
                  }

                  const updates: any = {
                    planId: editingPlanId!,
                    name,
                    displayName,
                    description,
                    price: priceInCents,
                    billingPeriod: editPlanData.billingPeriod,
                    creditsPerMonth: credits,
                    features,
                  };
                  
                  const stripePriceId = editPlanData.stripePriceId.trim();
                  const stripeProductId = editPlanData.stripeProductId.trim();
                  // Always send stripe IDs - empty strings become null in backend
                  // This ensures clearing a field actually removes the value
                  updates.stripePriceId = stripePriceId || null;
                  updates.stripeProductId = stripeProductId || null;

                  updatePlanMutation.mutate(updates);
                }
              }}
              disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
              data-testid="button-save-plan-dialog"
            >
              {createPlanMutation.isPending || updatePlanMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {creatingPlan ? "Creating..." : "Saving..."}
                </>
              ) : (
                creatingPlan ? "Create Plan" : "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Plan Confirmation */}
      <AlertDialog open={deletingPlanId !== null} onOpenChange={(open) => !open && setDeletingPlanId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the plan "{plans.find(p => p.id === deletingPlanId)?.displayName || 'Unknown'}". 
              {' '}Users with active subscriptions to this plan will not be affected, but you cannot delete a plan that has active subscriptions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePlanMutation.isPending} data-testid="button-cancel-delete-plan">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPlanId && deletePlanMutation.mutate(deletingPlanId)}
              disabled={deletePlanMutation.isPending}
              data-testid="button-confirm-delete-plan"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePlanMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Plan"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Pricing Confirmation */}
      <AlertDialog open={deletingPricingId !== null} onOpenChange={(open) => !open && setDeletingPricingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pricing Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the pricing entry for "{pricingList.find(p => p.id === deletingPricingId)?.feature} - {pricingList.find(p => p.id === deletingPricingId)?.model}".
              {' '}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePricingMutation.isPending} data-testid="button-cancel-delete-pricing">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPricingId && deletePricingMutation.mutate(deletingPricingId)}
              disabled={deletePricingMutation.isPending}
              data-testid="button-confirm-delete-pricing"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePricingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Pricing"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Plans Confirmation */}
      <AlertDialog open={resettingPlans} onOpenChange={(open) => !open && setResettingPlans(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Reset All Subscription Plans?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-semibold text-foreground">This will perform the following actions:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Migrate all users to the free trial plan (7 days, 1,000 credits)</li>
                <li>Delete all existing subscription plans (including duplicates)</li>
                <li>Create 9 new canonical plans with Stripe IDs pre-configured:
                  <ul className="list-circle list-inside ml-6 mt-1 space-y-0.5">
                    <li>Free Trial (1,000 credits)</li>
                    <li>Starter Monthly ($19, 4,000 credits)</li>
                    <li>Starter Annual ($148, 4,000 credits)</li>
                    <li>Professional Monthly ($49, 10,000 credits)</li>
                    <li>Professional Annual ($384, 10,000 credits)</li>
                    <li>Business Monthly ($99, 20,000 credits)</li>
                    <li>Business Annual ($768, 20,000 credits)</li>
                    <li>Agency Monthly ($249, 50,000 credits)</li>
                    <li>Agency Annual ($1,942, 50,000 credits)</li>
                  </ul>
                </li>
              </ul>
              <p className="text-destructive font-semibold mt-3">
                This action cannot be undone. Use this to fix duplicate plan issues in production.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetPlansMutation.isPending} data-testid="button-cancel-reset-plans">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetPlansMutation.mutate()}
              disabled={resetPlansMutation.isPending}
              data-testid="button-confirm-reset-plans"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetPlansMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting Plans...
                </>
              ) : (
                "Yes, Reset All Plans"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Announcement Dialog */}
      <Dialog open={creatingAnnouncement} onOpenChange={setCreatingAnnouncement}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAnnouncementId ? "Edit" : "Create"} Announcement</DialogTitle>
            <DialogDescription>
              Configure announcement bar with plan targeting
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="announcement-message">Message *</Label>
              <Textarea
                id="announcement-message"
                value={announcementForm.message}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                placeholder="Enter announcement message..."
                rows={3}
                maxLength={500}
                data-testid="input-announcement-message"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {announcementForm.message.length}/500 characters
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="announcement-type">Type</Label>
                <Select
                  value={announcementForm.type}
                  onValueChange={(value: any) => setAnnouncementForm({ ...announcementForm, type: value })}
                >
                  <SelectTrigger data-testid="select-announcement-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info (Blue)</SelectItem>
                    <SelectItem value="warning">Warning (Yellow)</SelectItem>
                    <SelectItem value="success">Success (Green)</SelectItem>
                    <SelectItem value="promo">Promo (Purple)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <div className="flex items-center space-x-2 h-9">
                  <input
                    type="checkbox"
                    id="announcement-active"
                    checked={announcementForm.isActive}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, isActive: e.target.checked })}
                    className="h-4 w-4"
                    data-testid="checkbox-announcement-active"
                  />
                  <Label htmlFor="announcement-active" className="cursor-pointer">
                    Active
                  </Label>
                </div>
              </div>
            </div>
            <div>
              <Label>Target Plans (leave empty for all plans)</Label>
              <div className="flex gap-2 mt-2">
                {["free", "starter", "pro"].map((plan) => (
                  <div key={plan} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`plan-${plan}`}
                      checked={announcementForm.targetPlans.includes(plan)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAnnouncementForm({
                            ...announcementForm,
                            targetPlans: [...announcementForm.targetPlans, plan],
                          });
                        } else {
                          setAnnouncementForm({
                            ...announcementForm,
                            targetPlans: announcementForm.targetPlans.filter((p) => p !== plan),
                          });
                        }
                      }}
                      className="h-4 w-4"
                      data-testid={`checkbox-plan-${plan}`}
                    />
                    <Label htmlFor={`plan-${plan}`} className="capitalize cursor-pointer">
                      {plan}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="announcement-start">Start Date (optional)</Label>
                <Input
                  id="announcement-start"
                  type="datetime-local"
                  value={announcementForm.startDate}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, startDate: e.target.value })}
                  data-testid="input-announcement-start"
                />
              </div>
              <div>
                <Label htmlFor="announcement-end">End Date (optional)</Label>
                <Input
                  id="announcement-end"
                  type="datetime-local"
                  value={announcementForm.endDate}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, endDate: e.target.value })}
                  data-testid="input-announcement-end"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreatingAnnouncement(false)}
              data-testid="button-cancel-announcement"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!announcementForm.message.trim()) {
                  toast({
                    title: "Error",
                    description: "Message is required",
                    variant: "destructive",
                  });
                  return;
                }
                try {
                  const payload = {
                    message: announcementForm.message.trim(),
                    type: announcementForm.type,
                    targetPlans: announcementForm.targetPlans.length > 0 ? announcementForm.targetPlans : null,
                    isActive: announcementForm.isActive,
                    startDate: announcementForm.startDate || null,
                    endDate: announcementForm.endDate || null,
                  };
                  
                  if (editingAnnouncementId) {
                    await apiRequest("PATCH", `/api/admin/announcements/${editingAnnouncementId}`, payload);
                  } else {
                    await apiRequest("POST", "/api/admin/announcements", payload);
                  }
                  
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/announcements/active"] });
                  setCreatingAnnouncement(false);
                  toast({
                    title: "Success",
                    description: `Announcement ${editingAnnouncementId ? "updated" : "created"} successfully`,
                  });
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || `Failed to ${editingAnnouncementId ? "update" : "create"} announcement`,
                    variant: "destructive",
                  });
                }
              }}
              data-testid="button-save-announcement"
            >
              {editingAnnouncementId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Blog Post Dialog */}
      <Dialog open={creatingBlogPost} onOpenChange={setCreatingBlogPost}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBlogPostId ? "Edit" : "Create"} Blog Post</DialogTitle>
            <DialogDescription>
              {editingBlogPostId ? "Update the blog post details" : "Create a new blog post"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="blog-title">Title *</Label>
                <Input
                  id="blog-title"
                  value={blogPostForm.title}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    setBlogPostForm({ 
                      ...blogPostForm, 
                      title: newTitle,
                      slug: !editingBlogPostId ? generateSlug(newTitle) : blogPostForm.slug
                    });
                  }}
                  placeholder="Enter post title..."
                  data-testid="input-blog-title"
                />
              </div>
              <div>
                <Label htmlFor="blog-slug">Slug</Label>
                <Input
                  id="blog-slug"
                  value={blogPostForm.slug}
                  onChange={(e) => setBlogPostForm({ ...blogPostForm, slug: e.target.value })}
                  placeholder="post-url-slug"
                  data-testid="input-blog-slug"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL-friendly identifier (auto-generated from title)
                </p>
              </div>
            </div>
            
            <div>
              <Label htmlFor="blog-content">Content (Markdown)</Label>
              <Textarea
                id="blog-content"
                value={blogPostForm.content}
                onChange={(e) => setBlogPostForm({ ...blogPostForm, content: e.target.value })}
                placeholder="Write your blog post content in Markdown..."
                rows={10}
                className="font-mono text-sm"
                data-testid="input-blog-content"
              />
            </div>

            <div>
              <Label htmlFor="blog-excerpt">Excerpt</Label>
              <Textarea
                id="blog-excerpt"
                value={blogPostForm.excerpt}
                onChange={(e) => setBlogPostForm({ ...blogPostForm, excerpt: e.target.value })}
                placeholder="A short description of the post..."
                rows={2}
                data-testid="input-blog-excerpt"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="blog-author">Author</Label>
                <Input
                  id="blog-author"
                  value={blogPostForm.author}
                  onChange={(e) => setBlogPostForm({ ...blogPostForm, author: e.target.value })}
                  placeholder="Author name..."
                  data-testid="input-blog-author"
                />
              </div>
              <div>
                <Label htmlFor="blog-category">Category</Label>
                <Select
                  value={blogPostForm.category}
                  onValueChange={(value: any) => setBlogPostForm({ ...blogPostForm, category: value })}
                >
                  <SelectTrigger data-testid="select-blog-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tutorial">Tutorial</SelectItem>
                    <SelectItem value="Case Study">Case Study</SelectItem>
                    <SelectItem value="Feature">Feature</SelectItem>
                    <SelectItem value="Announcement">Announcement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="blog-tags">Tags (comma-separated)</Label>
              <Input
                id="blog-tags"
                value={blogPostForm.tags}
                onChange={(e) => setBlogPostForm({ ...blogPostForm, tags: e.target.value })}
                placeholder="ai, video, tutorial..."
                data-testid="input-blog-tags"
              />
            </div>

            <div>
              <Label htmlFor="blog-featured-image">Featured Image URL</Label>
              <Input
                id="blog-featured-image"
                value={blogPostForm.featuredImageUrl}
                onChange={(e) => setBlogPostForm({ ...blogPostForm, featuredImageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
                data-testid="input-blog-featured-image"
              />
            </div>

            <div>
              <Label htmlFor="blog-meta-description">Meta Description (SEO)</Label>
              <Textarea
                id="blog-meta-description"
                value={blogPostForm.metaDescription}
                onChange={(e) => setBlogPostForm({ ...blogPostForm, metaDescription: e.target.value })}
                placeholder="A brief description for search engines..."
                rows={2}
                maxLength={160}
                data-testid="input-blog-meta-description"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {blogPostForm.metaDescription.length}/160 characters
              </p>
            </div>

            <div>
              <Label htmlFor="blog-status">Status</Label>
              <Select
                value={blogPostForm.status}
                onValueChange={(value: any) => setBlogPostForm({ ...blogPostForm, status: value })}
              >
                <SelectTrigger data-testid="select-blog-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreatingBlogPost(false)}
              data-testid="button-cancel-blog-post"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!blogPostForm.title.trim()) {
                  toast({
                    title: "Error",
                    description: "Title is required",
                    variant: "destructive",
                  });
                  return;
                }
                if (!blogPostForm.slug.trim()) {
                  toast({
                    title: "Error",
                    description: "Slug is required",
                    variant: "destructive",
                  });
                  return;
                }

                const tagsArray = blogPostForm.tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter((tag) => tag.length > 0);

                const payload = {
                  title: blogPostForm.title.trim(),
                  slug: blogPostForm.slug.trim(),
                  content: blogPostForm.content,
                  excerpt: blogPostForm.excerpt || undefined,
                  author: blogPostForm.author || undefined,
                  category: blogPostForm.category,
                  tags: tagsArray,
                  featuredImageUrl: blogPostForm.featuredImageUrl || undefined,
                  metaDescription: blogPostForm.metaDescription || undefined,
                  status: blogPostForm.status,
                  publishedDate: blogPostForm.status === 'published' ? new Date().toISOString() : undefined,
                };

                if (editingBlogPostId) {
                  updateBlogPostMutation.mutate({ id: editingBlogPostId, ...payload });
                } else {
                  createBlogPostMutation.mutate(payload);
                }
              }}
              disabled={createBlogPostMutation.isPending || updateBlogPostMutation.isPending}
              data-testid="button-save-blog-post"
            >
              {(createBlogPostMutation.isPending || updateBlogPostMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingBlogPostId ? "Update Post" : "Create Post"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Blog Post Confirmation */}
      <AlertDialog open={!!deletingBlogPostId} onOpenChange={(open) => !open && setDeletingBlogPostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blog Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the blog post.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-blog-post">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingBlogPostId) {
                  deleteBlogPostMutation.mutate(deletingBlogPostId);
                }
              }}
              disabled={deleteBlogPostMutation.isPending}
              data-testid="button-confirm-delete-blog-post"
            >
              {deleteBlogPostMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
