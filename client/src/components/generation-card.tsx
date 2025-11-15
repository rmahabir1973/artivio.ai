import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Calendar, Sparkles, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Generation } from "@shared/schema";

interface GenerationCardProps {
  generation: Generation;
}

export function GenerationCard({ generation }: GenerationCardProps) {
  const { toast } = useToast();
  
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
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this generation? This cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  return (
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
          <div className="aspect-video rounded-md bg-muted overflow-hidden">
            {generation.type === 'video' && (
              <video 
                src={generation.resultUrl} 
                controls 
                className="w-full h-full object-cover"
                data-testid={`video-result-${generation.id}`}
              />
            )}
            {generation.type === 'image' && (
              <img 
                src={generation.resultUrl} 
                alt={generation.prompt} 
                className="w-full h-full object-cover"
                data-testid={`img-result-${generation.id}`}
              />
            )}
            {generation.type === 'music' && (
              <audio 
                src={generation.resultUrl} 
                controls 
                className="w-full"
                data-testid={`audio-result-${generation.id}`}
              />
            )}
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
      
      <CardFooter className="flex justify-between items-center gap-2 pt-4">
        <span className="text-sm text-muted-foreground">
          {generation.creditsCost} credits
        </span>
        <div className="flex gap-2">
          {generation.status === 'completed' && generation.resultUrl && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDownload}
              data-testid={`button-download-${generation.id}`}
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            data-testid={`button-delete-${generation.id}`}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
