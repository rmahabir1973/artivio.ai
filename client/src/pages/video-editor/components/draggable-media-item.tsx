import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Video, Image as ImageIcon, Music, Plus } from 'lucide-react';
import type { Generation } from '@shared/schema';

interface DraggableMediaItemProps {
  item: Generation;
  mediaType: 'video' | 'image' | 'audio';
  onClick?: () => void;
  className?: string;
}

export function DraggableMediaItem({ 
  item, 
  mediaType, 
  onClick,
  className 
}: DraggableMediaItemProps) {
  // Default duration based on media type
  const defaultDuration = mediaType === 'image' ? 5 : mediaType === 'audio' ? 30 : 10;
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `draggable-${item.id}`,
    data: {
      type: 'media-item',
      mediaType,
      item: {
        id: item.id,
        type: mediaType,
        url: item.resultUrl,
        thumbnailUrl: item.thumbnailUrl,
        name: item.prompt || `${mediaType} clip`,
        duration: defaultDuration, // Include default duration for proper timeline placement
      }
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  };

  const isVideo = mediaType === 'video';
  const isImage = mediaType === 'image';
  const isAudio = mediaType === 'audio';

  const Icon = isVideo ? Video : isImage ? ImageIcon : Music;

  if (isAudio) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={cn(
          "group relative p-3 rounded-md border cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-primary transition-all",
          isDragging && "ring-2 ring-primary shadow-lg",
          className
        )}
        onClick={onClick}
        data-testid={`draggable-audio-${item.id}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
            <Music className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.prompt || 'Music track'}</p>
            <p className="text-xs text-muted-foreground">Drag to timeline</p>
          </div>
        </div>
        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
          <Plus className="h-5 w-5 text-primary" />
        </div>
      </div>
    );
  }

  const aspectClass = isImage ? 'aspect-square' : 'aspect-video';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative rounded-md overflow-hidden border cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-primary transition-all",
        aspectClass,
        isDragging && "ring-2 ring-primary shadow-lg",
        className
      )}
      onClick={onClick}
      data-testid={`draggable-${mediaType}-${item.id}`}
    >
      {item.thumbnailUrl ? (
        <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
      ) : item.resultUrl && isVideo ? (
        <video 
          src={item.resultUrl} 
          className="w-full h-full object-cover"
          preload="metadata"
          muted
          playsInline
        />
      ) : item.resultUrl && isImage ? (
        <img src={item.resultUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Plus className="h-6 w-6 text-white" />
      </div>
      {isImage && (
        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
          5s
        </div>
      )}
      {isDragging && (
        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
          <span className="text-xs font-medium text-primary-foreground bg-primary px-2 py-1 rounded">
            Drop on track
          </span>
        </div>
      )}
    </div>
  );
}

export default DraggableMediaItem;
