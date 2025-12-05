import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  Calendar,
  Check,
  X,
  RefreshCw,
  Wand2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Image as ImageIcon,
  Video,
  Hash,
  Eye,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  CalendarDays,
  LayoutGrid,
  Trash2,
  Heart,
  MessageSquare,
  Send,
  Bookmark,
  Repeat2,
  BarChart2,
  ThumbsUp,
  Share2,
  Smartphone,
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/authBridge";
import { SocialUpgradePrompt } from "@/components/social-upgrade-prompt";
import { format, parseISO, startOfWeek, addDays, isSameDay, isAfter, isBefore } from "date-fns";
import type { AiContentPlan } from "@shared/schema";
import { getSafeZoneForContentType, type SocialPlatform, type ContentType, type ContentSafeZone } from "@shared/socialPlatformConfig";

interface SubscriptionStatus {
  hasSocialPoster: boolean;
  status?: string;
}

interface PlanPost {
  id?: string;
  date: string;
  time: string;
  platforms: string[];
  contentType: string;
  caption: string;
  mediaPrompt?: string;
  mediaUrl?: string;
  mediaType?: string;
  thumbnailUrl?: string;
  hashtags?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'scheduled' | 'posted';
}

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
  instagram: "bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400",
  tiktok: "bg-black",
  linkedin: "bg-[#0A66C2]",
  youtube: "bg-[#FF0000]",
  facebook: "bg-[#1877F2]",
  x: "bg-black",
  threads: "bg-black",
  pinterest: "bg-[#E60023]",
  bluesky: "bg-[#0085FF]",
};

const STATUS_BADGES: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: any }> = {
  pending: { variant: "secondary", label: "Pending", icon: Clock },
  approved: { variant: "default", label: "Approved", icon: Check },
  rejected: { variant: "destructive", label: "Rejected", icon: X },
  scheduled: { variant: "outline", label: "Scheduled", icon: Calendar },
  posted: { variant: "default", label: "Posted", icon: CheckCircle2 },
};

const PLAN_STATUS_BADGES: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  approved: { variant: "default", label: "Approved" },
  executing: { variant: "outline", label: "Executing" },
  completed: { variant: "default", label: "Completed" },
  cancelled: { variant: "destructive", label: "Cancelled" },
};

const CONTENT_TYPE_ICONS: Record<string, any> = {
  text: FileText,
  image: ImageIcon,
  video: Video,
  carousel: LayoutGrid,
  story: Play,
  reel: Video,
  short: Video,
};

function SafeZoneInfo({ platforms, contentType }: { platforms: string[]; contentType: string }) {
  const safeZones: { platform: string; zone: ContentSafeZone }[] = [];
  const platformsWithoutZones: string[] = [];
  
  for (const platform of platforms) {
    const zone = getSafeZoneForContentType(platform as SocialPlatform, contentType as ContentType);
    if (zone) {
      safeZones.push({ platform, zone });
    } else {
      platformsWithoutZones.push(platform);
    }
  }
  
  if (safeZones.length === 0 && platformsWithoutZones.length === 0) return null;
  
  return (
    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
      <p className="text-sm font-medium mb-2 flex items-center gap-1 text-primary">
        <LayoutGrid className="w-4 h-4" />
        Safe Zone Guide
      </p>
      {safeZones.length > 0 ? (
        <ScrollArea className={safeZones.length > 2 ? "h-[180px]" : ""}>
          <div className="space-y-3 text-xs text-muted-foreground pr-2">
            {safeZones.map(({ platform, zone }) => (
              <div key={platform} className="flex flex-col gap-1 pb-2 border-b border-border/30 last:border-0 last:pb-0">
                <span className="font-medium capitalize text-foreground">{platform}:</span>
                <div className="pl-2 space-y-0.5">
                  <p>Media: {zone.videoSize.width}x{zone.videoSize.height}px</p>
                  <p>Text-safe: {zone.textSafeArea.width}x{zone.textSafeArea.height}px</p>
                  <p className="text-primary/80">
                    Avoid: Top {zone.margins.top}px, Bottom {zone.margins.bottom}px, 
                    Left {zone.margins.left}px, Right {zone.margins.right}px
                  </p>
                  {zone.notes && (
                    <p className="mt-1 text-xs italic text-muted-foreground/70">{zone.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : null}
      {platformsWithoutZones.length > 0 && (
        <div className="text-xs text-muted-foreground/70 mt-2 pt-2 border-t border-border/30">
          <p className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            No specific safe zone data for: {platformsWithoutZones.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}

// Media Preview Component
function MediaPreview({ mediaUrl, mediaType, thumbnailUrl, caption }: { 
  mediaUrl?: string; 
  mediaType?: string;
  thumbnailUrl?: string; 
  caption: string;
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!mediaUrl) return null;

  const isVideo = mediaType?.startsWith('video') || mediaUrl.match(/\.(mp4|webm|mov)$/i);
  const isImage = mediaType?.startsWith('image') || mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  if (hasError) {
    return (
      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Media unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {isVideo ? (
        <video
          src={mediaUrl}
          poster={thumbnailUrl}
          className="w-full h-full object-cover"
          controls
          preload="metadata"
          playsInline
          onLoadedData={() => setIsLoading(false)}
          onError={() => { setHasError(true); setIsLoading(false); }}
          data-testid="video-preview"
        />
      ) : isImage ? (
        <img
          src={mediaUrl}
          alt={caption}
          className="w-full h-full object-cover"
          onLoad={() => setIsLoading(false)}
          onError={() => { setHasError(true); setIsLoading(false); }}
          data-testid="image-preview"
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <ImageIcon className="w-8 h-8 text-muted-foreground opacity-50" />
        </div>
      )}
    </div>
  );
}

// Platform Preview Mockup Component
function PlatformPreview({ 
  platform, 
  post, 
  username = "yourprofile",
  profileImage
}: { 
  platform: string; 
  post: PlanPost; 
  username?: string;
  profileImage?: string;
}) {
  const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${username}&backgroundColor=6366f1`;
  const avatarUrl = profileImage || defaultAvatar;
  
  // Instagram Preview
  if (platform === 'instagram') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900" data-testid="preview-instagram">
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b">
          <img src={avatarUrl} alt={username} className="w-8 h-8 rounded-full object-cover" />
          <span className="font-semibold text-sm">{username}</span>
        </div>
        {/* Media */}
        <div className="aspect-square bg-muted">
          {post.mediaUrl ? (
            post.mediaType?.startsWith('video') ? (
              <video src={post.mediaUrl} className="w-full h-full object-cover" controls playsInline />
            ) : (
              <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <ImageIcon className="w-12 h-12 opacity-30" />
            </div>
          )}
        </div>
        {/* Actions */}
        <div className="p-3">
          <div className="flex items-center gap-4 mb-2">
            <Heart className="w-6 h-6" />
            <MessageSquare className="w-6 h-6" />
            <Send className="w-6 h-6" />
            <Bookmark className="w-6 h-6 ml-auto" />
          </div>
          <p className="text-sm">
            <span className="font-semibold">{username}</span>{' '}
            <span className="whitespace-pre-wrap">{post.caption.substring(0, 100)}{post.caption.length > 100 ? '...' : ''}</span>
          </p>
          {post.hashtags && post.hashtags.length > 0 && (
            <p className="text-sm text-primary mt-1">
              {post.hashtags.slice(0, 5).map(tag => `#${tag.replace(/^#/, '')}`).join(' ')}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Twitter/X Preview
  if (platform === 'x') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900 p-4" data-testid="preview-x">
        <div className="flex gap-3">
          <img src={avatarUrl} alt={username} className="w-10 h-10 rounded-full object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm">{username}</span>
              <span className="text-muted-foreground text-sm">@{username}</span>
              <span className="text-muted-foreground text-sm">· 1m</span>
            </div>
            <p className="text-sm whitespace-pre-wrap mt-1">{post.caption.substring(0, 280)}</p>
            {post.mediaUrl && (
              <div className="mt-3 rounded-xl overflow-hidden border">
                {post.mediaType?.startsWith('video') ? (
                  <video src={post.mediaUrl} className="w-full max-h-64 object-cover" controls playsInline />
                ) : (
                  <img src={post.mediaUrl} alt="" className="w-full max-h-64 object-cover" />
                )}
              </div>
            )}
            <div className="flex items-center justify-between mt-3 text-muted-foreground">
              <div className="flex items-center gap-1"><MessageSquare className="w-4 h-4" /><span className="text-xs">0</span></div>
              <div className="flex items-center gap-1"><Repeat2 className="w-4 h-4" /><span className="text-xs">0</span></div>
              <div className="flex items-center gap-1"><Heart className="w-4 h-4" /><span className="text-xs">0</span></div>
              <div className="flex items-center gap-1"><BarChart2 className="w-4 h-4" /><span className="text-xs">0</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Facebook Preview
  if (platform === 'facebook') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900" data-testid="preview-facebook">
        <div className="p-3 flex items-center gap-3">
          <img src={avatarUrl} alt={username} className="w-10 h-10 rounded-full object-cover" />
          <div>
            <p className="font-semibold text-sm">{username}</p>
            <p className="text-xs text-muted-foreground">Just now · Public</p>
          </div>
        </div>
        <div className="px-3 pb-2">
          <p className="text-sm whitespace-pre-wrap">{post.caption.substring(0, 200)}{post.caption.length > 200 ? '...' : ''}</p>
        </div>
        {post.mediaUrl && (
          <div className="bg-muted">
            {post.mediaType?.startsWith('video') ? (
              <video src={post.mediaUrl} className="w-full max-h-80 object-cover" controls playsInline />
            ) : (
              <img src={post.mediaUrl} alt="" className="w-full max-h-80 object-cover" />
            )}
          </div>
        )}
        <div className="flex items-center justify-around p-2 border-t text-muted-foreground">
          <Button variant="ghost" size="sm" className="flex-1 gap-2"><ThumbsUp className="w-4 h-4" />Like</Button>
          <Button variant="ghost" size="sm" className="flex-1 gap-2"><MessageSquare className="w-4 h-4" />Comment</Button>
          <Button variant="ghost" size="sm" className="flex-1 gap-2"><Share2 className="w-4 h-4" />Share</Button>
        </div>
      </div>
    );
  }

  // LinkedIn Preview
  if (platform === 'linkedin') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900" data-testid="preview-linkedin">
        <div className="p-3 flex items-center gap-3">
          <img src={avatarUrl} alt={username} className="w-12 h-12 rounded-full object-cover" />
          <div>
            <p className="font-semibold text-sm">{username}</p>
            <p className="text-xs text-muted-foreground">Your Headline</p>
            <p className="text-xs text-muted-foreground">Just now · Public</p>
          </div>
        </div>
        <div className="px-3 pb-3">
          <p className="text-sm whitespace-pre-wrap">{post.caption.substring(0, 200)}{post.caption.length > 200 ? '... see more' : ''}</p>
        </div>
        {post.mediaUrl && (
          <div className="bg-muted">
            {post.mediaType?.startsWith('video') ? (
              <video src={post.mediaUrl} className="w-full max-h-80 object-cover" controls playsInline />
            ) : (
              <img src={post.mediaUrl} alt="" className="w-full max-h-80 object-cover" />
            )}
          </div>
        )}
        <div className="flex items-center justify-around p-2 border-t text-muted-foreground">
          <Button variant="ghost" size="sm" className="flex-1 gap-1"><ThumbsUp className="w-4 h-4" />Like</Button>
          <Button variant="ghost" size="sm" className="flex-1 gap-1"><MessageSquare className="w-4 h-4" />Comment</Button>
          <Button variant="ghost" size="sm" className="flex-1 gap-1"><Repeat2 className="w-4 h-4" />Repost</Button>
          <Button variant="ghost" size="sm" className="flex-1 gap-1"><Send className="w-4 h-4" />Send</Button>
        </div>
      </div>
    );
  }

  // TikTok Preview
  if (platform === 'tiktok') {
    return (
      <div className="border rounded-lg overflow-hidden bg-black text-white aspect-[9/16] max-h-[400px] relative" data-testid="preview-tiktok">
        {post.mediaUrl && (
          post.mediaType?.startsWith('video') ? (
            <video src={post.mediaUrl} className="w-full h-full object-cover" controls playsInline />
          ) : (
            <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" />
          )
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <img src={avatarUrl} alt={username} className="w-8 h-8 rounded-full object-cover" />
            <span className="font-semibold text-sm">@{username}</span>
          </div>
          <p className="text-sm line-clamp-3">{post.caption}</p>
        </div>
        <div className="absolute right-3 bottom-20 flex flex-col items-center gap-4">
          <div className="text-center"><Heart className="w-7 h-7" /><span className="text-xs">0</span></div>
          <div className="text-center"><MessageSquare className="w-7 h-7" /><span className="text-xs">0</span></div>
          <div className="text-center"><Share2 className="w-7 h-7" /><span className="text-xs">0</span></div>
        </div>
      </div>
    );
  }

  // Generic preview for other platforms
  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900 p-4" data-testid={`preview-${platform}`}>
      <div className="flex items-center gap-3 mb-3">
        <img src={avatarUrl} alt={username} className="w-10 h-10 rounded-full object-cover" />
        <div>
          <p className="font-semibold text-sm capitalize">{platform}</p>
          <p className="text-xs text-muted-foreground">@{username}</p>
        </div>
      </div>
      {post.mediaUrl && (
        <div className="rounded-lg overflow-hidden mb-3">
          {post.mediaType?.startsWith('video') ? (
            <video src={post.mediaUrl} className="w-full max-h-64 object-cover" controls playsInline />
          ) : (
            <img src={post.mediaUrl} alt="" className="w-full max-h-64 object-cover" />
          )}
        </div>
      )}
      <p className="text-sm whitespace-pre-wrap">{post.caption}</p>
      {post.hashtags && post.hashtags.length > 0 && (
        <p className="text-sm text-primary mt-2">
          {post.hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ')}
        </p>
      )}
    </div>
  );
}

export default function ContentPlanPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<{ post: PlanPost; index: number } | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateScope, setGenerateScope] = useState<'week' | 'month'>('week');
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedPostIndices, setSelectedPostIndices] = useState<number[]>([]);
  const [showDeletePlanConfirm, setShowDeletePlanConfirm] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<string | null>(null);

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

  const { data: plans = [], isLoading: plansLoading, refetch: refetchPlans } = useQuery<AiContentPlan[]>({
    queryKey: ["/api/social/content-plans"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/social/content-plans");
      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error("Failed to fetch content plans");
      }
      return response.json();
    },
    enabled: !!user && subscriptionStatus?.hasSocialPoster,
  });

  const { data: selectedPlan, isLoading: selectedPlanLoading } = useQuery<AiContentPlan>({
    queryKey: ["/api/social/content-plans", selectedPlanId],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/social/content-plans/${selectedPlanId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch plan details");
      }
      return response.json();
    },
    enabled: !!selectedPlanId && !!user && subscriptionStatus?.hasSocialPoster,
  });

  const generatePlanMutation = useMutation({
    mutationFn: async (scope: 'week' | 'month') => {
      const response = await fetchWithAuth("/api/social/content-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate plan");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/content-plans"] });
      setSelectedPlanId(data.id);
      setShowGenerateDialog(false);
      toast({ title: "Content plan generated successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to generate plan", description: error.message, variant: "destructive" });
    },
  });

  const updatePlanStatusMutation = useMutation({
    mutationFn: async ({ planId, status }: { planId: string; status: string }) => {
      const response = await fetchWithAuth(`/api/social/content-plans/${planId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error("Failed to update plan status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/content-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/content-plans", selectedPlanId] });
      toast({ title: "Plan status updated!" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const updatePostStatusMutation = useMutation({
    mutationFn: async ({ planId, index, status }: { planId: string; index: number; status: string }) => {
      const response = await fetchWithAuth(`/api/social/content-plans/${planId}/posts/${index}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error("Failed to update post status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/content-plans", selectedPlanId] });
      toast({ title: "Post status updated!" });
    },
    onError: () => {
      toast({ title: "Failed to update post status", variant: "destructive" });
    },
  });

  const regeneratePostMutation = useMutation({
    mutationFn: async ({ planId, index }: { planId: string; index: number }) => {
      const response = await fetchWithAuth(`/api/social/content-plans/${planId}/posts/${index}/regenerate`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to regenerate post");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/content-plans", selectedPlanId] });
      setSelectedPost(null);
      toast({ title: "Post regenerated!" });
    },
    onError: () => {
      toast({ title: "Failed to regenerate post", variant: "destructive" });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async ({ planId, index }: { planId: string; index: number }) => {
      const response = await fetchWithAuth(`/api/social/content-plans/${planId}/posts/${index}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete post");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/content-plans", selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/content-plans"] });
      setSelectedPost(null);
      toast({ title: "Post deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete post", variant: "destructive" });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await fetchWithAuth(`/api/social/content-plans/${planId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete plan");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/content-plans"] });
      setSelectedPlanId(null);
      toast({ title: "Content plan deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete plan", variant: "destructive" });
    },
  });

  const bulkDeletePostsMutation = useMutation({
    mutationFn: async ({ planId, indices }: { planId: string; indices: number[] }) => {
      const response = await fetchWithAuth(`/api/social/content-plans/${planId}/posts/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indices }),
      });
      if (!response.ok) {
        throw new Error("Failed to delete posts");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/content-plans", selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/content-plans"] });
      setSelectedPostIndices([]);
      toast({ title: `${data.deletedCount} posts deleted` });
    },
    onError: () => {
      toast({ title: "Failed to delete posts", variant: "destructive" });
    },
  });

  const { data: agentStatus, refetch: refetchAgentStatus } = useQuery<{
    isRunning: boolean;
    isExecuting: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
    postsAttemptedThisRun: number;
    postsSucceededThisRun: number;
    postsFailedThisRun: number;
    postsSucceededTotal: number;
    postsFailedTotal: number;
    errors: string[];
  }>({
    queryKey: ["/api/social/execution-agent/status"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/social/execution-agent/status");
      if (!response.ok) {
        throw new Error("Failed to get agent status");
      }
      return response.json();
    },
    enabled: !!user && subscriptionStatus?.hasSocialPoster,
    refetchInterval: 30000,
  });

  const startAgentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth("/api/social/execution-agent/start", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to start agent");
      }
      return response.json();
    },
    onSuccess: () => {
      refetchAgentStatus();
      toast({ title: "Execution agent started!" });
    },
    onError: () => {
      toast({ title: "Failed to start agent", variant: "destructive" });
    },
  });

  const stopAgentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth("/api/social/execution-agent/stop", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to stop agent");
      }
      return response.json();
    },
    onSuccess: () => {
      refetchAgentStatus();
      toast({ title: "Execution agent stopped" });
    },
    onError: () => {
      toast({ title: "Failed to stop agent", variant: "destructive" });
    },
  });

  const executeNowMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth("/api/social/execution-agent/execute-now", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to execute");
      }
      return response.json();
    },
    onSuccess: (data) => {
      refetchAgentStatus();
      queryClient.invalidateQueries({ queryKey: ["/api/social/content-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/content-plans", selectedPlanId] });
      
      if (data.skipped) {
        toast({ 
          title: "Execution in progress", 
          description: "Another execution is already running. Please wait.",
          variant: "default"
        });
      } else {
        const attemptedCount = data.postsAttemptedThisRun || 0;
        const successCount = data.postsSucceededThisRun || 0;
        const failedCount = data.postsFailedThisRun || 0;
        
        if (attemptedCount === 0) {
          toast({ 
            title: "No posts to process",
            description: "No approved posts are due for posting right now"
          });
        } else if (failedCount === 0) {
          toast({ 
            title: "Execution complete",
            description: `${successCount} post${successCount > 1 ? 's' : ''} published successfully`
          });
        } else if (successCount === 0) {
          toast({ 
            title: "Execution failed",
            description: `${failedCount} post${failedCount > 1 ? 's' : ''} failed to publish`,
            variant: "destructive"
          });
        } else {
          toast({ 
            title: "Execution complete with issues",
            description: `${successCount} posted, ${failedCount} failed`,
            variant: "destructive"
          });
        }
      }
    },
    onError: () => {
      toast({ title: "Failed to execute", variant: "destructive" });
    },
  });

  if (statusLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
          <div className="grid gap-4 md:grid-cols-3 mt-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!subscriptionStatus?.hasSocialPoster) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <SocialUpgradePrompt />
      </div>
    );
  }

  const getPostsForDay = (date: Date): { post: PlanPost; index: number }[] => {
    if (!selectedPlan?.plan?.posts) return [];
    return selectedPlan.plan.posts
      .map((post, index) => ({ post, index }))
      .filter(({ post }) => {
        try {
          const postDate = parseISO(post.date);
          return isSameDay(postDate, date);
        } catch {
          return false;
        }
      });
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const calculateProgress = () => {
    if (!selectedPlan?.plan?.posts) return { approved: 0, pending: 0, rejected: 0, total: 0 };
    const posts = selectedPlan.plan.posts;
    const approved = posts.filter(p => p.status === 'approved' || p.status === 'scheduled' || p.status === 'posted').length;
    const rejected = posts.filter(p => p.status === 'rejected').length;
    const pending = posts.filter(p => p.status === 'pending').length;
    return { approved, pending, rejected, total: posts.length };
  };

  const progress = calculateProgress();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-content-plan-title">Content Plan</h1>
          <p className="text-muted-foreground">
            Generate and manage AI-powered content calendars
          </p>
        </div>
        <Button
          onClick={() => setShowGenerateDialog(true)}
          className="gap-2"
          data-testid="button-generate-plan"
        >
          <Wand2 className="w-4 h-4" />
          Generate Plan
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${agentStatus?.isRunning ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
                <span className="font-medium">
                  {agentStatus?.isRunning ? 'Agent Running' : 'Agent Stopped'}
                </span>
              </div>
              {agentStatus?.lastRunAt && (
                <span className="text-sm text-muted-foreground">
                  Last run: {format(new Date(agentStatus.lastRunAt), 'MMM d, h:mm a')}
                </span>
              )}
              {agentStatus?.lastRunAt && agentStatus.postsSucceededThisRun > 0 && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {agentStatus.postsSucceededThisRun} posted this run
                </Badge>
              )}
              {agentStatus?.lastRunAt && agentStatus.postsFailedThisRun > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="w-3 h-3" />
                  {agentStatus.postsFailedThisRun} failed
                </Badge>
              )}
              {agentStatus?.postsSucceededTotal !== undefined && agentStatus.postsSucceededTotal > 0 && (
                <span className="text-sm text-muted-foreground">
                  Total: {agentStatus.postsSucceededTotal} published
                </span>
              )}
              {agentStatus?.errors && agentStatus.errors.length > 0 && (
                <Badge variant="outline" className="gap-1 text-destructive border-destructive">
                  <AlertCircle className="w-3 h-3" />
                  {agentStatus.errors.length} recent error{agentStatus.errors.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {agentStatus?.isRunning ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => stopAgentMutation.mutate()}
                  disabled={stopAgentMutation.isPending}
                  data-testid="button-stop-agent"
                >
                  {stopAgentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Pause className="w-4 h-4 mr-1" />
                  )}
                  Stop Agent
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startAgentMutation.mutate()}
                  disabled={startAgentMutation.isPending}
                  data-testid="button-start-agent"
                >
                  {startAgentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Play className="w-4 h-4 mr-1" />
                  )}
                  Start Agent
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => executeNowMutation.mutate()}
                disabled={executeNowMutation.isPending}
                data-testid="button-execute-now"
              >
                {executeNowMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-1" />
                )}
                Post Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {plansLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : plans.length === 0 ? (
        <Card className="text-center py-12">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <CalendarDays className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">No Content Plans Yet</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Generate your first AI-powered content plan to start scheduling posts automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              size="lg" 
              onClick={() => setShowGenerateDialog(true)}
              className="gap-2"
              data-testid="button-create-first-plan"
            >
              <Sparkles className="w-4 h-4" />
              Create Your First Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Plans</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1 p-4 pt-0">
                    {plans.map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`w-full text-left p-3 rounded-lg transition-colors hover-elevate ${
                          selectedPlanId === plan.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'
                        }`}
                        data-testid={`button-select-plan-${plan.id}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium capitalize">{plan.scope} Plan</span>
                          <Badge variant={PLAN_STATUS_BADGES[plan.status]?.variant || "secondary"} className="text-xs">
                            {PLAN_STATUS_BADGES[plan.status]?.label || plan.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(plan.startDate), 'MMM d')} - {format(new Date(plan.endDate), 'MMM d, yyyy')}
                        </p>
                        {plan.plan?.posts && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {plan.plan.posts.length} posts planned
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            {!selectedPlanId ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Select a plan to view its calendar</p>
                </CardContent>
              </Card>
            ) : selectedPlanLoading ? (
              <Skeleton className="h-[500px] w-full" />
            ) : selectedPlan ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span className="capitalize">{selectedPlan.scope} Content Plan</span>
                          <Badge variant={PLAN_STATUS_BADGES[selectedPlan.status]?.variant || "secondary"}>
                            {PLAN_STATUS_BADGES[selectedPlan.status]?.label || selectedPlan.status}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {format(new Date(selectedPlan.startDate), 'MMMM d')} - {format(new Date(selectedPlan.endDate), 'MMMM d, yyyy')}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedPlan.status === 'draft' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => updatePlanStatusMutation.mutate({ planId: selectedPlan.id, status: 'approved' })}
                            disabled={updatePlanStatusMutation.isPending}
                            className="gap-1"
                            data-testid="button-approve-plan"
                          >
                            <Check className="w-4 h-4" />
                            Approve All
                          </Button>
                        )}
                        {selectedPlan.status === 'approved' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updatePlanStatusMutation.mutate({ planId: selectedPlan.id, status: 'executing' })}
                            disabled={updatePlanStatusMutation.isPending}
                            className="gap-1"
                            data-testid="button-execute-plan"
                          >
                            <Play className="w-4 h-4" />
                            Start Execution
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowDeletePlanConfirm(true)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          data-testid="button-delete-plan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {selectedPlan.plan?.strategy && (
                      <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium mb-1">Strategy</p>
                        <p className="text-sm text-muted-foreground">{selectedPlan.plan.strategy}</p>
                      </div>
                    )}
                    {selectedPlan.plan?.contentPillars && selectedPlan.plan.contentPillars.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="text-sm font-medium">Content Pillars:</span>
                        {selectedPlan.plan.contentPillars.map((pillar, i) => (
                          <Badge key={i} variant="outline">{pillar}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Progress</span>
                        <span>{progress.approved + progress.rejected}/{progress.total} reviewed</span>
                      </div>
                      <Progress 
                        value={progress.total > 0 ? ((progress.approved + progress.rejected) / progress.total) * 100 : 0} 
                        className="h-2"
                      />
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          {progress.approved} approved
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-yellow-500" />
                          {progress.pending} pending
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          {progress.rejected} rejected
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Calendar View</CardTitle>
                      <div className="flex items-center gap-2">
                        {selectedPostIndices.length > 0 && (
                          <>
                            <span className="text-sm text-muted-foreground">
                              {selectedPostIndices.length} selected
                            </span>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                if (selectedPlanId) {
                                  bulkDeletePostsMutation.mutate({ planId: selectedPlanId, indices: selectedPostIndices });
                                }
                              }}
                              disabled={bulkDeletePostsMutation.isPending}
                              className="gap-1"
                              data-testid="button-bulk-delete"
                            >
                              {bulkDeletePostsMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                              Delete Selected
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPostIndices([])}
                              data-testid="button-clear-selection"
                            >
                              Clear
                            </Button>
                          </>
                        )}
                        {selectedPlan?.plan?.posts && selectedPlan.plan.posts.length > 0 && selectedPostIndices.length === 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const allIndices = selectedPlan?.plan?.posts?.map((_: any, i: number) => i) || [];
                              setSelectedPostIndices(allIndices);
                            }}
                            data-testid="button-select-all"
                          >
                            Select All
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
                          data-testid="button-prev-week"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm font-medium min-w-[160px] text-center">
                          {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
                          data-testid="button-next-week"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-7 gap-2">
                      {weekDays.map((day) => {
                        const dayPosts = getPostsForDay(day);
                        const isToday = isSameDay(day, new Date());
                        const isPast = isBefore(day, new Date()) && !isToday;
                        
                        return (
                          <div 
                            key={day.toISOString()} 
                            className={`min-h-[180px] border rounded-lg p-2 ${
                              isToday ? 'border-primary bg-primary/5' : isPast ? 'bg-muted/30' : ''
                            }`}
                          >
                            <div className={`text-center mb-2 pb-2 border-b ${isToday ? 'border-primary/30' : ''}`}>
                              <p className="text-xs text-muted-foreground">{format(day, 'EEE')}</p>
                              <p className={`text-lg font-semibold ${isToday ? 'text-primary' : ''}`}>
                                {format(day, 'd')}
                              </p>
                            </div>
                            <ScrollArea className="h-[120px]">
                              <div className="space-y-1">
                                {dayPosts.map(({ post, index }) => {
                                  const isSelected = selectedPostIndices.includes(index);
                                  return (
                                    <div
                                      key={index}
                                      className={`relative w-full text-left p-2 rounded-md text-xs border bg-background ${isSelected ? 'ring-2 ring-primary' : ''}`}
                                    >
                                      <div className="absolute top-1 left-1">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            if (isSelected) {
                                              setSelectedPostIndices(prev => prev.filter(i => i !== index));
                                            } else {
                                              setSelectedPostIndices(prev => [...prev, index]);
                                            }
                                          }}
                                          className="w-3 h-3 rounded border-muted-foreground cursor-pointer"
                                          data-testid={`checkbox-post-${index}`}
                                        />
                                      </div>
                                      <button
                                        onClick={() => setSelectedPost({ post, index })}
                                        className="w-full text-left hover-elevate pl-4"
                                        data-testid={`button-view-post-${index}`}
                                      >
                                        <div className="flex items-center gap-1 mb-1">
                                          {post.platforms.slice(0, 2).map((platform) => {
                                            const Icon = PLATFORM_ICONS[platform];
                                            return Icon ? (
                                              <div
                                                key={platform}
                                                className={`w-4 h-4 ${PLATFORM_COLORS[platform]} rounded flex items-center justify-center`}
                                              >
                                                <Icon className="w-2.5 h-2.5 text-white" />
                                              </div>
                                            ) : null;
                                          })}
                                          {post.platforms.length > 2 && (
                                            <span className="text-[10px] text-muted-foreground">
                                              +{post.platforms.length - 2}
                                            </span>
                                          )}
                                          <span className="ml-auto text-[10px] text-muted-foreground">{post.time}</span>
                                        </div>
                                        {/* Thumbnail preview */}
                                        {post.mediaUrl && (
                                          <div className="relative w-full h-12 rounded overflow-hidden mb-1 bg-muted">
                                            {post.mediaType?.startsWith('video') ? (
                                              <div className="relative w-full h-full">
                                                <img 
                                                  src={post.thumbnailUrl || post.mediaUrl} 
                                                  alt="" 
                                                  className="w-full h-full object-cover"
                                                  onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                  }}
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                                  <Play className="w-4 h-4 text-white fill-white" />
                                                </div>
                                              </div>
                                            ) : (
                                              <img 
                                                src={post.mediaUrl} 
                                                alt="" 
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                  (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                              />
                                            )}
                                          </div>
                                        )}
                                        <p className="line-clamp-2 text-[11px]">{post.caption}</p>
                                        <div className="flex items-center justify-between mt-1">
                                          <Badge 
                                            variant={STATUS_BADGES[post.status]?.variant || "secondary"} 
                                            className="text-[10px] h-4 px-1"
                                          >
                                            {STATUS_BADGES[post.status]?.label || post.status}
                                          </Badge>
                                        </div>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </ScrollArea>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              Generate Content Plan
            </DialogTitle>
            <DialogDescription>
              Choose a time period for your AI-generated content plan. The AI will create posts based on your brand kit.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Plan Duration</label>
              <Select value={generateScope} onValueChange={(v) => setGenerateScope(v as 'week' | 'month')}>
                <SelectTrigger data-testid="select-plan-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">1 Week (7 days)</SelectItem>
                  <SelectItem value="month">1 Month (30 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium">What to expect:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  {generateScope === 'week' ? '~14 posts' : '~30 posts'} across your connected platforms
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Captions aligned with your brand voice
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Optimal posting times for engagement
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Relevant hashtags included
                </li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => generatePlanMutation.mutate(generateScope)}
              disabled={generatePlanMutation.isPending}
              className="gap-2"
              data-testid="button-confirm-generate"
            >
              {generatePlanMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPost} onOpenChange={() => { setSelectedPost(null); setPreviewPlatform(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedPost && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Post Details
                </DialogTitle>
                <DialogDescription>
                  {format(parseISO(selectedPost.post.date), 'EEEE, MMMM d, yyyy')} at {selectedPost.post.time}
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details" className="gap-2" data-testid="tab-details">
                    <FileText className="w-4 h-4" />
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-2" data-testid="tab-preview">
                    <Smartphone className="w-4 h-4" />
                    Preview
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="flex-1 overflow-y-auto mt-4">
                  <div className="space-y-4 pr-2">
                    {/* Media Preview */}
                    {selectedPost.post.mediaUrl && (
                      <MediaPreview 
                        mediaUrl={selectedPost.post.mediaUrl}
                        mediaType={selectedPost.post.mediaType}
                        thumbnailUrl={selectedPost.post.thumbnailUrl}
                        caption={selectedPost.post.caption}
                      />
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Platforms:</span>
                      <div className="flex gap-1">
                        {selectedPost.post.platforms.map((platform) => {
                          const Icon = PLATFORM_ICONS[platform];
                          return Icon ? (
                            <div
                              key={platform}
                              className={`w-6 h-6 ${PLATFORM_COLORS[platform]} rounded flex items-center justify-center`}
                              title={platform}
                            >
                              <Icon className="w-3.5 h-3.5 text-white" />
                            </div>
                          ) : (
                            <Badge key={platform} variant="outline">{platform}</Badge>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Content Type:</span>
                      <Badge variant="outline" className="capitalize gap-1">
                        {CONTENT_TYPE_ICONS[selectedPost.post.contentType] && (
                          (() => {
                            const Icon = CONTENT_TYPE_ICONS[selectedPost.post.contentType];
                            return <Icon className="w-3 h-3" />;
                          })()
                        )}
                        {selectedPost.post.contentType}
                      </Badge>
                    </div>

                    <SafeZoneInfo 
                      platforms={selectedPost.post.platforms} 
                      contentType={selectedPost.post.contentType} 
                    />

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Status:</span>
                      <Badge variant={STATUS_BADGES[selectedPost.post.status]?.variant || "secondary"}>
                        {STATUS_BADGES[selectedPost.post.status]?.label || selectedPost.post.status}
                      </Badge>
                    </div>

                    <Separator />

                    <div>
                      <p className="text-sm font-medium mb-2">Caption:</p>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{selectedPost.post.caption}</p>
                      </div>
                    </div>

                    {selectedPost.post.hashtags && selectedPost.post.hashtags.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2 flex items-center gap-1">
                          <Hash className="w-4 h-4" />
                          Hashtags:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {selectedPost.post.hashtags.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              #{tag.replace(/^#/, '')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedPost.post.mediaPrompt && (
                      <div>
                        <p className="text-sm font-medium mb-2">Media Prompt:</p>
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">{selectedPost.post.mediaPrompt}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="flex-1 overflow-y-auto mt-4">
                  <div className="space-y-4 pr-2">
                    {/* Platform selector */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">Preview as:</span>
                      <div className="flex gap-1 flex-wrap">
                        {selectedPost.post.platforms.map((platform) => {
                          const Icon = PLATFORM_ICONS[platform];
                          const isActive = previewPlatform === platform || (!previewPlatform && platform === selectedPost.post.platforms[0]);
                          return (
                            <Button
                              key={platform}
                              variant={isActive ? "default" : "outline"}
                              size="sm"
                              onClick={() => setPreviewPlatform(platform)}
                              className="gap-1"
                              data-testid={`button-preview-${platform}`}
                            >
                              {Icon && <Icon className="w-3 h-3" />}
                              <span className="capitalize">{platform}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Platform Preview */}
                    <ScrollArea className="h-[400px]">
                      <PlatformPreview
                        platform={previewPlatform || selectedPost.post.platforms[0]}
                        post={selectedPost.post}
                      />
                    </ScrollArea>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deletePostMutation.mutate({ planId: selectedPlanId!, index: selectedPost.index })}
                  disabled={deletePostMutation.isPending}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  data-testid="button-delete-post"
                >
                  {deletePostMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => regeneratePostMutation.mutate({ planId: selectedPlanId!, index: selectedPost.index })}
                  disabled={regeneratePostMutation.isPending}
                  className="gap-1"
                  data-testid="button-regenerate-post"
                >
                  {regeneratePostMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Regenerate
                </Button>
                {selectedPost.post.status === 'pending' && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        updatePostStatusMutation.mutate({ planId: selectedPlanId!, index: selectedPost.index, status: 'rejected' });
                        setSelectedPost(null);
                      }}
                      disabled={updatePostStatusMutation.isPending}
                      className="gap-1"
                      data-testid="button-reject-post"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => {
                        updatePostStatusMutation.mutate({ planId: selectedPlanId!, index: selectedPost.index, status: 'approved' });
                        setSelectedPost(null);
                      }}
                      disabled={updatePostStatusMutation.isPending}
                      className="gap-1"
                      data-testid="button-approve-post"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Plan Confirmation Dialog */}
      <Dialog open={showDeletePlanConfirm} onOpenChange={setShowDeletePlanConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Content Plan
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this content plan? This action cannot be undone.
              All posts in this plan will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeletePlanConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedPlanId) {
                  deletePlanMutation.mutate(selectedPlanId);
                  setShowDeletePlanConfirm(false);
                }
              }}
              disabled={deletePlanMutation.isPending}
              className="gap-1"
              data-testid="button-confirm-delete-plan"
            >
              {deletePlanMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
