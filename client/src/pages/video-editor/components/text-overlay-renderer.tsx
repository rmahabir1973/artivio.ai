import { useMemo } from 'react';
import { EditorTextOverlay } from '@/hooks/useTextOverlay';
import { cn } from '@/lib/utils';

interface TextOverlayRendererProps {
  overlays: EditorTextOverlay[];
  currentTime: number;
  selectedOverlayId: string | null;
  onSelectOverlay?: (id: string | null) => void;
  isPlaying?: boolean;
}

export function TextOverlayRenderer({
  overlays,
  currentTime,
  selectedOverlayId,
  onSelectOverlay,
  isPlaying = false,
}: TextOverlayRendererProps) {
  const visibleOverlays = useMemo(() => {
    return overlays.filter(
      overlay => currentTime >= overlay.startTime && currentTime <= overlay.endTime
    );
  }, [overlays, currentTime]);

  const getAnimationStyle = (overlay: EditorTextOverlay): React.CSSProperties => {
    const animDuration = 0.5;
    const animProgress = Math.min((currentTime - overlay.startTime) / animDuration, 1);

    switch (overlay.animation) {
      case 'fade-in':
        return {
          transform: 'translate(-50%, -50%)',
          opacity: Math.min(animProgress, 1),
          transition: 'opacity 0.3s ease-out',
        };
      case 'slide-up':
        const slideOffset = (1 - animProgress) * 50;
        return {
          transform: `translate(-50%, -50%) translateY(${slideOffset}px)`,
          opacity: animProgress,
          transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
        };
      case 'pop':
        const scale = animProgress < 1 ? 0.5 + (animProgress * 0.5) : 1;
        return {
          transform: `translate(-50%, -50%) scale(${scale})`,
          opacity: animProgress,
          transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
        };
      case 'typewriter':
        return {
          clipPath: `inset(0 ${(1 - animProgress) * 100}% 0 0)`,
          transform: 'translate(-50%, -50%)',
        };
      default:
        return {
          transform: 'translate(-50%, -50%)',
        };
    }
  };

  if (visibleOverlays.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {visibleOverlays.map((overlay) => {
        const isSelected = overlay.id === selectedOverlayId;

        return (
          <div
            key={overlay.id}
            className={cn(
              "absolute pointer-events-auto cursor-move select-none",
              isSelected && !isPlaying && "ring-2 ring-primary ring-offset-2"
            )}
            style={{
              left: `${overlay.x}%`,
              top: `${overlay.y}%`,
              ...getAnimationStyle(overlay),
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectOverlay?.(overlay.id);
            }}
            data-testid={`text-overlay-render-${overlay.id}`}
          >
            <div
              style={{
                fontFamily: overlay.fontFamily,
                fontSize: `${overlay.fontSize}px`,
                color: overlay.color,
                backgroundColor: overlay.backgroundColor,
                fontWeight: overlay.bold ? 'bold' : 'normal',
                fontStyle: overlay.italic ? 'italic' : 'normal',
                padding: overlay.backgroundColor !== 'transparent' ? '0.25em 0.5em' : undefined,
                borderRadius: overlay.backgroundColor !== 'transparent' ? '4px' : undefined,
                whiteSpace: 'pre-wrap',
                textShadow: overlay.backgroundColor === 'transparent' 
                  ? '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.5)' 
                  : undefined,
              }}
            >
              {overlay.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}
