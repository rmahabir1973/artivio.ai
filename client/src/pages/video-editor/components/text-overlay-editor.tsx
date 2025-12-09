import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Bold, 
  Italic, 
  Type, 
  Plus, 
  Trash2, 
  Copy,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';
import { EditorTextOverlay, DEFAULT_TEXT_OVERLAY } from '@/hooks/useTextOverlay';
import { cn } from '@/lib/utils';

interface TextOverlayEditorProps {
  overlays: EditorTextOverlay[];
  selectedOverlayId: string | null;
  currentTime: number;
  totalDuration: number;
  onAddOverlay: (overlay: Omit<EditorTextOverlay, 'id'>) => string;
  onUpdateOverlay: (id: string, updates: Partial<EditorTextOverlay>) => void;
  onRemoveOverlay: (id: string) => void;
  onSelectOverlay: (id: string | null) => void;
  onDuplicateOverlay: (id: string) => string | null;
}

const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Impact',
  'Comic Sans MS',
  'Trebuchet MS',
  'Verdana',
  'Montserrat',
];

const ANIMATIONS = [
  { value: 'none', label: 'None' },
  { value: 'fade-in', label: 'Fade In' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'pop', label: 'Pop' },
  { value: 'typewriter', label: 'Typewriter' },
] as const;

export function TextOverlayEditor({
  overlays,
  selectedOverlayId,
  currentTime,
  totalDuration,
  onAddOverlay,
  onUpdateOverlay,
  onRemoveOverlay,
  onSelectOverlay,
  onDuplicateOverlay,
}: TextOverlayEditorProps) {
  const selectedOverlay = overlays.find(o => o.id === selectedOverlayId);

  const handleAddText = () => {
    const defaultDuration = 5;
    onAddOverlay({
      ...DEFAULT_TEXT_OVERLAY,
      startTime: currentTime,
      endTime: Math.min(currentTime + defaultDuration, totalDuration || defaultDuration),
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Text Overlays</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddText}
          data-testid="button-add-text-overlay"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Text
        </Button>
      </div>

      {overlays.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Type className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No text overlays yet</p>
          <p className="text-xs mt-1">Click "Add Text" to create one</p>
        </div>
      ) : (
        <div className="space-y-2">
          {overlays.map((overlay) => (
            <div
              key={overlay.id}
              className={cn(
                "p-2 rounded-md border cursor-pointer transition-colors",
                selectedOverlayId === overlay.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover-elevate"
              )}
              onClick={() => onSelectOverlay(overlay.id)}
              data-testid={`text-overlay-item-${overlay.id}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate flex-1">
                  {overlay.text.substring(0, 20)}{overlay.text.length > 20 ? '...' : ''}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {formatTime(overlay.startTime)} - {formatTime(overlay.endTime)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedOverlay && (
        <div className="space-y-4 pt-4 border-t">
          <div className="space-y-2">
            <Label htmlFor="text-content">Text</Label>
            <Textarea
              id="text-content"
              value={selectedOverlay.text}
              onChange={(e) => onUpdateOverlay(selectedOverlay.id, { text: e.target.value })}
              className="resize-none"
              rows={2}
              data-testid="input-text-content"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time (s)</Label>
              <Input
                id="start-time"
                type="number"
                min={0}
                max={selectedOverlay.endTime}
                step={0.1}
                value={selectedOverlay.startTime}
                onChange={(e) => onUpdateOverlay(selectedOverlay.id, { startTime: parseFloat(e.target.value) || 0 })}
                data-testid="input-start-time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">End Time (s)</Label>
              <Input
                id="end-time"
                type="number"
                min={selectedOverlay.startTime}
                max={totalDuration || 999}
                step={0.1}
                value={selectedOverlay.endTime}
                onChange={(e) => onUpdateOverlay(selectedOverlay.id, { endTime: parseFloat(e.target.value) || 0 })}
                data-testid="input-end-time"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Font Family</Label>
            <Select
              value={selectedOverlay.fontFamily}
              onValueChange={(value) => onUpdateOverlay(selectedOverlay.id, { fontFamily: value })}
            >
              <SelectTrigger data-testid="select-font-family">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map((font) => (
                  <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Font Size: {selectedOverlay.fontSize}px</Label>
            <Slider
              value={[selectedOverlay.fontSize]}
              onValueChange={([value]) => onUpdateOverlay(selectedOverlay.id, { fontSize: value })}
              min={12}
              max={120}
              step={1}
              data-testid="slider-font-size"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={selectedOverlay.bold ? "default" : "outline"}
              size="icon"
              onClick={() => onUpdateOverlay(selectedOverlay.id, { bold: !selectedOverlay.bold })}
              data-testid="button-toggle-bold"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant={selectedOverlay.italic ? "default" : "outline"}
              size="icon"
              onClick={() => onUpdateOverlay(selectedOverlay.id, { italic: !selectedOverlay.italic })}
              data-testid="button-toggle-italic"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <Label htmlFor="text-color" className="text-xs">Color</Label>
              <input
                id="text-color"
                type="color"
                value={selectedOverlay.color}
                onChange={(e) => onUpdateOverlay(selectedOverlay.id, { color: e.target.value })}
                className="h-8 w-8 rounded border cursor-pointer"
                data-testid="input-text-color"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="bg-color" className="text-xs">BG</Label>
              <input
                id="bg-color"
                type="color"
                value={selectedOverlay.backgroundColor === 'transparent' ? '#000000' : selectedOverlay.backgroundColor}
                onChange={(e) => onUpdateOverlay(selectedOverlay.id, { backgroundColor: e.target.value })}
                className="h-8 w-8 rounded border cursor-pointer"
                data-testid="input-bg-color"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Position</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">X: {selectedOverlay.x}%</Label>
                <Slider
                  value={[selectedOverlay.x]}
                  onValueChange={([value]) => onUpdateOverlay(selectedOverlay.id, { x: value })}
                  min={0}
                  max={100}
                  step={1}
                  data-testid="slider-position-x"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Y: {selectedOverlay.y}%</Label>
                <Slider
                  value={[selectedOverlay.y]}
                  onValueChange={([value]) => onUpdateOverlay(selectedOverlay.id, { y: value })}
                  min={0}
                  max={100}
                  step={1}
                  data-testid="slider-position-y"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Animation</Label>
            <Select
              value={selectedOverlay.animation}
              onValueChange={(value: EditorTextOverlay['animation']) => onUpdateOverlay(selectedOverlay.id, { animation: value })}
            >
              <SelectTrigger data-testid="select-animation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANIMATIONS.map((anim) => (
                  <SelectItem key={anim.value} value={anim.value}>
                    {anim.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDuplicateOverlay(selectedOverlay.id)}
              className="flex-1"
              data-testid="button-duplicate-overlay"
            >
              <Copy className="h-4 w-4 mr-1" />
              Duplicate
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onRemoveOverlay(selectedOverlay.id)}
              className="flex-1"
              data-testid="button-remove-overlay"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
