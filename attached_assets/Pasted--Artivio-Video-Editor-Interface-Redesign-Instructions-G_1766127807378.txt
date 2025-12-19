# Artivio Video Editor - Interface Redesign Instructions

## 🎯 Goal
Redesign the Artivio video editor interface to be more professional, space-efficient, and feature an advanced CapCut-style timeline with better layout proportions.

## 📸 Current Issues (From Screenshots)
1. ❌ Preview window is too large (taking up 60%+ of screen)
2. ❌ Right sidebar is too wide with unnecessarily long option panels
3. ❌ Timeline is cramped at the bottom with minimal space
4. ❌ Effects/options panels are vertically stacked, wasting horizontal space
5. ❌ No track layers visible (video, audio, effects separated)
6. ❌ Zoom controls are minimal
7. ❌ No advanced timeline features (snap, markers, keyframes)

## 🎨 Target Layout (CapCut-style)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Logo] [File] [Edit] [Tools]              [User] [Export]   [-][□][×]  │
├─────────────┬───────────────────────────────────────────┬───────────────┤
│   ASSETS    │          PREVIEW (40% height)              │   PROPERTIES  │
│   Library   │  ┌─────────────────────────────────────┐   │               │
│             │  │                                     │   │   ┌─────────┐ │
│  [Effects]  │  │         Video Preview               │   │   │ Video   │ │
│  [Transi-]  │  │         16:9 / 9:16                 │   │   │ Audio   │ │
│  [Stickers] │  │         640 x 360                   │   │   │ Effects │ │
│  [Text]     │  │                                     │   │   │ Filters │ │
│  [Music]    │  │                                     │   │   └─────────┘ │
│             │  └─────────────────────────────────────┘   │               │
│   Search:   │                                             │   [Property   │
│  [_______]  │  ⏮ ⏪ ▶ ⏩ ⏭  00:00:15 / 00:01:30            │    panels     │
│             │                                             │    based on   │
│  [Thumb 1]  │                                             │    selection] │
│  [Thumb 2]  │                                             │               │
│  [Thumb 3]  │                                             │               │
│             │                                             │               │
├─────────────┴───────────────────────────────────────────┴───────────────┤
│                    ADVANCED TIMELINE (40% height)                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [🔍-] [🔍+] [✂] [🔗] [⚡] [📍]    |←────────timeline────────→|    │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ 🎬 Video 1  ████████████▓▓▓▓▓███████████                          │   │
│  │ 🎬 Video 2                    ▓▓▓████████████████                │   │
│  │ 🎵 Audio    ∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿             │   │
│  │ 🎤 Voice                      ∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿              │   │
│  │ ✨ Effects              [FX]         [FX]                         │   │
│  │ 📝 Text                      [Hello!]                             │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ 0:00    0:05    0:10    0:15    0:20    0:25    0:30    0:35     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Layout Proportions:
- **Left Sidebar (Assets):** 15% width
- **Center Preview:** 60% width, 40% height
- **Right Sidebar (Properties):** 25% width
- **Timeline:** 100% width, 40% height (bottom section)

---

## 📝 Detailed Implementation Instructions

### **PHASE 1: Layout Restructure**

#### Step 1.1: Update Main Container Grid

**File:** `src/components/VideoEditor/VideoEditor.tsx` (or main editor component)

**Current structure (assumed):**
```tsx
<div className="flex h-screen">
  <Sidebar /> {/* Too wide */}
  <div className="flex-1">
    <PreviewPanel /> {/* Too tall */}
    <Timeline /> {/* Too short */}
  </div>
  <PropertiesPanel /> {/* Too wide */}
</div>
```

**New structure:**
```tsx
<div className="h-screen flex flex-col">
  {/* Top Navigation Bar */}
  <NavigationBar />
  
  {/* Main Content Area */}
  <div className="flex-1 flex overflow-hidden">
    {/* Left: Assets Library (15% width) */}
    <AssetsSidebar className="w-[15%] min-w-[200px] max-w-[280px]" />
    
    {/* Center: Preview (60% width) */}
    <PreviewSection className="w-[60%] flex flex-col">
      <VideoPreview className="flex-1" /> {/* 60% of remaining height */}
      <PlaybackControls />
    </PreviewSection>
    
    {/* Right: Properties (25% width) */}
    <PropertiesPanel className="w-[25%] min-w-[280px] max-w-[400px]" />
  </div>
  
  {/* Bottom: Advanced Timeline (40% height) */}
  <TimelineSection className="h-[40%] min-h-[300px] border-t" />
</div>
```

#### Step 1.2: CSS/Tailwind Classes

```tsx
// VideoEditor.tsx
export function VideoEditor() {
  return (
    <div className="h-screen w-full flex flex-col bg-gray-900 text-white">
      {/* Navigation Bar - 48px fixed height */}
      <nav className="h-12 bg-gray-950 border-b border-gray-800 flex items-center px-4">
        <div className="flex items-center space-x-6">
          <Logo />
          <MenuBar />
        </div>
        <div className="flex-1" />
        <div className="flex items-center space-x-4">
          <UserAvatar />
          <ExportButton />
        </div>
      </nav>
      
      {/* Main Content - Flex 1 (fills remaining height) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Assets Sidebar */}
        <aside className="w-[15%] min-w-[200px] max-w-[280px] bg-gray-850 border-r border-gray-800 overflow-y-auto">
          <AssetsSidebar />
        </aside>
        
        {/* Preview Section */}
        <main className="flex-[0.6] flex flex-col bg-gray-900">
          <div className="flex-1 flex items-center justify-center p-4">
            <VideoPreview />
          </div>
          <PlaybackControls />
        </main>
        
        {/* Properties Panel */}
        <aside className="w-[25%] min-w-[280px] max-w-[400px] bg-gray-850 border-l border-gray-800 overflow-y-auto">
          <PropertiesPanel />
        </aside>
      </div>
      
      {/* Timeline - 40% of screen height */}
      <section className="h-[40%] min-h-[300px] bg-gray-950 border-t border-gray-700">
        <AdvancedTimeline />
      </section>
    </div>
  );
}
```

---

### **PHASE 2: Assets Sidebar Redesign**

**Goal:** Make it compact and icon-based like CapCut

**File:** `src/components/VideoEditor/AssetsSidebar.tsx`

```tsx
export function AssetsSidebar() {
  const [activeTab, setActiveTab] = useState('effects');
  
  const tabs = [
    { id: 'effects', icon: Sparkles, label: 'Effects' },
    { id: 'transitions', icon: ArrowRightLeft, label: 'Transitions' },
    { id: 'stickers', icon: Smile, label: 'Stickers' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'music', icon: Music, label: 'Music' },
    { id: 'uploads', icon: Upload, label: 'Uploads' },
  ];
  
  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="p-2 space-y-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
              activeTab === tab.id 
                ? "bg-blue-600 text-white" 
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            )}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-sm font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
      
      {/* Search Bar */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <AssetGrid activeTab={activeTab} />
      </div>
    </div>
  );
}

function AssetGrid({ activeTab }: { activeTab: string }) {
  // Grid of thumbnails/assets
  return (
    <div className="grid grid-cols-2 gap-2">
      {assets[activeTab]?.map((asset) => (
        <button
          key={asset.id}
          className="aspect-square rounded-lg overflow-hidden bg-gray-800 hover:ring-2 hover:ring-blue-500 transition-all group"
          draggable
          onDragStart={(e) => handleDragStart(e, asset)}
        >
          <img 
            src={asset.thumbnail} 
            alt={asset.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
          />
          {/* Asset name overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
            <p className="text-xs text-white truncate">{asset.name}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
```

---

### **PHASE 3: Preview Section Optimization**

**Goal:** Constrained size with proper aspect ratio

**File:** `src/components/VideoEditor/VideoPreview.tsx`

```tsx
export function VideoPreview() {
  const { project, currentFrame } = useVideoEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // Calculate preview size to fit container while maintaining aspect ratio
  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const aspectRatio = project.settings.width / project.settings.height;
    
    // Fit to container with padding
    const maxWidth = containerWidth - 48; // 24px padding each side
    const maxHeight = containerHeight - 48;
    
    let width = maxWidth;
    let height = width / aspectRatio;
    
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    setDimensions({ width, height });
  }, [project.settings, containerRef.current?.clientWidth]);
  
  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-gray-950">
      <div className="relative" style={{ width: dimensions.width, height: dimensions.height }}>
        {/* Canvas/Preview */}
        <canvas
          className="w-full h-full bg-black rounded-lg shadow-2xl"
          width={project.settings.width}
          height={project.settings.height}
        />
        
        {/* Overlay Info */}
        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded px-2 py-1 text-xs">
          {project.settings.width} × {project.settings.height}
        </div>
        
        {/* Center Crosshair (optional) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-px h-8 bg-white/20" />
          <div className="w-8 h-px bg-white/20 absolute" />
        </div>
      </div>
    </div>
  );
}
```

---

### **PHASE 4: Properties Panel Optimization**

**Goal:** Compact, tabbed interface with collapsible sections

**File:** `src/components/VideoEditor/PropertiesPanel.tsx`

```tsx
export function PropertiesPanel() {
  const { selectedClip } = useVideoEditor();
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'effects'>('video');
  
  if (!selectedClip) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <FileQuestion className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a clip to edit properties</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-800">
        <TabButton 
          active={activeTab === 'video'} 
          onClick={() => setActiveTab('video')}
          icon={Video}
        >
          Video
        </TabButton>
        <TabButton 
          active={activeTab === 'audio'} 
          onClick={() => setActiveTab('audio')}
          icon={Volume2}
        >
          Audio
        </TabButton>
        <TabButton 
          active={activeTab === 'effects'} 
          onClick={() => setActiveTab('effects')}
          icon={Sparkles}
        >
          Effects
        </TabButton>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'video' && <VideoProperties clip={selectedClip} />}
        {activeTab === 'audio' && <AudioProperties clip={selectedClip} />}
        {activeTab === 'effects' && <EffectsProperties clip={selectedClip} />}
      </div>
    </div>
  );
}

function VideoProperties({ clip }: { clip: Clip }) {
  return (
    <div className="space-y-4">
      {/* Transform Section */}
      <PropertySection title="Transform" icon={Move} defaultOpen>
        <SliderControl 
          label="Scale" 
          value={clip.transform.scale} 
          min={0} 
          max={200}
          onChange={(v) => updateClip(clip.id, { transform: { scale: v }})}
        />
        <TwoAxisControl 
          label="Position"
          x={clip.transform.x}
          y={clip.transform.y}
          onChange={(x, y) => updateClip(clip.id, { transform: { x, y }})}
        />
        <SliderControl 
          label="Rotation" 
          value={clip.transform.rotation} 
          min={-180} 
          max={180}
          onChange={(v) => updateClip(clip.id, { transform: { rotation: v }})}
        />
      </PropertySection>
      
      {/* Opacity Section */}
      <PropertySection title="Opacity" icon={Eye}>
        <SliderControl 
          label="Opacity" 
          value={clip.opacity} 
          min={0} 
          max={100}
          suffix="%"
          onChange={(v) => updateClip(clip.id, { opacity: v })}
        />
      </PropertySection>
      
      {/* Speed Section */}
      <PropertySection title="Speed" icon={Gauge}>
        <SelectControl
          label="Speed"
          value={clip.speed}
          options={[
            { value: 0.25, label: '0.25x' },
            { value: 0.5, label: '0.5x' },
            { value: 1, label: 'Normal' },
            { value: 2, label: '2x' },
            { value: 4, label: '4x' },
          ]}
          onChange={(v) => updateClip(clip.id, { speed: v })}
        />
      </PropertySection>
    </div>
  );
}

function PropertySection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = false 
}: { 
  title: string; 
  icon: any; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-sm">{title}</span>
        </div>
        <ChevronDown 
          className={cn(
            "w-4 h-4 text-gray-400 transition-transform",
            isOpen && "rotate-180"
          )} 
        />
      </button>
      
      {isOpen && (
        <div className="p-3 space-y-3 bg-gray-900/30">
          {children}
        </div>
      )}
    </div>
  );
}
```

---

### **PHASE 5: Advanced Timeline Implementation** ⭐

**Goal:** Multi-track timeline with layers, like CapCut

**File:** `src/components/VideoEditor/AdvancedTimeline/AdvancedTimeline.tsx`

```tsx
export function AdvancedTimeline() {
  const { project, currentTime, zoom, setZoom } = useVideoEditor();
  const timelineRef = useRef<HTMLDivElement>(null);
  
  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Timeline Toolbar */}
      <TimelineToolbar zoom={zoom} setZoom={setZoom} />
      
      {/* Timeline Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Headers (Left) */}
        <TrackHeaders />
        
        {/* Timeline Canvas (Right - Scrollable) */}
        <div ref={timelineRef} className="flex-1 overflow-auto relative">
          <TimelineCanvas />
        </div>
      </div>
      
      {/* Time Ruler */}
      <TimeRuler zoom={zoom} duration={project.duration} />
    </div>
  );
}

function TimelineToolbar({ zoom, setZoom }: { zoom: number; setZoom: (z: number) => void }) {
  return (
    <div className="h-10 bg-gray-900 border-b border-gray-800 flex items-center px-4 space-x-4">
      {/* Zoom Controls */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
          className="p-1 hover:bg-gray-800 rounded"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        
        <div className="w-32">
          <Slider
            value={[zoom]}
            onValueChange={([v]) => setZoom(v)}
            min={0.1}
            max={3}
            step={0.1}
            className="w-full"
          />
        </div>
        
        <button
          onClick={() => setZoom(Math.min(3, zoom + 0.1))}
          className="p-1 hover:bg-gray-800 rounded"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        
        <span className="text-xs text-gray-500 w-12">{Math.round(zoom * 100)}%</span>
      </div>
      
      {/* Divider */}
      <div className="h-6 w-px bg-gray-800" />
      
      {/* Tools */}
      <ToolButton icon={Scissors} tooltip="Split" />
      <ToolButton icon={Link} tooltip="Link Clips" />
      <ToolButton icon={Zap} tooltip="Speed" />
      <ToolButton icon={Bookmark} tooltip="Add Marker" />
      
      {/* Divider */}
      <div className="h-6 w-px bg-gray-800" />
      
      {/* Snap Toggle */}
      <ToggleButton icon={Magnet} label="Snap" />
      
      <div className="flex-1" />
      
      {/* Timeline Settings */}
      <button className="p-1 hover:bg-gray-800 rounded">
        <Settings className="w-4 h-4" />
      </button>
    </div>
  );
}

function TrackHeaders() {
  const tracks = [
    { id: 'video1', type: 'video', label: 'Video 1', icon: Video, color: 'blue' },
    { id: 'video2', type: 'video', label: 'Video 2', icon: Video, color: 'blue' },
    { id: 'audio', type: 'audio', label: 'Audio', icon: Volume2, color: 'green' },
    { id: 'voice', type: 'audio', label: 'Voice', icon: Mic, color: 'purple' },
    { id: 'effects', type: 'effects', label: 'Effects', icon: Sparkles, color: 'yellow' },
    { id: 'text', type: 'text', label: 'Text', icon: Type, color: 'pink' },
  ];
  
  return (
    <div className="w-40 bg-gray-900 border-r border-gray-800 flex-shrink-0">
      {tracks.map(track => (
        <div
          key={track.id}
          className="h-12 border-b border-gray-800 flex items-center px-3 space-x-2 group hover:bg-gray-850"
        >
          <track.icon className={cn("w-4 h-4", `text-${track.color}-400`)} />
          <span className="text-sm font-medium text-gray-300">{track.label}</span>
          
          {/* Track Controls (Show on hover) */}
          <div className="ml-auto opacity-0 group-hover:opacity-100 flex space-x-1">
            <button className="p-0.5 hover:bg-gray-800 rounded">
              <Lock className="w-3 h-3" />
            </button>
            <button className="p-0.5 hover:bg-gray-800 rounded">
              <Eye className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineCanvas() {
  const { clips, zoom, currentTime, setCurrentTime } = useVideoEditor();
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Calculate pixel-per-second based on zoom
  const pixelsPerSecond = 100 * zoom; // 100px per second at 1x zoom
  
  return (
    <div
      ref={canvasRef}
      className="relative h-full min-w-full"
      style={{ width: `${pixelsPerSecond * 60}px` }} // 60 seconds width
      onClick={(e) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const clickX = e.clientX - rect.left;
          const newTime = clickX / pixelsPerSecond;
          setCurrentTime(newTime);
        }
      }}
    >
      {/* Playhead */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none"
        style={{ left: `${currentTime * pixelsPerSecond}px` }}
      >
        <div className="w-3 h-3 bg-red-500 -ml-1.5 -mt-1 rounded-b-sm" />
      </div>
      
      {/* Clips on Tracks */}
      <div className="relative h-full">
        {clips.map((clip, index) => (
          <TimelineClip
            key={clip.id}
            clip={clip}
            trackIndex={index}
            pixelsPerSecond={pixelsPerSecond}
          />
        ))}
      </div>
      
      {/* Grid Lines */}
      <TimelineGrid pixelsPerSecond={pixelsPerSecond} />
    </div>
  );
}

function TimelineClip({ 
  clip, 
  trackIndex, 
  pixelsPerSecond 
}: { 
  clip: Clip; 
  trackIndex: number; 
  pixelsPerSecond: number;
}) {
  const { selectClip, selectedClip } = useVideoEditor();
  const isSelected = selectedClip?.id === clip.id;
  
  const leftPosition = (clip.startTime || 0) * pixelsPerSecond;
  const width = (clip.duration || 5) * pixelsPerSecond;
  const top = trackIndex * 48; // 48px per track
  
  return (
    <div
      className={cn(
        "absolute h-11 rounded cursor-pointer overflow-hidden",
        "border-2 transition-all",
        isSelected 
          ? "border-blue-500 shadow-lg shadow-blue-500/50" 
          : "border-gray-700 hover:border-gray-600"
      )}
      style={{
        left: `${leftPosition}px`,
        width: `${width}px`,
        top: `${top}px`,
      }}
      onClick={() => selectClip(clip)}
      draggable
    >
      {/* Clip Background (Thumbnail or Waveform) */}
      {clip.type === 'video' && (
        <img
          src={clip.thumbnail}
          alt={clip.name}
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
      )}
      
      {clip.type === 'audio' && (
        <AudioWaveform audioUrl={clip.url} width={width} height={44} />
      )}
      
      {/* Clip Label */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-1">
        <span className="text-xs text-white truncate font-medium">{clip.name}</span>
      </div>
      
      {/* Resize Handles */}
      {isSelected && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 cursor-ew-resize" />
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500 cursor-ew-resize" />
        </>
      )}
      
      {/* Transition Indicator */}
      {clip.transition && (
        <div className="absolute -right-2 top-0 bottom-0 w-4 bg-gradient-to-r from-transparent to-purple-500/50 flex items-center justify-center">
          <ArrowRightLeft className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  );
}

function TimeRuler({ zoom, duration }: { zoom: number; duration: number }) {
  const pixelsPerSecond = 100 * zoom;
  const majorInterval = zoom < 0.5 ? 10 : zoom < 1 ? 5 : 1; // seconds
  
  return (
    <div className="h-8 bg-gray-900 border-t border-gray-800 relative overflow-hidden">
      <div className="absolute inset-0 flex">
        {Array.from({ length: Math.ceil(duration / majorInterval) + 1 }).map((_, i) => {
          const time = i * majorInterval;
          const left = time * pixelsPerSecond;
          
          return (
            <div
              key={i}
              className="absolute top-0 bottom-0 border-l border-gray-700"
              style={{ left: `${left}px` }}
            >
              <div className="mt-1 ml-1 text-xs text-gray-500">
                {formatTime(time)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
```

---

### **PHASE 6: Responsive Behavior**

Add resize handles and saved preferences:

```tsx
// src/hooks/useResizablePanels.ts
export function useResizablePanels() {
  const [leftWidth, setLeftWidth] = useState(
    () => parseInt(localStorage.getItem('leftPanelWidth') || '15')
  );
  const [rightWidth, setRightWidth] = useState(
    () => parseInt(localStorage.getItem('rightPanelWidth') || '25')
  );
  const [timelineHeight, setTimelineHeight] = useState(
    () => parseInt(localStorage.getItem('timelineHeight') || '40')
  );
  
  useEffect(() => {
    localStorage.setItem('leftPanelWidth', leftWidth.toString());
  }, [leftWidth]);
  
  useEffect(() => {
    localStorage.setItem('rightPanelWidth', rightWidth.toString());
  }, [rightWidth]);
  
  useEffect(() => {
    localStorage.setItem('timelineHeight', timelineHeight.toString());
  }, [timelineHeight]);
  
  return {
    leftWidth,
    setLeftWidth,
    rightWidth,
    setRightWidth,
    timelineHeight,
    setTimelineHeight,
  };
}
```

---

## 📦 Required Dependencies

Add these to `package.json`:

```json
{
  "dependencies": {
    "lucide-react": "^0.263.1",
    "@radix-ui/react-slider": "^1.1.2",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tabs": "^1.0.4",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  }
}
```

---

## 🎨 Tailwind Configuration

Update `tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        gray: {
          850: '#1a1d24',
          950: '#0f1117',
        },
      },
      height: {
        'screen-40': '40vh',
      },
    },
  },
};
```

---

## ✅ Testing Checklist

After implementation, verify:

- [ ] Preview is properly sized (not too large)
- [ ] Timeline takes up 40% of screen height
- [ ] All tracks are visible and labeled
- [ ] Clips can be dragged and dropped
- [ ] Zoom controls work smoothly
- [ ] Playhead moves correctly
- [ ] Properties panel shows relevant controls
- [ ] Assets sidebar is compact and accessible
- [ ] Layout is responsive (doesn't break on different screen sizes)
- [ ] Performance is smooth (60fps timeline scrubbing)

---

## 🚀 Deployment

1. Run local development:
   ```bash
   npm run dev
   ```

2. Test on localhost:3000

3. Once verified, deploy to production:
   ```bash
   git add .
   git commit -m "Redesigned video editor interface with CapCut-style timeline"
   git push
   ```

---

## 📝 Notes for Implementation

1. **Start with layout** - Get the proportions right first
2. **Then add timeline** - This is the most complex component
3. **Properties panel** - Simplify and make collapsible
4. **Polish last** - Animations, transitions, micro-interactions

**Estimated Implementation Time:** 8-12 hours for full redesign

**Priority Order:**
1. Layout restructure (2 hours)
2. Advanced timeline (4 hours)
3. Properties panel optimization (2 hours)
4. Assets sidebar (1 hour)
5. Polish & testing (2 hours)

Good luck with the redesign! 🎨
