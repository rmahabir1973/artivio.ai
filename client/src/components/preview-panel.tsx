import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ExternalLink, Eye, FileVideo, FileImage, FileAudio, AlertCircle, Lightbulb } from "lucide-react";

interface ParsedError {
  message: string;
  recommendation?: string;
  errorType?: string;
}

function parseErrorMessage(errorMessage: string | null | undefined): ParsedError {
  if (!errorMessage) {
    return { message: 'Generation failed' };
  }
  
  try {
    const parsed = JSON.parse(errorMessage);
    if (parsed._type === 'DETAILED_ERROR') {
      return {
        message: parsed.message || 'Generation failed',
        recommendation: parsed.recommendation,
        errorType: parsed.errorType,
      };
    }
  } catch (e) {
    // Not JSON, treat as plain text
  }
  
  return { message: errorMessage };
}

interface PreviewPanelProps {
  title?: string;
  description?: string;
  status?: "idle" | "generating" | "completed" | "failed";
  resultUrl?: string | null;
  resultType?: "video" | "image" | "audio" | "text";
  errorMessage?: string | null;
  emptyStateMessage?: string;
  customContent?: ReactNode;
  onDownload?: () => void;
  onView?: () => void;
}

export function PreviewPanel({
  title = "Preview",
  description = "Your generated content will appear here",
  status = "idle",
  resultUrl,
  resultType = "video",
  errorMessage,
  emptyStateMessage = "No content generated yet. Configure your settings and click Generate to get started.",
  customContent,
  onDownload,
  onView,
}: PreviewPanelProps) {
  const getStatusBadge = () => {
    switch (status) {
      case "generating":
        return <Badge variant="secondary" data-testid="preview-status-generating">Generating...</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600" data-testid="preview-status-completed">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive" data-testid="preview-status-failed">Failed</Badge>;
      default:
        return null;
    }
  };

  const getIcon = () => {
    switch (resultType) {
      case "video":
        return <FileVideo className="h-12 w-12 text-muted-foreground" />;
      case "image":
        return <FileImage className="h-12 w-12 text-muted-foreground" />;
      case "audio":
        return <FileAudio className="h-12 w-12 text-muted-foreground" />;
      default:
        return <Eye className="h-12 w-12 text-muted-foreground" />;
    }
  };

  const renderContent = () => {
    if (customContent) {
      return customContent;
    }

    if (status === "failed") {
      const parsedError = parseErrorMessage(errorMessage);
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-destructive">Generation Failed</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4" data-testid="error-message">
            {parsedError.message}
          </p>
          {parsedError.recommendation && (
            <div className="bg-muted/50 rounded-lg p-4 max-w-md text-left" data-testid="error-recommendation">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium mb-1">Tip for next time:</p>
                  <p className="text-sm text-muted-foreground">{parsedError.recommendation}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (status === "generating") {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="animate-pulse mb-4">{getIcon()}</div>
          <h3 className="text-lg font-semibold mb-2">Generating Content</h3>
          <p className="text-sm text-muted-foreground">This may take a few moments...</p>
        </div>
      );
    }

    if (status === "completed" && resultUrl) {
      return (
        <div className="flex flex-col h-full p-4">
          <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden mb-4">
            {resultType === "video" && (
              <video
                src={resultUrl}
                controls
                preload="auto"
                playsInline
                className="max-w-full max-h-full"
                data-testid="preview-video"
              >
                Your browser does not support the video tag.
              </video>
            )}
            {resultType === "image" && (
              <img
                src={resultUrl}
                alt="Generated content"
                className="max-w-full max-h-full object-contain"
                data-testid="preview-image"
              />
            )}
            {resultType === "audio" && (
              <audio
                src={resultUrl}
                controls
                className="w-full"
                data-testid="preview-audio"
              >
                Your browser does not support the audio tag.
              </audio>
            )}
          </div>
          <div className="flex gap-2">
            {onDownload && (
              <Button
                onClick={onDownload}
                className="flex-1"
                data-testid="button-download-preview"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
            {onView && (
              <Button
                onClick={onView}
                variant="outline"
                data-testid="button-view-preview"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="mb-4">{getIcon()}</div>
        <h3 className="text-lg font-semibold mb-2">No Preview Available</h3>
        <p className="text-sm text-muted-foreground max-w-md">{emptyStateMessage}</p>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold" data-testid="preview-title">{title}</h2>
          {getStatusBadge()}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground" data-testid="preview-description">{description}</p>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}
