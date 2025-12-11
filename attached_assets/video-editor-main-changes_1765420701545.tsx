// ============================================================================
// VIDEO EDITOR MAIN FILE CHANGES
// ============================================================================
// These changes integrate the new drag-drop transition system

// ============================================================================
// 1. ADD STATE FOR TRANSITION EDITING
// ============================================================================

// Add this state near other modal states (around line 230):
const [showTransitionEditModal, setShowTransitionEditModal] = useState(false);
const [editingTransition, setEditingTransition] = useState<{ position: number; transition: ClipTransitionLocal } | null>(null);

// ============================================================================
// 2. ADD TRANSITION HANDLERS
// ============================================================================

// Add these handlers after the clip handlers (around line 900):

// Handle transition edit
const handleTransitionEdit = useCallback((position: number) => {
  const transition = enhancements.clipTransitions.find(t => t.afterClipIndex === position);
  if (!transition) return;
  
  setEditingTransition({ position, transition });
  setShowTransitionEditModal(true);
}, [enhancements.clipTransitions]);

// Handle transition remove
const handleTransitionRemove = useCallback((position: number) => {
  setEnhancements(prev => {
    const newTransitions = prev.clipTransitions.filter(t => t.afterClipIndex !== position);
    return {
      ...prev,
      clipTransitions: newTransitions,
      // Switch back to 'none' mode if no transitions left
      transitionMode: newTransitions.length === 0 ? 'none' : 'perClip',
    };
  });
  
  toast({
    title: "Transition Removed",
    description: `Transition between clips ${position + 1} and ${position + 2} removed`,
  });
}, [toast]);

// Handle transition save from edit dialog
const handleTransitionSave = useCallback((position: number, updates: Partial<ClipTransitionLocal>) => {
  setEnhancements(prev => {
    const newTransitions = prev.clipTransitions.map(t => 
      t.afterClipIndex === position 
        ? { ...t, ...updates }
        : t
    );
    
    return {
      ...prev,
      clipTransitions: newTransitions,
    };
  });
  
  toast({
    title: "Transition Updated",
    description: `Transition between clips ${position + 1} and ${position + 2} updated`,
  });
}, [toast]);

// ============================================================================
// 3. UPDATE handleDragEnd TO HANDLE TRANSITION DROPS
// ============================================================================

// Replace the existing handleDragEnd function (around line 1100):

const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;

  if (!over) {
    console.log('[DRAG] No drop target, ignoring');
    return;
  }

  const activeId = String(active.id);
  const overId = String(over.id);
  
  console.log('[DRAG] handleDragEnd:', { activeId, overId, useMultiTrack });

  // ========================================================================
  // NEW: Handle transition drag to drop zone
  // ========================================================================
  const activeData = active.data.current;
  const overData = over.data.current;
  
  if (
    activeData?.type === 'transition' && 
    overData?.type === 'transition-zone'
  ) {
    const transitionType = activeData.transitionType as TransitionType;
    const position = overData.position as number;
    
    console.log('[DRAG] Transition drop:', { transitionType, position });
    
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
        toast({
          title: "Transition Replaced",
          description: `${transitionType} transition now between clips ${position + 1} and ${position + 2}`,
        });
      } else {
        // Add new transition
        newTransitions.push(newTransition);
        toast({
          title: "Transition Added",
          description: `${transitionType} transition added between clips ${position + 1} and ${position + 2}`,
        });
      }
      
      return {
        ...prev,
        transitionMode: 'perClip',
        clipTransitions: newTransitions,
      };
    });
    
    // Mark preview as stale
    setPreviewStatus('stale');
    
    return; // IMPORTANT: Don't fall through to other drag handling
  }

  // ========================================================================
  // In multi-track mode, ONLY handle media-to-track drops
  // ========================================================================
  if (useMultiTrack) {
    if (!(activeId.startsWith('draggable-') && overId.startsWith('track-drop-'))) {
      console.log('[DRAG] Multi-track mode: ignoring non-media drag');
      return;
    }
  }

  // ========================================================================
  // Handle media drag to track (existing code)
  // ========================================================================
  if (activeId.startsWith('draggable-') && overId.startsWith('track-drop-')) {
    const dragData = active.data.current as { 
      type: string; 
      mediaType: 'video' | 'image' | 'audio';
      item: DroppedMediaItem;
    };
    
    const dropData = over.data.current as { trackId: string; trackType: string } | undefined;
    
    if (dragData?.type === 'media-item' && dragData.item?.url) {
      const mediaType = dragData.mediaType;
      const item = dragData.item;
      const trackId = dropData?.trackId || 'video-0';
      
      const instanceId = `${item.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      if (useMultiTrack) {
        // Multi-track handling (existing code)
        const getTrackNumberFromId = (id: string): number => {
          const mapping: Record<string, number> = {
            'video-0': 0,
            'video-1': 1,
            'text-0': 2,
            'audio-0': 3,
            'audio-1': 4,
          };
          return mapping[id] ?? 0;
        };
        
        const trackNumber = getTrackNumberFromId(trackId);
        const currentMaxEnd = multiTrackItems
          .filter(i => i.track === trackNumber)
          .reduce((max, i) => Math.max(max, i.startTime + i.duration), 0);
        
        const itemDuration = item.duration || (mediaType === 'image' ? 5 : 10);
        
        const newItem: MultiTrackTimelineItem = {
          id: instanceId,
          type: mediaType,
          track: trackNumber,
          startTime: currentMaxEnd,
          duration: itemDuration,
          originalDuration: itemDuration,
          url: item.url,
          thumbnailUrl: item.thumbnailUrl,
          name: item.name,
          volume: mediaType === 'audio' ? 100 : undefined,
          speed: 1,
        };
        
        console.log('[DRAG] Adding to multi-track:', newItem);
        
        setMultiTrackItems(prev => {
          const updated = [...prev, newItem];
          console.log('[DRAG] Updated multi-track items:', updated);
          return updated;
        });
        
        setMultiTrackKey(prev => prev + 1);
        
        toast({
          title: "Added to Timeline",
          description: `${mediaType} added to ${trackId.replace('-', ' ').toUpperCase()} track`,
        });
      } else {
        // Single-track handling (existing code)
        if (mediaType === 'audio') {
          const audioTrack = {
            id: instanceId,
            url: item.url,
            name: item.name || 'Audio track',
            type: 'music' as const,
            volume: 1,
          };
          setAudioTracks(prev => [...prev, audioTrack]);
        } else {
          const clip: VideoClip = {
            id: instanceId,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl || null,
            prompt: item.name || '',
            createdAt: new Date().toISOString(),
            type: mediaType,
          };
          setOrderedClips(prev => [...prev, clip]);
        }
        
        toast({
          title: "Added to timeline",
          description: `${mediaType === 'video' ? 'Video' : mediaType === 'image' ? 'Image' : 'Audio'} added to timeline`,
        });
      }
      
      return;
    }
  }

  // ========================================================================
  // Handle clip reordering in single-track mode (existing code)
  // ========================================================================
  if (active.id !== over.id && !activeId.startsWith('draggable-')) {
    setOrderedClips((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  }
};

// ============================================================================
// 4. UPDATE TRANSITIONS SIDEBAR TO USE DRAGGABLE TRANSITIONS
// ============================================================================

// Replace the transitions category content (around line 2050):

{activeCategory === 'transitions' && (
  <div className="space-y-4 p-3">
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Drag transitions to the timeline between clips
      </p>
      {orderedClips.length < 2 && (
        <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 text-xs">
          <p className="font-medium mb-1">Add more clips</p>
          <p>You need at least 2 clips to add transitions between them.</p>
        </div>
      )}
    </div>
    
    {/* Fade transitions */}
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">Fade Effects</p>
      <div className="grid grid-cols-2 gap-2">
        <DraggableTransition
          type="fade"
          icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
          label="Fade"
        />
        <DraggableTransition
          type="dissolve"
          icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
          label="Dissolve"
        />
        <DraggableTransition
          type="fadeblack"
          icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
          label="Fade Black"
        />
        <DraggableTransition
          type="fadewhite"
          icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
          label="Fade White"
        />
      </div>
    </div>
    
    {/* Wipe transitions */}
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">Wipe Effects</p>
      <div className="grid grid-cols-2 gap-2">
        <DraggableTransition
          type="wipeleft"
          icon={<ArrowRight className="h-4 w-4 text-muted-foreground rotate-180" />}
          label="Wipe Left"
        />
        <DraggableTransition
          type="wiperight"
          icon={<ArrowRight className="h-4 w-4 text-muted-foreground" />}
          label="Wipe Right"
        />
        <DraggableTransition
          type="wipeup"
          icon={<ArrowRight className="h-4 w-4 text-muted-foreground -rotate-90" />}
          label="Wipe Up"
        />
        <DraggableTransition
          type="wipedown"
          icon={<ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />}
          label="Wipe Down"
        />
      </div>
    </div>
    
    {/* Slide transitions */}
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">Slide Effects</p>
      <div className="grid grid-cols-2 gap-2">
        <DraggableTransition
          type="slideleft"
          icon={<Film className="h-4 w-4 text-muted-foreground" />}
          label="Slide Left"
        />
        <DraggableTransition
          type="slideright"
          icon={<Film className="h-4 w-4 text-muted-foreground" />}
          label="Slide Right"
        />
        <DraggableTransition
          type="slideup"
          icon={<Film className="h-4 w-4 text-muted-foreground" />}
          label="Slide Up"
        />
        <DraggableTransition
          type="slidedown"
          icon={<Film className="h-4 w-4 text-muted-foreground" />}
          label="Slide Down"
        />
      </div>
    </div>
    
    {/* Shape transitions */}
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">Shape Effects</p>
      <div className="grid grid-cols-2 gap-2">
        <DraggableTransition
          type="circleopen"
          icon={<Layers className="h-4 w-4 text-muted-foreground" />}
          label="Circle Open"
        />
        <DraggableTransition
          type="circleclose"
          icon={<Layers className="h-4 w-4 text-muted-foreground" />}
          label="Circle Close"
        />
        <DraggableTransition
          type="radial"
          icon={<Layers className="h-4 w-4 text-muted-foreground" />}
          label="Radial"
        />
        <DraggableTransition
          type="pixelize"
          icon={<Layers className="h-4 w-4 text-muted-foreground" />}
          label="Pixelize"
        />
      </div>
    </div>
    
    {/* Active transitions list */}
    {enhancements.clipTransitions.length > 0 && (
      <div className="pt-4 border-t space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Active Transitions ({enhancements.clipTransitions.length})
        </p>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {enhancements.clipTransitions
            .sort((a, b) => a.afterClipIndex - b.afterClipIndex)
            .map((transition) => (
              <div 
                key={transition.afterClipIndex} 
                className="flex items-center justify-between p-2 rounded-md bg-muted/50 border text-xs"
              >
                <div className="flex items-center gap-2">
                  <Shuffle className="h-3 w-3 text-primary" />
                  <span>
                    Clip {transition.afterClipIndex + 1} → {transition.afterClipIndex + 2}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {transition.type}
                  </Badge>
                  <span className="text-muted-foreground">{transition.durationSeconds}s</span>
                </div>
              </div>
            ))}
        </div>
      </div>
    )}
  </div>
)}

// ============================================================================
// 5. UPDATE TIMELINE TRACK PROPS
// ============================================================================

// Update the TimelineTrack component call (around line 2600):

<TimelineTrack
  clips={orderedClips}
  audioTracks={audioTracks}
  getClipSettings={getClipSettings}
  onMuteToggle={toggleClipMute}
  onRemoveClip={removeClipFromTimeline}
  onRemoveAudioTrack={removeAudioTrack}
  onOpenSettings={openClipSettings}
  totalDuration={totalDuration}
  clipTransitions={enhancements.clipTransitions}
  onTransitionEdit={handleTransitionEdit}
  onTransitionRemove={handleTransitionRemove}
/>

// ============================================================================
// 6. ADD TRANSITION EDIT DIALOG
// ============================================================================

// Add this dialog after the other dialogs (around line 2800):

{/* Transition Edit Dialog */}
{editingTransition && (
  <TransitionEditDialog
    open={showTransitionEditModal}
    onOpenChange={setShowTransitionEditModal}
    position={editingTransition.position}
    transition={editingTransition.transition}
    onSave={handleTransitionSave}
  />
)}
