import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  Video,
  FileText,
  Edit2,
  Trash2,
  Plus,
  Eye,
  MoreHorizontal,
  Send,
  Hash,
  X,
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
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, setHours, setMinutes } from "date-fns";
import { fetchWithAuth } from "@/lib/authBridge";
import { SocialUpgradePrompt } from "@/components/social-upgrade-prompt";

interface ConnectedAccount {
  id: string;
  platform: string;
  accountUsername: string;
  connected: boolean;
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

interface ScheduledPost {
  id: string;
  platform: string;
  caption: string;
  hashtags: string[];
  mediaType: string;
  mediaUrl?: string;
  scheduledFor: string;
  status: string;
  aiGenerated: boolean;
}

interface SubscriptionStatus {
  hasSocialPoster: boolean;
  status?: string;
}

export default function SocialCalendar() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [viewFilter, setViewFilter] = useState<string>("all");
  
  // Create Post Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("12:00");
  const [postMode, setPostMode] = useState<"schedule" | "now">("schedule");

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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

  const { data: scheduledPosts = [], isLoading, refetch } = useQuery<ScheduledPost[]>({
    queryKey: ["/api/social/posts", format(weekStart, "yyyy-MM-dd")],
    enabled: !!user && subscriptionStatus?.hasSocialPoster === true,
  });

  const { data: connectedAccounts = [] } = useQuery<ConnectedAccount[]>({
    queryKey: ["/api/social/accounts"],
    enabled: !!user && subscriptionStatus?.hasSocialPoster === true,
  });

  const connectedPlatformsList = connectedAccounts.filter(acc => acc.connected);

  const createPostMutation = useMutation({
    mutationFn: async (postData: {
      platforms: string[];
      title: string;
      hashtags: string[];
      scheduledAt?: string;
      publishNow?: boolean;
    }) => {
      const response = await apiRequest("POST", "/api/social/posts", {
        ...postData,
        postType: "text",
        status: postData.publishNow ? "publishing" : "scheduled",
      });
      const result = await response.json();
      
      // If publishing now, call the publish endpoint
      if (postData.publishNow && result.post?.id) {
        await apiRequest("POST", `/api/social/posts/${result.post.id}/publish`);
      }
      return result;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
      resetCreateForm();
      setShowCreateModal(false);
      toast({
        title: variables.publishNow ? "Publishing..." : "Post Scheduled",
        description: variables.publishNow 
          ? "Your post is being published now." 
          : "Your post has been scheduled successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create post",
        variant: "destructive",
      });
    },
  });

  const resetCreateForm = () => {
    setCaption("");
    setSelectedPlatforms([]);
    setHashtags([]);
    setHashtagInput("");
    setScheduleDate("");
    setScheduleTime("12:00");
    setPostMode("schedule");
  };

  const handleAddHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
      setHashtagInput("");
    }
  };

  const handleRemoveHashtag = (tag: string) => {
    setHashtags(hashtags.filter(h => h !== tag));
  };

  const togglePlatform = (platformId: string) => {
    if (selectedPlatforms.includes(platformId)) {
      setSelectedPlatforms(prev => prev.filter(p => p !== platformId));
    } else {
      setSelectedPlatforms(prev => [...prev, platformId]);
    }
  };

  const handleCreatePost = () => {
    if (!caption.trim()) {
      toast({
        title: "Missing Caption",
        description: "Please enter a caption for your post.",
        variant: "destructive",
      });
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast({
        title: "No Platforms Selected",
        description: "Please select at least one platform to post to.",
        variant: "destructive",
      });
      return;
    }

    if (postMode === "schedule") {
      if (!scheduleDate) {
        toast({
          title: "Missing Date",
          description: "Please select a date to schedule your post.",
          variant: "destructive",
        });
        return;
      }

      const [hours, minutes] = scheduleTime.split(":").map(Number);
      let scheduledAt = new Date(scheduleDate);
      scheduledAt = setHours(scheduledAt, hours);
      scheduledAt = setMinutes(scheduledAt, minutes);

      createPostMutation.mutate({
        platforms: selectedPlatforms,
        title: caption,
        hashtags,
        scheduledAt: scheduledAt.toISOString(),
        publishNow: false,
      });
    } else {
      createPostMutation.mutate({
        platforms: selectedPlatforms,
        title: caption,
        hashtags,
        publishNow: true,
      });
    }
  };

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return await apiRequest("DELETE", `/api/social/posts/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
      setSelectedPost(null);
      toast({
        title: "Post Deleted",
        description: "The scheduled post has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete post",
        variant: "destructive",
      });
    },
  });

  const publishNowMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await apiRequest("POST", `/api/social/posts/${postId}/publish`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
      setSelectedPost(null);
      toast({
        title: "Publishing",
        description: "Your post is being published now.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to publish post",
        variant: "destructive",
      });
    },
  });

  const getPostsForDay = (date: Date) => {
    return scheduledPosts.filter(post => {
      const postDate = parseISO(post.scheduledFor);
      const matchesDay = isSameDay(postDate, date);
      const matchesPlatform = viewFilter === "all" || post.platform === viewFilter;
      return matchesDay && matchesPlatform;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-blue-500";
      case "published": return "bg-green-500";
      case "failed": return "bg-red-500";
      case "draft": return "bg-gray-500";
      default: return "bg-muted";
    }
  };

  const MediaTypeIcon = ({ type }: { type: string }) => {
    switch (type) {
      case "video": return <Video className="w-3 h-3" />;
      case "image": return <ImageIcon className="w-3 h-3" />;
      default: return <FileText className="w-3 h-3" />;
    }
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
        title="Unlock Content Calendar"
        description="Plan and schedule your posts in advance with our intuitive drag-and-drop calendar interface."
      />
    );
  }

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Content Calendar
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage your scheduled social media posts.
          </p>
        </div>
        <Button 
          className="gap-2"
          onClick={() => setShowCreateModal(true)}
          data-testid="button-create-content"
        >
          <Plus className="w-4 h-4" />
          Create Content
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
              data-testid="button-prev-week"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
              data-testid="button-next-week"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="font-medium ml-2">
              {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setCurrentWeek(new Date())}
            >
              Today
            </Button>
            <Select value={viewFilter} onValueChange={setViewFilter}>
              <SelectTrigger className="w-40" data-testid="select-platform-filter">
                <SelectValue placeholder="All platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {Object.keys(PLATFORM_ICONS).map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, index) => {
            const posts = getPostsForDay(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div key={index} className="min-h-[200px]">
                <div className={`text-center p-2 rounded-t-lg ${isToday ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <p className="text-xs font-medium">{format(day, "EEE")}</p>
                  <p className="text-lg font-bold">{format(day, "d")}</p>
                </div>
                
                <div className="border border-t-0 rounded-b-lg p-2 min-h-[160px] space-y-2">
                  {posts.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No posts
                    </p>
                  ) : (
                    posts.map((post) => {
                      const PlatformIcon = PLATFORM_ICONS[post.platform];
                      return (
                        <button
                          key={post.id}
                          onClick={() => setSelectedPost(post)}
                          className="w-full text-left p-2 rounded border bg-card hover-elevate transition-all"
                          data-testid={`button-post-${post.id}`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <div className={`w-5 h-5 ${PLATFORM_COLORS[post.platform]} rounded flex items-center justify-center`}>
                              {PlatformIcon && <PlatformIcon className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(post.scheduledFor), "h:mm a")}
                            </span>
                          </div>
                          <p className="text-xs line-clamp-2">{post.caption}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <MediaTypeIcon type={post.mediaType} />
                            <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(post.status)}`} />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-lg">
          {selectedPost && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${PLATFORM_COLORS[selectedPost.platform]} rounded-lg flex items-center justify-center`}>
                    {PLATFORM_ICONS[selectedPost.platform] && 
                      <span className="text-white">
                        {(() => {
                          const Icon = PLATFORM_ICONS[selectedPost.platform];
                          return <Icon className="w-5 h-5" />;
                        })()}
                      </span>
                    }
                  </div>
                  <div>
                    <DialogTitle className="capitalize">
                      {selectedPost.platform} Post
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {format(parseISO(selectedPost.scheduledFor), "MMM d, yyyy 'at' h:mm a")}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {selectedPost.mediaUrl && (
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    {selectedPost.mediaType === "video" ? (
                      <video 
                        src={selectedPost.mediaUrl} 
                        controls 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img 
                        src={selectedPost.mediaUrl} 
                        alt="Post media" 
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                )}
                
                <div>
                  <p className="text-sm">{selectedPost.caption}</p>
                  {selectedPost.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedPost.hashtags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(selectedPost.status)}>
                    {selectedPost.status}
                  </Badge>
                  {selectedPost.aiGenerated && (
                    <Badge variant="outline">AI Generated</Badge>
                  )}
                </div>
              </div>
              
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deletePostMutation.mutate(selectedPost.id)}
                  disabled={deletePostMutation.isPending}
                  className="text-destructive hover:text-destructive"
                  data-testid="button-delete-post"
                >
                  {deletePostMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
                {selectedPost.status === "scheduled" && (
                  <Button
                    size="sm"
                    onClick={() => publishNowMutation.mutate(selectedPost.id)}
                    disabled={publishNowMutation.isPending}
                    data-testid="button-publish-now"
                  >
                    {publishNowMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Publish Now
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Post Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => {
        if (!open) resetCreateForm();
        setShowCreateModal(open);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Post
            </DialogTitle>
            <DialogDescription>
              Create and schedule a post to your connected social media accounts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Caption */}
            <div className="space-y-2">
              <Label htmlFor="caption">Caption</Label>
              <Textarea
                id="caption"
                placeholder="What's on your mind? Write your post content here..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="min-h-[100px] resize-none"
                data-testid="input-caption"
              />
              <p className="text-xs text-muted-foreground">
                {caption.length} characters
              </p>
            </div>

            {/* Platform Selection */}
            <div className="space-y-2">
              <Label>Select Platforms</Label>
              {connectedPlatformsList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No connected accounts. Please connect your social media accounts first.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {connectedPlatformsList.map((account) => {
                    const PlatformIcon = PLATFORM_ICONS[account.platform];
                    const isSelected = selectedPlatforms.includes(account.platform);
                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => togglePlatform(account.platform)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                          isSelected 
                            ? "border-primary bg-primary/10" 
                            : "border-border hover-elevate"
                        }`}
                        data-testid={`button-platform-${account.platform}`}
                      >
                        <div className={`w-8 h-8 ${PLATFORM_COLORS[account.platform]} rounded-lg flex items-center justify-center`}>
                          {PlatformIcon && <PlatformIcon className="w-4 h-4 text-white" />}
                        </div>
                        <span className="text-xs capitalize">{account.platform}</span>
                        {isSelected && (
                          <div className="w-2 h-2 bg-primary rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Hashtags */}
            <div className="space-y-2">
              <Label htmlFor="hashtags">Hashtags</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="hashtags"
                    placeholder="Add hashtag"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddHashtag();
                      }
                    }}
                    className="pl-9"
                    data-testid="input-hashtag"
                  />
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleAddHashtag}
                  data-testid="button-add-hashtag"
                >
                  Add
                </Button>
              </div>
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {hashtags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveHashtag(tag)}
                        className="hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Post Mode Selection */}
            <div className="space-y-3">
              <Label>When to Post</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={postMode === "schedule" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setPostMode("schedule")}
                  data-testid="button-mode-schedule"
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  Schedule
                </Button>
                <Button
                  type="button"
                  variant={postMode === "now" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setPostMode("now")}
                  data-testid="button-mode-now"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Post Now
                </Button>
              </div>
            </div>

            {/* Schedule Date/Time */}
            {postMode === "schedule" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={format(new Date(), "yyyy-MM-dd")}
                    data-testid="input-schedule-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    data-testid="input-schedule-time"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetCreateForm();
                setShowCreateModal(false);
              }}
              data-testid="button-cancel-create"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePost}
              disabled={createPostMutation.isPending || !caption.trim() || selectedPlatforms.length === 0}
              data-testid="button-submit-post"
            >
              {createPostMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : postMode === "now" ? (
                <Send className="w-4 h-4 mr-2" />
              ) : (
                <CalendarIcon className="w-4 h-4 mr-2" />
              )}
              {postMode === "now" ? "Post Now" : "Schedule Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
