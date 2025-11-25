import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface VideoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl?: string;
  title?: string;
}

export function VideoModal({ isOpen, onOpenChange, videoUrl, title }: VideoModalProps) {
  if (!videoUrl) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 bg-black border-0">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-2 right-2 z-50 p-2 hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Close video"
        >
          <X className="h-6 w-6 text-white" />
        </button>
        <div className="relative w-full aspect-video">
          <iframe
            src={videoUrl}
            className="w-full h-full rounded-lg"
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title={title}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
