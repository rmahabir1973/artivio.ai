import { Play, Loader2, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PreviewSurfaceProps {
  previewUrl: string | null;
  isGenerating: boolean;
  clipCount: number;
  totalDuration: number;
  onGeneratePreview: () => void;
  className?: string;
}

export function PreviewSurface({ 
  previewUrl, 
  isGenerating, 
  clipCount, 
  totalDuration,
  onGeneratePreview,
  className 
}: PreviewSurfaceProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  return (
    <div className={cn("flex flex-col h-full bg-muted/20 rounded-lg", className)} data-testid="preview-surface">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Preview</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {clipCount > 0 && (
            <>
              <span>{clipCount} clip{clipCount !== 1 ? 's' : ''}</span>
              <span className="text-muted-foreground/50">|</span>
              <span>{formatDuration(totalDuration)}</span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-4">
        {previewUrl ? (
          <video
            src={previewUrl}
            controls
            className="max-w-full max-h-full rounded-lg shadow-lg"
            data-testid="preview-video"
          />
        ) : clipCount > 0 ? (
          <div className="text-center space-y-4">
            <div className="h-32 w-48 mx-auto rounded-lg bg-muted/50 flex items-center justify-center">
              <Film className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {clipCount} clip{clipCount !== 1 ? 's' : ''} ready to preview
              </p>
              <Button 
                onClick={onGeneratePreview}
                disabled={isGenerating}
                data-testid="button-generate-preview"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Generate Preview
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <Film className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Add clips to preview your video
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
