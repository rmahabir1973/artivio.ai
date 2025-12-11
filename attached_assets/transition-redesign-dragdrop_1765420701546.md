# Transition System Redesign - Drag & Drop Between Clips

## Current Problems

1. ❌ Can't drag transitions to timeline
2. ❌ Transitions add sequentially (can't choose specific position)
3. ❌ Can't change/edit transitions after adding
4. ❌ No visual representation of transitions on timeline
5. ❌ Not intuitive like professional editors (Camtasia, Premiere, DaVinci)

## Solution: Professional Drag-and-Drop Transition System

### Key Features

1. ✅ **Drag transitions from sidebar** → Drop between clips on timeline
2. ✅ **Visual transition zones** - Clear drop targets between clips
3. ✅ **Edit transitions** - Click to modify type/duration
4. ✅ **Remove transitions** - Right-click or delete button
5. ✅ **Visual indicators** - Icons showing transition type between clips

### Architecture Changes

#### 1. Timeline Clip Structure

Add transition zones between clips:

```
[Clip 1] [TRANSITION ZONE] [Clip 2] [TRANSITION ZONE] [Clip 3]
```

Each transition zone:
- Acts as a drop target for draggable transitions
- Shows current transition (if any)
- Allows editing/removing transitions

#### 2. Draggable Transition Items

In the Effects/Transitions sidebar, each transition becomes draggable:

```tsx
<DraggableTransition 
  type="fade"
  icon={<Sparkles />}
  label="Fade"
/>
```

#### 3. Drop Zones Between Clips

Between each clip pair on the timeline, add a drop zone:

```tsx
<TransitionDropZone
  position={clipIndex} // Between clip N and N+1
  currentTransition={transitionAtPosition}
  onDrop={handleTransitionDrop}
  onEdit={handleTransitionEdit}
  onRemove={handleTransitionRemove}
/>
```

### Implementation Plan

## Step 1: Create Draggable Transition Component

```tsx
// In video-editor/components.tsx or similar

interface DraggableTransitionProps {
  type: TransitionType;
  icon: React.ReactNode;
  label: string;
}

export function DraggableTransition({ type, icon, label }: DraggableTransitionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ 
    id: `transition-${type}`,
    data: { 
      type: 'transition',
      transitionType: type,
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-2 border rounded-md cursor-grab active:cursor-grabbing hover:bg-muted/50 text-center"
    >
      {icon}
      <span className="text-xs capitalize block mt-1">{label}</span>
    </div>
  );
}
```

## Step 2: Create Transition Drop Zone Component

```tsx
interface TransitionDropZoneProps {
  position: number; // After which clip (0-based)
  currentTransition?: ClipTransitionLocal;
  onDrop: (position: number, type: TransitionType) => void;
  onEdit: (position: number) => void;
  onRemove: (position: number) => void;
}

export function TransitionDropZone({
  position,
  currentTransition,
  onDrop,
  onEdit,
  onRemove,
}: TransitionDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `transition-drop-${position}`,
    data: {
      type: 'transition-zone',
      position,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col items-center justify-center shrink-0",
        "transition-all duration-200",
        isOver ? "w-16 bg-primary/20 border-2 border-primary border-dashed" : "w-8",
        currentTransition ? "w-12" : ""
      )}
    >
      {/* Visual indicator */}
      {currentTransition ? (
        <div className="flex flex-col items-center gap-1 py-2">
          <div className="w-px h-6 bg-primary" />
          
          {/* Transition icon badge */}
          <div className="relative group">
            <Badge 
              variant="secondary" 
              className="cursor-pointer hover:bg-primary/20"
              onClick={() => onEdit(position)}
            >
              <Shuffle className="h-3 w-3" />
            </Badge>
            
            {/* Hover tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block">
              <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                {currentTransition.type} ({currentTransition.durationSeconds}s)
              </div>
            </div>
            
            {/* Remove button */}
            <Button
              size="icon"
              variant="ghost"
              className="absolute -top-1 -right-1 h-4 w-4 p-0 opacity-0 group-hover:opacity-100 bg-destructive text-destructive-foreground rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(position);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="w-px h-6 bg-primary" />
        </div>
      ) : (
        <div className={cn(
          "flex flex-col items-center py-2",
          isOver && "animate-pulse"
        )}>
          <div className="w-px h-4 bg-border" />
          <div className={cn(
            "h-2 w-2 rounded-full border-2",
            isOver ? "border-primary bg-primary" : "border-border"
          )} />
          <div className="w-px h-4 bg-border" />
        </div>
      )}
    </div>
  );
}
```

## Step 3: Update Timeline Track Component

Modify the timeline to include transition drop zones between clips:

```tsx
export function TimelineTrack({
  clips,
  // ... other props
}: TimelineTrackProps) {
  return (
    <div className="p-4 border-t bg-muted/30">
      <div className="flex items-center gap-1 overflow-x-auto">
        {clips.map((clip, index) => (
          <React.Fragment key={clip.id}>
            {/* The clip itself */}
            <SortableClip
              clip={clip}
              clipIndex={index}
              // ... other props
            />
            
            {/* Transition drop zone (after each clip except the last) */}
            {index < clips.length - 1 && (
              <TransitionDropZone
                position={index}
                currentTransition={getTransitionAtPosition(index)}
                onDrop={handleTransitionDrop}
                onEdit={handleTransitionEdit}
                onRemove={handleTransitionRemove}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
```

## Step 4: Update Main Video Editor handleDragEnd

```tsx
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;

  if (!over) return;

  const activeData = active.data.current;
  const overData = over.data.current;

  // Handle transition drag to drop zone
  if (
    activeData?.type === 'transition' && 
    overData?.type === 'transition-zone'
  ) {
    const transitionType = activeData.transitionType as TransitionType;
    const position = overData.position as number;
    
    // Add or update transition at position
    setEnhancements(prev => {
      const newTransitions = [...prev.clipTransitions];
      const existingIndex = newTransitions.findIndex(t => t.afterClipIndex === position);
      
      const newTransition: ClipTransitionLocal = {
        afterClipIndex: position,
        type: transitionType,
        durationSeconds: 1.0, // Default duration
      };
      
      if (existingIndex >= 0) {
        // Replace existing transition
        newTransitions[existingIndex] = newTransition;
      } else {
        // Add new transition
        newTransitions.push(newTransition);
      }
      
      return {
        ...prev,
        transitionMode: 'perClip',
        clipTransitions: newTransitions,
      };
    });
    
    toast({
      title: "Transition Added",
      description: `${transitionType} transition added between clips ${position + 1} and ${position + 2}`,
    });
    
    return; // Important: don't fall through to clip reordering
  }

  // ... rest of existing drag handling (clip reordering, media drops, etc.)
};
```

## Step 5: Helper Functions

```tsx
// Get transition at a specific position
const getTransitionAtPosition = useCallback((position: number): ClipTransitionLocal | undefined => {
  return enhancements.clipTransitions.find(t => t.afterClipIndex === position);
}, [enhancements.clipTransitions]);

// Handle transition drop
const handleTransitionDrop = useCallback((position: number, type: TransitionType) => {
  setEnhancements(prev => {
    const newTransitions = [...prev.clipTransitions];
    const existingIndex = newTransitions.findIndex(t => t.afterClipIndex === position);
    
    const newTransition: ClipTransitionLocal = {
      afterClipIndex: position,
      type,
      durationSeconds: 1.0,
    };
    
    if (existingIndex >= 0) {
      newTransitions[existingIndex] = newTransition;
    } else {
      newTransitions.push(newTransition);
    }
    
    return {
      ...prev,
      transitionMode: 'perClip',
      clipTransitions: newTransitions,
    };
  });
}, []);

// Handle transition edit
const handleTransitionEdit = useCallback((position: number) => {
  const transition = getTransitionAtPosition(position);
  if (!transition) return;
  
  // Open edit dialog
  setEditingTransition({ position, transition });
  setShowTransitionEditModal(true);
}, [getTransitionAtPosition]);

// Handle transition remove
const handleTransitionRemove = useCallback((position: number) => {
  setEnhancements(prev => ({
    ...prev,
    clipTransitions: prev.clipTransitions.filter(t => t.afterClipIndex !== position),
    transitionMode: prev.clipTransitions.length <= 1 ? 'none' : 'perClip',
  }));
  
  toast({
    title: "Transition Removed",
    description: `Transition between clips ${position + 1} and ${position + 2} removed`,
  });
}, [toast]);
```

## Step 6: Transition Edit Dialog

```tsx
interface TransitionEditModalProps {
  position: number;
  transition: ClipTransitionLocal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (position: number, updates: Partial<ClipTransitionLocal>) => void;
}

export function TransitionEditModal({
  position,
  transition,
  open,
  onOpenChange,
  onSave,
}: TransitionEditModalProps) {
  const [type, setType] = useState(transition.type);
  const [duration, setDuration] = useState(transition.durationSeconds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Transition</DialogTitle>
          <DialogDescription>
            Customize the transition between clips {position + 1} and {position + 2}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Transition Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TransitionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fade">Fade</SelectItem>
                <SelectItem value="dissolve">Dissolve</SelectItem>
                <SelectItem value="wipeleft">Wipe Left</SelectItem>
                <SelectItem value="wiperight">Wipe Right</SelectItem>
                <SelectItem value="circleopen">Circle Open</SelectItem>
                {/* Add all other transition types */}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Duration: {duration}s</Label>
            <Slider
              value={[duration]}
              min={0.25}
              max={3}
              step={0.25}
              onValueChange={([v]) => setDuration(v)}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => {
            onSave(position, { type, durationSeconds: duration });
            onOpenChange(false);
          }}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Step 7: Update Transitions Sidebar

Replace the click-to-add system with drag-to-drop:

```tsx
{activeCategory === 'transitions' && (
  <div className="space-y-3 p-3">
    <p className="text-sm text-muted-foreground">
      Drag transitions to the timeline between clips
    </p>
    
    {/* Fade transitions */}
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">Fade Effects</p>
      <div className="grid grid-cols-2 gap-2">
        {(['fade', 'dissolve', 'fadeblack', 'fadewhite'] as TransitionType[]).map((type) => (
          <DraggableTransition
            key={type}
            type={type}
            icon={<Sparkles className="h-4 w-4 mx-auto text-muted-foreground" />}
            label={type}
          />
        ))}
      </div>
    </div>
    
    {/* Wipe transitions */}
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">Wipe Effects</p>
      <div className="grid grid-cols-2 gap-2">
        {(['wipeleft', 'wiperight', 'wipeup', 'wipedown'] as TransitionType[]).map((type) => (
          <DraggableTransition
            key={type}
            type={type}
            icon={<ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />}
            label={type.replace('wipe', '')}
          />
        ))}
      </div>
    </div>
    
    {/* Continue for other transition groups... */}
  </div>
)}
```

## Visual Example of Timeline

```
Before (current):
[Clip 1] [Clip 2] [Clip 3] [Clip 4]

After (new design):
[Clip 1] [●] [Clip 2] [FADE↔] [Clip 3] [●] [Clip 4]
         ↑            ↑                ↑
    empty zone   has fade        empty zone
  (drop target) (click to edit)  (drop target)
```

## Benefits

1. ✅ **Intuitive** - Drag-and-drop like Camtasia/Premiere
2. ✅ **Visual** - See transitions on timeline
3. ✅ **Editable** - Click to change type/duration
4. ✅ **Removable** - Easy to delete
5. ✅ **Professional** - Industry-standard workflow

## Migration Notes

- Old transition system data is compatible (clipTransitions array)
- Just changing the UI/UX, not the data structure
- Backend Lambda code needs no changes
