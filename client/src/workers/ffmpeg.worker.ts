/**
 * FFmpeg Web Worker
 * Handles video processing, effects, and format conversion using FFmpeg WASM
 * Runs off the main thread to prevent UI freezing
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

interface FFmpegMessage {
  type: 'init' | 'process' | 'extract-frame' | 'apply-effect' | 'destroy';
  taskId?: string;
  inputUrl?: string;
  outputFormat?: string;
  effect?: {
    type: 'blur' | 'brightness' | 'contrast' | 'saturation' | 'crop' | 'rotate';
    params: Record<string, number>;
  };
  time?: number;
}

class FFmpegWorker {
  private ffmpeg: FFmpeg | null = null;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    self.addEventListener('message', this.handleMessage.bind(this));
    this.sendMessage({ type: 'ready' });
  }

  private sendMessage(message: any): void {
    self.postMessage(message);
  }

  /**
   * Handle messages from main thread
   */
  private async handleMessage(event: MessageEvent<FFmpegMessage>): Promise<void> {
    const { type, taskId } = event.data;

    try {
      switch (type) {
        case 'init':
          await this.initialize();
          break;

        case 'process':
          if (event.data.inputUrl && event.data.outputFormat) {
            await this.processVideo(taskId!, event.data.inputUrl, event.data.outputFormat);
          }
          break;

        case 'extract-frame':
          if (event.data.inputUrl && event.data.time !== undefined) {
            await this.extractFrame(taskId!, event.data.inputUrl, event.data.time);
          }
          break;

        case 'apply-effect':
          if (event.data.inputUrl && event.data.effect) {
            await this.applyEffect(taskId!, event.data.inputUrl, event.data.effect);
          }
          break;

        case 'destroy':
          await this.cleanup();
          break;
      }
    } catch (error) {
      this.sendMessage({
        type: 'error',
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Initialize FFmpeg WASM
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        this.sendMessage({ type: 'initializing' });

        this.ffmpeg = new FFmpeg();

        // Load FFmpeg core (using CDN for WASM files)
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

        await this.ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        this.isInitialized = true;

        this.sendMessage({ type: 'initialized' });
      } catch (error) {
        this.isInitialized = false;
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Process a video file (format conversion, etc.)
   */
  private async processVideo(
    taskId: string,
    inputUrl: string,
    outputFormat: string
  ): Promise<void> {
    await this.ensureInitialized();
    if (!this.ffmpeg) return;

    this.sendMessage({ type: 'processing', taskId, progress: 0 });

    try {
      // Fetch input file
      const inputData = await fetchFile(inputUrl);
      await this.ffmpeg.writeFile('input.mp4', inputData);

      // Run FFmpeg command
      await this.ffmpeg.exec([
        '-i', 'input.mp4',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        `output.${outputFormat}`
      ]);

      // Read output file
      const outputData = await this.ffmpeg.readFile(`output.${outputFormat}`);
      const blob = new Blob([outputData], { type: `video/${outputFormat}` });
      const outputUrl = URL.createObjectURL(blob);

      this.sendMessage({
        type: 'processed',
        taskId,
        outputUrl,
      });

      // Cleanup
      await this.ffmpeg.deleteFile('input.mp4');
      await this.ffmpeg.deleteFile(`output.${outputFormat}`);
    } catch (error) {
      throw new Error(`Failed to process video: ${error}`);
    }
  }

  /**
   * Extract a single frame from video at specific time
   */
  private async extractFrame(
    taskId: string,
    inputUrl: string,
    time: number
  ): Promise<void> {
    await this.ensureInitialized();
    if (!this.ffmpeg) return;

    try {
      // Fetch input file
      const inputData = await fetchFile(inputUrl);
      await this.ffmpeg.writeFile('input.mp4', inputData);

      // Extract frame at specific time
      await this.ffmpeg.exec([
        '-ss', time.toString(),
        '-i', 'input.mp4',
        '-frames:v', '1',
        '-f', 'image2',
        'frame.jpg'
      ]);

      // Read frame
      const frameData = await this.ffmpeg.readFile('frame.jpg');
      const blob = new Blob([frameData], { type: 'image/jpeg' });
      const frameUrl = URL.createObjectURL(blob);

      this.sendMessage({
        type: 'frame-extracted',
        taskId,
        frameUrl,
        time,
      });

      // Cleanup
      await this.ffmpeg.deleteFile('input.mp4');
      await this.ffmpeg.deleteFile('frame.jpg');
    } catch (error) {
      throw new Error(`Failed to extract frame: ${error}`);
    }
  }

  /**
   * Apply effects to video using FFmpeg filters
   */
  private async applyEffect(
    taskId: string,
    inputUrl: string,
    effect: {
      type: 'blur' | 'brightness' | 'contrast' | 'saturation' | 'crop' | 'rotate';
      params: Record<string, number>;
    }
  ): Promise<void> {
    await this.ensureInitialized();
    if (!this.ffmpeg) return;

    this.sendMessage({ type: 'applying-effect', taskId });

    try {
      // Fetch input file
      const inputData = await fetchFile(inputUrl);
      await this.ffmpeg.writeFile('input.mp4', inputData);

      // Build FFmpeg filter based on effect type
      let filter = '';

      switch (effect.type) {
        case 'blur':
          filter = `gblur=sigma=${effect.params.sigma || 5}`;
          break;

        case 'brightness':
          filter = `eq=brightness=${effect.params.brightness || 0}`;
          break;

        case 'contrast':
          filter = `eq=contrast=${effect.params.contrast || 1}`;
          break;

        case 'saturation':
          filter = `eq=saturation=${effect.params.saturation || 1}`;
          break;

        case 'crop':
          filter = `crop=${effect.params.width}:${effect.params.height}:${effect.params.x}:${effect.params.y}`;
          break;

        case 'rotate':
          filter = `rotate=${effect.params.angle}*PI/180`;
          break;
      }

      // Run FFmpeg with filter
      await this.ffmpeg.exec([
        '-i', 'input.mp4',
        '-vf', filter,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-c:a', 'copy',
        'output.mp4'
      ]);

      // Read output file
      const outputData = await this.ffmpeg.readFile('output.mp4');
      const blob = new Blob([outputData], { type: 'video/mp4' });
      const outputUrl = URL.createObjectURL(blob);

      this.sendMessage({
        type: 'effect-applied',
        taskId,
        outputUrl,
      });

      // Cleanup
      await this.ffmpeg.deleteFile('input.mp4');
      await this.ffmpeg.deleteFile('output.mp4');
    } catch (error) {
      throw new Error(`Failed to apply effect: ${error}`);
    }
  }

  /**
   * Ensure FFmpeg is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    if (this.ffmpeg) {
      // FFmpeg cleanup happens automatically
      this.ffmpeg = null;
    }

    this.isInitialized = false;
    this.initPromise = null;

    this.sendMessage({ type: 'destroyed' });
  }
}

// Initialize worker
new FFmpegWorker();
