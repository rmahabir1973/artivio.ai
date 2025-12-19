# Build Custom Timeline with React DnD for Artivio

## 🎯 Goal
Build a professional CapCut-style timeline that integrates with your existing FFmpeg VPS pipeline.

**KEY:** This timeline is just a UI component that outputs JSON data. Your existing FFmpeg server.js processes the actual video.

---

## 📦 Required Libraries

```bash
# Drag & Drop
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# State Management
npm install zustand

# Utilities
npm install clsx tailwind-merge

# Waveform Visualization
npm install wavesurfer.js

# Icons
npm install lucide-react
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Timeline UI (React)                │
│  - User drags clips                                 │
│  - User trims clips                                 │
│  - User adds transitions                            │
│  → Outputs: Timeline JSON                           │
└─────────────────────────────────────────────────────┘
                        ↓
              Timeline Data Structure:
              {
                clips: [
                  {
                    id: "clip1",
                    sourceUrl: "s3://...",
                    startTime: 0,
                    duration: 10,
                    trackId: "video1",
                    trim: { start: 0, end: 10 }
                  }
                ],
                transitions: [...]
              }
                        ↓
┌─────────────────────────────────────────────────────┐
│              Your Existing Backend                   │
│  POST /api/video-editor/export                      │
│  → Receives timeline JSON                           │
│  → Sends to VPS server.js                           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│         Your VPS with FFmpeg 8.0.1                  │
│  server.js receives job                             │
│  → Downloads clips from S3                          │
│  → Runs FFmpeg with transitions                     │
│  → Uploads output to S3                             │
│  → Callback to backend                              │
└─────────────────────────────────────────────────────┘
```

**Key Point:** Timeline is JUST a UI component. Your FFmpeg pipeline stays intact!

---

## 📁 File Structure

```
src/components/VideoEditor/
├── Timeline/
│   ├── Timeline.tsx                 # Main container
│   ├── TimelineCanvas.tsx           # Scrollable canvas
│   ├── TimelineTrack.tsx            # Single track (Video 1, Audio, etc.)
│   ├── TimelineClip.tsx             # Draggable clip component
│   ├── TimelineClipTrimHandle.tsx   # Trim handles
│   ├── TimelineRuler.tsx            # Time markers
│   ├── TimelinePlayhead.tsx         # Scrubber
│   ├── TimelineZoomControls.tsx     # Zoom in/out
│   ├── hooks/
│   │   ├── useTimelineStore.ts      # Zustand store
│   │   ├── useTimelineDrag.ts       # Drag logic
│   │   └── useTimelineTrim.ts       # Trim logic
│   └── utils/
│       ├── timelineCalculations.ts  # Time/pixel conversions
│       └── snapToGrid.ts            # Snap logic
```

---

## 🎨 Component Implementation

### 1. Timeline Store (Zustand)

```typescript
// src/components/VideoEditor/Timeline/hooks/useTimelineStore.ts
import { create } from 'zustand';

export interface TimelineClip {
  id: string;
  sourceUrl: string;
  thumbnail?: string;
  trackId: string;
  startTime: number; // seconds
  duration: number; // seconds
  trimStart: number; // seconds from original start
  trimEnd: number; // seconds from original end
  originalDuration: number;
  type: 'video' | 'audio' | 'image';
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'effects';
  clips: TimelineClip[];
}

interface TimelineStore {
  tracks: TimelineTrack[];
  zoom: number; // 0.1 to 3.0
  currentTime: number;
  duration: number;
  
  // Actions
  addClip: (trackId: string, clip: Omit<TimelineClip, 'id'>) => void;
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => void;
  trimClip: (clipId: string, trimStart: number, trimEnd: number) => void;
  deleteClip: (clipId: string) => void;
  setZoom: (zoom: number) => void;
  setCurrentTime: (time: number) => void;
}

export const useTimelineStore = create<TimelineStore>((set) => ({
  tracks: [
    { id: 'video1', name: 'Video 1', type: 'video', clips: [] },
    { id: 'video2', name: 'Video 2', type: 'video', clips: [] },
    { id: 'audio', name: 'Audio', type: 'audio', clips: [] },
  ],
  zoom: 1,
  currentTime: 0,
  duration: 60,
  
  addClip: (trackId, clipData) => set((state) => {
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return state;
    
    const newClip: TimelineClip = {
      ...clipData,
      id: `clip-${Date.now()}`,
      trimStart: 0,
      trimEnd: clipData.duration,
      originalDuration: clipData.duration,
    };
    
    return {
      tracks: state.tracks.map(t =>
        t.id === trackId
          ? { ...t, clips: [...t.clips, newClip] }
          : t
      )
    };
  }),
  
  moveClip: (clipId, newTrackId, newStartTime) => set((state) => {
    // Find and remove clip from current track
    let movedClip: TimelineClip | undefined;
    const tracksWithoutClip = state.tracks.map(track => ({
      ...track,
      clips: track.clips.filter(clip => {
        if (clip.id === clipId) {
          movedClip = clip;
          return false;
        }
        return true;
      })
    }));
    
    if (!movedClip) return state;
    
    // Add clip to new track with new start time
    return {
      tracks: tracksWithoutClip.map(track =>
        track.id === newTrackId
          ? {
              ...track,
              clips: [...track.clips, { ...movedClip, trackId: newTrackId, startTime: newStartTime }]
            }
          : track
      )
    };
  }),
  
  trimClip: (clipId, trimStart, trimEnd) => set((state) => ({
    tracks: state.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip =>
        clip.id === clipId
          ? {
              ...clip,
              trimStart,
              trimEnd,
              duration: trimEnd - trimStart
            }
          : clip
      )
    }))
  })),
  
  deleteClip: (clipId) => set((state) => ({
    tracks: state.tracks.map(track => ({
      ...track,
      clips: track.clips.filter(c => c.id !== clipId)
    }))
  })),
  
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),
  
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
}));
```

---

### 2. Main Timeline Component

```typescript
// src/components/VideoEditor/Timeline/Timeline.tsx
import { DndContext, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useState } from 'react';
import { TimelineCanvas } from './TimelineCanvas';
import { TimelineZoomControls } from './TimelineZoomControls';
import { useTimelineStore } from './hooks/useTimelineStore';

export function Timeline() {
  const { tracks, zoom, setZoom, moveClip } = useTimelineStore();
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  
  const handleDragStart = (event: DragStartEvent) => {
    setActiveClipId(event.active.id as string);
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveClipId(null);
      return;
    }
    
    // Parse drop location
    const overData = over.data.current;
    const newTrackId = overData?.trackId;
    const newStartTime = overData?.startTime;
    
    if (newTrackId && newStartTime !== undefined) {
      moveClip(active.id as string, newTrackId, newStartTime);
    }
    
    setActiveClipId(null);
  };
  
  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Toolbar */}
      <div className="h-10 bg-gray-900 border-b border-gray-800 flex items-center px-4">
        <TimelineZoomControls zoom={zoom} onZoomChange={setZoom} />
        
        <div className="flex-1" />
        
        {/* Additional controls */}
        <button className="px-3 py-1 text-sm hover:bg-gray-800 rounded">
          Split
        </button>
      </div>
      
      {/* Timeline Canvas */}
      <div className="flex-1 overflow-hidden">
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <TimelineCanvas tracks={tracks} activeClipId={activeClipId} />
        </DndContext>
      </div>
    </div>
  );
}
```

---

### 3. Timeline Canvas (Scrollable Area)

```typescript
// src/components/VideoEditor/Timeline/TimelineCanvas.tsx
import { useDroppable } from '@dnd-kit/core';
import { TimelineTrack } from './TimelineTrack';
import { TimelineRuler } from './TimelineRuler';
import { TimelinePlayhead } from './TimelinePlayhead';
import { useTimelineStore } from './hooks/useTimelineStore';
import type { TimelineTrack as Track } from './hooks/useTimelineStore';

interface Props {
  tracks: Track[];
  activeClipId: string | null;
}

export function TimelineCanvas({ tracks, activeClipId }: Props) {
  const { zoom, duration, currentTime } = useTimelineStore();
  
  const pixelsPerSecond = 100 * zoom; // 100px per second at 1x zoom
  const totalWidth = duration * pixelsPerSecond;
  
  return (
    <div className="h-full flex">
      {/* Track Headers (Fixed Left) */}
      <div className="w-40 bg-gray-900 border-r border-gray-800 flex-shrink-0">
        {tracks.map(track => (
          <div
            key={track.id}
            className="h-16 border-b border-gray-800 flex items-center px-4"
          >
            <span className="text-sm font-medium text-gray-300">{track.name}</span>
          </div>
        ))}
      </div>
      
      {/* Scrollable Timeline Area */}
      <div className="flex-1 overflow-auto relative">
        <div className="relative" style={{ width: totalWidth, minHeight: '100%' }}>
          {/* Playhead */}
          <TimelinePlayhead currentTime={currentTime} pixelsPerSecond={pixelsPerSecond} />
          
          {/* Tracks */}
          <div>
            {tracks.map((track, index) => (
              <TimelineTrack
                key={track.id}
                track={track}
                pixelsPerSecond={pixelsPerSecond}
                isActive={track.clips.some(c => c.id === activeClipId)}
              />
            ))}
          </div>
          
          {/* Time Ruler (Bottom) */}
          <TimelineRuler duration={duration} pixelsPerSecond={pixelsPerSecond} />
        </div>
      </div>
    </div>
  );
}
```

---

### 4. Timeline Track

```typescript
// src/components/VideoEditor/Timeline/TimelineTrack.tsx
import { useDroppable } from '@dnd-kit/core';
import { TimelineClip } from './TimelineClip';
import type { TimelineTrack as Track } from './hooks/useTimelineStore';

interface Props {
  track: Track;
  pixelsPerSecond: number;
  isActive: boolean;
}

export function TimelineTrack({ track, pixelsPerSecond, isActive }: Props) {
  const { setNodeRef } = useDroppable({
    id: `track-${track.id}`,
    data: { trackId: track.id }
  });
  
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-16 border-b border-gray-800 relative",
        isActive && "bg-gray-800/50"
      )}
    >
      {track.clips.map(clip => (
        <TimelineClip
          key={clip.id}
          clip={clip}
          pixelsPerSecond={pixelsPerSecond}
        />
      ))}
    </div>
  );
}
```

---

### 5. Draggable Timeline Clip

```typescript
// src/components/VideoEditor/Timeline/TimelineClip.tsx
import { useDraggable } from '@dnd-kit/core';
import { useState } from 'react';
import { TimelineClipTrimHandle } from './TimelineClipTrimHandle';
import type { TimelineClip as Clip } from './hooks/useTimelineStore';

interface Props {
  clip: Clip;
  pixelsPerSecond: number;
}

export function TimelineClip({ clip, pixelsPerSecond }: Props) {
  const [isSelected, setIsSelected] = useState(false);
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: clip.id,
    data: { clip }
  });
  
  const leftPosition = clip.startTime * pixelsPerSecond;
  const width = clip.duration * pixelsPerSecond;
  
  const style = {
    left: `${leftPosition}px`,
    width: `${width}px`,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "absolute top-1 h-14 rounded cursor-move overflow-hidden",
        "border-2 transition-all",
        isSelected ? "border-blue-500 shadow-lg" : "border-gray-600"
      )}
      onClick={() => setIsSelected(true)}
      {...listeners}
      {...attributes}
    >
      {/* Clip Background/Thumbnail */}
      {clip.thumbnail && (
        <img
          src={clip.thumbnail}
          alt={clip.id}
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
      )}
      
      {/* Clip Label */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
        <span className="text-xs text-white truncate font-medium">
          {clip.id} - {clip.duration.toFixed(1)}s
        </span>
      </div>
      
      {/* Trim Handles (Only when selected) */}
      {isSelected && (
        <>
          <TimelineClipTrimHandle
            clipId={clip.id}
            side="left"
            clip={clip}
            pixelsPerSecond={pixelsPerSecond}
          />
          <TimelineClipTrimHandle
            clipId={clip.id}
            side="right"
            clip={clip}
            pixelsPerSecond={pixelsPerSecond}
          />
        </>
      )}
    </div>
  );
}
```

---

### 6. Trim Handles

```typescript
// src/components/VideoEditor/Timeline/TimelineClipTrimHandle.tsx
import { useState } from 'react';
import { useTimelineStore } from './hooks/useTimelineStore';
import type { TimelineClip } from './hooks/useTimelineStore';

interface Props {
  clipId: string;
  side: 'left' | 'right';
  clip: TimelineClip;
  pixelsPerSecond: number;
}

export function TimelineClipTrimHandle({ clipId, side, clip, pixelsPerSecond }: Props) {
  const { trimClip } = useTimelineStore();
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [originalTrim, setOriginalTrim] = useState({ start: clip.trimStart, end: clip.trimEnd });
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    setStartX(e.clientX);
    setOriginalTrim({ start: clip.trimStart, end: clip.trimEnd });
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaTime = deltaX / pixelsPerSecond;
    
    if (side === 'left') {
      // Trimming from start
      const newTrimStart = Math.max(0, Math.min(
        originalTrim.start + deltaTime,
        clip.originalDuration - 0.1 // Minimum 0.1s clip
      ));
      trimClip(clipId, newTrimStart, originalTrim.end);
    } else {
      // Trimming from end
      const newTrimEnd = Math.max(originalTrim.start + 0.1, Math.min(
        originalTrim.end + deltaTime,
        clip.originalDuration
      ));
      trimClip(clipId, originalTrim.start, newTrimEnd);
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
  
  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 w-1 bg-blue-500 cursor-ew-resize hover:w-2 transition-all",
        side === 'left' ? 'left-0' : 'right-0',
        isDragging && "w-2 bg-blue-400"
      )}
      onMouseDown={handleMouseDown}
    />
  );
}
```

---

## 🔗 Integration with Your Backend

When user clicks "Export":

```typescript
// Export timeline data to backend
async function handleExport() {
  const { tracks } = useTimelineStore.getState();
  
  // Convert timeline UI state to export format
  const exportData = {
    clips: tracks.flatMap(track => 
      track.clips.map(clip => ({
        sourceUrl: clip.sourceUrl,
        startTime: clip.startTime,
        duration: clip.duration,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
      }))
    ),
    enhancements: {
      // transitions, effects, etc.
    }
  };
  
  // Send to your existing backend
  const response = await fetch('http://your-vps:3001/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId: generateJobId(),
      clips: exportData.clips,
      enhancements: exportData.enhancements,
      callbackUrl: `${window.location.origin}/api/callback`
    })
  });
  
  // Your existing server.js processes it with FFmpeg!
}
```

---

## ⏱️ Implementation Timeline

| Day | Task | Hours |
|-----|------|-------|
| **Day 1** | Setup stores, basic layout | 6h |
| **Day 2** | Drag & drop with @dnd-kit | 8h |
| **Day 3** | Trim handles functionality | 8h |
| **Day 4** | Polish, zoom, keyboard shortcuts | 6h |
| **Day 5** | Integration with backend, testing | 4h |

**Total: ~32 hours = 4-5 days**

---

## ✅ Advantages of This Approach

1. ✅ **Keeps your FFmpeg pipeline** - No changes to server.js
2. ✅ **Works with Vite** - No Next.js migration needed
3. ✅ **Full control** - Customize everything
4. ✅ **Modern libraries** - @dnd-kit is industry standard
5. ✅ **Reasonable timeline** - 5 days vs 6 weeks from scratch

---

## 🎯 Summary

**Don't use RVE** - It conflicts with your FFmpeg architecture.

**Instead:** Build custom timeline with:
- @dnd-kit for drag-and-drop
- Zustand for state
- Your existing FFmpeg pipeline

**Timeline:** 5 days of focused work

**Result:** Professional CapCut-style timeline that outputs JSON data for your server.js to process!

This is what Replit should build! 🚀
