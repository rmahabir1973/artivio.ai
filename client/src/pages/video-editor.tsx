import { useState, useRef, useEffect } from "react";
import { LivePlayerProvider } from "@twick/live-player";
import { TwickStudio } from "@twick/studio";
import { TimelineProvider, INITIAL_TIMELINE_DATA } from "@twick/timeline";
import "@twick/studio/dist/studio.css";
import { SidebarInset } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { Loader2, Download, Film, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function VideoEditor() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  
  // Ref for tracking abort controller and mounted state
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleExportVideo = async (project: any, videoSettings: any) => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return { status: false, message: "Please sign in to export videos" };
    }

    // Create abort controller for this export
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsExporting(true);
    setExportProgress("Preparing export...");
    setExportedVideoUrl(null);

    try {
      setExportProgress("Sending to cloud renderer...");
      
      const response = await apiRequest("POST", "/api/video-editor/export", {
        project,
        videoSettings,
      });
      
      const data = await response.json();
      
      if (data.status === "processing") {
        setExportProgress("Rendering video in the cloud...");
        
        const pollForResult = async (jobId: string): Promise<any> => {
          const maxAttempts = 60;
          let attempts = 0;
          
          while (attempts < maxAttempts && !signal.aborted) {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(resolve, 5000);
              signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new Error('Export cancelled'));
              });
            });
            
            if (!isMountedRef.current || signal.aborted) {
              throw new Error('Export cancelled');
            }
            
            attempts++;
            setExportProgress(`Rendering... (${Math.min(attempts * 5, 95)}%)`);
            
            const statusResponse = await apiRequest("GET", `/api/video-editor/export/${jobId}`);
            const statusData = await statusResponse.json();
            
            if (statusData.status === "completed") {
              return statusData;
            } else if (statusData.status === "failed") {
              throw new Error(statusData.error || "Export failed");
            }
          }
          
          throw new Error("Export timed out");
        };
        
        const result = await pollForResult(data.jobId);
        
        if (isMountedRef.current) {
          setExportedVideoUrl(result.downloadUrl);
          toast({
            title: "Export Complete!",
            description: "Your video is ready to download.",
          });
        }
        
        return { status: true, message: "Video exported successfully" };
      }
      
      if (data.downloadUrl) {
        if (isMountedRef.current) {
          setExportedVideoUrl(data.downloadUrl);
          toast({
            title: "Export Complete!",
            description: "Your video is ready to download.",
          });
        }
        return { status: true, message: "Video exported successfully" };
      }
      
      throw new Error("Unexpected response from export service");
    } catch (error: any) {
      if (error.message !== 'Export cancelled' && isMountedRef.current) {
        toast({
          title: "Export Failed",
          description: error.message || "Failed to export video",
          variant: "destructive",
        });
      }
      return { status: false, message: error.message || "Failed to export video" };
    } finally {
      if (isMountedRef.current) {
        setIsExporting(false);
        setExportProgress(null);
      }
      abortControllerRef.current = null;
    }
  };

  return (
    <SidebarInset>
      <div className="flex flex-col h-full w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Film className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Video Editor</h1>
          </div>
          
          {exportedVideoUrl && (
            <a
              href={exportedVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              data-testid="button-download-video"
            >
              <Download className="h-4 w-4" />
              Download Video
            </a>
          )}
        </div>

        {/* Export Progress Overlay */}
        {isExporting && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card border rounded-lg p-8 text-center space-y-4 max-w-md">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Exporting Video</h3>
                <p className="text-muted-foreground">{exportProgress}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                This may take a few minutes depending on video length.
              </p>
            </div>
          </div>
        )}

        {/* Info Alert for Guests */}
        {!isAuthenticated && (
          <Alert className="m-4 border-blue-500/50 bg-blue-500/10">
            <AlertCircle className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              You're exploring as a guest. Sign in to save projects and export videos.
            </AlertDescription>
          </Alert>
        )}

        {/* Twick Studio */}
        <div className="flex-1 relative" data-testid="video-editor-container">
          <LivePlayerProvider>
            <TimelineProvider
              initialData={INITIAL_TIMELINE_DATA}
              contextId="artivio-video-editor"
            >
              <TwickStudio
                studioConfig={{
                  videoProps: {
                    width: 1920,
                    height: 1080,
                  },
                  timelineTickConfigs: [
                    { durationThreshold: 30, majorInterval: 5, minorTicks: 5 },
                    { durationThreshold: 300, majorInterval: 30, minorTicks: 6 },
                  ],
                  timelineZoomConfig: {
                    min: 0.5,
                    max: 2.0,
                    step: 0.25,
                    default: 1.0,
                  },
                  exportVideo: handleExportVideo,
                }}
              />
            </TimelineProvider>
          </LivePlayerProvider>
        </div>

        {/* Guest Modal */}
        <GuestGenerateModal
          open={showGuestModal}
          onOpenChange={setShowGuestModal}
          featureName="Video Editor"
        />
      </div>
    </SidebarInset>
  );
}
