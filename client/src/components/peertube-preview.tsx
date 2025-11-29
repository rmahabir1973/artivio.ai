import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Library, Sparkles, Play } from "lucide-react";
import { normalizeVideoUrl } from "@/lib/videoProvider";
import { Link } from "wouter";

interface PeerTubePreviewProps {
  pageType: "video" | "image" | "transition" | "sora" | "grok" | "sound-effects" | "music" | "voice-clone" | "lip-sync" | "tts" | "upscaler" | "video-upscaler" | "bg-remover";
  title?: string;
  description?: string;
  showGeneratingMessage?: boolean;
}

const PAGE_TYPE_TO_FIELD: Record<PeerTubePreviewProps["pageType"], string> = {
  "video": "previewVideoVideo",
  "image": "previewVideoImage",
  "transition": "previewVideoTransition",
  "sora": "previewVideoSora",
  "grok": "previewVideoGrok",
  "sound-effects": "previewVideoSoundEffects",
  "music": "previewVideoMusic",
  "voice-clone": "previewVideoVoiceClone",
  "lip-sync": "previewVideoLipSync",
  "tts": "previewVideoTts",
  "upscaler": "previewVideoUpscaler",
  "video-upscaler": "previewVideoVideoUpscaler",
  "bg-remover": "previewVideoBgRemover",
};

export function PeerTubePreview({
  pageType,
  title = "Preview",
  description = "See what's possible with AI",
  showGeneratingMessage = false,
}: PeerTubePreviewProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  const { data: homeContent } = useQuery<any>({
    queryKey: ["/api/home-content"],
  });

  useEffect(() => {
    if (homeContent) {
      const fieldName = PAGE_TYPE_TO_FIELD[pageType];
      const rawUrl = homeContent[fieldName];
      if (rawUrl) {
        const result = normalizeVideoUrl(rawUrl);
        if (result.success && result.info) {
          setEmbedUrl(result.info.embedUrl);
        }
      }
    }
  }, [homeContent, pageType]);

  return (
    <div className="sticky top-4 h-fit">
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500" />
        
        <div className="relative bg-gradient-to-br from-[#0f0f1e]/95 via-[#0a0a15]/95 to-[#050510]/95 rounded-2xl border border-purple-500/20 overflow-hidden backdrop-blur-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/20 to-transparent">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500 blur-md opacity-50" />
                <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                  <Play className="w-4 h-4 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="text-xs text-purple-300/70">{description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-purple-300/70">Live Demo</span>
            </div>
          </div>

          <div className="relative aspect-video bg-gradient-to-br from-[#0a0a15] to-[#050510]">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title="Preview Video"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full" />
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/30 to-violet-600/30 border border-purple-500/30 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-purple-400" />
                  </div>
                </div>
                <p className="text-sm text-purple-300/70 text-center px-6">
                  Preview video coming soon
                </p>
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-[#050510]/80 via-transparent to-transparent pointer-events-none" />
          </div>

          {showGeneratingMessage && (
            <div className="px-5 py-4 border-t border-purple-500/20 bg-gradient-to-r from-purple-900/30 via-violet-900/20 to-transparent">
              <div className="flex items-start gap-3">
                <div className="relative shrink-0 mt-0.5">
                  <div className="absolute inset-0 bg-violet-500 blur-md opacity-40" />
                  <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/80 to-purple-600/80 border border-violet-400/30 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white animate-pulse" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white mb-1">
                    Your creation is in progress
                  </p>
                  <p className="text-xs text-purple-300/80 leading-relaxed">
                    This typically takes a few minutes. Once ready, you'll find it in your{" "}
                    <Link href="/history" className="text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors">
                      Library
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-purple-400/60">
        <Library className="w-3.5 h-3.5" />
        <span>View all your creations in the Library</span>
      </div>
    </div>
  );
}
