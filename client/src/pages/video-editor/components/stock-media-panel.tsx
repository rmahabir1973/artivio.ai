import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Video, Music, Plus, Loader2, Play, Pause, Clock, Download, Star, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface StockVideo {
  id: string;
  source: 'pixabay' | 'pexels';
  thumbnailUrl: string;
  previewUrl: string;
  videoUrl: string;
  hdUrl?: string;
  width: number;
  height: number;
  duration: number;
  tags: string;
  user: string;
  userUrl: string;
  pageUrl: string;
}

interface StockAudio {
  id: string;
  source: 'freesound' | 'pixabay';
  title: string;
  description?: string;
  audioUrl: string;
  previewUrl: string;
  duration: number;
  tags: string;
  user: string;
  userUrl: string;
  pageUrl?: string;
  license?: string;
  rating?: number;
  downloads?: number;
  category: string;
}

interface StockMediaPanelProps {
  onAddVideo: (video: { id: string; url: string; thumbnailUrl: string; title: string; source: string; duration: number }) => void;
  onAddAudio: (audio: { id: string; url: string; title: string; source: string; duration: number }) => void;
}

export function StockMediaPanel({ onAddVideo, onAddAudio }: StockMediaPanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'videos' | 'audio'>('videos');
  const [videoQuery, setVideoQuery] = useState('');
  const [audioQuery, setAudioQuery] = useState('');
  const [videoSearchTerm, setVideoSearchTerm] = useState('');
  const [audioSearchTerm, setAudioSearchTerm] = useState('');
  const [videoPage, setVideoPage] = useState(1);
  const [audioPage, setAudioPage] = useState(1);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio on unmount or tab change
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  // Stop audio when switching to videos tab
  useEffect(() => {
    if (activeTab === 'videos' && audioRef.current) {
      audioRef.current.pause();
      setPlayingAudioId(null);
    }
  }, [activeTab]);

  const handleAudioPreview = useCallback((audio: StockAudio) => {
    if (playingAudioId === audio.id) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const newAudio = new Audio(audio.previewUrl);
      newAudio.volume = 0.5;
      newAudio.onended = () => {
        setPlayingAudioId(null);
      };
      newAudio.play().catch(console.error);
      audioRef.current = newAudio;
      setPlayingAudioId(audio.id);
    }
  }, [playingAudioId]);

  const { data: videoResults, isLoading: videosLoading, isFetching: videosFetching } = useQuery({
    queryKey: ['/api/stock-videos/search', videoSearchTerm, videoPage],
    queryFn: async () => {
      if (!videoSearchTerm) return { videos: [], totalPixabay: 0, totalPexels: 0 };
      const response = await fetchWithAuth(`/api/stock-videos/search?q=${encodeURIComponent(videoSearchTerm)}&page=${videoPage}&per_page=12`);
      return response.json();
    },
    enabled: !!videoSearchTerm,
    staleTime: 5 * 60 * 1000,
  });

  const { data: audioResults, isLoading: audioLoading, isFetching: audioFetching } = useQuery({
    queryKey: ['/api/stock-audio/search', audioSearchTerm, audioPage],
    queryFn: async () => {
      if (!audioSearchTerm) return { audio: [], total: 0 };
      const response = await fetchWithAuth(`/api/stock-audio/search?q=${encodeURIComponent(audioSearchTerm)}&page=${audioPage}&per_page=15`);
      return response.json();
    },
    enabled: !!audioSearchTerm,
    staleTime: 5 * 60 * 1000,
  });

  const downloadVideoMutation = useMutation({
    mutationFn: async (video: StockVideo) => {
      const response = await fetchWithAuth('/api/stock-videos/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: video.source,
          videoId: video.id,
          videoUrl: video.hdUrl || video.videoUrl,
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration,
          width: video.width,
          height: video.height,
          title: video.tags?.split(',')[0] || 'Stock Video',
        }),
      });
      return response.json();
    },
    onSuccess: (data, video) => {
      onAddVideo({
        id: video.id,
        url: data.url,
        thumbnailUrl: video.thumbnailUrl,
        title: video.tags?.split(',')[0] || 'Stock Video',
        source: video.source,
        duration: video.duration,
      });
    },
    onError: (error: any) => {
      toast({ title: "Download Failed", description: error.message || "Failed to download video", variant: "destructive" });
    },
  });

  const downloadAudioMutation = useMutation({
    mutationFn: async (audio: StockAudio) => {
      const response = await fetchWithAuth('/api/stock-audio/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: audio.source,
          audioId: audio.id,
          audioUrl: audio.audioUrl,
          title: audio.title,
          duration: audio.duration,
        }),
      });
      return response.json();
    },
    onSuccess: (data, audio) => {
      onAddAudio({
        id: audio.id,
        url: data.url,
        title: audio.title,
        source: audio.source,
        duration: audio.duration,
      });
    },
    onError: (error: any) => {
      toast({ title: "Download Failed", description: error.message || "Failed to download audio", variant: "destructive" });
    },
  });

  const handleVideoSearch = useCallback(() => {
    if (videoQuery.trim()) {
      setVideoSearchTerm(videoQuery.trim());
      setVideoPage(1);
    }
  }, [videoQuery]);

  const handleAudioSearch = useCallback(() => {
    if (audioQuery.trim()) {
      setAudioSearchTerm(audioQuery.trim());
      setAudioPage(1);
    }
  }, [audioQuery]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const videos = videoResults?.videos || [];
  const audioTracks = audioResults?.audio || [];

  return (
    <div className="space-y-3" data-testid="stock-media-panel">
      <p className="text-sm text-muted-foreground">Search free stock videos from Pexels/Pixabay and sounds from Freesound</p>
      
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'videos' | 'audio')}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="videos" className="gap-1" data-testid="tab-stock-videos">
            <Video className="h-3.5 w-3.5" />
            Videos
          </TabsTrigger>
          <TabsTrigger value="audio" className="gap-1" data-testid="tab-stock-audio">
            <Music className="h-3.5 w-3.5" />
            Audio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="mt-3 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search videos..."
              value={videoQuery}
              onChange={(e) => setVideoQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVideoSearch()}
              className="h-8 text-sm"
              data-testid="input-stock-video-search"
            />
            <Button 
              size="sm" 
              onClick={handleVideoSearch} 
              disabled={!videoQuery.trim() || videosFetching}
              data-testid="button-stock-video-search"
            >
              {videosFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {!videoSearchTerm && (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Search for stock videos</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Try: nature, city, technology, business</p>
            </div>
          )}

          {videosLoading && (
            <div className="grid grid-cols-2 gap-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="aspect-video rounded-md" />
              ))}
            </div>
          )}

          {videoSearchTerm && !videosLoading && videos.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-xs">No videos found for "{videoSearchTerm}"</p>
            </div>
          )}

          {videos.length > 0 && (
            <ScrollArea className="h-[400px]">
              <div className="grid grid-cols-2 gap-2 pr-3">
                {videos.map((video: StockVideo) => (
                  <div
                    key={`${video.source}-${video.id}`}
                    className="relative aspect-video rounded-md overflow-hidden border bg-muted group cursor-pointer"
                    onMouseEnter={() => setHoveredVideo(video.id)}
                    onMouseLeave={() => setHoveredVideo(null)}
                    data-testid={`stock-video-${video.id}`}
                  >
                    {hoveredVideo === video.id && video.previewUrl ? (
                      <video
                        src={video.previewUrl}
                        className="w-full h-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    ) : (
                      <img
                        src={video.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                    
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                            {video.source}
                          </Badge>
                          <span className="text-[10px] text-white/80 flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDuration(video.duration)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs gap-1"
                        onClick={() => downloadVideoMutation.mutate(video)}
                        disabled={downloadVideoMutation.isPending}
                        data-testid={`button-add-stock-video-${video.id}`}
                      >
                        {downloadVideoMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Plus className="h-3 w-3" />
                            Add
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {(videoResults?.totalPixabay > 12 || videoResults?.totalPexels > 12) && (
                <div className="flex justify-center gap-2 mt-3 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVideoPage(p => Math.max(1, p - 1))}
                    disabled={videoPage === 1 || videosFetching}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground self-center">Page {videoPage}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVideoPage(p => p + 1)}
                    disabled={videos.length < 12 || videosFetching}
                  >
                    Next
                  </Button>
                </div>
              )}
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="audio" className="mt-3 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search audio/music..."
              value={audioQuery}
              onChange={(e) => setAudioQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAudioSearch()}
              className="h-8 text-sm"
              data-testid="input-stock-audio-search"
            />
            <Button 
              size="sm" 
              onClick={handleAudioSearch} 
              disabled={!audioQuery.trim() || audioFetching}
              data-testid="button-stock-audio-search"
            >
              {audioFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {!audioSearchTerm && (
            <div className="text-center py-8 text-muted-foreground">
              <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Search for stock audio & music</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Try: ambient, upbeat, cinematic, relaxing</p>
            </div>
          )}

          {audioLoading && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-md" />
              ))}
            </div>
          )}

          {audioSearchTerm && !audioLoading && audioTracks.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-xs">No sounds found for "{audioSearchTerm}"</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Try different keywords like: nature, music, ambient</p>
            </div>
          )}

          {audioTracks.length > 0 && (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-3">
                {audioTracks.map((audio: StockAudio) => (
                  <div
                    key={`${audio.source}-${audio.id}`}
                    className="flex items-center gap-2 p-2 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors group"
                    data-testid={`stock-audio-${audio.id}`}
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "flex-shrink-0 w-8 h-8 rounded-full",
                        playingAudioId === audio.id ? "bg-primary text-primary-foreground" : "bg-primary/10"
                      )}
                      onClick={() => handleAudioPreview(audio)}
                      data-testid={`button-preview-audio-${audio.id}`}
                    >
                      {playingAudioId === audio.id ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5 ml-0.5" />
                      )}
                    </Button>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{audio.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDuration(audio.duration)}
                        </span>
                        <span>•</span>
                        <span className="truncate">{audio.user}</span>
                        {audio.rating && audio.rating > 3 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-amber-500">
                              <Star className="h-2.5 w-2.5 fill-current" />
                              {audio.rating.toFixed(1)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {audio.pageUrl && (
                        <a
                          href={audio.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-muted"
                          title="View on Freesound"
                        >
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => downloadAudioMutation.mutate(audio)}
                        disabled={downloadAudioMutation.isPending}
                        data-testid={`button-add-stock-audio-${audio.id}`}
                      >
                        {downloadAudioMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {audioResults?.total && audioResults.total > 15 && (
                <div className="flex justify-center gap-2 mt-3 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAudioPage(p => Math.max(1, p - 1))}
                    disabled={audioPage === 1 || audioFetching}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground self-center">Page {audioPage}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAudioPage(p => p + 1)}
                    disabled={audioTracks.length < 15 || audioFetching}
                  >
                    Next
                  </Button>
                </div>
              )}

              <div className="mt-3 pt-2 border-t text-center">
                <p className="text-[9px] text-muted-foreground">
                  Sounds from{' '}
                  <a 
                    href="https://freesound.org" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Freesound.org
                  </a>
                  {' '}(Creative Commons). Click the link icon to view attribution.
                </p>
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
