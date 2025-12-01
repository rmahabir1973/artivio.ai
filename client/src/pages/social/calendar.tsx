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
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import { Link } from "wouter";

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
  id: number;
  platform: string;
  caption: string;
  hashtags: string[];
  mediaType: string;
  mediaUrl?: string;
  scheduledFor: string;
  status: string;
  aiGenerated: boolean;
}

export default function SocialCalendar() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [viewFilter, setViewFilter] = useState<string>("all");

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: scheduledPosts = [], isLoading, refetch } = useQuery<ScheduledPost[]>({
    queryKey: ["/api/social/posts", format(weekStart, "yyyy-MM-dd")],
    enabled: !!user,
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: number) => {
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
    mutationFn: async (postId: number) => {
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
        <Button asChild className="gap-2">
          <Link href="/social/strategist">
            <Plus className="w-4 h-4" />
            Create Content
          </Link>
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
    </div>
  );
}
