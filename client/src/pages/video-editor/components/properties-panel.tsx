import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Video,
  Volume2,
  VolumeX,
  Sparkles,
  Move,
  Eye,
  Gauge,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  Clock,
  Scissors,
  Play,
  Pause,
  Settings,
  Layers,
  Music,
  Image,
  X,
} from 'lucide-react';

interface ClipSettingsLocal {
  clipId: string;
  muted: boolean;
  volume: number;
  speed: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  originalDuration?: number;
  displayDuration?: number;
}

interface VideoClip {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  prompt: string;
  createdAt: string;
  type: 'video' | 'image';
}

interface EnhancementsState {
  transitionMode: 'none' | 'crossfade' | 'perClip';
  transitionDuration: number;
  clipTransitions: any[];
  fadeIn: boolean;
  fadeOut: boolean;
  fadeDuration: number;
  aspectRatio: '16:9' | '9:16' | '1:1';
  backgroundMusic?: {
    audioUrl: string;
    volume: number;
    name?: string;
  };
  audioTrack?: {
    audioUrl: string;
    volume: number;
    type: 'tts' | 'voice' | 'sfx';
    name?: string;
  };
  textOverlays: any[];
  avatarOverlay?: any;
  watermark?: any;
  captions: any[];
}

interface AudioTrack {
  id: string;
  url: string;
  name: string;
  duration?: number;
  positionSeconds?: number;
  volume: number;
  type: 'music' | 'voice' | 'sfx';
  trackId?: string;
  speed?: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  fadeOutSeconds?: number;
}

interface PropertiesPanelProps {
  selectedClip: { clip: VideoClip; index: number } | null;
  selectedAudioTrack: AudioTrack | null;
  clipSettings: ClipSettingsLocal | null;
  enhancements: EnhancementsState;
  onClipSettingsChange: (updates: Partial<ClipSettingsLocal>) => void;
  onEnhancementsChange: (updates: Partial<EnhancementsState>) => void;
  onAudioTrackChange?: (trackId: string, updates: Partial<AudioTrack>) => void;
  onMuteToggle: () => void;
  totalDuration: number;
  clipCount: number;
  className?: string;
}

function PropertySection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted rounded-t-md transition-colors"
          data-testid={`section-toggle-${title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{title}</span>
          </div>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-3 space-y-3 border border-t-0 rounded-b-md bg-background">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PropertiesPanel({
  selectedClip,
  selectedAudioTrack,
  clipSettings,
  enhancements,
  onClipSettingsChange,
  onEnhancementsChange,
  onAudioTrackChange,
  onMuteToggle,
  totalDuration,
  clipCount,
  className,
}: PropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'effects'>('video');

  // Render audio track properties panel when an audio track is selected
  if (selectedAudioTrack && !selectedClip) {
    return (
      <div className={cn("h-full flex flex-col", className)} data-testid="properties-panel-audio">
        <div className="p-3 border-b">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Music className="h-4 w-4 text-primary" />
            Audio Track
          </h3>
          <p className="text-xs text-muted-foreground truncate mt-1">{selectedAudioTrack.name}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <PropertySection title="Audio Info" icon={Music}>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium capitalize">{selectedAudioTrack.type === 'voice' ? 'Voice/TTS' : selectedAudioTrack.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{formatDuration(selectedAudioTrack.duration ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Position</span>
                <span className="font-medium">{formatDuration(selectedAudioTrack.positionSeconds ?? 0)}</span>
              </div>
            </div>
          </PropertySection>

          <PropertySection title="Volume" icon={Volume2}>
            <div className="space-y-2">
              <Label className="text-xs flex justify-between">
                Volume Level
                <span className="text-muted-foreground">
                  {Math.round(selectedAudioTrack.volume * 100)}%
                </span>
              </Label>
              <Slider
                value={[selectedAudioTrack.volume]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([v]) => 
                  onAudioTrackChange?.(selectedAudioTrack.id, { volume: v })
                }
                data-testid="slider-audio-volume"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          </PropertySection>

          <PropertySection title="Speed" icon={Gauge}>
            <div className="space-y-2">
              <Label className="text-xs flex justify-between">
                Playback Speed
                <span className="text-muted-foreground">{selectedAudioTrack.speed ?? 1}x</span>
              </Label>
              <Slider
                value={[selectedAudioTrack.speed ?? 1]}
                min={0.5}
                max={2}
                step={0.25}
                onValueChange={([v]) =>
                  onAudioTrackChange?.(selectedAudioTrack.id, { speed: v })
                }
                data-testid="slider-audio-speed"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0.5x (Slow)</span>
                <span>2x (Fast)</span>
              </div>
            </div>
          </PropertySection>

          <PropertySection title="Timing" icon={Clock}>
            <div className="space-y-2">
              <Label className="text-xs flex justify-between">
                Timeline Position
                <span className="text-muted-foreground">
                  {formatDuration(selectedAudioTrack.positionSeconds ?? 0)}
                </span>
              </Label>
              <Slider
                value={[selectedAudioTrack.positionSeconds ?? 0]}
                min={0}
                max={Math.max(totalDuration - (selectedAudioTrack.duration ?? 0), 0)}
                step={0.1}
                onValueChange={([v]) =>
                  onAudioTrackChange?.(selectedAudioTrack.id, { positionSeconds: v })
                }
                data-testid="slider-audio-position"
              />
            </div>
          </PropertySection>
        </div>

        <div className="border-t p-3 space-y-3">
          <PropertySection title="Project Info" icon={Settings} defaultOpen>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Clips</span>
                <span className="font-medium">{clipCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{formatDuration(totalDuration)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aspect Ratio</span>
                <span className="font-medium">{enhancements.aspectRatio}</span>
              </div>
            </div>
          </PropertySection>
        </div>
      </div>
    );
  }

  if (!selectedClip) {
    return (
      <div className={cn("h-full flex flex-col", className)} data-testid="properties-panel">
        <div className="p-3 border-b">
          <h3 className="text-sm font-semibold">Properties</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center px-4">
            <FileQuestion className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No clip selected</p>
            <p className="text-xs mt-1 text-muted-foreground">
              Select a clip from the timeline to edit its properties
            </p>
          </div>
        </div>

        <div className="border-t p-3 space-y-3">
          <PropertySection title="Project Info" icon={Settings} defaultOpen>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Clips</span>
                <span className="font-medium">{clipCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{formatDuration(totalDuration)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aspect Ratio</span>
                <span className="font-medium">{enhancements.aspectRatio}</span>
              </div>
            </div>
          </PropertySection>

          <PropertySection title="Export Settings" icon={Video} defaultOpen={false}>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Aspect Ratio</Label>
                <Select
                  value={enhancements.aspectRatio}
                  onValueChange={(v: '16:9' | '9:16' | '1:1') =>
                    onEnhancementsChange({ aspectRatio: v })
                  }
                >
                  <SelectTrigger className="h-8" data-testid="select-aspect-ratio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                    <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                    <SelectItem value="1:1">1:1 (Square)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Fade In
                  </Label>
                  <Switch
                    checked={enhancements.fadeIn}
                    onCheckedChange={(checked) =>
                      onEnhancementsChange({ fadeIn: checked })
                    }
                    data-testid="switch-fade-in"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Fade Out
                  </Label>
                  <Switch
                    checked={enhancements.fadeOut}
                    onCheckedChange={(checked) =>
                      onEnhancementsChange({ fadeOut: checked })
                    }
                    data-testid="switch-fade-out"
                  />
                </div>
              </div>
            </div>
          </PropertySection>
        </div>
      </div>
    );
  }

  const clip = selectedClip.clip;
  const settings = clipSettings || {
    clipId: clip.id,
    muted: false,
    volume: 1,
    speed: 1.0,
  };

  return (
    <div className={cn("h-full flex flex-col", className)} data-testid="properties-panel">
      <div className="p-3 border-b">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {clip.type === 'image' ? (
            <Image className="h-4 w-4 text-primary" />
          ) : (
            <Video className="h-4 w-4 text-primary" />
          )}
          {clip.type === 'image' ? 'Image' : 'Clip'} #{selectedClip.index + 1}
        </h3>
        <p className="text-xs text-muted-foreground truncate mt-1">{clip.prompt}</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-9 p-0">
          <TabsTrigger
            value="video"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 text-xs"
            data-testid="tab-video"
          >
            <Video className="h-3 w-3 mr-1" />
            Video
          </TabsTrigger>
          <TabsTrigger
            value="audio"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 text-xs"
            data-testid="tab-audio"
          >
            <Volume2 className="h-3 w-3 mr-1" />
            Audio
          </TabsTrigger>
          <TabsTrigger
            value="effects"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 text-xs"
            data-testid="tab-effects"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Effects
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <TabsContent value="video" className="m-0 space-y-3">
            {clip.type === 'image' ? (
              <PropertySection title="Display" icon={Clock}>
                <div className="space-y-2">
                  <Label className="text-xs flex justify-between">
                    Duration
                    <span className="text-muted-foreground">
                      {settings.displayDuration ?? 5}s
                    </span>
                  </Label>
                  <Slider
                    value={[settings.displayDuration ?? 5]}
                    min={1}
                    max={30}
                    step={1}
                    onValueChange={([v]) =>
                      onClipSettingsChange({ displayDuration: v, originalDuration: v })
                    }
                    data-testid="slider-display-duration"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    How long this image will be shown (1-30 seconds)
                  </p>
                </div>
              </PropertySection>
            ) : (
              <>
                <PropertySection title="Speed" icon={Gauge}>
                  <div className="space-y-2">
                    <Label className="text-xs flex justify-between">
                      Playback Speed
                      <span className="text-muted-foreground">{settings.speed}x</span>
                    </Label>
                    <Slider
                      value={[settings.speed]}
                      min={0.5}
                      max={2}
                      step={0.25}
                      onValueChange={([v]) => onClipSettingsChange({ speed: v })}
                      data-testid="slider-speed"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>0.5x (Slow)</span>
                      <span>2x (Fast)</span>
                    </div>
                  </div>
                </PropertySection>

                <PropertySection title="Trim" icon={Scissors}>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs flex justify-between">
                        Start
                        <span className="text-muted-foreground">
                          {formatDuration(settings.trimStartSeconds ?? 0)}
                        </span>
                      </Label>
                      <Slider
                        value={[settings.trimStartSeconds ?? 0]}
                        min={0}
                        max={Math.max((settings.trimEndSeconds ?? settings.originalDuration ?? 10) - 0.5, 0.1)}
                        step={0.1}
                        onValueChange={([v]) => onClipSettingsChange({ trimStartSeconds: v })}
                        data-testid="slider-trim-start"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs flex justify-between">
                        End
                        <span className="text-muted-foreground">
                          {formatDuration(settings.trimEndSeconds ?? settings.originalDuration ?? 10)}
                        </span>
                      </Label>
                      <Slider
                        value={[settings.trimEndSeconds ?? settings.originalDuration ?? 10]}
                        min={Math.max((settings.trimStartSeconds ?? 0) + 0.5, 0.5)}
                        max={settings.originalDuration ?? 10}
                        step={0.1}
                        onValueChange={([v]) => onClipSettingsChange({ trimEndSeconds: v })}
                        data-testid="slider-trim-end"
                      />
                    </div>
                  </div>
                </PropertySection>
              </>
            )}

          </TabsContent>

          <TabsContent value="audio" className="m-0 space-y-3">
            {clip.type === 'image' ? (
              <div className="text-center py-8 text-muted-foreground">
                <VolumeX className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Images don't have audio</p>
              </div>
            ) : (
              <>
                <PropertySection title="Volume" icon={Volume2}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs flex items-center gap-2">
                        {settings.muted ? (
                          <VolumeX className="h-3 w-3" />
                        ) : (
                          <Volume2 className="h-3 w-3" />
                        )}
                        Mute Audio
                      </Label>
                      <Switch
                        checked={settings.muted}
                        onCheckedChange={onMuteToggle}
                        data-testid="switch-mute"
                      />
                    </div>

                    {!settings.muted && (
                      <div className="space-y-2">
                        <Label className="text-xs flex justify-between">
                          Volume
                          <span className="text-muted-foreground">
                            {Math.round(settings.volume * 100)}%
                          </span>
                        </Label>
                        <Slider
                          value={[settings.volume]}
                          min={0}
                          max={1}
                          step={0.05}
                          onValueChange={([v]) => onClipSettingsChange({ volume: v })}
                          data-testid="slider-volume"
                        />
                      </div>
                    )}
                  </div>
                </PropertySection>

                {enhancements.backgroundMusic && (
                  <PropertySection title="Background Music" icon={Music}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs truncate flex-1">
                          {enhancements.backgroundMusic.name || 'Music Track'}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onEnhancementsChange({ backgroundMusic: undefined })}
                          data-testid="button-remove-music"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs flex justify-between">
                          Volume
                          <span className="text-muted-foreground">
                            {Math.round(enhancements.backgroundMusic.volume * 100)}%
                          </span>
                        </Label>
                        <Slider
                          value={[enhancements.backgroundMusic.volume]}
                          min={0}
                          max={1}
                          step={0.05}
                          onValueChange={([v]) =>
                            onEnhancementsChange({
                              backgroundMusic: {
                                ...enhancements.backgroundMusic!,
                                volume: v,
                              },
                            })
                          }
                          data-testid="slider-music-volume"
                        />
                      </div>
                    </div>
                  </PropertySection>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="effects" className="m-0 space-y-3">
            <PropertySection title="Transitions" icon={Layers}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Global Fade In/Out</Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={enhancements.fadeIn ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => onEnhancementsChange({ fadeIn: !enhancements.fadeIn })}
                    data-testid="button-toggle-fade-in"
                  >
                    Fade In
                  </Button>
                  <Button
                    variant={enhancements.fadeOut ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => onEnhancementsChange({ fadeOut: !enhancements.fadeOut })}
                    data-testid="button-toggle-fade-out"
                  >
                    Fade Out
                  </Button>
                </div>
                {(enhancements.fadeIn || enhancements.fadeOut) && (
                  <div className="space-y-2 pt-2">
                    <Label className="text-xs flex justify-between">
                      Fade Duration
                      <span className="text-muted-foreground">{enhancements.fadeDuration}s</span>
                    </Label>
                    <Slider
                      value={[enhancements.fadeDuration]}
                      min={0.25}
                      max={2}
                      step={0.25}
                      onValueChange={([v]) => onEnhancementsChange({ fadeDuration: v })}
                      data-testid="slider-fade-duration"
                    />
                  </div>
                )}
              </div>
            </PropertySection>

            {enhancements.clipTransitions.length > 0 && (
              <PropertySection title="Clip Transitions" icon={Sparkles}>
                <div className="space-y-2">
                  {enhancements.clipTransitions.map((transition, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs"
                    >
                      <span>
                        Clip {transition.afterClipIndex + 1} → {transition.afterClipIndex + 2}
                      </span>
                      <span className="text-muted-foreground capitalize">{transition.type}</span>
                    </div>
                  ))}
                </div>
              </PropertySection>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 10);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${secs}.${ms}s`;
}

export type { ClipSettingsLocal, VideoClip, EnhancementsState, PropertiesPanelProps, AudioTrack };
