import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Calendar, Sparkles, Trash2, Play, Copy, RotateCw, Maximize2, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Generation } from "@shared/schema";
import { useLocation } from "wouter";

interface GenerationCardProps {
  generation: Generation;
}

export function GenerationCard({ generation }: GenerationCardProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  
  const statusColors = {
    pending: "secondary",
    processing: "default",
    completed: "default",
    failed: "destructive",
  } as const;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/generations/${generation.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Generation deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete generation",
        variant: "destructive",
      });
    },
  });

  const handleDownload = async () => {
    if (!generation.resultUrl) return;
    
    try {
      const response = await fetch(generation.resultUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `artivio-${generation.type}-${generation.id}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download started",
        description: "Your file is being downloaded",
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download failed",
        description: "Could not download the file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this generation? This cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generation.prompt);
    toast({
      title: "Copied",
      description: "Prompt copied to clipboard",
    });
  };

  const handleRegenerate = () => {
    // Navigate to the appropriate generation page with the prompt pre-filled
    const typeRoutes: Record<string, string> = {
      video: '/video',
      image: '/image',
      music: '/music',
    };
    
    const route = typeRoutes[generation.type];
    if (route) {
      // Store the prompt in sessionStorage to pre-fill the form
      sessionStorage.setItem('regeneratePrompt', generation.prompt);
      sessionStorage.setItem('regenerateModel', generation.model);
      setLocation(route);
    }
  };

  const handlePlayVideo = () => {
    if (generation.type === 'video' && generation.resultUrl) {
      setShowVideoDialog(true);
    }
  };

  return (
    <>
      <Card className="overflow-hidden hover-elevate">
        <CardHeader className="space-y-2 pb-4">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-2">{generation.prompt}</CardTitle>
            <Badge variant={statusColors[generation.status as keyof typeof statusColors]} className="shrink-0">
              {generation.status}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {generation.resultUrl && generation.status === 'completed' && (
            <div className="relative aspect-video rounded-md bg-muted overflow-hidden group">
              {generation.type === 'video' && (
                <>
                  <video 
                    src={generation.resultUrl}
                    className="w-full h-full object-cover"
                    data-testid={`video-result-${generation.id}`}
                    poster={generation.resultUrl}
                  />
                  <div 
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={handlePlayVideo}
                  >
                    <div className="bg-white/90 rounded-full p-4 hover:bg-white transition-colors">
                      <Play className="h-8 w-8 text-black fill-black" />
                    </div>
                  </div>
                </>
              )}
              {generation.type === 'image' && (
                <img 
                  src={generation.resultUrl} 
                  alt={generation.prompt} 
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => window.open(generation.resultUrl, '_blank')}
                  data-testid={`img-result-${generation.id}`}
                />
              )}
              {generation.type === 'music' && (
                <div className="flex items-center justify-center h-full bg-gradient-to-br from-purple-900/20 to-blue-900/20">
                  <audio 
                    src={generation.resultUrl} 
                    controls 
                    className="w-full px-4"
                    data-testid={`audio-result-${generation.id}`}
                  />
                </div>
              )}
            </div>
          )}
          
          {!generation.resultUrl && generation.status === 'completed' && (
            <div className="aspect-video rounded-md bg-muted flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No result available</p>
            </div>
          )}

          {(generation.status === 'pending' || generation.status === 'processing') && (
            <div className="aspect-video rounded-md bg-muted flex items-center justify-center">
              <div className="text-center space-y-2">
                <Sparkles className="h-8 w-8 animate-pulse text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Generating...</p>
              </div>
            </div>
          )}

          {generation.status === 'failed' && (
            <div className="aspect-video rounded-md bg-destructive/10 flex items-center justify-center">
              <p className="text-sm text-destructive">Generation failed</p>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span>{generation.model}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{formatDistanceToNow(new Date(generation.createdAt), { addSuffix: true })}</span>
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col gap-3 pt-4">
          <div className="flex justify-between items-center w-full">
            <span className="text-sm text-muted-foreground">
              {generation.creditsCost} credits
            </span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowDetailsDialog(true)}
              data-testid={`button-details-${generation.id}`}
            >
              <Info className="h-4 w-4 mr-1" />
              Details
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 w-full">
            {generation.status === 'completed' && generation.resultUrl && (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownload}
                  className="w-full"
                  data-testid={`button-download-${generation.id}`}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCopyPrompt}
                  className="w-full"
                  data-testid={`button-copy-${generation.id}`}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 w-full">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRegenerate}
              className="w-full"
              data-testid={`button-regenerate-${generation.id}`}
            >
              <RotateCw className="h-4 w-4 mr-1" />
              Regenerate
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="w-full text-destructive hover:text-destructive"
              data-testid={`button-delete-${generation.id}`}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Full Screen Video Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="line-clamp-2">{generation.prompt}</DialogTitle>
            <DialogDescription>
              {generation.model} • {formatDistanceToNow(new Date(generation.createdAt), { addSuffix: true })}
            </DialogDescription>
          </DialogHeader>
          {generation.resultUrl && (
            <div className="aspect-video rounded-lg overflow-hidden bg-black">
              <video 
                src={generation.resultUrl}
                controls
                autoPlay
                className="w-full h-full"
                data-testid={`video-dialog-${generation.id}`}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generation Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Prompt</h4>
              <p className="text-sm text-muted-foreground">{generation.prompt}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-1">Type</h4>
                <p className="text-sm text-muted-foreground capitalize">{generation.type}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">Model</h4>
                <p className="text-sm text-muted-foreground">{generation.model}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">Status</h4>
                <Badge variant={statusColors[generation.status as keyof typeof statusColors]}>
                  {generation.status}
                </Badge>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">Credits Used</h4>
                <p className="text-sm text-muted-foreground">{generation.creditsCost}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">Created</h4>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(generation.createdAt), { addSuffix: true })}
                </p>
              </div>
              {generation.statusDetail && (
                <div className="col-span-2">
                  <h4 className="text-sm font-medium mb-1">Status Detail</h4>
                  <p className="text-sm text-muted-foreground">{generation.statusDetail}</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
