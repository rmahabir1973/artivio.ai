/**
 * Audio Mixer using Web Audio API
 * Handles mixing multiple audio tracks with volume, fade, and synchronization
 */

export interface AudioTrack {
  id: string;
  element: HTMLVideoElement | HTMLAudioElement;
  startTime: number;
  duration: number;
  volume: number; // 0-100
  fadeIn?: number; // seconds
  fadeOut?: number; // seconds
  muted?: boolean;
  trim?: { start: number; end: number };
  speed?: number;
}

export class AudioMixer {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private tracks: Map<string, {
    track: AudioTrack;
    source: MediaElementAudioSourceNode;
    gainNode: GainNode;
  }> = new Map();
  // Track elements that have already been connected (can only connect once per element)
  private connectedElements: WeakMap<HTMLMediaElement, MediaElementAudioSourceNode> = new WeakMap();
  private isInitialized: boolean = false;
  private currentTime: number = 0;

  constructor() {
    // Create audio context (will be initialized on first user interaction)
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Create master gain node
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    this.masterGain.gain.value = 1.0;
  }

  /**
   * Initialize audio context (must be called after user interaction)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.isInitialized = true;
  }

  /**
   * Add or update an audio track
   */
  addTrack(track: AudioTrack): void {
    // Check if this track ID already exists with the same element
    const existing = this.tracks.get(track.id);
    if (existing && existing.track.element === track.element) {
      // Same element, just update the track data and volume
      existing.track = track;
      const volumeMultiplier = (track.volume ?? 100) / 100;
      existing.gainNode.gain.value = track.muted ? 0 : volumeMultiplier;
      return;
    }

    // Remove existing track if present (different element or new track)
    this.removeTrack(track.id);

    // Get or create source node for this element
    // Note: createMediaElementSource can only be called ONCE per element
    let source = this.connectedElements.get(track.element);
    if (!source) {
      source = this.audioContext.createMediaElementSource(track.element);
      this.connectedElements.set(track.element, source);
    }

    // Create gain node for this track
    const gainNode = this.audioContext.createGain();

    // Connect: source -> gainNode -> masterGain -> destination
    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    // Set initial volume
    const volumeMultiplier = (track.volume ?? 100) / 100;
    gainNode.gain.value = track.muted ? 0 : volumeMultiplier;

    this.tracks.set(track.id, { track, source, gainNode });
  }

  /**
   * Remove an audio track
   */
  removeTrack(trackId: string): void {
    const existing = this.tracks.get(trackId);
    if (existing) {
      try {
        existing.source.disconnect();
        existing.gainNode.disconnect();
      } catch (e) {
        // Already disconnected
      }
      this.tracks.delete(trackId);
    }
  }

  /**
   * Update track volume
   */
  setTrackVolume(trackId: string, volume: number): void {
    const trackData = this.tracks.get(trackId);
    if (!trackData) return;

    const volumeMultiplier = volume / 100;
    trackData.gainNode.gain.value = trackData.track.muted ? 0 : volumeMultiplier;
    trackData.track.volume = volume;
  }

  /**
   * Mute/unmute a track
   */
  setTrackMuted(trackId: string, muted: boolean): void {
    const trackData = this.tracks.get(trackId);
    if (!trackData) return;

    trackData.track.muted = muted;
    const volumeMultiplier = (trackData.track.volume ?? 100) / 100;
    trackData.gainNode.gain.value = muted ? 0 : volumeMultiplier;
  }

  /**
   * Update current time and apply fade effects
   */
  updateTime(currentTime: number): void {
    // Skip if audio context is in error state
    if (this.audioContext.state === 'closed') return;

    this.currentTime = currentTime;

    this.tracks.forEach((trackData) => {
      const track = trackData.track;
      const gainNode = trackData.gainNode;

      // Check if track is active
      const endTime = track.startTime + track.duration;
      const isActive = currentTime >= track.startTime && currentTime < endTime;

      if (!isActive) {
        // Mute inactive tracks - direct set, no ramping
        if (gainNode.gain.value !== 0) {
          gainNode.gain.value = 0;
        }
        return;
      }

      // Calculate time within the track
      const timeInTrack = currentTime - track.startTime;

      // Base volume
      const baseVolume = track.muted ? 0 : (track.volume ?? 100) / 100;
      let finalVolume = baseVolume;

      // Apply fade in
      if (track.fadeIn && timeInTrack < track.fadeIn) {
        const fadeProgress = timeInTrack / track.fadeIn;
        finalVolume *= fadeProgress;
      }

      // Apply fade out
      if (track.fadeOut) {
        const timeUntilEnd = track.duration - timeInTrack;
        if (timeUntilEnd < track.fadeOut) {
          const fadeProgress = timeUntilEnd / track.fadeOut;
          finalVolume *= fadeProgress;
        }
      }

      // Only update if volume changed significantly (avoid spamming audio API)
      if (Math.abs(gainNode.gain.value - finalVolume) > 0.01) {
        // Simple direct assignment - avoid ramping which creates many scheduled values
        gainNode.gain.value = finalVolume;
      }
    });
  }

  /**
   * Sync audio elements to timeline time
   */
  syncTracks(currentTime: number): void {
    this.currentTime = currentTime;

    this.tracks.forEach((trackData) => {
      const track = trackData.track;
      const element = track.element;

      // Check if track is active
      const endTime = track.startTime + track.duration;
      const isActive = currentTime >= track.startTime && currentTime < endTime;

      if (!isActive) {
        // Pause inactive tracks
        if (!element.paused) {
          element.pause();
        }
        return;
      }

      // Calculate local time within the track
      const timeInTrack = currentTime - track.startTime;
      const speed = track.speed || 1;
      const trimStart = track.trim?.start || 0;
      const localTime = trimStart + (timeInTrack * speed);

      // Sync element time
      if (Math.abs(element.currentTime - localTime) > 0.1) {
        element.currentTime = localTime;
      }

      // Set playback rate
      if (element.playbackRate !== speed) {
        element.playbackRate = speed;
      }
    });

    // Update volumes with fade effects
    this.updateTime(currentTime);
  }

  /**
   * Start playback
   */
  async play(): Promise<void> {
    try {
      await this.initialize();
    } catch (e) {
      console.warn('[AudioMixer] Failed to initialize:', e);
      return;
    }

    // Play all active tracks
    this.tracks.forEach((trackData) => {
      const track = trackData.track;
      const element = track.element;

      const endTime = track.startTime + track.duration;
      const isActive = this.currentTime >= track.startTime && this.currentTime < endTime;

      if (isActive && element.paused) {
        element.play().catch(() => {
          // Ignore play errors
        });
      }
    });

    // Note: No separate animation loop - time updates come from compositor via syncTracks/updateTime
  }

  /**
   * Pause playback
   */
  pause(): void {
    // Pause all tracks
    this.tracks.forEach((trackData) => {
      const element = trackData.track.element;
      if (!element.paused) {
        element.pause();
      }
    });
  }

  /**
   * Seek to a specific time
   */
  seek(time: number): void {
    this.currentTime = time;
    this.syncTracks(time);
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void {
    const volumeMultiplier = Math.max(0, Math.min(1, volume / 100));
    this.masterGain.gain.value = volumeMultiplier;
  }

  /**
   * Get master volume
   */
  getMasterVolume(): number {
    return this.masterGain.gain.value * 100;
  }

  /**
   * Clear all tracks
   */
  clear(): void {
    const trackIds = Array.from(this.tracks.keys());
    trackIds.forEach(id => this.removeTrack(id));
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clear();

    if (this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {
        // Ignore close errors
      });
    }
  }
}
