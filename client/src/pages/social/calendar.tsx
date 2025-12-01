import { useState, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Upload,
  Film,
  MessageSquare,
  Link as LinkIcon,
  Users,
  Globe,
  Lock,
  AlertCircle,
} from "lucide-react";
import {
  PLATFORM_CONFIGS,
  getContentTypes,
  getMaxCharacters,
  getPlatformSpecificFields,
  type SocialPlatform,
  type ContentType,
  type ContentTypeConfig,
  type PlatformSpecificField,
} from "@shared/socialPlatformConfig";
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

interface MediaItem {
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  mimeType?: string;
}

interface ScheduledPost {
  id: string;
  platform: string;  // Primary platform (first in array) for backward compat
  platforms?: string[];  // All target platforms
  caption: string;
  hashtags: string[];
  mediaType: string;
  mediaUrl?: string;  // Legacy single media URL
  mediaItems?: MediaItem[];  // Array of media items for carousels etc.
  contentType?: string;  // Content type (post, story, reel, etc.)
  platformSpecificData?: Record<string, Record<string, any>>;  // Per-platform namespaced data
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
  
  // New state for enhanced modal
  const [contentType, setContentType] = useState<string>("post");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  // Platform-specific data is namespaced per platform: { instagram: { firstComment: "..." }, youtube: { privacyStatus: "public" } }
  const [platformSpecificData, setPlatformSpecificData] = useState<Record<string, Record<string, any>>>({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to get/set platform-specific data for a given platform and field
  const getPlatformFieldValue = (platform: string, fieldKey: string) => {
    return platformSpecificData[platform]?.[fieldKey] ?? '';
  };
  
  const setPlatformFieldValue = (platform: string, fieldKey: string, value: any) => {
    setPlatformSpecificData(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [fieldKey]: value
      }
    }));
  };

  // Get common content types across all selected platforms
  const availableContentTypes = useMemo(() => {
    if (selectedPlatforms.length === 0) return [];
    
    const platformContentTypes = selectedPlatforms.map(platform => 
      getContentTypes(platform as SocialPlatform)
    );
    
    // Get content types that exist in ALL selected platforms
    if (platformContentTypes.length === 0) return [];
    
    const firstPlatformTypes = platformContentTypes[0];
    const commonTypes = firstPlatformTypes.filter(type => 
      platformContentTypes.every(platformTypes => 
        platformTypes.some(pt => pt.id === type.id)
      )
    );
    
    return commonTypes;
  }, [selectedPlatforms]);

  // Get the current content type config
  const currentContentTypeConfig = useMemo(() => {
    if (selectedPlatforms.length === 0 || !contentType) return null;
    const platform = selectedPlatforms[0] as SocialPlatform;
    const types = getContentTypes(platform);
    return types.find(t => t.id === contentType);
  }, [selectedPlatforms, contentType]);

  // Get all platform-specific fields from all selected platforms for the current content type
  const allPlatformSpecificFields = useMemo(() => {
    if (selectedPlatforms.length === 0 || !contentType) return [];
    
    const fieldsMap = new Map<string, { field: PlatformSpecificField; platforms: string[] }>();
    
    selectedPlatforms.forEach(platform => {
      const fields = getPlatformSpecificFields(platform as SocialPlatform, contentType as ContentType);
      fields.forEach(field => {
        if (fieldsMap.has(field.key)) {
          fieldsMap.get(field.key)!.platforms.push(platform);
        } else {
          fieldsMap.set(field.key, { field, platforms: [platform] });
        }
      });
    });
    
    return Array.from(fieldsMap.values());
  }, [selectedPlatforms, contentType]);

  // Get the effective max characters based on platform and content type
  const effectiveMaxCharacters = useMemo(() => {
    if (selectedPlatforms.length === 0) return 2200;
    
    // Get the minimum max characters across all selected platforms
    return Math.min(
      ...selectedPlatforms.map(platform => 
        getMaxCharacters(platform as SocialPlatform, contentType as ContentType)
      )
    );
  }, [selectedPlatforms, contentType]);

  // Check if current content type requires media
  const requiresMedia = currentContentTypeConfig?.requiresMedia || false;
  const maxMediaCount = currentContentTypeConfig?.maxMediaCount || 1;
  const acceptedMediaTypes = currentContentTypeConfig?.mediaTypes || [];

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
      contentType?: string;
      mediaItems?: { name: string; type: string; size: number }[];
      platformSpecificData?: Record<string, Record<string, any>>; // Nested per-platform structure
    }) => {
      try {
        // Create the post first
        const response = await apiRequest("POST", "/api/social/posts", {
          ...postData,
          postType: postData.contentType || "text",
          status: postData.publishNow ? "draft" : "scheduled",
        });
        
        const result = await response.json();
        
        // If publishing now, call the publish endpoint
        if (postData.publishNow) {
          if (!result.post?.id) {
            throw new Error("Post created but missing ID for publishing");
          }
          try {
            await apiRequest("POST", `/api/social/posts/${result.post.id}/publish`);
          } catch (publishError: any) {
            throw new Error(publishError.message || "Post created but failed to publish immediately");
          }
        }
        return result;
      } catch (error: any) {
        // Re-throw with a user-friendly message
        throw new Error(error.message || "Failed to create post");
      }
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
    setContentType("post");
    setMediaFiles([]);
    setPlatformSpecificData({});
    setIsDragging(false);
  };

  // Media file handling
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    
    const newFiles = Array.from(files).slice(0, maxMediaCount - mediaFiles.length);
    setMediaFiles(prev => [...prev, ...newFiles].slice(0, maxMediaCount));
  }, [maxMediaCount, mediaFiles.length]);

  const handleRemoveFile = useCallback((index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const getAcceptedFileTypes = useCallback(() => {
    const types: string[] = [];
    if (acceptedMediaTypes.includes('image') || acceptedMediaTypes.includes('carousel')) {
      types.push('image/jpeg', 'image/png', 'image/gif', 'image/webp');
    }
    if (acceptedMediaTypes.includes('video')) {
      types.push('video/mp4', 'video/quicktime', 'video/webm');
    }
    return types.join(',');
  }, [acceptedMediaTypes]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Update platform-specific field - applies to all platforms that use this field
  const updatePlatformSpecificField = useCallback((key: string, value: any) => {
    setPlatformSpecificData(prev => {
      const updated = { ...prev };
      // Apply this field value to all selected platforms that have this field
      selectedPlatforms.forEach(platform => {
        const fields = getPlatformSpecificFields(platform as SocialPlatform, contentType as ContentType);
        if (fields.some(f => f.key === key)) {
          if (!updated[platform]) {
            updated[platform] = {};
          }
          updated[platform][key] = value;
        }
      });
      return updated;
    });
  }, [selectedPlatforms, contentType]);
  
  // Get the current value for a field (from first platform that has it)
  const getFieldValue = useCallback((key: string) => {
    for (const platform of selectedPlatforms) {
      if (platformSpecificData[platform]?.[key] !== undefined) {
        return platformSpecificData[platform][key];
      }
    }
    return '';
  }, [selectedPlatforms, platformSpecificData]);

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
      const newPlatforms = selectedPlatforms.filter(p => p !== platformId);
      setSelectedPlatforms(newPlatforms);
      
      // Clear platformSpecificData for deselected platform
      setPlatformSpecificData(prev => {
        const updated = { ...prev };
        delete updated[platformId];
        return updated;
      });
      
      // Reset content type if no longer valid for remaining platforms
      if (newPlatforms.length > 0) {
        const newAvailableTypes = newPlatforms.reduce((common, platform) => {
          const types = getContentTypes(platform as SocialPlatform);
          if (common.length === 0) return types.map(t => t.id);
          return common.filter(id => types.some(t => t.id === id));
        }, [] as string[]);
        if (!newAvailableTypes.includes(contentType)) {
          setContentType(newAvailableTypes[0] || 'post');
        }
      }
    } else {
      const newPlatforms = [...selectedPlatforms, platformId];
      setSelectedPlatforms(newPlatforms);
      // Reset content type if no longer valid for new platforms
      const newAvailableTypes = newPlatforms.reduce((common, platform) => {
        const types = getContentTypes(platform as SocialPlatform);
        if (common.length === 0) return types.map(t => t.id);
        return common.filter(id => types.some(t => t.id === id));
      }, [] as string[]);
      if (!newAvailableTypes.includes(contentType)) {
        setContentType(newAvailableTypes[0] || 'post');
      }
    }
    // Clear media files when platforms change since requirements may differ
    setMediaFiles([]);
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
    
    // Check if media is required but not provided
    if (requiresMedia && mediaFiles.length === 0) {
      toast({
        title: "Media Required",
        description: `This content type requires ${acceptedMediaTypes.includes('video') ? 'a video' : 'an image'}.`,
        variant: "destructive",
      });
      return;
    }

    // Check for required platform-specific fields (per platform)
    const missingRequiredFields: string[] = [];
    selectedPlatforms.forEach(platform => {
      const fields = getPlatformSpecificFields(platform as SocialPlatform, contentType as ContentType);
      fields.forEach(field => {
        if (field.required && !platformSpecificData[platform]?.[field.key]) {
          const fieldLabel = `${field.label} (${platform})`;
          if (!missingRequiredFields.includes(fieldLabel)) {
            missingRequiredFields.push(fieldLabel);
          }
        }
      });
    });
    
    if (missingRequiredFields.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please fill in: ${missingRequiredFields.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    // Build the post data with new fields
    const postData = {
      platforms: selectedPlatforms,
      title: caption,
      hashtags,
      contentType,
      mediaItems: mediaFiles.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
      })),
      platformSpecificData,
      publishNow: postMode === "now",
      scheduledAt: undefined as string | undefined,
    };

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
      postData.scheduledAt = scheduledAt.toISOString();
    }

    createPostMutation.mutate(postData);
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
      // Support multi-platform posts: check if viewFilter matches any platform in the array
      const postPlatforms = post.platforms || [post.platform];
      const matchesPlatform = viewFilter === "all" || postPlatforms.includes(viewFilter);
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
                      // Get all platforms for this post
                      const postPlatforms = post.platforms || [post.platform];
                      return (
                        <button
                          key={post.id}
                          onClick={() => setSelectedPost(post)}
                          className="w-full text-left p-2 rounded border bg-card hover-elevate transition-all"
                          data-testid={`button-post-${post.id}`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            {/* Show all platform icons for multi-platform posts */}
                            <div className="flex -space-x-1">
                              {postPlatforms.slice(0, 3).map((platform, idx) => {
                                const Icon = PLATFORM_ICONS[platform];
                                return (
                                  <div 
                                    key={platform}
                                    className={`w-5 h-5 ${PLATFORM_COLORS[platform]} rounded flex items-center justify-center border border-background`}
                                    style={{ zIndex: 3 - idx }}
                                  >
                                    {Icon && <Icon className="w-3 h-3 text-white" />}
                                  </div>
                                );
                              })}
                              {postPlatforms.length > 3 && (
                                <div className="w-5 h-5 bg-muted rounded flex items-center justify-center border border-background text-[10px] font-medium">
                                  +{postPlatforms.length - 3}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(post.scheduledFor), "h:mm a")}
                            </span>
                          </div>
                          <p className="text-xs line-clamp-2">{post.caption}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <MediaTypeIcon type={post.contentType || post.mediaType} />
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
                  {/* Show all platform icons for multi-platform posts */}
                  {(() => {
                    const postPlatforms = selectedPost.platforms || [selectedPost.platform];
                    return (
                      <div className="flex -space-x-2">
                        {postPlatforms.map((platform, idx) => {
                          const Icon = PLATFORM_ICONS[platform];
                          return (
                            <div 
                              key={platform}
                              className={`w-10 h-10 ${PLATFORM_COLORS[platform]} rounded-lg flex items-center justify-center border-2 border-background`}
                              style={{ zIndex: postPlatforms.length - idx }}
                            >
                              {Icon && <Icon className="w-5 h-5 text-white" />}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <div>
                    <DialogTitle className="capitalize">
                      {(() => {
                        const postPlatforms = selectedPost.platforms || [selectedPost.platform];
                        if (postPlatforms.length === 1) {
                          return `${postPlatforms[0]} Post`;
                        }
                        return `Multi-Platform Post (${postPlatforms.length})`;
                      })()}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {format(parseISO(selectedPost.scheduledFor), "MMM d, yyyy 'at' h:mm a")}
                      {selectedPost.contentType && selectedPost.contentType !== 'post' && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {selectedPost.contentType.charAt(0).toUpperCase() + selectedPost.contentType.slice(1)}
                        </Badge>
                      )}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Media Items (for carousels/galleries) */}
                {selectedPost.mediaItems && selectedPost.mediaItems.length > 0 ? (
                  <div className={selectedPost.mediaItems.length === 1 ? "" : "grid grid-cols-2 gap-2"}>
                    {selectedPost.mediaItems.slice(0, 4).map((item, i) => (
                      <div key={i} className="aspect-video bg-muted rounded-lg overflow-hidden relative">
                        {item.type === "video" ? (
                          <video 
                            src={item.url} 
                            controls 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img 
                            src={item.url} 
                            alt={`Post media ${i + 1}`} 
                            className="w-full h-full object-cover"
                          />
                        )}
                        {i === 3 && selectedPost.mediaItems!.length > 4 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-medium">
                            +{selectedPost.mediaItems!.length - 4} more
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : selectedPost.mediaUrl && (
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

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={getStatusColor(selectedPost.status)}>
                    {selectedPost.status}
                  </Badge>
                  {selectedPost.aiGenerated && (
                    <Badge variant="outline">AI Generated</Badge>
                  )}
                  {/* Show target platforms */}
                  {selectedPost.platforms && selectedPost.platforms.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      Posting to: {selectedPost.platforms.join(', ')}
                    </span>
                  )}
                </div>
                
                {/* Platform-Specific Data (if available) */}
                {selectedPost.platformSpecificData && Object.keys(selectedPost.platformSpecificData).length > 0 && (
                  <div className="space-y-2">
                    <Separator />
                    <p className="text-xs font-medium text-muted-foreground">Platform Options</p>
                    <div className="space-y-2">
                      {Object.entries(selectedPost.platformSpecificData).map(([platform, fields]) => {
                        const PlatformIcon = PLATFORM_ICONS[platform];
                        const fieldEntries = Object.entries(fields as Record<string, any>).filter(([_, v]) => v !== null && v !== undefined && v !== '');
                        if (fieldEntries.length === 0) return null;
                        return (
                          <div key={platform} className="flex items-start gap-2 bg-muted/50 rounded p-2">
                            {PlatformIcon && (
                              <div className={`w-5 h-5 ${PLATFORM_COLORS[platform]} rounded flex items-center justify-center flex-shrink-0`}>
                                <PlatformIcon className="w-3 h-3 text-white" />
                              </div>
                            )}
                            <div className="text-xs space-y-1">
                              {fieldEntries.map(([key, value]) => (
                                <div key={key} className="flex gap-1">
                                  <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                  <span className="font-medium">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Post
            </DialogTitle>
            <DialogDescription>
              Create and schedule a post to your connected social media accounts.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* Platform Selection */}
              <div className="space-y-2">
                <Label>Select Platforms</Label>
                {connectedPlatformsList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No connected accounts. Please connect your social media accounts first.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
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

              {/* Content Type Selector */}
              {selectedPlatforms.length > 0 && availableContentTypes.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="content-type">Content Type</Label>
                  <Select 
                    value={contentType} 
                    onValueChange={(newContentType) => {
                      setContentType(newContentType);
                      setMediaFiles([]);
                      // Prune platformSpecificData to only keep fields valid for new content type
                      setPlatformSpecificData(prev => {
                        const pruned: Record<string, Record<string, any>> = {};
                        selectedPlatforms.forEach(platform => {
                          const validFields = getPlatformSpecificFields(platform as SocialPlatform, newContentType as ContentType);
                          const validKeys = validFields.map(f => f.key);
                          if (prev[platform]) {
                            pruned[platform] = {};
                            Object.entries(prev[platform]).forEach(([key, value]) => {
                              if (validKeys.includes(key)) {
                                pruned[platform][key] = value;
                              }
                            });
                          }
                        });
                        return pruned;
                      });
                    }}
                    data-testid="select-content-type"
                  >
                    <SelectTrigger id="content-type" data-testid="select-content-type-trigger">
                      <SelectValue placeholder="Select content type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableContentTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id} data-testid={`option-content-type-${type.id}`}>
                          <div className="flex items-center gap-2">
                            {type.id === 'video' || type.id === 'reel' || type.id === 'short' ? (
                              <Film className="w-4 h-4" />
                            ) : type.id === 'carousel' ? (
                              <ImageIcon className="w-4 h-4" />
                            ) : type.id === 'thread' ? (
                              <MessageSquare className="w-4 h-4" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                            <span>{type.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {currentContentTypeConfig && (
                    <p className="text-xs text-muted-foreground">
                      {currentContentTypeConfig.description}
                    </p>
                  )}
                </div>
              )}

              {/* Caption with Enhanced Character Counter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="caption">Caption</Label>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${caption.length > effectiveMaxCharacters ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      {caption.length} / {effectiveMaxCharacters}
                    </span>
                    {caption.length > effectiveMaxCharacters && (
                      <AlertCircle className="w-3 h-3 text-destructive" />
                    )}
                  </div>
                </div>
                <Textarea
                  id="caption"
                  placeholder="What's on your mind? Write your post content here..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className={`min-h-[100px] resize-none ${caption.length > effectiveMaxCharacters ? 'border-destructive' : ''}`}
                  data-testid="input-caption"
                />
                {selectedPlatforms.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Character limit based on: {selectedPlatforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                  </p>
                )}
              </div>

              {/* Media Upload Section */}
              {selectedPlatforms.length > 0 && currentContentTypeConfig && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      {acceptedMediaTypes.includes('video') ? (
                        <Film className="w-4 h-4" />
                      ) : (
                        <ImageIcon className="w-4 h-4" />
                      )}
                      Media
                      {requiresMedia && <span className="text-destructive">*</span>}
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {mediaFiles.length} / {maxMediaCount} file{maxMediaCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  {/* Drag and Drop Area */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                      isDragging 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    data-testid="dropzone-media"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={getAcceptedFileTypes()}
                      multiple={maxMediaCount > 1}
                      onChange={(e) => handleFileSelect(e.target.files)}
                      className="hidden"
                      data-testid="input-file-upload"
                    />
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {isDragging ? 'Drop files here' : 'Click or drag files to upload'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {acceptedMediaTypes.includes('video') && 'MP4, MOV, WebM'}
                      {acceptedMediaTypes.includes('video') && (acceptedMediaTypes.includes('image') || acceptedMediaTypes.includes('carousel')) && ' or '}
                      {(acceptedMediaTypes.includes('image') || acceptedMediaTypes.includes('carousel')) && 'JPG, PNG, GIF, WebP'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Max {maxMediaCount} file{maxMediaCount !== 1 ? 's' : ''}
                      {currentContentTypeConfig.maxVideoDuration && ` • Max ${Math.floor(currentContentTypeConfig.maxVideoDuration / 60)} min video`}
                    </p>
                  </div>

                  {/* File Previews */}
                  {mediaFiles.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {mediaFiles.map((file, index) => (
                        <div 
                          key={index} 
                          className="relative aspect-square rounded-lg overflow-hidden border bg-muted"
                          data-testid={`preview-media-${index}`}
                        >
                          {file.type.startsWith('video/') ? (
                            <video 
                              src={URL.createObjectURL(file)} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img 
                              src={URL.createObjectURL(file)} 
                              alt={`Preview ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile(index);
                            }}
                            className="absolute top-1 right-1 p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                            data-testid={`button-remove-media-${index}`}
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                          <div className="absolute bottom-1 left-1 right-1 text-[10px] text-white bg-black/50 rounded px-1 truncate">
                            {formatFileSize(file.size)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Platform-Specific Options */}
              {allPlatformSpecificFields.length > 0 && (
                <div className="space-y-4">
                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Platform Options</Label>
                    <p className="text-xs text-muted-foreground">
                      Configure platform-specific settings
                    </p>
                  </div>
                  
                  {allPlatformSpecificFields.map(({ field, platforms }) => (
                    <div key={field.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`field-${field.key}`} className="flex items-center gap-2">
                          {field.label}
                          {field.required && <span className="text-destructive">*</span>}
                        </Label>
                        <div className="flex items-center gap-1">
                          {platforms.map(platform => {
                            const PlatformIcon = PLATFORM_ICONS[platform];
                            return PlatformIcon ? (
                              <div 
                                key={platform}
                                className={`w-5 h-5 ${PLATFORM_COLORS[platform]} rounded flex items-center justify-center`}
                                title={platform}
                              >
                                <PlatformIcon className="w-3 h-3 text-white" />
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                      
                      {/* Render different field types */}
                      {field.type === 'text' && (
                        <Input
                          id={`field-${field.key}`}
                          placeholder={field.placeholder}
                          maxLength={field.maxLength}
                          value={getFieldValue(field.key) || ''}
                          onChange={(e) => updatePlatformSpecificField(field.key, e.target.value)}
                          data-testid={`input-${field.key}`}
                        />
                      )}
                      
                      {field.type === 'textarea' && (
                        <Textarea
                          id={`field-${field.key}`}
                          placeholder={field.placeholder}
                          maxLength={field.maxLength}
                          value={getFieldValue(field.key) || ''}
                          onChange={(e) => updatePlatformSpecificField(field.key, e.target.value)}
                          className="min-h-[80px] resize-none"
                          data-testid={`textarea-${field.key}`}
                        />
                      )}
                      
                      {field.type === 'select' && field.options && (
                        <Select 
                          value={getFieldValue(field.key) || ''} 
                          onValueChange={(value) => updatePlatformSpecificField(field.key, value)}
                        >
                          <SelectTrigger data-testid={`select-${field.key}`}>
                            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center gap-2">
                                  {option.value.includes('PUBLIC') || option.value === 'public' ? (
                                    <Globe className="w-3 h-3" />
                                  ) : option.value.includes('PRIVATE') || option.value === 'private' ? (
                                    <Lock className="w-3 h-3" />
                                  ) : null}
                                  {option.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      {field.type === 'toggle' && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{field.helpText}</span>
                          <Switch
                            id={`field-${field.key}`}
                            checked={getFieldValue(field.key) || false}
                            onCheckedChange={(checked) => updatePlatformSpecificField(field.key, checked)}
                            data-testid={`switch-${field.key}`}
                          />
                        </div>
                      )}
                      
                      {field.helpText && field.type !== 'toggle' && (
                        <p className="text-xs text-muted-foreground">{field.helpText}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

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
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
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
              disabled={
                createPostMutation.isPending || 
                !caption.trim() || 
                selectedPlatforms.length === 0 ||
                caption.length > effectiveMaxCharacters ||
                (requiresMedia && mediaFiles.length === 0)
              }
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
