import { useState, useCallback, useRef } from 'react';

export interface EditorTextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  bold: boolean;
  italic: boolean;
  startTime: number;
  endTime: number;
  animation: 'none' | 'fade-in' | 'slide-up' | 'pop' | 'typewriter';
}

interface UseTextOverlayReturn {
  overlays: EditorTextOverlay[];
  addOverlay: (overlay: Omit<EditorTextOverlay, 'id'>) => string;
  updateOverlay: (id: string, updates: Partial<EditorTextOverlay>) => void;
  removeOverlay: (id: string) => void;
  selectedOverlayId: string | null;
  setSelectedOverlayId: (id: string | null) => void;
  getVisibleOverlays: (currentTime: number) => EditorTextOverlay[];
  duplicateOverlay: (id: string) => string | null;
  clearAllOverlays: () => void;
}

export function useTextOverlay(): UseTextOverlayReturn {
  const [overlays, setOverlays] = useState<EditorTextOverlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const idCounterRef = useRef(0);

  const addOverlay = useCallback((overlay: Omit<EditorTextOverlay, 'id'>): string => {
    const id = `text-overlay-${Date.now()}-${idCounterRef.current++}`;
    const newOverlay: EditorTextOverlay = { ...overlay, id };
    setOverlays(prev => [...prev, newOverlay]);
    setSelectedOverlayId(id);
    return id;
  }, []);

  const updateOverlay = useCallback((id: string, updates: Partial<EditorTextOverlay>) => {
    setOverlays(prev => 
      prev.map(overlay => 
        overlay.id === id ? { ...overlay, ...updates } : overlay
      )
    );
  }, []);

  const removeOverlay = useCallback((id: string) => {
    setOverlays(prev => prev.filter(overlay => overlay.id !== id));
    if (selectedOverlayId === id) {
      setSelectedOverlayId(null);
    }
  }, [selectedOverlayId]);

  const getVisibleOverlays = useCallback((currentTime: number): EditorTextOverlay[] => {
    return overlays.filter(
      overlay => currentTime >= overlay.startTime && currentTime <= overlay.endTime
    );
  }, [overlays]);

  const duplicateOverlay = useCallback((id: string): string | null => {
    const overlay = overlays.find(o => o.id === id);
    if (!overlay) return null;
    
    const newOverlay: Omit<EditorTextOverlay, 'id'> = {
      ...overlay,
      x: overlay.x + 20,
      y: overlay.y + 20,
      startTime: overlay.endTime,
      endTime: overlay.endTime + (overlay.endTime - overlay.startTime),
    };
    return addOverlay(newOverlay);
  }, [overlays, addOverlay]);

  const clearAllOverlays = useCallback(() => {
    setOverlays([]);
    setSelectedOverlayId(null);
  }, []);

  return {
    overlays,
    addOverlay,
    updateOverlay,
    removeOverlay,
    selectedOverlayId,
    setSelectedOverlayId,
    getVisibleOverlays,
    duplicateOverlay,
    clearAllOverlays,
  };
}

export const DEFAULT_TEXT_OVERLAY: Omit<EditorTextOverlay, 'id' | 'startTime' | 'endTime'> = {
  text: 'New Text',
  x: 50,
  y: 50,
  fontSize: 32,
  fontFamily: 'Arial',
  color: '#ffffff',
  backgroundColor: 'transparent',
  bold: false,
  italic: false,
  animation: 'none',
};
