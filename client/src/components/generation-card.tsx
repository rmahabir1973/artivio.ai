import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Download, Calendar, Sparkles, Trash2, Play, Copy, RotateCw, Maximize2, Info, Eye, EyeOff, Volume2, Mic, Music, FileAudio, MessageSquare, QrCode, Users, Edit3, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Generation } from "@shared/schema";
import { useLocation } from "wouter";
import { UpscaleModal } from "@/components/upscale-modal";
import { fetchWithAuth } from "@/lib/authBridge";

interface GenerationCardProps {
  generation: Generation;
}

// Get fallback display for types without preview images
const getFallbackDisplay = (type: string): { icon: React.ReactNode; bgColor: string; label: string } => {
  const fallbacks: Record<string, { icon: React.ReactNode; bgColor: string; label: string }> = {
    'sound-effect': { icon: <Volume2 className="h-12 w-12" />, bgColor: 'from-orange-900/20 to-red-900/20', label: 'Sound Effect' },
    'text-to-speech': { icon: <Volume2 className="h-12 w-12" />, bgColor: 'from-blue-900/20 to-cyan-900/20', label: 'Text-to-Speech' },
    'voice-clone': { icon: <Mic className="h-12 w-12" />, bgColor: 'from-purple-900/20 to-pink-900/20', label: 'Voice Clone' },
    'speech-to-text': { icon: <Mic className="h-12 w-12" />, bgColor: 'from-indigo-900/20 to-blue-900/20', label: 'Speech-to-Text' },
    'analyze-image': { icon: <Zap className="h-12 w-12" />, bgColor: 'from-yellow-900/20 to-orange-900/20', label: 'Image Analysis' },
    'audio-converter': { icon: <FileAudio className="h-12 w-12" />, bgColor: 'from-green-900/20 to-teal-900/20', label: 'Audio Converter' },
    'talking-avatar': { icon: <Users className="h-12 w-12" />, bgColor: 'from-rose-900/20 to-pink-900/20', label: 'Talking Avatar' },
    'qr-generator': { icon: <QrCode className="h-12 w-12" />, bgColor: 'from-slate-900/20 to-gray-900/20', label: 'QR Code' },
    'chat': { icon: <MessageSquare className="h-12 w-12" />, bgColor: 'from-emerald-900/20 to-green-900/20', label: 'Chat' },
    'video-editor': { icon: <Edit3 className="h-12 w-12" />, bgColor: 'from-fuchsia-900/20 to-purple-900/20', label: 'Video Editor' },
  };
  
  return fallbacks[type] || { icon: <Music className="h-12 w-12" />, bgColor: 'from-gray-900/20 to-slate-900/20', label: 'Generated Content' };
};

export function GenerationCard({ generation }: GenerationCardProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUpscaleModal, setShowUpscaleModal] = useState(false);
  const [showShowcaseDialog, setShowShowcaseDialog] = useState(false);
  
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
      // Invalidate ALL /api/generations queries (including paginated ones with different query keys)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/generations');
        }
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete generation",
        variant: "destructive",
      });
    },
  });

  const showcaseMutation = useMutation({
    mutationFn: async (isShowcase: boolean) => {
      return await apiRequest("POST", `/api/generations/${generation.id}/showcase`, { isShowcase });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: data.message,
      });
      // Invalidate ALL /api/generations queries (including paginated ones with different query keys)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/generations');
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/showcase-videos"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update showcase status",
        variant: "destructive",
      });
    },
  });

  const handleDownload = async () => {
    if (!generation.resultUrl) return;
    
    try {
      // Use the backend proxy endpoint to avoid CORS issues
      // fetchWithAuth automatically adds Authorization header and retries on 401
      const response = await fetchWithAuth(`/api/generations/${generation.id}/download`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extract filename from Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      a.download = filenameMatch?.[1] || `artivio-${generation.type}-${generation.id}`;
      
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
      
      // Handle session expiration
      if (error instanceof Error && error.message === "SESSION_EXPIRED") {
        toast({
          title: "Session expired",
          description: "Please log in again to continue",
          variant: "destructive",
        });
        setTimeout(() => window.location.href = "/login", 1500);
        return;
      }
      
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Could not download the file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteConfirm = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleShowcaseToggle = () => {
    showcaseMutation.mutate(!generation.isShowcase);
    setShowShowcaseDialog(false);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generation.prompt);
    toast({
      title: "Copied",
      description: "Prompt copied to clipboard",
    });
  };

  // Supported types for regeneration
  const typeRoutes: Record<string, string> = {
    video: '/generate/video',
    image: '/generate/image',
    music: '/generate/music',
  };
  
  const canRegenerate = generation.type in typeRoutes;
  
  const handleRegenerate = () => {
    const route = typeRoutes[generation.type];
    if (route) {
      // Store the prompt and seed in sessionStorage to pre-fill the form
      sessionStorage.setItem('regeneratePrompt', generation.prompt);
      sessionStorage.setItem('regenerateModel', generation.model);
      if (generation.seed) {
        sessionStorage.setItem('regenerateSeed', generation.seed.toString());
      }
      setLocation(route);
    }
  };

  const handleReuseSeed = () => {
    const route = typeRoutes[generation.type];
    if (route && generation.seed) {
      // Store only the seed in sessionStorage to pre-fill the form
      sessionStorage.setItem('regenerateSeed', generation.seed.toString());
      toast({
        title: "Seed Ready",
        description: `Seed ${generation.seed} is ready to use in your next generation`,
      });
      setLocation(route);
    }
  };

  const handlePlayVideo = () => {
    if (generation.type === 'video' && generation.resultUrl) {
      setShowVideoDialog(true);
    }
  };

  const canUpscale = generation.status === 'completed' && 
                     generation.resultUrl && 
                     (generation.type === 'image' || generation.type === 'video') &&
                     generation.processingStage !== 'upscale';

  return (
    <>
      <Card className="overflow-hidden hover-elevate">
        <CardHeader className="space-y-2 pb-4">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-2">{generation.prompt}</CardTitle>
            <div className="flex gap-2 shrink-0">
              {generation.processingStage === 'upscale' && (
                <Badge variant="secondary" className="flex items-center gap-1" data-testid={`badge-upscaled-${generation.id}`}>
                  <Maximize2 className="h-3 w-3" />
                  Upscaled
                </Badge>
              )}
              <Badge variant={statusColors[generation.status as keyof typeof statusColors]}>
                {generation.status}
              </Badge>
            </div>
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
                    poster={generation.thumbnailUrl || generation.resultUrl}
                    preload="metadata"
                    playsInline
                  />
                  <div 
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={handlePlayVideo}
                    data-testid={`video-overlay-${generation.id}`}
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
                  onClick={() => generation.resultUrl && window.open(generation.resultUrl, '_blank')}
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
              {generation.type === 'sound-effect' && (
                <div className="flex items-center justify-center h-full bg-gradient-to-br from-orange-900/20 to-red-900/20">
                  <audio 
                    src={generation.resultUrl} 
                    controls 
                    className="w-full px-4"
                    data-testid={`audio-result-${generation.id}`}
                  />
                </div>
              )}
              {generation.type === 'text-to-speech' && (
                <div className="flex items-center justify-center h-full bg-gradient-to-br from-blue-900/20 to-cyan-900/20">
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
          
          {!generation.resultUrl && generation.status === 'completed' && (() => {
            const fallback = getFallbackDisplay(generation.type);
            return (
              <div className={`aspect-video rounded-md bg-gradient-to-br ${fallback.bgColor} flex flex-col items-center justify-center`}>
                <div className="text-muted-foreground opacity-70">
                  {fallback.icon}
                </div>
                <p className="text-sm text-muted-foreground mt-2">{fallback.label}</p>
              </div>
            );
          })()}

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
          
          {generation.seed && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono bg-muted px-2 py-1 rounded" data-testid={`seed-value-${generation.id}`}>
                Seed: {generation.seed}
              </span>
            </div>
          )}
          
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

          <div className={`grid ${canUpscale ? 'grid-cols-3' : 'grid-cols-2'} gap-2 w-full`}>
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
                {canUpscale && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowUpscaleModal(true)}
                    className="w-full"
                    data-testid={`button-upscale-${generation.id}`}
                  >
                    <Maximize2 className="h-4 w-4 mr-1" />
                    Upscale
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Showcase toggle for completed videos */}
          {generation.status === 'completed' && generation.type === 'video' && generation.resultUrl && (
            <Button 
              variant={generation.isShowcase ? "default" : "outline"}
              size="sm"
              onClick={() => setShowShowcaseDialog(true)}
              disabled={showcaseMutation.isPending}
              className="w-full"
              data-testid={`button-showcase-${generation.id}`}
            >
              {generation.isShowcase ? (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  In Showcase
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 mr-1" />
                  Add to Showcase
                </>
              )}
            </Button>
          )}

          <div className={
            canRegenerate && generation.seed 
              ? "grid grid-cols-3 gap-2 w-full" 
              : canRegenerate 
                ? "grid grid-cols-2 gap-2 w-full" 
                : "w-full"
          }>
            {canRegenerate && (
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
            )}
            {generation.seed && canRegenerate && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleReuseSeed}
                className="w-full"
                data-testid={`button-reuse-seed-${generation.id}`}
              >
                <Copy className="h-4 w-4 mr-1" />
                Use Seed
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteMutation.isPending}
              className="w-full text-destructive hover:text-destructive"
              data-testid={`button-delete-${generation.id}`}
            >
              {generation.status === 'processing' || generation.status === 'pending' ? (
                <>
                  <RotateCw className="h-4 w-4 mr-1" />
                  Cancel
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </>
              )}
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
              {generation.parentGenerationId && (
                <div className="col-span-2">
                  <h4 className="text-sm font-medium mb-1">Parent Generation</h4>
                  <p className="text-sm text-muted-foreground font-mono">{generation.parentGenerationId}</p>
                  <p className="text-xs text-muted-foreground mt-1">This is an upscaled version of another generation</p>
                </div>
              )}
              {generation.processingStage && (
                <div className="col-span-2">
                  <h4 className="text-sm font-medium mb-1">Processing Stage</h4>
                  <Badge variant={generation.processingStage === 'upscale' ? 'secondary' : 'outline'}>
                    {generation.processingStage === 'upscale' ? 'Upscaled Content' : 'Original Generation'}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete/Cancel Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {generation.status === 'processing' || generation.status === 'pending' 
                ? "Cancel Generation?" 
                : "Delete Generation?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {generation.status === 'processing' || generation.status === 'pending'
                ? `This will cancel the generation and refund ${generation.creditsCost} credits back to your account.`
                : "Are you sure you want to delete this generation? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`button-cancel-delete-${generation.id}`}>
              Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid={`button-confirm-delete-${generation.id}`}
            >
              {deleteMutation.isPending 
                ? (generation.status === 'processing' || generation.status === 'pending' ? "Cancelling..." : "Deleting...")
                : (generation.status === 'processing' || generation.status === 'pending' ? "Cancel Generation" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Showcase Confirmation Dialog */}
      <AlertDialog open={showShowcaseDialog} onOpenChange={setShowShowcaseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {generation.isShowcase ? "Remove from Showcase?" : "Add to Showcase?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {generation.isShowcase 
                ? "This will remove your video from the public showcase on the Video Models page."
                : "This will display your video on the public Video Models showcase page. Your video will be visible to all visitors."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`button-cancel-showcase-${generation.id}`}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleShowcaseToggle}
              disabled={showcaseMutation.isPending}
              data-testid={`button-confirm-showcase-${generation.id}`}
            >
              {showcaseMutation.isPending 
                ? "Updating..." 
                : generation.isShowcase 
                  ? "Remove from Showcase" 
                  : "Add to Showcase"
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upscale Modal */}
      {canUpscale && generation.resultUrl && (
        <UpscaleModal
          open={showUpscaleModal}
          onOpenChange={setShowUpscaleModal}
          contentType={generation.type as 'image' | 'video'}
          sourceUrl={generation.resultUrl}
          parentGenerationId={generation.id}
          onSuccess={() => {
            toast({
              title: "Success",
              description: "Check the generation queue to track your upscale progress",
            });
          }}
        />
      )}
    </>
  );
}
