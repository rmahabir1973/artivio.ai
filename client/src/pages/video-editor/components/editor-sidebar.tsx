import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Video, Music, Mic, Type, Layers, Download, ImageIcon } from "lucide-react";

// Sidebar categories for the OpenCut/CapCut-style layout
export type EditorCategory = 'media' | 'images' | 'music' | 'audio' | 'text' | 'overlays' | 'export';

// Editor sidebar menu configuration
const SIDEBAR_MENU: { id: EditorCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'media', label: 'Videos', icon: Video },
  { id: 'images', label: 'Images', icon: ImageIcon },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'audio', label: 'Audio', icon: Mic },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'overlays', label: 'Overlays', icon: Layers },
  { id: 'export', label: 'Export', icon: Download },
];

interface EditorSidebarProps {
  activeCategory: EditorCategory;
  onCategoryChange: (category: EditorCategory) => void;
}

export function EditorSidebar({ activeCategory, onCategoryChange }: EditorSidebarProps) {
  return (
    <div className="flex flex-col w-16 bg-muted/30 border-r shrink-0" data-testid="editor-sidebar">
      {SIDEBAR_MENU.map((item) => {
        const Icon = item.icon;
        const isActive = activeCategory === item.id;
        
        return (
          <Tooltip key={item.id} delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-14 w-full rounded-none flex flex-col gap-0.5 items-center justify-center",
                  isActive && "bg-background border-r-2 border-r-primary"
                )}
                onClick={() => onCategoryChange(item.id)}
                data-testid={`sidebar-${item.id}`}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                <span className={cn("text-[10px]", isActive ? "text-primary" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {item.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export { SIDEBAR_MENU };
