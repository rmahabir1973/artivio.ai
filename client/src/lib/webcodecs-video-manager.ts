/**
 * WebCodecs-based Video Manager
 * Hardware-accelerated video decoding with frame-perfect control
 * Used for professional-grade video editing with smooth scrubbing
 *
 * Note: This is a simplified implementation that uses HTMLVideoElement
 * as a source for VideoDecoder. Full MP4Box integration can be added later.
 */

// @ts-ignore - MP4Box types not available
import * as MP4Box from 'mp4box';

export interface VideoConfig {
  id: string;
  url: string;
  trimStart?: number; // Trim start in seconds
  trimEnd?: number; // Trim end in seconds
}

export interface DecodedFrame {
  frame: VideoFrame;
  timestamp: number; // in seconds
  duration: number; // in seconds
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

/**
 * Manages a single video using WebCodecs
 */
export class WebCodecsVideo {
  private id: string;
  private url: string;
  private decoder: VideoDecoder | null = null;
  private metadata: VideoMetadata | null = null;

  // Frame buffering
  private frameBuffer: Map<number, VideoFrame> = new Map();
  private readonly BUFFER_SIZE = 90; // Buffer 3 seconds at 30fps
  private currentBufferPosition = 0;

  // Decoding state
  private isDecoding = false;
  private decodingPromise: Promise<void> | null = null;
  private videoData: EncodedVideoChunk[] = [];
  private mp4boxFile: any = null;
  private videoTrackId: number | null = null;

  // Playback state
  private currentTime = 0;
  private isReady = false;

  constructor(config: VideoConfig) {
    this.id = config.id;
    this.url = config.url;
  }

  /**
   * Initialize and load video metadata
   */
  async initialize(): Promise<VideoMetadata> {
    if (this.metadata) return this.metadata;

    try {
      // Fetch video file
      const response = await fetch(this.url);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      // Use MP4Box.js to demux the video
      this.mp4boxFile = MP4Box.createFile();

      // Extract video track metadata
      const metadata = await new Promise<VideoMetadata>((resolve, reject) => {
        this.mp4boxFile.onError = (e: any) => reject(e);

        this.mp4boxFile.onReady = (info: any) => {
          const videoTrack = info.videoTracks[0];
          if (!videoTrack) {
            reject(new Error('No video track found'));
            return;
          }

          const metadata: VideoMetadata = {
            duration: info.duration / info.timescale,
            width: videoTrack.video.width,
            height: videoTrack.video.height,
            frameRate: videoTrack.nb_samples / (info.duration / info.timescale),
            hasVideo: info.videoTracks.length > 0,
            hasAudio: info.audioTracks.length > 0,
          };

          // Setup video track for sample extraction
          this.mp4boxFile.setExtractionOptions(videoTrack.id, null, { nbSamples: 1000 });

          resolve(metadata);
        };

        // Feed the file data
        const buffer = arrayBuffer as any;
        buffer.fileStart = 0;
        this.mp4boxFile.appendBuffer(buffer);
        this.mp4boxFile.flush();
      });

      this.metadata = metadata;
      await this.initializeDecoder();
      this.isReady = true;

      return metadata;
    } catch (error) {
      console.error('Failed to initialize WebCodecs video:', error);
      throw error;
    }
  }

  /**
   * Initialize the VideoDecoder
   */
  private async initializeDecoder(): Promise<void> {
    if (!this.metadata) throw new Error('Metadata not loaded');

    const videoTrack = this.mp4boxFile.getTrackById(1); // Assuming first video track
    const trackInfo = this.mp4boxFile.getTrackById(1);

    this.decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        this.onFrameDecoded(frame);
      },
      error: (error: Error) => {
        console.error('VideoDecoder error:', error);
      },
    });

    // Configure decoder
    this.decoder.configure({
      codec: this.getCodecString(trackInfo),
      codedWidth: this.metadata.width,
      codedHeight: this.metadata.height,
      optimizeForLatency: true, // For real-time playback
    });

    // Extract samples (encoded video chunks)
    this.mp4boxFile.onSamples = (trackId: number, ref: any, samples: any[]) => {
      for (const sample of samples) {
        const chunk = new EncodedVideoChunk({
          type: sample.is_sync ? 'key' : 'delta',
          timestamp: (sample.cts * 1000000) / sample.timescale, // Convert to microseconds
          duration: (sample.duration * 1000000) / sample.timescale,
          data: sample.data,
        });
        this.videoData.push(chunk);
      }
    };

    this.mp4boxFile.start();
  }

  /**
   * Get codec string for VideoDecoder configuration
   */
  private getCodecString(trackInfo: any): string {
    // Common codec strings
    const codecMap: Record<string, string> = {
      'avc1': 'avc1.64001f', // H.264
      'hvc1': 'hvc1.1.6.L93.B0', // H.265
      'vp09': 'vp09.00.10.08', // VP9
      'av01': 'av01.0.04M.08', // AV1
    };

    const codecType = trackInfo.codec || 'avc1';
    return codecMap[codecType] || codecType;
  }

  /**
   * Called when a frame is decoded
   */
  private onFrameDecoded(frame: VideoFrame): void {
    const timestamp = frame.timestamp / 1000000; // Convert to seconds
    const frameIndex = Math.floor(timestamp * (this.metadata?.frameRate || 30));

    // Add to circular buffer
    const bufferIndex = frameIndex % this.BUFFER_SIZE;

    // Close old frame if exists
    const oldFrame = this.frameBuffer.get(bufferIndex);
    if (oldFrame) {
      oldFrame.close();
    }

    this.frameBuffer.set(bufferIndex, frame);
  }

  /**
   * Seek to a specific time and decode surrounding frames
   */
  async seek(time: number): Promise<void> {
    if (!this.decoder || !this.metadata) return;

    this.currentTime = time;
    const targetFrameIndex = Math.floor(time * this.metadata.frameRate);

    // Find nearest keyframe before target
    let keyframeIndex = 0;
    for (let i = 0; i < this.videoData.length; i++) {
      if (this.videoData[i].type === 'key') {
        const chunkTime = this.videoData[i].timestamp / 1000000;
        if (chunkTime <= time) {
          keyframeIndex = i;
        } else {
          break;
        }
      }
    }

    // Clear buffer
    this.clearFrameBuffer();

    // Decode from keyframe to target + buffer
    const startIndex = keyframeIndex;
    const endIndex = Math.min(
      startIndex + this.BUFFER_SIZE,
      this.videoData.length
    );

    this.isDecoding = true;
    this.decodingPromise = this.decodeRange(startIndex, endIndex);
    await this.decodingPromise;
    this.isDecoding = false;
  }

  /**
   * Decode a range of chunks
   */
  private async decodeRange(start: number, end: number): Promise<void> {
    if (!this.decoder) return;

    for (let i = start; i < end; i++) {
      if (this.decoder.state === 'closed') break;

      try {
        this.decoder.decode(this.videoData[i]);
      } catch (error) {
        console.error('Decode error:', error);
      }

      // Yield to browser every 10 frames
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Wait for all frames to be decoded
    await this.decoder.flush();
  }

  /**
   * Get frame at specific time
   */
  getFrame(time: number): VideoFrame | null {
    if (!this.metadata) return null;

    const frameIndex = Math.floor(time * this.metadata.frameRate);
    const bufferIndex = frameIndex % this.BUFFER_SIZE;

    return this.frameBuffer.get(bufferIndex) || null;
  }

  /**
   * Pre-buffer frames around current position for smooth playback
   */
  async bufferAround(time: number): Promise<void> {
    if (this.isDecoding) return;

    const frameIndex = Math.floor(time * (this.metadata?.frameRate || 30));
    const bufferStart = Math.max(0, frameIndex - 15); // 0.5s before
    const bufferEnd = Math.min(
      this.videoData.length,
      frameIndex + this.BUFFER_SIZE - 15
    );

    // Only rebuffer if we've moved significantly
    if (Math.abs(frameIndex - this.currentBufferPosition) > 30) {
      this.currentBufferPosition = frameIndex;
      await this.decodeRange(bufferStart, bufferEnd);
    }
  }

  /**
   * Clear frame buffer
   */
  private clearFrameBuffer(): void {
    this.frameBuffer.forEach(frame => frame.close());
    this.frameBuffer.clear();
  }

  /**
   * Check if ready
   */
  getIsReady(): boolean {
    return this.isReady;
  }

  /**
   * Get metadata
   */
  getMetadata(): VideoMetadata | null {
    return this.metadata;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clearFrameBuffer();

    if (this.decoder) {
      if (this.decoder.state !== 'closed') {
        this.decoder.close();
      }
      this.decoder = null;
    }

    this.videoData = [];
    this.mp4boxFile = null;
  }
}

/**
 * Manages multiple WebCodecs videos
 */
export class WebCodecsVideoManager {
  private videos: Map<string, WebCodecsVideo> = new Map();
  private initPromises: Map<string, Promise<VideoMetadata>> = new Map();

  /**
   * Check if WebCodecs is supported
   */
  static isSupported(): boolean {
    return typeof VideoDecoder !== 'undefined' &&
           typeof VideoFrame !== 'undefined' &&
           typeof EncodedVideoChunk !== 'undefined';
  }

  /**
   * Load a video
   */
  async loadVideo(config: VideoConfig): Promise<VideoMetadata> {
    // Return existing if already loaded
    const existing = this.videos.get(config.id);
    if (existing) {
      const metadata = existing.getMetadata();
      if (metadata) return metadata;
    }

    // Check if already initializing
    const existingPromise = this.initPromises.get(config.id);
    if (existingPromise) {
      return existingPromise;
    }

    // Create and initialize new video
    const video = new WebCodecsVideo(config);
    this.videos.set(config.id, video);

    const promise = video.initialize();
    this.initPromises.set(config.id, promise);

    try {
      const metadata = await promise;
      return metadata;
    } catch (error) {
      // Cleanup on error
      this.videos.delete(config.id);
      this.initPromises.delete(config.id);
      throw error;
    }
  }

  /**
   * Get a video instance
   */
  getVideo(id: string): WebCodecsVideo | null {
    return this.videos.get(id) || null;
  }

  /**
   * Get frame from a video at specific time
   */
  getFrame(id: string, time: number): VideoFrame | null {
    const video = this.videos.get(id);
    return video ? video.getFrame(time) : null;
  }

  /**
   * Seek all videos to a specific timeline time
   */
  async seekAll(timelineTime: number, items: Array<{
    id: string;
    startTime: number;
    duration: number;
    trim?: { start: number; end: number };
    speed?: number;
  }>): Promise<void> {
    const seekPromises = items.map(async item => {
      const video = this.videos.get(item.id);
      if (!video) return;

      // Calculate local time within the video
      const timeInClip = timelineTime - item.startTime;
      if (timeInClip < 0 || timeInClip > item.duration) return;

      const speed = item.speed || 1;
      const trimStart = item.trim?.start || 0;
      const localTime = trimStart + (timeInClip * speed);

      await video.seek(localTime);
    });

    await Promise.all(seekPromises);
  }

  /**
   * Buffer frames around current playback position
   */
  async bufferAround(timelineTime: number, items: Array<{
    id: string;
    startTime: number;
    duration: number;
    trim?: { start: number; end: number };
    speed?: number;
  }>): Promise<void> {
    const bufferPromises = items.map(async item => {
      const video = this.videos.get(item.id);
      if (!video) return;

      const timeInClip = timelineTime - item.startTime;
      if (timeInClip < -2 || timeInClip > item.duration + 2) return; // Only buffer nearby videos

      const speed = item.speed || 1;
      const trimStart = item.trim?.start || 0;
      const localTime = trimStart + (timeInClip * speed);

      await video.bufferAround(localTime);
    });

    await Promise.all(bufferPromises);
  }

  /**
   * Remove a video
   */
  removeVideo(id: string): void {
    const video = this.videos.get(id);
    if (video) {
      video.destroy();
      this.videos.delete(id);
      this.initPromises.delete(id);
    }
  }

  /**
   * Clear all videos
   */
  clear(): void {
    this.videos.forEach(video => video.destroy());
    this.videos.clear();
    this.initPromises.clear();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clear();
  }
}
