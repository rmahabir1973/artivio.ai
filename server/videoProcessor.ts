import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import axios from 'axios';
import { nanoid } from 'nanoid';
import type { VideoEnhancements } from '@shared/schema';

const execAsync = promisify(exec);

// Configuration
const TEMP_DIR = path.join(process.cwd(), 'temp', 'video-processing');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'video-combinations');
const MAX_CONCURRENT_JOBS = 3; // Limit concurrent FFmpeg jobs
const FFMPEG_TIMEOUT = 600000; // 10 minutes timeout (increased for re-encoding)

// Semaphore for concurrency control
let activeJobs = 0;

interface VideoMetadata {
  duration: number;
  codec: string;
  width: number;
  height: number;
  hasAudio: boolean;
}

export interface CombineVideosOptions {
  videoUrls: string[];
  enhancements?: VideoEnhancements;
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

  await new Promise<void>((resolve, reject) => {
    writer.on('finish', () => resolve());
    writer.on('error', reject);
  });

  // Ensure file is fully written and accessible
  try {
    const stats = await fs.stat(filepath);
    if (stats.size === 0) {
      throw new Error('Downloaded file is empty');
    }
    console.log(`✓ Downloaded video ${index}: ${filepath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
  } catch (error) {
    throw new Error(`Failed to verify downloaded video: ${error}`);
  }

  return filepath;
}

/**
 * Get video metadata using ffprobe
 */
async function getVideoMetadata(filepath: string): Promise<VideoMetadata> {
  // First, verify file exists and is readable
  try {
    const stats = await fs.stat(filepath);
    console.log(`Probing video: ${filepath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
    
    if (stats.size === 0) {
      throw new Error('Video file is empty (0 bytes)');
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Video file not found: ${filepath}`);
    }
    throw new Error(`Cannot access video file: ${error.message}`);
  }

  // Probe for both video and audio streams
  const command = `ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,duration -of json "${filepath}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
    
    if (stderr) {
      console.warn(`ffprobe stderr: ${stderr}`);
    }
    
    const data = JSON.parse(stdout);
    const streams = data.streams || [];

    if (streams.length === 0) {
      throw new Error('No streams found in video file - file may be corrupted');
    }

    const videoStream = streams.find((s: any) => s.codec_type === 'video');
    if (!videoStream) {
      throw new Error(`No video stream found. Available streams: ${streams.map((s: any) => s.codec_type).join(', ')}`);
    }

    const audioStream = streams.find((s: any) => s.codec_type === 'audio');

    const metadata = {
      duration: parseFloat(videoStream.duration) || 0,
      codec: videoStream.codec_name || 'unknown',
      width: parseInt(videoStream.width) || 0,
      height: parseInt(videoStream.height) || 0,
      hasAudio: !!audioStream,
    };

    console.log(`✓ Video metadata: ${metadata.width}x${metadata.height}, ${metadata.duration}s, codec: ${metadata.codec}, audio: ${metadata.hasAudio}`);
    
    return metadata;
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
 * Download audio file for background music
 */
async function downloadAudio(url: string, tempDir: string): Promise<string> {
  const ext = path.extname(new URL(url).pathname) || '.mp3';
  const filename = `background_music${ext}`;
  const filepath = path.join(tempDir, filename);

  const response = await axios({
    method: 'GET',
    url,
    responseType: 'stream',
    timeout: 60000,
  });

  const writer = createWriteStream(filepath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(filepath));
    writer.on('error', reject);
  });
}

/**
 * Build FFmpeg filter graph for video enhancements
 */
function buildFilterGraph(
  videoCount: number,
  enhancements: VideoEnhancements | undefined,
  metadataList: VideoMetadata[],
  hasBackgroundMusic: boolean
): { videoFilters: string; audioFilters: string; adjustedDurations: number[] } {
  const videoFilterSteps: string[] = [];
  const audioFilterSteps: string[] = [];
  const adjustedDurations: number[] = [];
  
  // Apply speed adjustments first and track adjusted durations
  let videoStreams: string[] = [];
  let audioStreamLabels: string[] = [];
  
  for (let i = 0; i < videoCount; i++) {
    const speedFactor = getSpeedFactorForClip(i, enhancements?.speed);
    const originalDuration = metadataList[i].duration;
    const hasAudio = metadataList[i].hasAudio;
    
    // Calculate adjusted duration
    const adjustedDuration = originalDuration / speedFactor;
    adjustedDurations.push(adjustedDuration);
    
    if (speedFactor !== 1.0) {
      // Apply speed to video
      videoFilterSteps.push(`[${i}:v]setpts=${(1.0 / speedFactor).toFixed(3)}*PTS[v${i}s]`);
      videoStreams.push(`[v${i}s]`);
      
      // Apply speed to audio only if it exists
      if (hasAudio) {
        const aSpeed = speedFactor <= 2.0
          ? `[${i}:a]atempo=${speedFactor.toFixed(3)}[a${i}s]`
          : `[${i}:a]atempo=2.0,atempo=${(speedFactor / 2.0).toFixed(3)}[a${i}s]`;
        audioFilterSteps.push(aSpeed);
        audioStreamLabels.push(`[a${i}s]`);
      } else {
        // Create silence for clip without audio
        audioFilterSteps.push(`anullsrc=channel_layout=stereo:sample_rate=44100:duration=${adjustedDuration.toFixed(2)}[a${i}s]`);
        audioStreamLabels.push(`[a${i}s]`);
      }
    } else {
      videoStreams.push(`[${i}:v]`);
      if (hasAudio) {
        audioStreamLabels.push(`[${i}:a]`);
      } else {
        // Create silence for clip without audio
        audioFilterSteps.push(`anullsrc=channel_layout=stereo:sample_rate=44100:duration=${originalDuration.toFixed(2)}[a${i}s]`);
        audioStreamLabels.push(`[a${i}s]`);
      }
    }
  }

  // Apply crossfade transitions using ADJUSTED durations
  if (enhancements?.transitions?.mode === 'crossfade' && videoCount > 1) {
    const duration = enhancements.transitions.durationSeconds || 1.0;
    let currentStream = videoStreams[0];
    
    for (let i = 1; i < videoCount; i++) {
      // Calculate offset using adjusted durations
      const offset = adjustedDurations.slice(0, i).reduce((sum, d) => sum + d, 0) - duration;
      const nextLabel = i === videoCount - 1 ? 'vout' : `v${i}xf`;
      videoFilterSteps.push(`${currentStream}${videoStreams[i]}xfade=transition=fade:duration=${duration}:offset=${offset.toFixed(2)}[${nextLabel}]`);
      currentStream = `[${nextLabel}]`;
    }
  } else if (videoCount > 1) {
    // No transitions - simple concatenation
    videoFilterSteps.push(`${videoStreams.join('')}concat=n=${videoCount}:v=1:a=0[vout]`);
  } else {
    // Single video - use null filter (no-op passthrough)
    videoFilterSteps.push(`${videoStreams[0]}null[vout]`);
  }

  // Add text overlays
  const totalDuration = adjustedDurations.reduce((sum, d) => sum + d, 0);
  if (enhancements?.textOverlays && enhancements.textOverlays.length > 0) {
    let textFilter = '[vout]';
    
    for (let i = 0; i < enhancements.textOverlays.length; i++) {
      const overlay = enhancements.textOverlays[i];
      const outputLabel = i === enhancements.textOverlays.length - 1 ? 'vfinal' : `vtext${i}`;
      
      const position = getTextPosition(overlay.position, overlay.customPosition);
      const escapedText = overlay.text.replace(/'/g, "\\'").replace(/:/g, "\\:");
      const fontsize = overlay.fontSize || 48;
      const fontcolor = overlay.colorHex || '#FFFFFF';
      const fontfile = overlay.fontFamily ? `fontfile='${overlay.fontFamily}':` : '';
      
      // Determine timing using adjusted total duration
      let enableClause = '';
      if (overlay.timing === 'intro') {
        const dur = overlay.displaySeconds || 3;
        enableClause = `:enable='between(t,0,${dur})'`;
      } else if (overlay.timing === 'outro') {
        const dur = overlay.displaySeconds || 3;
        enableClause = `:enable='gte(t,${totalDuration - dur})'`;
      }
      
      videoFilterSteps.push(
        `${textFilter}drawtext=${fontfile}text='${escapedText}':${position}:fontsize=${fontsize}:fontcolor=${fontcolor}${enableClause}[${outputLabel}]`
      );
      textFilter = `[${outputLabel}]`;
    }
  } else {
    // No text overlays - use null filter (no-op passthrough)
    videoFilterSteps.push('[vout]null[vfinal]');
  }

  // Normalize sample rates to 44100 Hz before concatenation (handles mixed rates)
  const resampledLabels: string[] = [];
  for (let i = 0; i < audioStreamLabels.length; i++) {
    const resampledLabel = `[ar${i}]`;
    audioFilterSteps.push(`${audioStreamLabels[i]}aresample=44100${resampledLabel}`);
    resampledLabels.push(resampledLabel);
  }

  // Handle audio to match video transitions
  if (videoCount > 1 && enhancements?.transitions?.mode === 'crossfade') {
    // Apply audio crossfade to match video transitions
    const duration = enhancements.transitions.durationSeconds || 1.0;
    let currentAudioStream = resampledLabels[0];
    
    for (let i = 1; i < videoCount; i++) {
      const nextLabel = i === videoCount - 1 ? '[aout]' : `[a${i}xf]`;
      audioFilterSteps.push(`${currentAudioStream}${resampledLabels[i]}acrossfade=d=${duration}${nextLabel}`);
      currentAudioStream = nextLabel;
    }
  } else if (videoCount > 1) {
    // No transitions - concatenate audio sequentially
    audioFilterSteps.push(`${resampledLabels.join('')}concat=n=${videoCount}:v=0:a=1[aout]`);
  } else {
    // Single video - use anull filter (no-op passthrough for audio)
    audioFilterSteps.push(`${resampledLabels[0]}anull[aout]`);
  }

  const videoFilters = videoFilterSteps.join(';');
  const audioFilters = audioFilterSteps.join(';');

  return { videoFilters, audioFilters, adjustedDurations };
}

/**
 * Get speed factor for a specific clip
 */
function getSpeedFactorForClip(
  clipIndex: number,
  speedConfig: VideoEnhancements['speed'] | undefined
): number {
  if (!speedConfig || speedConfig.mode === 'none') {
    return 1.0;
  }
  
  if (speedConfig.mode === 'global') {
    return speedConfig.globalFactor || 1.0;
  }
  
  if (speedConfig.mode === 'perClip' && speedConfig.perClip) {
    const clipSpeed = speedConfig.perClip.find(c => c.clipIndex === clipIndex);
    return clipSpeed?.factor || 1.0;
  }
  
  return 1.0;
}

/**
 * Get text position for drawtext filter
 */
function getTextPosition(
  position: 'top' | 'center' | 'bottom' | 'custom',
  customPosition?: { xPercent: number; yPercent: number }
): string {
  switch (position) {
    case 'top':
      return 'x=(w-text_w)/2:y=h*0.1';
    case 'center':
      return 'x=(w-text_w)/2:y=(h-text_h)/2';
    case 'bottom':
      return 'x=(w-text_w)/2:y=h*0.85';
    case 'custom':
      if (customPosition) {
        const x = `w*${(customPosition.xPercent / 100).toFixed(2)}`;
        const y = `h*${(customPosition.yPercent / 100).toFixed(2)}`;
        return `x=${x}:y=${y}`;
      }
      return 'x=(w-text_w)/2:y=(h-text_h)/2';
    default:
      return 'x=(w-text_w)/2:y=(h-text_h)/2';
  }
}

/**
 * Combine videos using FFmpeg with optional enhancements
 */
export async function combineVideos(options: CombineVideosOptions): Promise<CombineVideosResult> {
  const { videoUrls, enhancements, onProgress } = options;

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

    // Download background music if specified
    let musicPath: string | undefined;
    if (enhancements?.backgroundMusic?.audioUrl) {
      onProgress?.('download', 'Downloading background music...');
      musicPath = await downloadAudio(enhancements.backgroundMusic.audioUrl, tempDir);
      tempFiles.push(musicPath);
    }

    // Determine if we need enhancements (re-encoding required)
    const hasEnhancements = !!(
      enhancements?.transitions?.mode === 'crossfade' ||
      enhancements?.backgroundMusic ||
      (enhancements?.textOverlays && enhancements.textOverlays.length > 0) ||
      (enhancements?.speed && enhancements.speed.mode !== 'none')
    );

    // Generate output filename
    const outputFilename = `combined_${jobId}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    tempFiles.push(outputPath);

    let totalDuration = metadataList.reduce((sum, m) => sum + m.duration, 0);
    let ffmpegCommand: string;

    if (!hasEnhancements) {
      // Fast path: simple concatenation with no re-encoding
      onProgress?.('process', 'Combining videos (fast mode)...');
      
      const concatFilePath = path.join(tempDir, 'concat.txt');
      await createConcatFile(downloadedPaths, concatFilePath);
      tempFiles.push(concatFilePath);

      ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputPath}"`;
    } else {
      // Enhanced path: build filter graph and re-encode
      onProgress?.('process', 'Applying enhancements and combining videos...');

      // Build input flags
      const inputFlags = downloadedPaths.map(p => `-i "${p}"`).join(' ');
      const musicInputFlag = musicPath ? `-i "${musicPath}"` : '';

      // Build filter graphs (returns separate video and audio filters)
      const { videoFilters, audioFilters, adjustedDurations } = buildFilterGraph(
        downloadedPaths.length,
        enhancements,
        metadataList,
        !!musicPath
      );

      // Update total duration with adjusted durations
      totalDuration = adjustedDurations.reduce((sum, d) => sum + d, 0);

      // Build complete audio filter chain with optional background music
      let completeAudioFilter = audioFilters;
      let finalAudioLabel = '[aout]';
      
      if (musicPath && enhancements?.backgroundMusic) {
        const volume = enhancements.backgroundMusic.volume || 0.3;
        const fadeIn = enhancements.backgroundMusic.fadeInSeconds || 0;
        const fadeOut = enhancements.backgroundMusic.fadeOutSeconds || 0;
        const musicStreamIdx = downloadedPaths.length;

        // Apply volume and fades to music
        let musicFilter = `[${musicStreamIdx}:a]volume=${volume}`;
        if (fadeIn > 0) {
          musicFilter += `,afade=t=in:st=0:d=${fadeIn}`;
        }
        if (fadeOut > 0) {
          musicFilter += `,afade=t=out:st=${totalDuration - fadeOut}:d=${fadeOut}`;
        }
        musicFilter += `[music]`;

        // Mix video audio with background music
        completeAudioFilter += `;${musicFilter};[aout][music]amix=inputs=2:duration=first[afinal]`;
        finalAudioLabel = '[afinal]';
      }

      const fullFilterComplex = videoFilters + ';' + completeAudioFilter;

      // Build FFmpeg command with filter_complex
      ffmpegCommand = `ffmpeg ${inputFlags} ${musicInputFlag} -filter_complex "${fullFilterComplex}" -map "[vfinal]" -map "${finalAudioLabel}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k "${outputPath}"`;
    }

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
