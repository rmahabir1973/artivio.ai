import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Video, Plus, X, ArrowUp, ArrowDown, Combine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Generation {
  id: string;
  type: string;
  status: string;
  model: string;
  prompt: string;
  resultUrl: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface VideoCombination {
  id: string;
  sourceVideoIds: string[];
  outputPath: string | null;
  status: string;
  errorMessage: string | null;
  creditsCost: number;
  durationSeconds: number | null;
  createdAt: string;
  completedAt: string | null;
}

export default function VideoEditor() {
  const { toast } = useToast();
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [showSelectionMode, setShowSelectionMode] = useState(true);

  // Fetch user's completed video generations
  const { data: generations = [], isLoading: loadingGenerations } = useQuery<Generation[]>({
    queryKey: ['/api/generations'],
  });

  // Fetch user's video combinations
  const { data: combinations = [], isLoading: loadingCombinations } = useQuery<VideoCombination[]>({
    queryKey: ['/api/video-combinations'],
  });

  // Filter only completed videos
  const availableVideos = generations.filter(
    g => g.type === 'video' && g.status === 'completed' && g.resultUrl
  );

  // Combine videos mutation
  const combineMutation = useMutation({
    mutationFn: async (videoIds: string[]) => {
      return await apiRequest('POST', '/api/combine-videos', { videoIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-combinations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: "Video Combination Started",
        description: "Your videos are being combined. This may take a few minutes.",
      });
      // Reset selection
      setSelectedVideoIds([]);
      setShowSelectionMode(false);
    },
    onError: (error: any) => {
      toast({
        title: "Combination Failed",
        description: error.message || "Failed to start video combination",
        variant: "destructive",
      });
    },
  });

  const handleToggleVideo = (videoId: string) => {
    if (selectedVideoIds.includes(videoId)) {
      setSelectedVideoIds(selectedVideoIds.filter(id => id !== videoId));
    } else {
      if (selectedVideoIds.length >= 20) {
        toast({
          title: "Maximum Reached",
          description: "You can combine up to 20 videos at once",
          variant: "destructive",
        });
        return;
      }
      setSelectedVideoIds([...selectedVideoIds, videoId]);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const newOrder = [...selectedVideoIds];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setSelectedVideoIds(newOrder);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < selectedVideoIds.length - 1) {
      const newOrder = [...selectedVideoIds];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setSelectedVideoIds(newOrder);
    }
  };

  const handleRemoveFromSelection = (videoId: string) => {
    setSelectedVideoIds(selectedVideoIds.filter(id => id !== videoId));
  };

  const handleCombine = () => {
    if (selectedVideoIds.length < 2) {
      toast({
        title: "Selection Required",
        description: "Please select at least 2 videos to combine",
        variant: "destructive",
      });
      return;
    }
    combineMutation.mutate(selectedVideoIds);
  };

  const getVideoById = (id: string) => {
    return availableVideos.find(v => v.id === id);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      processing: "default",
      completed: "default",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "default"} data-testid={`badge-status-${status}`}>{status}</Badge>;
  };

  if (loadingGenerations) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-heading">Video Editor</h1>
        <p className="text-muted-foreground">Combine multiple AI-generated videos into longer content</p>
      </div>

      {/* Selection Panel */}
      {showSelectionMode && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Select Videos</CardTitle>
            <CardDescription>Choose 2-20 videos to combine (in order)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableVideos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No completed videos available for combination</p>
                <p className="text-sm mt-2">Generate some videos first!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableVideos.map((video) => {
                  const isSelected = selectedVideoIds.includes(video.id);
                  const selectionIndex = selectedVideoIds.indexOf(video.id);

                  return (
                    <Card
                      key={video.id}
                      className={`cursor-pointer transition-all hover-elevate ${
                        isSelected ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => handleToggleVideo(video.id)}
                      data-testid={`card-video-${video.id}`}
                    >
                      <CardContent className="p-4 space-y-2">
                        <div className="aspect-video bg-muted rounded-md overflow-hidden">
                          {video.resultUrl && (
                            <video
                              src={video.resultUrl}
                              className="w-full h-full object-cover"
                              controls={false}
                              muted
                            />
                          )}
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{video.model}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{video.prompt}</p>
                          </div>
                          {isSelected && (
                            <Badge variant="default" data-testid={`badge-order-${selectionIndex + 1}`}>
                              #{selectionIndex + 1}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {selectedVideoIds.length > 0 && (
              <div className="sticky bottom-0 bg-background border-t pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {selectedVideoIds.length} video{selectedVideoIds.length !== 1 ? 's' : ''} selected
                  </p>
                  <Button 
                    onClick={() => setShowSelectionMode(false)}
                    data-testid="button-continue"
                  >
                    Continue to Arrange <ArrowDown className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Arrangement Panel */}
      {!showSelectionMode && selectedVideoIds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Arrange Order</CardTitle>
            <CardDescription>Drag to reorder your videos before combining</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {selectedVideoIds.map((videoId, index) => {
                const video = getVideoById(videoId);
                if (!video) return null;

                return (
                  <div
                    key={videoId}
                    className="flex items-center gap-3 p-3 bg-muted rounded-md"
                    data-testid={`row-selected-video-${index}`}
                  >
                    <div className="flex flex-col gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        data-testid={`button-move-up-${index}`}
                        className="h-6 w-6"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === selectedVideoIds.length - 1}
                        data-testid={`button-move-down-${index}`}
                        className="h-6 w-6"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                    </div>

                    <Badge variant="outline" data-testid={`badge-position-${index + 1}`}>#{index + 1}</Badge>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{video.model}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{video.prompt}</p>
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveFromSelection(videoId)}
                      data-testid={`button-remove-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Button 
                variant="outline" 
                onClick={() => setShowSelectionMode(true)}
                data-testid="button-back"
              >
                Back to Selection
              </Button>
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Cost: <span className="font-bold text-foreground">75 credits</span>
                </p>
                <Button
                  onClick={handleCombine}
                  disabled={combineMutation.isPending || selectedVideoIds.length < 2}
                  data-testid="button-combine"
                >
                  {combineMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Combining...
                    </>
                  ) : (
                    <>
                      <Combine className="mr-2 w-4 h-4" />
                      Combine Videos
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Combinations History */}
      <Card>
        <CardHeader>
          <CardTitle>Your Video Combinations</CardTitle>
          <CardDescription>Previously combined videos</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCombinations ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : combinations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No video combinations yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {combinations.map((combo) => (
                <div
                  key={combo.id}
                  className="flex items-center gap-4 p-4 bg-muted rounded-md"
                  data-testid={`combination-${combo.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusBadge(combo.status)}
                      <Badge variant="outline">
                        {combo.sourceVideoIds.length} videos
                      </Badge>
                      {combo.durationSeconds && (
                        <Badge variant="outline">
                          {combo.durationSeconds}s
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created: {formatDate(combo.createdAt)}
                    </p>
                    {combo.errorMessage && (
                      <p className="text-xs text-destructive mt-1">{combo.errorMessage}</p>
                    )}
                  </div>

                  {combo.status === 'completed' && combo.outputPath && (
                    <div className="flex gap-2">
                      <a
                        href={combo.outputPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`link-view-${combo.id}`}
                      >
                        <Button size="sm">
                          <Video className="mr-2 w-3 h-3" />
                          View
                        </Button>
                      </a>
                      <a
                        href={combo.outputPath}
                        download
                        data-testid={`link-download-${combo.id}`}
                      >
                        <Button size="sm" variant="outline">
                          Download
                        </Button>
                      </a>
                    </div>
                  )}

                  {combo.status === 'processing' && (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
