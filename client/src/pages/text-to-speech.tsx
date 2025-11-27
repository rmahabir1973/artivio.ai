import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { SidebarInset } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { 
  Search, 
  Download, 
  ChevronDown, 
  Loader2, 
  Play, 
  Pause, 
  Heart, 
  User, 
  X,
  RefreshCw,
  Mic
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { GuestGenerateModal } from "@/components/guest-generate-modal";

interface FishAudioVoice {
  _id: string;
  type: string;
  title: string;
  description?: string;
  cover_image?: string;
  state: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  visibility: string;
  like_count: number;
  mark_count: number;
  shared_count: number;
  task_count: number;
  languages?: string[];
  author?: {
    _id: string;
    nickname: string;
    avatar: string;
  };
}

interface ListVoicesResponse {
  total: number;
  items: FishAudioVoice[];
}

interface MyVoice {
  voiceId: string;
  name: string;
  description?: string;
  isActive: boolean;
  provider: string;
  createdAt: string;
}

const MAX_CHARS = 30000;
const PAGE_SIZE = 20;

export default function TextToSpeech() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { getModelCost } = usePricing();

  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<FishAudioVoice | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("library");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [volume, setVolume] = useState([0]);
  const [speed, setSpeed] = useState([1.0]);
  const [temperature, setTemperature] = useState([0.9]);
  const [topP, setTopP] = useState([0.9]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showGuestModal, setShowGuestModal] = useState(false);

  const {
    data: voicesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: voicesLoading,
  } = useInfiniteQuery({
    queryKey: ["/api/fish-audio/voices", searchQuery],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page_size: PAGE_SIZE.toString(),
        page_number: pageParam.toString(),
        sort_by: "score",
      });
      if (searchQuery.trim()) {
        params.set("title", searchQuery.trim());
      }
      const response = await fetch(`/api/fish-audio/voices?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch voices");
      }
      return response.json() as Promise<ListVoicesResponse>;
    },
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((acc, page) => acc + page.items.length, 0);
      if (totalFetched < lastPage.total) {
        return allPages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const { data: myVoices = [], isLoading: myVoicesLoading } = useQuery<MyVoice[]>({
    queryKey: ["/api/fish-audio/my-voices"],
    enabled: isAuthenticated,
  });

  const allVoices = voicesData?.pages.flatMap(page => page.items) || [];
  const totalVoices = voicesData?.pages[0]?.total || 0;

  const generateMutation = useMutation({
    mutationFn: async (params: {
      text: string;
      referenceId: string;
      temperature: number;
      topP: number;
      speed: number;
      volume: number;
    }) => {
      const response = await fetch("/api/fish-audio/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "TTS generation failed");
      }
      
      const audioBlob = await response.blob();
      return URL.createObjectURL(audioBlob);
    },
    onSuccess: (url) => {
      setAudioUrl(url);
      toast({
        title: "Speech Generated",
        description: "Your audio is ready to play!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {});
      }
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate speech",
        variant: "destructive",
      });
    },
  });

  const handleSelectVoice = useCallback((voice: FishAudioVoice) => {
    setSelectedVoice(voice);
  }, []);

  const handleSelectMyVoice = useCallback((voice: MyVoice) => {
    setSelectedVoice({
      _id: voice.voiceId,
      type: "tts",
      title: voice.name,
      description: voice.description,
      state: voice.isActive ? "trained" : "inactive",
      tags: [],
      created_at: voice.createdAt,
      updated_at: voice.createdAt,
      visibility: "private",
      like_count: 0,
      mark_count: 0,
      shared_count: 0,
      task_count: 0,
    });
  }, []);

  const handleGenerate = () => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }

    if (!text.trim()) {
      toast({
        title: "Text Required",
        description: "Please enter text to convert to speech.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedVoice) {
      toast({
        title: "Voice Required",
        description: "Please select a voice from the library.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      text: text.trim(),
      referenceId: selectedVoice._id,
      temperature: temperature[0],
      topP: topP[0],
      speed: speed[0],
      volume: volume[0],
    });
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `tts_${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const creditsCost = getModelCost("fish-audio-tts", 20);

  return (
    <SidebarInset>
      <div className="h-full overflow-y-auto">
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold" data-testid="text-heading">Text to Speech</h1>
            <p className="text-muted-foreground">Generate natural-sounding speech using Fish.Audio's 200K+ voice library</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <Textarea
                    placeholder="Enter the text you want to convert to speech..."
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                    className="min-h-48 resize-none text-base"
                    maxLength={MAX_CHARS}
                    data-testid="textarea-text-input"
                  />
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      {text.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setText("")}
                          data-testid="button-clear-text"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground" data-testid="text-char-count">
                      {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mic className="h-5 w-5" />
                    Select Voice
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="library" data-testid="tab-library">
                        Voice Library ({totalVoices.toLocaleString()}+)
                      </TabsTrigger>
                      <TabsTrigger value="my-voices" data-testid="tab-my-voices">
                        My Voices ({myVoices.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="library" className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search voices by name..."
                          value={searchQuery}
                          onChange={handleSearchChange}
                          className="pl-9"
                          data-testid="input-search-voices"
                        />
                      </div>

                      <ScrollArea className="h-80">
                        {voicesLoading ? (
                          <div className="flex items-center justify-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                        ) : allVoices.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                            <Mic className="h-10 w-10 mb-2" />
                            <p>No voices found</p>
                            {searchQuery && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSearchQuery("")}
                                className="mt-2"
                              >
                                Clear search
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2 pr-4">
                            {allVoices.map((voice) => (
                              <VoiceCard
                                key={voice._id}
                                voice={voice}
                                isSelected={selectedVoice?._id === voice._id}
                                onClick={() => handleSelectVoice(voice)}
                              />
                            ))}
                            
                            {hasNextPage && (
                              <div className="pt-4 flex justify-center">
                                <Button
                                  variant="outline"
                                  onClick={() => fetchNextPage()}
                                  disabled={isFetchingNextPage}
                                  data-testid="button-load-more"
                                >
                                  {isFetchingNextPage ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      Loading...
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="h-4 w-4 mr-2" />
                                      Load More Voices
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="my-voices" className="space-y-4">
                      {!isAuthenticated ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                          <User className="h-10 w-10 mb-2" />
                          <p>Sign in to use your cloned voices</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => setShowGuestModal(true)}
                          >
                            Sign In
                          </Button>
                        </div>
                      ) : myVoicesLoading ? (
                        <div className="flex items-center justify-center h-40">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      ) : myVoices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                          <Mic className="h-10 w-10 mb-2" />
                          <p>No cloned voices yet</p>
                          <p className="text-sm">Create a voice clone to use here</p>
                        </div>
                      ) : (
                        <ScrollArea className="h-80">
                          <div className="space-y-2 pr-4">
                            {myVoices.filter(v => v.isActive).map((voice) => (
                              <div
                                key={voice.voiceId}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover-elevate ${
                                  selectedVoice?._id === voice.voiceId
                                    ? "border-primary bg-primary/5"
                                    : "border-border"
                                }`}
                                onClick={() => handleSelectMyVoice(voice)}
                                data-testid={`voice-card-my-${voice.voiceId}`}
                              >
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback>
                                    {voice.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{voice.name}</p>
                                  {voice.description && (
                                    <p className="text-sm text-muted-foreground truncate">
                                      {voice.description}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="secondary" className="shrink-0">
                                  My Voice
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Voice</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedVoice ? (
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        {selectedVoice.cover_image ? (
                          <AvatarImage src={selectedVoice.cover_image} alt={selectedVoice.title} />
                        ) : null}
                        <AvatarFallback className="text-lg">
                          {selectedVoice.title.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate" data-testid="text-selected-voice">
                          {selectedVoice.title}
                        </p>
                        {selectedVoice.author && (
                          <p className="text-sm text-muted-foreground truncate">
                            by {selectedVoice.author.nickname}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedVoice(null)}
                        data-testid="button-clear-voice"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-4 text-muted-foreground">
                      <p className="text-sm">Select a voice from the library</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CardHeader className="pb-3">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
                        data-testid="button-toggle-advanced"
                      >
                        <CardTitle className="text-lg">Advanced Settings</CardTitle>
                        <ChevronDown className={`h-5 w-5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Label>Volume</Label>
                          <span className="text-sm text-muted-foreground" data-testid="text-volume-value">
                            {volume[0] > 0 ? `+${volume[0]}` : volume[0]}
                          </span>
                        </div>
                        <Slider
                          value={volume}
                          onValueChange={setVolume}
                          min={-10}
                          max={10}
                          step={1}
                          data-testid="slider-volume"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>-10</span>
                          <span>10</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Label>Speed</Label>
                          <span className="text-sm text-muted-foreground" data-testid="text-speed-value">
                            {speed[0].toFixed(1)}x
                          </span>
                        </div>
                        <Slider
                          value={speed}
                          onValueChange={setSpeed}
                          min={0.5}
                          max={1.2}
                          step={0.1}
                          data-testid="slider-speed"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0.5x</span>
                          <span>1.2x</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Label>Temperature</Label>
                          <span className="text-sm text-muted-foreground" data-testid="text-temp-value">
                            {temperature[0].toFixed(2)}
                          </span>
                        </div>
                        <Slider
                          value={temperature}
                          onValueChange={setTemperature}
                          min={0.7}
                          max={1.0}
                          step={0.01}
                          data-testid="slider-temperature"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0.7</span>
                          <span>1.0</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Label>Top P</Label>
                          <span className="text-sm text-muted-foreground" data-testid="text-topp-value">
                            {topP[0].toFixed(2)}
                          </span>
                        </div>
                        <Slider
                          value={topP}
                          onValueChange={setTopP}
                          min={0.7}
                          max={0.99}
                          step={0.01}
                          data-testid="slider-topp"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0.7</span>
                          <span>0.99</span>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {audioUrl && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Generated Audio</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      onEnded={() => setIsPlaying(false)}
                      onPause={() => setIsPlaying(false)}
                      onPlay={() => setIsPlaying(true)}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={togglePlayback}
                        className="flex-1"
                        data-testid="button-toggle-playback"
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Play
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleDownload}
                        data-testid="button-download-audio"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !text.trim() || !selectedVoice}
                className="w-full h-12"
                size="lg"
                data-testid="button-generate"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Generate & Play ({creditsCost} credits)
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="Text to Speech"
      />
    </SidebarInset>
  );
}

function VoiceCard({
  voice,
  isSelected,
  onClick,
}: {
  voice: FishAudioVoice;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover-elevate ${
        isSelected ? "border-primary bg-primary/5" : "border-border"
      }`}
      onClick={onClick}
      data-testid={`voice-card-${voice._id}`}
    >
      <Avatar className="h-12 w-12 shrink-0">
        {voice.cover_image ? (
          <AvatarImage src={voice.cover_image} alt={voice.title} />
        ) : null}
        <AvatarFallback className="text-lg">
          {voice.title.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{voice.title}</p>
        </div>
        {voice.author && (
          <p className="text-sm text-muted-foreground truncate">
            by {voice.author.nickname}
          </p>
        )}
        {voice.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {voice.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs px-1.5 py-0">
                {tag}
              </Badge>
            ))}
            {voice.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{voice.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 text-muted-foreground shrink-0">
        <Heart className="h-3.5 w-3.5" />
        <span className="text-xs">{formatNumber(voice.like_count)}</span>
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}
