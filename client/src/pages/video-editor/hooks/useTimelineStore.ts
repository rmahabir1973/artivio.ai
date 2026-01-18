import { useState, useCallback, useMemo, createContext, useContext, useRef } from 'react';

export interface TimelineClip {
  id: string;
  sourceUrl: string;
  thumbnailUrl: string | null;
  prompt: string;
  type: 'video' | 'image';
  trackId: string;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  originalDuration: number;
  speed: number;
  volume: number;
  muted: boolean;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'effects';
  locked: boolean;
  visible: boolean;
  clips: TimelineClip[];
}

export interface TimelineAudioTrack {
  id: string;
  url: string;
  name: string;
  type: 'music' | 'voice' | 'sfx';
  volume: number;
  startTime: number;
  duration: number;
}

export interface TimelineMarker {
  id: string;
  time: number;
  label: string;
  color: string;
}

export interface TimelineTransition {
  id: string;
  afterClipId: string;
  type: string;
  durationSeconds: number;
}

// Note: Cross-layer transitions have been removed - only sequential transitions are supported
// This interface is kept for type compatibility but is no longer used
export interface CrossLayerTransition {
  id: string;
  fromClipId: string;
  toClipId: string;
  type: string;
  durationSeconds: number;
}

export interface SelectionState {
  selectedClipIds: Set<string>;
  lastSelectedClipId: string | null;
}

export interface TimelineState {
  tracks: TimelineTrack[];
  audioTracks: TimelineAudioTrack[];
  markers: TimelineMarker[];
  transitions: TimelineTransition[];
  crossLayerTransitions: CrossLayerTransition[];
  zoom: number;
  currentTime: number;
  duration: number;
  snapEnabled: boolean;
  selection: SelectionState;
  isPlaying: boolean;
}

export interface HistoryEntry {
  state: Omit<TimelineState, 'selection' | 'isPlaying'>;
  timestamp: number;
}

export interface VideoClipLegacy {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  prompt: string;
  createdAt: string;
  type: 'video' | 'image';
}

export interface ClipSettingsLegacy {
  clipId: string;
  muted: boolean;
  volume: number;
  speed: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  originalDuration?: number;
  displayDuration?: number;
}

export interface ClipTransitionLegacy {
  afterClipIndex: number;
  type: string;
  durationSeconds: number;
}

export const DEFAULT_TRACKS: TimelineTrack[] = [
  { id: 'video-1', name: 'Video 1', type: 'video', locked: false, visible: true, clips: [] },
  { id: 'video-2', name: 'Video 2', type: 'video', locked: false, visible: true, clips: [] },
  { id: 'audio-music', name: 'Music', type: 'audio', locked: false, visible: true, clips: [] },
  { id: 'audio-voice', name: 'Voice', type: 'audio', locked: false, visible: true, clips: [] },
  { id: 'text', name: 'Text', type: 'text', locked: false, visible: true, clips: [] },
  { id: 'effects', name: 'Effects', type: 'effects', locked: false, visible: true, clips: [] },
];

export function convertFromLegacy(
  orderedClips: VideoClipLegacy[],
  clipSettings: Map<string, ClipSettingsLegacy>,
  clipTransitions: ClipTransitionLegacy[],
  audioTracks: Array<{ id: string; url: string; name: string; type: 'music' | 'voice' | 'sfx'; volume: number }>
): { tracks: TimelineTrack[]; audioTracks: TimelineAudioTrack[]; transitions: TimelineTransition[] } {
  const tracks: TimelineTrack[] = DEFAULT_TRACKS.map(t => ({ ...t, clips: [] }));
  const videoTrack = tracks.find(t => t.id === 'video-1')!;
  
  let runningTime = 0;
  
  orderedClips.forEach((clip, index) => {
    const settings = clipSettings.get(clip.id);
    const originalDuration = settings?.originalDuration ?? (clip.type === 'image' ? 5 : 5);
    const displayDuration = settings?.displayDuration ?? originalDuration;
    const trimStart = settings?.trimStartSeconds ?? 0;
    const trimEnd = settings?.trimEndSeconds ?? originalDuration;
    const speed = settings?.speed ?? 1;
    
    let effectiveDuration: number;
    if (clip.type === 'image') {
      effectiveDuration = displayDuration;
    } else {
      effectiveDuration = (trimEnd - trimStart) / speed;
    }
    
    const transition = clipTransitions.find(t => t.afterClipIndex === index - 1);
    const overlap = transition ? transition.durationSeconds : 0;
    
    const timelineClip: TimelineClip = {
      id: clip.id,
      sourceUrl: clip.url,
      thumbnailUrl: clip.thumbnailUrl,
      prompt: clip.prompt,
      type: clip.type,
      trackId: 'video-1',
      startTime: Math.max(0, runningTime - overlap),
      duration: effectiveDuration,
      trimStart,
      trimEnd,
      originalDuration,
      speed,
      volume: settings?.volume ?? 100,
      muted: settings?.muted ?? false,
    };
    
    videoTrack.clips.push(timelineClip);
    runningTime += effectiveDuration;
  });
  
  const timelineAudioTracks: TimelineAudioTrack[] = audioTracks.map((audio, index) => ({
    id: audio.id,
    url: audio.url,
    name: audio.name,
    type: audio.type,
    volume: audio.volume,
    startTime: 0,
    duration: 30,
  }));
  
  const timelineTransitions: TimelineTransition[] = clipTransitions.map((t, idx) => ({
    id: `transition-${idx}`,
    afterClipId: orderedClips[t.afterClipIndex]?.id ?? '',
    type: t.type,
    durationSeconds: t.durationSeconds,
  })).filter(t => t.afterClipId);
  
  return { tracks, audioTracks: timelineAudioTracks, transitions: timelineTransitions };
}

export function convertToLegacy(
  tracks: TimelineTrack[],
  audioTracks: TimelineAudioTrack[],
  transitions: TimelineTransition[]
): { 
  orderedClips: VideoClipLegacy[]; 
  clipSettings: ClipSettingsLegacy[]; 
  clipTransitions: ClipTransitionLegacy[];
  legacyAudioTracks: Array<{ id: string; url: string; name: string; type: 'music' | 'voice' | 'sfx'; volume: number }>;
} {
  const videoTrack = tracks.find(t => t.id === 'video-1');
  const allClips = videoTrack?.clips ?? [];
  
  const sortedClips = [...allClips].sort((a, b) => a.startTime - b.startTime);
  
  const orderedClips: VideoClipLegacy[] = sortedClips.map(clip => ({
    id: clip.id,
    url: clip.sourceUrl,
    thumbnailUrl: clip.thumbnailUrl,
    prompt: clip.prompt,
    createdAt: new Date().toISOString(),
    type: clip.type,
  }));
  
  const clipSettings: ClipSettingsLegacy[] = sortedClips.map(clip => ({
    clipId: clip.id,
    muted: clip.muted,
    volume: clip.volume,
    speed: clip.speed,
    trimStartSeconds: clip.trimStart,
    trimEndSeconds: clip.trimEnd,
    originalDuration: clip.originalDuration,
    displayDuration: clip.type === 'image' ? clip.duration : undefined,
  }));
  
  const clipTransitions: ClipTransitionLegacy[] = [];
  transitions.forEach(t => {
    const clipIndex = sortedClips.findIndex(c => c.id === t.afterClipId);
    if (clipIndex >= 0) {
      clipTransitions.push({
        afterClipIndex: clipIndex,
        type: t.type,
        durationSeconds: t.durationSeconds,
      });
    }
  });
  
  const legacyAudioTracks = audioTracks.map(audio => ({
    id: audio.id,
    url: audio.url,
    name: audio.name,
    type: audio.type,
    volume: audio.volume,
  }));
  
  return { orderedClips, clipSettings, clipTransitions, legacyAudioTracks };
}

export function calculateTimelineDuration(tracks: TimelineTrack[], audioTracks: TimelineAudioTrack[]): number {
  let maxDuration = 0;
  
  tracks.forEach(track => {
    track.clips.forEach(clip => {
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd > maxDuration) {
        maxDuration = clipEnd;
      }
    });
  });
  
  audioTracks.forEach(audio => {
    const audioEnd = audio.startTime + audio.duration;
    if (audioEnd > maxDuration) {
      maxDuration = audioEnd;
    }
  });
  
  return Math.max(maxDuration, 60);
}

export function findNearestSnapPoint(
  time: number,
  tracks: TimelineTrack[],
  currentTime: number,
  excludeClipId?: string,
  threshold: number = 0.5
): number | null {
  const snapPoints: number[] = [0, currentTime];
  
  tracks.forEach(track => {
    track.clips.forEach(clip => {
      if (clip.id !== excludeClipId) {
        snapPoints.push(clip.startTime);
        snapPoints.push(clip.startTime + clip.duration);
      }
    });
  });
  
  let nearestPoint: number | null = null;
  let nearestDistance = threshold;
  
  snapPoints.forEach(point => {
    const distance = Math.abs(time - point);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPoint = point;
    }
  });
  
  return nearestPoint;
}

export function useTimelineStore(initialState?: Partial<TimelineState>) {
  const [state, setState] = useState<TimelineState>({
    tracks: DEFAULT_TRACKS.map(t => ({ ...t, clips: [] })),
    audioTracks: [],
    markers: [],
    transitions: [],
    crossLayerTransitions: [],
    zoom: 1,
    currentTime: 0,
    duration: 60,
    snapEnabled: true,
    selection: {
      selectedClipIds: new Set(),
      lastSelectedClipId: null,
    },
    isPlaying: false,
    ...initialState,
  });
  
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const maxHistory = 50;
  
  const pushHistory = useCallback(() => {
    const { selection, isPlaying, ...stateForHistory } = state;
    const entry: HistoryEntry = {
      state: JSON.parse(JSON.stringify(stateForHistory)),
      timestamp: Date.now(),
    };
    
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(entry);
    if (historyRef.current.length > maxHistory) {
      historyRef.current.shift();
    }
    historyIndexRef.current = historyRef.current.length - 1;
  }, [state]);
  
  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const entry = historyRef.current[historyIndexRef.current];
      setState(prev => ({
        ...prev,
        ...entry.state,
      }));
      return true;
    }
    return false;
  }, []);
  
  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const entry = historyRef.current[historyIndexRef.current];
      setState(prev => ({
        ...prev,
        ...entry.state,
      }));
      return true;
    }
    return false;
  }, []);
  
  const setZoom = useCallback((zoom: number) => {
    setState(prev => ({
      ...prev,
      zoom: Math.max(0.25, Math.min(3, zoom)),
    }));
  }, []);
  
  const setCurrentTime = useCallback((time: number) => {
    setState(prev => ({
      ...prev,
      currentTime: Math.max(0, Math.min(time, prev.duration)),
    }));
  }, []);
  
  const setSnapEnabled = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, snapEnabled: enabled }));
  }, []);
  
  const setIsPlaying = useCallback((playing: boolean) => {
    setState(prev => ({ ...prev, isPlaying: playing }));
  }, []);
  
  const selectClip = useCallback((clipId: string, addToSelection: boolean = false) => {
    setState(prev => {
      const newSelectedIds = addToSelection 
        ? new Set(prev.selection.selectedClipIds) 
        : new Set<string>();
      
      if (newSelectedIds.has(clipId)) {
        newSelectedIds.delete(clipId);
      } else {
        newSelectedIds.add(clipId);
      }
      
      return {
        ...prev,
        selection: {
          selectedClipIds: newSelectedIds,
          lastSelectedClipId: clipId,
        },
      };
    });
  }, []);
  
  const selectClipsInRange = useCallback((startTime: number, endTime: number, trackIds?: string[]) => {
    setState(prev => {
      const newSelectedIds = new Set<string>();
      
      prev.tracks.forEach(track => {
        if (trackIds && !trackIds.includes(track.id)) return;
        
        track.clips.forEach(clip => {
          const clipEnd = clip.startTime + clip.duration;
          if (clip.startTime < endTime && clipEnd > startTime) {
            newSelectedIds.add(clip.id);
          }
        });
      });
      
      return {
        ...prev,
        selection: {
          selectedClipIds: newSelectedIds,
          lastSelectedClipId: null,
        },
      };
    });
  }, []);
  
  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selection: {
        selectedClipIds: new Set(),
        lastSelectedClipId: null,
      },
    }));
  }, []);
  
  const moveClip = useCallback((clipId: string, newTrackId: string, newStartTime: number) => {
    pushHistory();
    
    setState(prev => {
      let movedClip: TimelineClip | undefined;
      
      const tracksWithoutClip = prev.tracks.map(track => ({
        ...track,
        clips: track.clips.filter(clip => {
          if (clip.id === clipId) {
            movedClip = { ...clip };
            return false;
          }
          return true;
        }),
      }));
      
      if (!movedClip) return prev;
      
      let finalStartTime = newStartTime;
      if (prev.snapEnabled) {
        const snapped = findNearestSnapPoint(newStartTime, tracksWithoutClip, prev.currentTime, clipId);
        if (snapped !== null) {
          finalStartTime = snapped;
        }
      }
      
      movedClip.startTime = Math.max(0, finalStartTime);
      movedClip.trackId = newTrackId;
      
      return {
        ...prev,
        tracks: tracksWithoutClip.map(track =>
          track.id === newTrackId
            ? { ...track, clips: [...track.clips, movedClip!].sort((a, b) => a.startTime - b.startTime) }
            : track
        ),
        duration: calculateTimelineDuration(tracksWithoutClip.map(track =>
          track.id === newTrackId
            ? { ...track, clips: [...track.clips, movedClip!] }
            : track
        ), prev.audioTracks),
      };
    });
  }, [pushHistory]);
  
  const trimClip = useCallback((clipId: string, trimStart: number, trimEnd: number) => {
    pushHistory();
    
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => ({
        ...track,
        clips: track.clips.map(clip => {
          if (clip.id !== clipId) return clip;
          
          const newTrimStart = Math.max(0, Math.min(trimStart, clip.originalDuration - 0.1));
          const newTrimEnd = Math.max(newTrimStart + 0.1, Math.min(trimEnd, clip.originalDuration));
          const newDuration = (newTrimEnd - newTrimStart) / clip.speed;
          
          return {
            ...clip,
            trimStart: newTrimStart,
            trimEnd: newTrimEnd,
            duration: newDuration,
          };
        }),
      })),
    }));
  }, [pushHistory]);
  
  const splitClip = useCallback((clipId: string, splitTime: number) => {
    pushHistory();
    
    setState(prev => {
      const newTracks = prev.tracks.map(track => {
        const clipIndex = track.clips.findIndex(c => c.id === clipId);
        if (clipIndex === -1) return track;
        
        const clip = track.clips[clipIndex];
        const relativeTime = splitTime - clip.startTime;
        
        if (relativeTime <= 0 || relativeTime >= clip.duration) return track;
        
        const splitPointInOriginal = clip.trimStart + (relativeTime * clip.speed);
        
        const firstClip: TimelineClip = {
          ...clip,
          trimEnd: splitPointInOriginal,
          duration: relativeTime,
        };
        
        const secondClip: TimelineClip = {
          ...clip,
          id: `${clip.id}-split-${Date.now()}`,
          startTime: splitTime,
          trimStart: splitPointInOriginal,
          duration: clip.duration - relativeTime,
        };
        
        const newClips = [...track.clips];
        newClips.splice(clipIndex, 1, firstClip, secondClip);
        
        return { ...track, clips: newClips };
      });
      
      return {
        ...prev,
        tracks: newTracks,
      };
    });
  }, [pushHistory]);
  
  const deleteClip = useCallback((clipId: string) => {
    pushHistory();
    
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => ({
        ...track,
        clips: track.clips.filter(c => c.id !== clipId),
      })),
      transitions: prev.transitions.filter(t => t.afterClipId !== clipId),
      selection: {
        selectedClipIds: new Set(Array.from(prev.selection.selectedClipIds).filter(id => id !== clipId)),
        lastSelectedClipId: prev.selection.lastSelectedClipId === clipId ? null : prev.selection.lastSelectedClipId,
      },
    }));
  }, [pushHistory]);
  
  const deleteSelectedClips = useCallback(() => {
    if (state.selection.selectedClipIds.size === 0) return;
    
    pushHistory();
    
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => ({
        ...track,
        clips: track.clips.filter(c => !prev.selection.selectedClipIds.has(c.id)),
      })),
      transitions: prev.transitions.filter(t => !prev.selection.selectedClipIds.has(t.afterClipId)),
      selection: {
        selectedClipIds: new Set(),
        lastSelectedClipId: null,
      },
    }));
  }, [state.selection.selectedClipIds, pushHistory]);
  
  const addClip = useCallback((trackId: string, clip: Omit<TimelineClip, 'id' | 'trackId'>) => {
    pushHistory();
    
    const newClip: TimelineClip = {
      ...clip,
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trackId,
    };
    
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(track =>
        track.id === trackId
          ? { ...track, clips: [...track.clips, newClip].sort((a, b) => a.startTime - b.startTime) }
          : track
      ),
      duration: calculateTimelineDuration(
        prev.tracks.map(track =>
          track.id === trackId
            ? { ...track, clips: [...track.clips, newClip] }
            : track
        ),
        prev.audioTracks
      ),
    }));
    
    return newClip.id;
  }, [pushHistory]);
  
  const toggleTrackLock = useCallback((trackId: string) => {
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(track =>
        track.id === trackId ? { ...track, locked: !track.locked } : track
      ),
    }));
  }, []);
  
  const toggleTrackVisibility = useCallback((trackId: string) => {
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(track =>
        track.id === trackId ? { ...track, visible: !track.visible } : track
      ),
    }));
  }, []);
  
  const addMarker = useCallback((time: number, label: string = '', color: string = '#ef4444') => {
    const newMarker: TimelineMarker = {
      id: `marker-${Date.now()}`,
      time,
      label,
      color,
    };
    
    setState(prev => ({
      ...prev,
      markers: [...prev.markers, newMarker].sort((a, b) => a.time - b.time),
    }));
    
    return newMarker.id;
  }, []);
  
  const removeMarker = useCallback((markerId: string) => {
    setState(prev => ({
      ...prev,
      markers: prev.markers.filter(m => m.id !== markerId),
    }));
  }, []);
  
  const loadFromLegacy = useCallback((
    orderedClips: VideoClipLegacy[],
    clipSettings: Map<string, ClipSettingsLegacy>,
    clipTransitions: ClipTransitionLegacy[],
    audioTracks: Array<{ id: string; url: string; name: string; type: 'music' | 'voice' | 'sfx'; volume: number }>
  ) => {
    const { tracks, audioTracks: newAudioTracks, transitions } = convertFromLegacy(
      orderedClips,
      clipSettings,
      clipTransitions,
      audioTracks
    );
    
    setState(prev => ({
      ...prev,
      tracks,
      audioTracks: newAudioTracks,
      transitions,
      duration: calculateTimelineDuration(tracks, newAudioTracks),
    }));
  }, []);
  
  const exportToLegacy = useCallback(() => {
    return convertToLegacy(state.tracks, state.audioTracks, state.transitions);
  }, [state.tracks, state.audioTracks, state.transitions]);
  
  const getClipById = useCallback((clipId: string): TimelineClip | undefined => {
    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) return clip;
    }
    return undefined;
  }, [state.tracks]);
  
  const getSelectedClips = useCallback((): TimelineClip[] => {
    const clips: TimelineClip[] = [];
    state.tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (state.selection.selectedClipIds.has(clip.id)) {
          clips.push(clip);
        }
      });
    });
    return clips;
  }, [state.tracks, state.selection.selectedClipIds]);
  
  const addCrossLayerTransition = useCallback((fromClipId: string, toClipId: string, type: string = 'fade', durationSeconds: number = 1.0) => {
    pushHistory();
    
    const newTransition: CrossLayerTransition = {
      id: `clt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      fromClipId,
      toClipId,
      type,
      durationSeconds,
    };
    
    setState(prev => ({
      ...prev,
      crossLayerTransitions: [...prev.crossLayerTransitions.filter(
        t => !(t.fromClipId === fromClipId && t.toClipId === toClipId)
      ), newTransition],
    }));
    
    return newTransition.id;
  }, [pushHistory]);
  
  const updateCrossLayerTransition = useCallback((transitionId: string, updates: Partial<Omit<CrossLayerTransition, 'id'>>) => {
    pushHistory();
    
    setState(prev => ({
      ...prev,
      crossLayerTransitions: prev.crossLayerTransitions.map(t =>
        t.id === transitionId ? { ...t, ...updates } : t
      ),
    }));
  }, [pushHistory]);
  
  const removeCrossLayerTransition = useCallback((transitionId: string) => {
    pushHistory();
    
    setState(prev => ({
      ...prev,
      crossLayerTransitions: prev.crossLayerTransitions.filter(t => t.id !== transitionId),
    }));
  }, [pushHistory]);
  
  const getCrossLayerTransition = useCallback((fromClipId: string, toClipId: string): CrossLayerTransition | undefined => {
    return state.crossLayerTransitions.find(
      t => t.fromClipId === fromClipId && t.toClipId === toClipId
    );
  }, [state.crossLayerTransitions]);
  
  const getClipOverlaps = useCallback((): Array<{ fromClip: TimelineClip; toClip: TimelineClip; overlapStart: number; overlapEnd: number; transition?: CrossLayerTransition }> => {
    const overlaps: Array<{ fromClip: TimelineClip; toClip: TimelineClip; overlapStart: number; overlapEnd: number; transition?: CrossLayerTransition }> = [];
    const allClips: Array<TimelineClip & { trackIndex: number }> = [];
    
    state.tracks.forEach((track, trackIndex) => {
      track.clips.forEach(clip => {
        allClips.push({ ...clip, trackIndex });
      });
    });
    
    for (let i = 0; i < allClips.length; i++) {
      for (let j = i + 1; j < allClips.length; j++) {
        const clipA = allClips[i];
        const clipB = allClips[j];
        
        if (clipA.trackId === clipB.trackId) continue;
        
        const aStart = clipA.startTime;
        const aEnd = clipA.startTime + clipA.duration;
        const bStart = clipB.startTime;
        const bEnd = clipB.startTime + clipB.duration;
        
        const overlapStart = Math.max(aStart, bStart);
        const overlapEnd = Math.min(aEnd, bEnd);
        
        if (overlapStart < overlapEnd && (overlapEnd - overlapStart) >= 0.1) {
          const fromClip = aEnd <= bEnd ? clipA : clipB;
          const toClip = aEnd <= bEnd ? clipB : clipA;
          
          const transition = state.crossLayerTransitions.find(
            t => t.fromClipId === fromClip.id && t.toClipId === toClip.id
          );
          
          overlaps.push({ fromClip, toClip, overlapStart, overlapEnd, transition });
        }
      }
    }
    
    return overlaps;
  }, [state.tracks, state.crossLayerTransitions]);
  
  const pixelsPerSecond = useMemo(() => 100 * state.zoom, [state.zoom]);
  
  return {
    ...state,
    pixelsPerSecond,
    
    setZoom,
    setCurrentTime,
    setSnapEnabled,
    setIsPlaying,
    
    selectClip,
    selectClipsInRange,
    clearSelection,
    
    moveClip,
    trimClip,
    splitClip,
    deleteClip,
    deleteSelectedClips,
    addClip,
    
    toggleTrackLock,
    toggleTrackVisibility,
    
    addMarker,
    removeMarker,
    
    addCrossLayerTransition,
    updateCrossLayerTransition,
    removeCrossLayerTransition,
    getCrossLayerTransition,
    getClipOverlaps,
    
    loadFromLegacy,
    exportToLegacy,
    
    getClipById,
    getSelectedClips,
    
    undo,
    redo,
  };
}

export type TimelineStoreReturn = ReturnType<typeof useTimelineStore>;
