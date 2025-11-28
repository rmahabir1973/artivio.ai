import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { getPlaybackEmbedUrl, detectProvider } from "@/lib/videoProvider";
import { useMemo } from "react";

interface VideoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl?: string;
  title?: string;
}

export function VideoModal({ isOpen, onOpenChange, videoUrl, title }: VideoModalProps) {
  const embedUrl = useMemo(() => {
    if (!videoUrl) return null;
    return getPlaybackEmbedUrl(videoUrl);
  }, [videoUrl]);

  const provider = useMemo(() => {
    if (!videoUrl) return 'unknown';
    return detectProvider(videoUrl);
  }, [videoUrl]);

  if (!videoUrl || !embedUrl) {
    return null;
  }

  const iframeAllow = provider === 'vimeo' 
    ? "autoplay; fullscreen; picture-in-picture"
    : "autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 bg-black border-0">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-2 right-2 z-50 p-2 hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Close video"
          data-testid="button-close-video-modal"
        >
          <X className="h-6 w-6 text-white" />
        </button>
        <div className="relative w-full aspect-video">
          <iframe
            src={embedUrl}
            className="w-full h-full rounded-lg"
            frameBorder="0"
            allow={iframeAllow}
            allowFullScreen
            title={title}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
