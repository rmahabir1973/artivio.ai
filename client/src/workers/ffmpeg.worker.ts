/**
 * FFmpeg Web Worker
 * Handles video processing, effects, and format conversion using FFmpeg WASM
 * Runs off the main thread to prevent UI freezing
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

interface FFmpegMessage {
  type: 'init' | 'process' | 'extract-frame' | 'apply-effect' | 'destroy' | 'cancel';
  taskId?: string;
  inputUrl?: string;
  outputFormat?: string;
  effect?: {
    type: 'blur' | 'brightness' | 'contrast' | 'saturation' | 'crop' | 'rotate';
    params: Record<string, number>;
  };
  time?: number;
  inputFile?: File;
}

interface TaskState {
  cancelled: boolean;
  outputUrl?: string;
}

class FFmpegWorker {
  private ffmpeg: FFmpeg | null = null;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private tasks: Map<string, TaskState> = new Map();
  private activeTask: string | null = null;

  constructor() {
    self.addEventListener('message', this.handleMessage.bind(this));
    console.log('[FFmpegWorker] Worker initialized');
    this.sendMessage({ type: 'ready' });
  }

  private sendMessage(message: any, transfer?: Transferable[]): void {
    if (transfer && transfer.length > 0) {
      self.postMessage(message, { transfer });
    } else {
      self.postMessage(message);
    }
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
            await this.processVideo(
              taskId!,
              event.data.inputUrl,
              event.data.outputFormat
            );
          } else if (event.data.inputFile) {
            await this.processVideoFile(
              taskId!,
              event.data.inputFile,
              event.data.outputFormat!
            );
          }
          break;

        case 'extract-frame':
          if (event.data.inputUrl && event.data.time !== undefined) {
            await this.extractFrame(
              taskId!,
              event.data.inputUrl,
              event.data.time
            );
          }
          break;

        case 'apply-effect':
          if (event.data.inputUrl && event.data.effect) {
            await this.applyEffect(
              taskId!,
              event.data.inputUrl,
              event.data.effect
            );
          }
          break;

        case 'cancel':
          if (taskId) {
            this.cancelTask(taskId);
          }
          break;

        case 'destroy':
          await this.cleanup();
          break;
      }
    } catch (error) {
      console.error(`[FFmpegWorker] Task ${taskId} failed:`, error);
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
    if (this.isInitialized) {
      this.sendMessage({ type: 'initialized' });
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        this.sendMessage({ type: 'initializing' });

        // Create FFmpeg instance
        this.ffmpeg = new FFmpeg();

        // Setup logging
        this.ffmpeg.on('log', ({ message }) => {
          console.log('[FFmpeg]', message);
        });

        // Setup progress reporting
        this.ffmpeg.on('progress', ({ progress }) => {
          if (this.activeTask) {
            this.sendMessage({
              type: 'progress',
              taskId: this.activeTask,
              progress: Math.round(progress * 100),
            });
          }
        });

        // Load FFmpeg core
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

        await this.ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        this.isInitialized = true;

        console.log('[FFmpegWorker] FFmpeg initialized successfully');
        this.sendMessage({ type: 'initialized' });
      } catch (error) {
        console.error('[FFmpegWorker] Initialization failed:', error);
        this.isInitialized = false;
        this.initPromise = null;
        this.ffmpeg = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Check if task was cancelled
   */
  private checkTaskCancelled(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    return task?.cancelled || false;
  }

  /**
   * Cancel a task
   */
  private cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.cancelled = true;
      // Revoke object URL if exists
      if (task.outputUrl) {
        URL.revokeObjectURL(task.outputUrl);
      }
    }

    // If this is the active task, try to terminate FFmpeg
    if (taskId === this.activeTask && this.ffmpeg) {
      // Note: FFmpeg doesn't have a direct cancel method
      // We'll rely on the cancelled flag
    }

    this.sendMessage({ type: 'cancelled', taskId });
  }

  /**
   * Clean up old URLs to prevent memory leaks
   */
  private cleanupOldUrls(): void {
    // Keep only the last 5 tasks to prevent memory leaks
    if (this.tasks.size > 5) {
      const tasksToDelete = Array.from(this.tasks.keys()).slice(0, -5);
      tasksToDelete.forEach(taskId => {
        const task = this.tasks.get(taskId);
        if (task?.outputUrl) {
          URL.revokeObjectURL(task.outputUrl);
        }
        this.tasks.delete(taskId);
      });
    }
  }

  /**
   * Process a video file
   */
  private async processVideo(
    taskId: string,
    inputUrl: string,
    outputFormat: string
  ): Promise<void> {
    this.activeTask = taskId;
    this.tasks.set(taskId, { cancelled: false });

    try {
      await this.ensureInitialized();
      if (!this.ffmpeg) throw new Error('FFmpeg not initialized');

      if (this.checkTaskCancelled(taskId)) return;

      this.sendMessage({ type: 'processing', taskId, progress: 0 });

      // Fetch input file
      console.log(`[FFmpegWorker] ${taskId}: Fetching input video`);
      const response = await fetch(inputUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
      }

      const inputData = await response.arrayBuffer();

      if (this.checkTaskCancelled(taskId)) return;

      // Write to virtual filesystem
      await this.ffmpeg.writeFile('input.mp4', new Uint8Array(inputData));

      // Run FFmpeg command
      console.log(`[FFmpegWorker] ${taskId}: Processing video to ${outputFormat}`);
      const outputFilename = `output.${outputFormat}`;

      await this.ffmpeg.exec([
        '-i', 'input.mp4',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-movflags', '+faststart',
        '-y', // Overwrite output
        outputFilename
      ]);

      if (this.checkTaskCancelled(taskId)) return;

      // Read output file
      console.log(`[FFmpegWorker] ${taskId}: Reading output`);
      const outputData = await this.ffmpeg.readFile(outputFilename);

      // Convert to blob
      const blob = new Blob([outputData], { 
        type: outputFormat === 'mp4' ? 'video/mp4' : 
              outputFormat === 'webm' ? 'video/webm' : 
              'application/octet-stream'
      });

      // Send blob directly to avoid object URL issues
      this.sendMessage({
        type: 'processed',
        taskId,
        outputBlob: blob,
        format: outputFormat,
      }, [blob]);

      // Cleanup files
      await this.ffmpeg.deleteFile('input.mp4');
      await this.ffmpeg.deleteFile(outputFilename);

      this.cleanupOldUrls();

    } catch (error) {
      if (!this.checkTaskCancelled(taskId)) {
        throw error;
      }
    } finally {
      this.activeTask = null;
    }
  }

  /**
   * Process video from File object
   */
  private async processVideoFile(
    taskId: string,
    inputFile: File,
    outputFormat: string
  ): Promise<void> {
    // Convert File to URL for processing
    const inputUrl = URL.createObjectURL(inputFile);

    try {
      await this.processVideo(taskId, inputUrl, outputFormat);
    } finally {
      // Clean up object URL
      URL.revokeObjectURL(inputUrl);
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
    this.activeTask = taskId;
    this.tasks.set(taskId, { cancelled: false });

    try {
      await this.ensureInitialized();
      if (!this.ffmpeg) throw new Error('FFmpeg not initialized');

      if (this.checkTaskCancelled(taskId)) return;

      console.log(`[FFmpegWorker] ${taskId}: Extracting frame at ${time}s`);

      // Fetch input file
      const response = await fetch(inputUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
      }

      const inputData = await response.arrayBuffer();

      if (this.checkTaskCancelled(taskId)) return;

      // Write to virtual filesystem
      await this.ffmpeg.writeFile('input.mp4', new Uint8Array(inputData));

      // Extract frame
      await this.ffmpeg.exec([
        '-ss', time.toString(),
        '-i', 'input.mp4',
        '-frames:v', '1',
        '-q:v', '2', // Quality: 2-31 (lower is better)
        '-f', 'image2',
        '-y',
        'frame.jpg'
      ]);

      if (this.checkTaskCancelled(taskId)) return;

      // Read frame
      const frameData = await this.ffmpeg.readFile('frame.jpg');

      // Convert to blob
      const blob = new Blob([frameData], { type: 'image/jpeg' });

      this.sendMessage({
        type: 'frame-extracted',
        taskId,
        frameBlob: blob,
        time,
      }, [blob]);

      // Cleanup
      await this.ffmpeg.deleteFile('input.mp4');
      await this.ffmpeg.deleteFile('frame.jpg');

    } catch (error) {
      if (!this.checkTaskCancelled(taskId)) {
        throw error;
      }
    } finally {
      this.activeTask = null;
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
    this.activeTask = taskId;
    this.tasks.set(taskId, { cancelled: false });

    try {
      await this.ensureInitialized();
      if (!this.ffmpeg) throw new Error('FFmpeg not initialized');

      if (this.checkTaskCancelled(taskId)) return;

      console.log(`[FFmpegWorker] ${taskId}: Applying effect ${effect.type}`);

      // Fetch input file
      const response = await fetch(inputUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
      }

      const inputData = await response.arrayBuffer();

      if (this.checkTaskCancelled(taskId)) return;

      // Write to virtual filesystem
      await this.ffmpeg.writeFile('input.mp4', new Uint8Array(inputData));

      // Build filter
      let filter = '';
      switch (effect.type) {
        case 'blur':
          filter = `gblur=sigma=${effect.params.sigma || 5}`;
          break;
        case 'brightness':
          filter = `eq=brightness=${(effect.params.brightness || 0) / 100}`;
          break;
        case 'contrast':
          filter = `eq=contrast=${effect.params.contrast || 1}`;
          break;
        case 'saturation':
          filter = `eq=saturation=${effect.params.saturation || 1}`;
          break;
        case 'crop':
          filter = `crop=${effect.params.width || 640}:${effect.params.height || 480}:${effect.params.x || 0}:${effect.params.y || 0}`;
          break;
        case 'rotate':
          const angle = effect.params.angle || 0;
          filter = `rotate=${angle}*PI/180:ow=rotw(${angle}):oh=roth(${angle})`;
          break;
        default:
          throw new Error(`Unknown effect type: ${effect.type}`);
      }

      console.log(`[FFmpegWorker] ${taskId}: Using filter: ${filter}`);

      // Apply effect
      await this.ffmpeg.exec([
        '-i', 'input.mp4',
        '-vf', filter,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'copy',
        '-movflags', '+faststart',
        '-y',
        'output.mp4'
      ]);

      if (this.checkTaskCancelled(taskId)) return;

      // Read output
      const outputData = await this.ffmpeg.readFile('output.mp4');

      // Convert to blob
      const blob = new Blob([outputData], { type: 'video/mp4' });

      this.sendMessage({
        type: 'effect-applied',
        taskId,
        outputBlob: blob,
      }, [blob]);

      // Cleanup
      await this.ffmpeg.deleteFile('input.mp4');
      await this.ffmpeg.deleteFile('output.mp4');

      this.cleanupOldUrls();

    } catch (error) {
      if (!this.checkTaskCancelled(taskId)) {
        throw error;
      }
    } finally {
      this.activeTask = null;
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
    console.log('[FFmpegWorker] Cleaning up resources');

    // Cancel all active tasks
    for (const [taskId, task] of this.tasks) {
      if (task.outputUrl) {
        URL.revokeObjectURL(task.outputUrl);
      }
    }
    this.tasks.clear();

    // Cleanup FFmpeg
    if (this.ffmpeg) {
      try {
        // Close FFmpeg instance
        // Note: The new FFmpeg.js doesn't have a close/terminate method
        // We'll just nullify the reference
      } catch (error) {
        console.warn('[FFmpegWorker] Error during cleanup:', error);
      }
      this.ffmpeg = null;
    }

    this.isInitialized = false;
    this.initPromise = null;
    this.activeTask = null;

    this.sendMessage({ type: 'destroyed' });
  }
}

// Initialize worker
new FFmpegWorker();