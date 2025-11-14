import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import axios from 'axios';
import { nanoid } from 'nanoid';

const execAsync = promisify(exec);

// Configuration
const TEMP_DIR = path.join(process.cwd(), 'temp', 'video-processing');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'video-combinations');
const MAX_CONCURRENT_JOBS = 3; // Limit concurrent FFmpeg jobs
const FFMPEG_TIMEOUT = 300000; // 5 minutes timeout

// Semaphore for concurrency control
let activeJobs = 0;

interface VideoMetadata {
  duration: number;
  codec: string;
  width: number;
  height: number;
}

export interface CombineVideosOptions {
  videoUrls: string[];
  onProgress?: (stage: string, message: string) => void;
}

export interface CombineVideosResult {
  outputPath: string; // Relative path from public directory
  durationSeconds: number;
  tempFiles: string[]; // For cleanup tracking
}

/**
 * Wait for an available job slot
 */
async function acquireJobSlot(): Promise<void> {
  while (activeJobs >= MAX_CONCURRENT_JOBS) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  activeJobs++;
}

/**
 * Release a job slot
 */
function releaseJobSlot(): void {
  activeJobs = Math.max(0, activeJobs - 1);
}

/**
 * Ensure directories exist
 */
async function ensureDirectories(): Promise<void> {
  await fs.mkdir(TEMP_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

/**
 * Download video from URL to temp directory
 */
async function downloadVideo(url: string, tempDir: string, index: number): Promise<string> {
  const ext = path.extname(new URL(url).pathname) || '.mp4';
  const filename = `input_${index}${ext}`;
  const filepath = path.join(tempDir, filename);

  const response = await axios({
    method: 'GET',
    url,
    responseType: 'stream',
    timeout: 60000, // 60 second timeout
  });

  const writer = createWriteStream(filepath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(filepath));
    writer.on('error', reject);
  });
}

/**
 * Get video metadata using ffprobe
 */
async function getVideoMetadata(filepath: string): Promise<VideoMetadata> {
  const command = `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,duration -of json "${filepath}"`;
  
  try {
    const { stdout } = await execAsync(command, { timeout: 10000 });
    const data = JSON.parse(stdout);
    const stream = data.streams?.[0];

    if (!stream) {
      throw new Error('No video stream found');
    }

    return {
      duration: parseFloat(stream.duration) || 0,
      codec: stream.codec_name || 'unknown',
      width: parseInt(stream.width) || 0,
      height: parseInt(stream.height) || 0,
    };
  } catch (error: any) {
    throw new Error(`Failed to probe video metadata: ${error.message}`);
  }
}

/**
 * Create FFmpeg concat file
 */
async function createConcatFile(videoPaths: string[], concatFilePath: string): Promise<void> {
  const lines = videoPaths.map(p => `file '${p}'`).join('\n');
  await fs.writeFile(concatFilePath, lines, 'utf-8');
}

/**
 * Combine videos using FFmpeg
 */
export async function combineVideos(options: CombineVideosOptions): Promise<CombineVideosResult> {
  const { videoUrls, onProgress } = options;

  // Validate input
  if (!videoUrls || videoUrls.length < 2) {
    throw new Error('At least 2 videos are required for combination');
  }

  if (videoUrls.length > 20) {
    throw new Error('Cannot combine more than 20 videos at once');
  }

  // Acquire job slot (concurrency control)
  await acquireJobSlot();
  
  let tempDir: string | null = null;
  const tempFiles: string[] = [];

  try {
    // Ensure directories exist
    await ensureDirectories();

    // Create unique temp directory for this job
    const jobId = nanoid(10);
    tempDir = path.join(TEMP_DIR, jobId);
    await fs.mkdir(tempDir, { recursive: true });

    onProgress?.('download', 'Downloading videos...');

    // Download all videos
    const downloadedPaths: string[] = [];
    for (let i = 0; i < videoUrls.length; i++) {
      const url = videoUrls[i];
      onProgress?.('download', `Downloading video ${i + 1}/${videoUrls.length}...`);
      const filepath = await downloadVideo(url, tempDir, i);
      downloadedPaths.push(filepath);
      tempFiles.push(filepath);
    }

    onProgress?.('validate', 'Validating videos...');

    // Validate all videos and collect metadata
    const metadataList: VideoMetadata[] = [];
    for (const filepath of downloadedPaths) {
      const metadata = await getVideoMetadata(filepath);
      metadataList.push(metadata);
    }

    // Calculate total duration
    const totalDuration = metadataList.reduce((sum, m) => sum + m.duration, 0);

    onProgress?.('process', 'Combining videos with FFmpeg...');

    // Create concat file
    const concatFilePath = path.join(tempDir, 'concat.txt');
    await createConcatFile(downloadedPaths, concatFilePath);
    tempFiles.push(concatFilePath);

    // Generate output filename
    const outputFilename = `combined_${jobId}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    tempFiles.push(outputPath);

    // Run FFmpeg to concatenate
    // Use -c copy for fast concatenation (no re-encoding)
    const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputPath}"`;
    
    onProgress?.('process', 'Running FFmpeg...');
    
    await execAsync(ffmpegCommand, {
      timeout: FFMPEG_TIMEOUT,
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    });

    onProgress?.('complete', 'Video combination complete!');

    // Return relative path (from public directory)
    const relativePath = `/video-combinations/${outputFilename}`;

    return {
      outputPath: relativePath,
      durationSeconds: Math.round(totalDuration),
      tempFiles,
    };

  } catch (error: any) {
    onProgress?.('error', error.message || 'Video combination failed');
    throw new Error(`Video combination failed: ${error.message}`);
  } finally {
    releaseJobSlot();

    // Clean up temp directory (but not output file)
    if (tempDir) {
      try {
        // Remove only the temp directory and downloaded inputs, not the output
        const filesToClean = tempFiles.filter(f => !f.startsWith(OUTPUT_DIR));
        for (const file of filesToClean) {
          await fs.unlink(file).catch(() => {});
        }
        await fs.rmdir(tempDir).catch(() => {});
      } catch (cleanupError) {
        console.error('Temp cleanup error:', cleanupError);
      }
    }
  }
}

/**
 * Clean up old combination files (for maintenance)
 */
export async function cleanupOldCombinations(maxAgeHours: number = 72): Promise<void> {
  try {
    const files = await fs.readdir(OUTPUT_DIR);
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    for (const file of files) {
      const filepath = path.join(OUTPUT_DIR, file);
      const stats = await fs.stat(filepath);
      
      if (now - stats.mtimeMs > maxAge) {
        await fs.unlink(filepath);
        console.log(`Cleaned up old combination: ${file}`);
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}
