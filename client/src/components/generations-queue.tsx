import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Download, 
  RefreshCw,
  Eye,
  ExternalLink,
  History as HistoryIcon
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface Generation {
  id: string;
  type: string;
  model: string;
  prompt: string;
  status: string;
  resultUrl: string | null;
  errorMessage: string | null;
  creditsCost: number;
  createdAt: string;
  completedAt: string | null;
  generationType?: string | null;
  referenceImages?: string[] | null;
  parameters?: any;
}

export function GenerationsQueue() {
  const { toast } = useToast();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch recent generations (last 10)
  const { data: generations = [], isLoading } = useQuery<Generation[]>({
    queryKey: ["/api/generations"],
    refetchInterval: autoRefresh ? 10000 : false, // Auto-refresh every 10 seconds
  });

  // Get in-progress and recent generations
  const inProgress = generations.filter(g => g.status === 'pending' || g.status === 'processing');
  const recent = generations
    .filter(g => g.status === 'completed' || g.status === 'failed')
    .slice(0, 5);

  // Disable auto-refresh if no in-progress generations
  useEffect(() => {
    if (inProgress.length === 0 && autoRefresh) {
      setAutoRefresh(false);
    } else if (inProgress.length > 0 && !autoRefresh) {
      setAutoRefresh(true);
    }
  }, [inProgress.length, autoRefresh]);

  const retryMutation = useMutation({
    mutationFn: async (generationId: string) => {
      const generation = generations.find(g => g.id === generationId);
      if (!generation) throw new Error("Generation not found");
      
      // Resubmit with full original parameters
      const endpoint = `/api/generate/${generation.type}`;
      const payload: any = {
        model: generation.model,
        prompt: generation.prompt,
      };

      // Include generation-specific fields if present
      if (generation.generationType) {
        payload.generationType = generation.generationType;
      }
      if (generation.referenceImages && generation.referenceImages.length > 0) {
        payload.referenceImages = generation.referenceImages;
      }
      if (generation.parameters) {
        payload.parameters = generation.parameters;
      }

      console.log('Retrying generation with payload:', payload);
      return await apiRequest("POST", endpoint, payload);
    },
    onSuccess: () => {
      toast({
        title: "Generation Restarted",
        description: "Your generation has been queued again.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
    },
    onError: (error: Error) => {
      console.error('Retry failed:', error);
      toast({
        title: "Retry Failed",
        description: error.message || "Failed to restart generation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Complete</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="bg-primary/10 text-primary">Processing</Badge>;
      case 'pending':
        return <Badge variant="outline">Queued</Badge>;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      video: '🎬',
      image: '🖼️',
      music: '🎵',
    };
    return icons[type] || '📄';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Generations Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5 text-primary" />
              Recent Generations
              {inProgress.length > 0 && (
                <Badge variant="secondary" className="ml-2">{inProgress.length} in progress</Badge>
              )}
            </CardTitle>
            <CardDescription>Track your AI generations in real-time</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/generations"] })}
            data-testid="button-refresh-queue"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* In-Progress Generations */}
        {inProgress.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm font-semibold">Processing Now</p>
            </div>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {inProgress.map((gen) => (
                  <div
                    key={gen.id}
                    className="p-3 rounded-lg border bg-muted/30 space-y-2"
                    data-testid={`generation-${gen.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{getTypeIcon(gen.type)}</span>
                          <Badge variant="outline" className="text-xs">{gen.model}</Badge>
                          {getStatusBadge(gen.status)}
                        </div>
                        <p className="text-sm line-clamp-1 text-muted-foreground">{gen.prompt}</p>
                      </div>
                    </div>
                    <Progress value={gen.status === 'processing' ? 60 : 30} className="h-1" />
                    <p className="text-xs text-muted-foreground">
                      Started {formatDistanceToNow(new Date(gen.createdAt))} ago
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Recent Completed/Failed */}
        {recent.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Recent Activity</p>
              <Button
                variant="ghost"
                size="sm"
                asChild
                data-testid="button-view-all-history"
              >
                <a href="/history">
                  View All
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            </div>
            <div className="space-y-2">
              {recent.map((gen) => (
                <div
                  key={gen.id}
                  className="p-3 rounded-lg border hover-elevate flex items-center justify-between gap-3"
                  data-testid={`generation-complete-${gen.id}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getStatusIcon(gen.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{getTypeIcon(gen.type)}</span>
                        <p className="text-sm font-medium line-clamp-1">{gen.prompt}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{gen.model}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {gen.completedAt 
                            ? formatDistanceToNow(new Date(gen.completedAt)) + ' ago'
                            : formatDistanceToNow(new Date(gen.createdAt)) + ' ago'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {gen.status === 'completed' && gen.resultUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        data-testid={`button-download-${gen.id}`}
                      >
                        <a href={gen.resultUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {gen.status === 'failed' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => retryMutation.mutate(gen.id)}
                        disabled={retryMutation.isPending}
                        data-testid={`button-retry-${gen.id}`}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {inProgress.length === 0 && recent.length === 0 && (
          <div className="text-center py-8">
            <HistoryIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-2">No generations yet</p>
            <p className="text-xs text-muted-foreground/70">
              Start creating amazing content with AI!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
