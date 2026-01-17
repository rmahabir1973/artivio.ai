/**
 * Browser-Based Video Export Engine
 * Uses WebCodecs for encoding and MP4Box.js for muxing
 * Suitable for videos < 10 minutes in length
 */

declare const VideoEncoder: typeof globalThis.VideoEncoder;
declare const AudioEncoder: {
  new(init: { output: (chunk: any) => void; error: (error: any) => void }): {
    configure: (config: any) => void;
    encode: (data: any) => void;
    flush: () => Promise<void>;
    close: () => void;
  };
  isConfigSupported: (config: any) => Promise<{ supported: boolean }>;
};
declare const AudioData: {
  new(init: {
    format: string;
    sampleRate: number;
    numberOfFrames: number;
    numberOfChannels: number;
    timestamp: number;
    data: Float32Array;
  }): { close: () => void };
};

// MP4Box type declarations
interface MP4BoxFile {
  addTrack: (config: any) => number;
  addSample: (trackId: number, buffer: ArrayBuffer, opts: any) => void;
  flush: () => void;
  getBuffer: () => ArrayBuffer;
  getStream: () => ReadableStream | null;
  onSegment?: (id: number, user: unknown, buffer: ArrayBuffer) => void;
}

// @ts-ignore - mp4box doesn't have proper TypeScript types
import * as MP4BoxModule from 'mp4box';
const MP4Box = (MP4BoxModule as any).default || (MP4BoxModule as any);

export interface ExportConfig {
  width: number;
  height: number;
  fps: number;
  videoBitrate: number;
  audioBitrate: number;
  codec: 'avc1' | 'vp8' | 'vp9' | 'av1';
}

export interface ExportProgress {
  phase: 'preparing' | 'rendering' | 'encoding' | 'muxing' | 'finalizing' | 'complete' | 'error';
  progress: number;
  currentFrame: number;
  totalFrames: number;
  message: string;
}

export interface TimelineClip {
  id: string;
  type: 'video' | 'image' | 'audio';
  url: string;
  startTime: number;
  duration: number;
  originalDuration?: number;
  trim?: { start: number; end: number };
  speed?: number;
  volume?: number;
  muted?: boolean;
  fadeOut?: number;
  zIndex?: number;
}

export interface CrossLayerTransition {
  id: string;
  fromClipId: string;
  toClipId: string;
  type: string;
  durationSeconds: number;
}

type OnProgressCallback = (progress: ExportProgress) => void;
type FrameProvider = (time: number) => ImageBitmap | null;

export class BrowserVideoExporter {
  private config: ExportConfig;
  private mp4File: MP4BoxFile | null = null;
  private videoEncoder: VideoEncoder | null = null;
  private audioEncoder: ReturnType<typeof AudioEncoder['prototype']['constructor']> | null = null;
  private videoTrackId: number = 0;
  private audioTrackId: number = 0;
  private encodedChunks: { video: EncodedVideoChunk[]; audio: any[] } = { video: [], audio: [] };
  private isExporting: boolean = false;
  private abortController: AbortController | null = null;

  constructor(config: Partial<ExportConfig> = {}) {
    this.config = {
      width: config.width || 1920,
      height: config.height || 1080,
      fps: config.fps || 30,
      videoBitrate: config.videoBitrate || 5_000_000,
      audioBitrate: config.audioBitrate || 128_000,
      codec: config.codec || 'avc1',
    };
  }

  static isSupported(): boolean {
    return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined';
  }

  async export(
    clips: TimelineClip[],
    transitions: CrossLayerTransition[],
    frameProvider: FrameProvider,
    totalDuration: number,
    onProgress?: OnProgressCallback
  ): Promise<Blob> {
    if (this.isExporting) {
      throw new Error('Export already in progress');
    }

    if (!BrowserVideoExporter.isSupported()) {
      throw new Error('WebCodecs not supported in this browser');
    }

    this.isExporting = true;
    this.abortController = new AbortController();
    this.encodedChunks = { video: [], audio: [] };

    try {
      const totalFrames = Math.ceil(totalDuration * this.config.fps);

      onProgress?.({
        phase: 'preparing',
        progress: 0,
        currentFrame: 0,
        totalFrames,
        message: 'Initializing encoders...',
      });

      await this.initializeEncoders();

      onProgress?.({
        phase: 'rendering',
        progress: 5,
        currentFrame: 0,
        totalFrames,
        message: 'Rendering frames...',
      });

      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (this.abortController.signal.aborted) {
          throw new Error('Export cancelled');
        }

        const time = frameIndex / this.config.fps;
        const frame = frameProvider(time);

        if (frame) {
          await this.encodeVideoFrame(frame, frameIndex);
          frame.close();
        }

        const progress = 5 + (frameIndex / totalFrames) * 70;
        onProgress?.({
          phase: 'encoding',
          progress,
          currentFrame: frameIndex,
          totalFrames,
          message: `Encoding frame ${frameIndex + 1}/${totalFrames}`,
        });
      }

      onProgress?.({
        phase: 'muxing',
        progress: 80,
        currentFrame: totalFrames,
        totalFrames,
        message: 'Processing audio tracks...',
      });

      await this.processAudioTracks(clips, totalDuration);

      onProgress?.({
        phase: 'finalizing',
        progress: 95,
        currentFrame: totalFrames,
        totalFrames,
        message: 'Finalizing video...',
      });

      await this.flushEncoders();
      const blob = await this.createMP4();

      onProgress?.({
        phase: 'complete',
        progress: 100,
        currentFrame: totalFrames,
        totalFrames,
        message: 'Export complete!',
      });

      return blob;
    } catch (error) {
      onProgress?.({
        phase: 'error',
        progress: 0,
        currentFrame: 0,
        totalFrames: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      this.cleanup();
      this.isExporting = false;
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  private async initializeEncoders(): Promise<void> {
    const videoCodecString = this.getVideoCodecString();

    const videoEncoderConfig: VideoEncoderConfig = {
      codec: videoCodecString,
      width: this.config.width,
      height: this.config.height,
      bitrate: this.config.videoBitrate,
      framerate: this.config.fps,
      latencyMode: 'quality',
      bitrateMode: 'variable',
    };

    const support = await VideoEncoder.isConfigSupported(videoEncoderConfig);
    if (!support.supported) {
      throw new Error(`Video codec ${videoCodecString} not supported`);
    }

    this.videoEncoder = new VideoEncoder({
      output: (chunk, metadata) => {
        this.encodedChunks.video.push(chunk);
      },
      error: (error) => {
        console.error('Video encoder error:', error);
      },
    });

    this.videoEncoder.configure(videoEncoderConfig);

    const audioEncoderConfig: any = {
      codec: 'mp4a.40.2',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: this.config.audioBitrate,
    };

    const audioSupport = await AudioEncoder.isConfigSupported(audioEncoderConfig);
    if (audioSupport.supported) {
      this.audioEncoder = new AudioEncoder({
        output: (chunk) => {
          this.encodedChunks.audio.push(chunk);
        },
        error: (error) => {
          console.error('Audio encoder error:', error);
        },
      });

      this.audioEncoder.configure(audioEncoderConfig);
    }
  }

  private getVideoCodecString(): string {
    switch (this.config.codec) {
      case 'avc1':
        return 'avc1.42001E';
      case 'vp8':
        return 'vp8';
      case 'vp9':
        return 'vp09.00.10.08';
      case 'av1':
        return 'av01.0.04M.08';
      default:
        return 'avc1.42001E';
    }
  }

  private async encodeVideoFrame(bitmap: ImageBitmap, frameIndex: number): Promise<void> {
    if (!this.videoEncoder) return;

    const timestamp = (frameIndex * 1_000_000) / this.config.fps;
    const duration = 1_000_000 / this.config.fps;

    const videoFrame = new VideoFrame(bitmap, {
      timestamp,
      duration,
    });

    const keyFrame = frameIndex % 30 === 0;
    this.videoEncoder.encode(videoFrame, { keyFrame });
    videoFrame.close();
  }

  private async processAudioTracks(clips: TimelineClip[], totalDuration: number): Promise<void> {
    const audioClips = clips.filter(
      (clip) => clip.type === 'audio' || (clip.type === 'video' && !clip.muted)
    );

    if (audioClips.length === 0 || !this.audioEncoder) return;

    const audioContext = new OfflineAudioContext(2, Math.ceil(totalDuration * 48000), 48000);

    for (const clip of audioClips) {
      try {
        const response = await fetch(clip.url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        const gainNode = audioContext.createGain();
        const volume = (clip.volume ?? 100) / 100;
        gainNode.gain.setValueAtTime(volume, 0);

        if (clip.fadeOut && clip.fadeOut > 0) {
          const fadeStart = clip.duration - clip.fadeOut;
          gainNode.gain.setValueAtTime(volume, clip.startTime + fadeStart);
          gainNode.gain.linearRampToValueAtTime(0, clip.startTime + clip.duration);
        }

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        const trimStart = clip.trim?.start ?? 0;
        const playbackRate = clip.speed ?? 1;

        source.playbackRate.setValueAtTime(playbackRate, 0);
        source.start(clip.startTime, trimStart, clip.duration);
      } catch (error) {
        console.warn(`Failed to process audio for clip ${clip.id}:`, error);
      }
    }

    try {
      const renderedBuffer = await audioContext.startRendering();
      await this.encodeAudioBuffer(renderedBuffer);
    } catch (error) {
      console.warn('Failed to render audio:', error);
    }
  }

  private async encodeAudioBuffer(buffer: AudioBuffer): Promise<void> {
    if (!this.audioEncoder) return;

    const numberOfChannels = buffer.numberOfChannels;
    const numberOfFrames = buffer.length;
    const sampleRate = buffer.sampleRate;

    const planarData = new Float32Array(numberOfChannels * numberOfFrames);
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      planarData.set(channelData, channel * numberOfFrames);
    }

    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames,
      numberOfChannels,
      timestamp: 0,
      data: planarData,
    });

    this.audioEncoder.encode(audioData);
    audioData.close();
  }

  private async flushEncoders(): Promise<void> {
    if (this.videoEncoder) {
      await this.videoEncoder.flush();
    }
    if (this.audioEncoder) {
      await this.audioEncoder.flush();
    }
  }

  private async createMP4(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        const mp4File = MP4Box.createFile();
        this.mp4File = mp4File;

        if (this.encodedChunks.video.length > 0) {
          const firstChunk = this.encodedChunks.video[0];

          this.videoTrackId = mp4File.addTrack({
            timescale: 1_000_000,
            width: this.config.width,
            height: this.config.height,
            brands: ['isom', 'iso2', 'avc1', 'mp41'],
            avcDecoderConfigRecord: this.getAVCDecoderConfig(),
          });

          for (const chunk of this.encodedChunks.video) {
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);

            const buffer = data.buffer as ArrayBuffer & { fileStart?: number };
            buffer.fileStart = 0;

            mp4File.addSample(this.videoTrackId, buffer, {
              duration: Math.round((chunk.duration ?? 33333) / 1000),
              dts: Math.round(chunk.timestamp / 1000),
              cts: Math.round(chunk.timestamp / 1000),
              is_sync: chunk.type === 'key',
            });
          }
        }

        const chunks: ArrayBuffer[] = [];
        mp4File.onSegment = (id: number, user: unknown, buffer: ArrayBuffer) => {
          chunks.push(buffer);
        };

        const stream = mp4File.getStream();
        if (stream) {
          const reader = (stream as ReadableStream).getReader();
          const processChunk = async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
            resolve(new Blob(chunks, { type: 'video/mp4' }));
          };
          processChunk();
        } else {
          mp4File.flush();
          const arrayBuffer = mp4File.getBuffer();
          resolve(new Blob([arrayBuffer], { type: 'video/mp4' }));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  private getAVCDecoderConfig(): Uint8Array | undefined {
    for (const chunk of this.encodedChunks.video) {
      if (chunk.type === 'key') {
        return undefined;
      }
    }
    return undefined;
  }

  private cleanup(): void {
    if (this.videoEncoder) {
      try {
        this.videoEncoder.close();
      } catch (e) { }
      this.videoEncoder = null;
    }

    if (this.audioEncoder) {
      try {
        this.audioEncoder.close();
      } catch (e) { }
      this.audioEncoder = null;
    }

    this.mp4File = null;
    this.encodedChunks = { video: [], audio: [] };
    this.abortController = null;
  }
}
