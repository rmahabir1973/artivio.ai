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
const MAX_CONCURRENT_JOBS = 3;
const FFMPEG_TIMEOUT = 600000;

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
  outputPath: string;
  durationSeconds: number;
  tempFiles: string[];
}

async function acquireJobSlot(): Promise<void> {
  while (activeJobs >= MAX_CONCURRENT_JOBS) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  activeJobs++;
}

function releaseJobSlot(): void {
  activeJobs = Math.max(0, activeJobs - 1);
}

async function ensureDirectories(): Promise<void> {
  await fs.mkdir(TEMP_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function downloadVideo(url: string, tempDir: string, index: number): Promise<string> {
  const ext = path.extname(new URL(url).pathname) || '.mp4';
  const filename = `input_${index}${ext}`;
  const filepath = path.join(tempDir, filename);

  try {
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 60000,
    });

    const writer = createWriteStream(filepath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', () => resolve());
      writer.on('error', reject);
    });

    const stats = await fs.stat(filepath);
    if (stats.size === 0) {
      throw new Error('Downloaded file is empty');
    }
    console.log(`✓ Downloaded video ${index}: ${filepath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);

    return filepath;
  } catch (error: any) {
    throw new Error(`Failed to download video ${index + 1}: ${error.message}`);
  }
}

async function getVideoMetadata(filepath: string): Promise<VideoMetadata> {
  try {
    const stats = await fs.stat(filepath);
    if (stats.size === 0) {
      throw new Error('Video file is empty');
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Video file not found`);
    }
    throw new Error(`Cannot access video file: ${error.message}`);
  }

  const command = `ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,duration -of json "${filepath}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
    
    const data = JSON.parse(stdout);
    const streams = data.streams || [];

    if (streams.length === 0) {
      throw new Error('No streams found in video');
    }

    const videoStream = streams.find((s: any) => s.codec_type === 'video');
    if (!videoStream) {
      throw new Error('No video stream found');
    }

    const audioStream = streams.find((s: any) => s.codec_type === 'audio');

    const metadata = {
      duration: parseFloat(videoStream.duration) || 0,
      codec: videoStream.codec_name || 'unknown',
      width: parseInt(videoStream.width) || 0,
      height: parseInt(videoStream.height) || 0,
      hasAudio: !!audioStream,
    };

    return metadata;
  } catch (error: any) {
    throw new Error(`Failed to read video metadata: ${error.message}`);
  }
}

/**
 * Normalize video to standard format (MP4 with H.264 + AAC)
 */
async function normalizeVideo(inputPath: string, outputPath: string): Promise<void> {
  try {
    const command = `ffmpeg -i "${inputPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -y "${outputPath}"`;
    
    await execAsync(command, {
      timeout: 300000,
      maxBuffer: 50 * 1024 * 1024,
    });

    console.log(`✓ Normalized video: ${outputPath}`);
  } catch (error: any) {
    throw new Error(`Failed to normalize video: ${error.message}`);
  }
}

async function createConcatFile(videoPaths: string[], concatFilePath: string): Promise<void> {
  const lines = videoPaths.map(p => `file '${p}'`).join('\n');
  await fs.writeFile(concatFilePath, lines, 'utf-8');
}

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

function buildFilterGraph(
  videoCount: number,
  enhancements: VideoEnhancements | undefined,
  metadataList: VideoMetadata[],
  hasBackgroundMusic: boolean
): { videoFilters: string; audioFilters: string; adjustedDurations: number[] } {
  const videoFilterSteps: string[] = [];
  const audioFilterSteps: string[] = [];
  const adjustedDurations: number[] = [];
  
  let videoStreams: string[] = [];
  let audioStreamLabels: string[] = [];
  
  for (let i = 0; i < videoCount; i++) {
    const speedFactor = getSpeedFactorForClip(i, enhancements?.speed);
    const originalDuration = metadataList[i].duration;
    const hasAudio = metadataList[i].hasAudio;
    
    const adjustedDuration = originalDuration / speedFactor;
    adjustedDurations.push(adjustedDuration);
    
    if (speedFactor !== 1.0) {
      videoFilterSteps.push(`[${i}:v]setpts=${(1.0 / speedFactor).toFixed(3)}*PTS[v${i}s]`);
      videoStreams.push(`[v${i}s]`);
      
      if (hasAudio) {
        const aSpeed = speedFactor <= 2.0
          ? `[${i}:a]atempo=${speedFactor.toFixed(3)}[a${i}s]`
          : `[${i}:a]atempo=2.0,atempo=${(speedFactor / 2.0).toFixed(3)}[a${i}s]`;
        audioFilterSteps.push(aSpeed);
        audioStreamLabels.push(`[a${i}s]`);
      } else {
        audioFilterSteps.push(`anullsrc=channel_layout=stereo:sample_rate=44100:duration=${adjustedDuration.toFixed(2)}[a${i}s]`);
        audioStreamLabels.push(`[a${i}s]`);
      }
    } else {
      videoStreams.push(`[${i}:v]`);
      if (hasAudio) {
        audioStreamLabels.push(`[${i}:a]`);
      } else {
        audioFilterSteps.push(`anullsrc=channel_layout=stereo:sample_rate=44100:duration=${originalDuration.toFixed(2)}[a${i}s]`);
        audioStreamLabels.push(`[a${i}s]`);
      }
    }
  }

  if (enhancements?.transitions?.mode === 'crossfade' && videoCount > 1) {
    const duration = enhancements.transitions.durationSeconds || 1.0;
    let currentStream = videoStreams[0];
    
    for (let i = 1; i < videoCount; i++) {
      const offset = adjustedDurations.slice(0, i).reduce((sum, d) => sum + d, 0) - duration;
      const nextLabel = i === videoCount - 1 ? 'vout' : `v${i}xf`;
      videoFilterSteps.push(`${currentStream}${videoStreams[i]}xfade=transition=fade:duration=${duration}:offset=${offset.toFixed(2)}[${nextLabel}]`);
      currentStream = `[${nextLabel}]`;
    }
  } else if (videoCount > 1) {
    videoFilterSteps.push(`${videoStreams.join('')}concat=n=${videoCount}:v=1:a=0[vout]`);
  } else {
    videoFilterSteps.push(`${videoStreams[0]}null[vout]`);
  }

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
    videoFilterSteps.push('[vout]null[vfinal]');
  }

  const resampledLabels: string[] = [];
  for (let i = 0; i < audioStreamLabels.length; i++) {
    const resampledLabel = `[ar${i}]`;
    audioFilterSteps.push(`${audioStreamLabels[i]}aresample=44100${resampledLabel}`);
    resampledLabels.push(resampledLabel);
  }

  if (videoCount > 1 && enhancements?.transitions?.mode === 'crossfade') {
    const duration = enhancements.transitions.durationSeconds || 1.0;
    let currentAudioStream = resampledLabels[0];
    
    for (let i = 1; i < videoCount; i++) {
      const nextLabel = i === videoCount - 1 ? '[aout]' : `[a${i}xf]`;
      audioFilterSteps.push(`${currentAudioStream}${resampledLabels[i]}acrossfade=d=${duration}${nextLabel}`);
      currentAudioStream = nextLabel;
    }
  } else if (videoCount > 1) {
    audioFilterSteps.push(`${resampledLabels.join('')}concat=n=${videoCount}:v=0:a=1[aout]`);
  } else {
    audioFilterSteps.push(`${resampledLabels[0]}anull[aout]`);
  }

  const videoFilters = videoFilterSteps.join(';');
  const audioFilters = audioFilterSteps.join(';');

  return { videoFilters, audioFilters, adjustedDurations };
}

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

export async function combineVideos(options: CombineVideosOptions): Promise<CombineVideosResult> {
  const { videoUrls, enhancements, onProgress } = options;

  if (!videoUrls || videoUrls.length < 2) {
    throw new Error('At least 2 videos are required');
  }

  if (videoUrls.length > 20) {
    throw new Error('Cannot combine more than 20 videos');
  }

  await acquireJobSlot();
  
  let tempDir: string | null = null;
  const tempFiles: string[] = [];

  try {
    await ensureDirectories();

    const jobId = nanoid(10);
    tempDir = path.join(TEMP_DIR, jobId);
    await fs.mkdir(tempDir, { recursive: true });

    onProgress?.('download', `Downloading ${videoUrls.length} videos...`);

    const downloadedPaths: string[] = [];
    for (let i = 0; i < videoUrls.length; i++) {
      onProgress?.('download', `Downloading video ${i + 1}/${videoUrls.length}...`);
      const filepath = await downloadVideo(videoUrls[i], tempDir, i);
      downloadedPaths.push(filepath);
      tempFiles.push(filepath);
    }

    onProgress?.('validate', 'Validating and normalizing videos...');

    const metadataList: VideoMetadata[] = [];
    const normalizedPaths: string[] = [];

    // Normalize all videos to ensure compatibility
    for (let i = 0; i < downloadedPaths.length; i++) {
      try {
        onProgress?.('validate', `Processing video ${i + 1}/${downloadedPaths.length}...`);
        
        const metadata = await getVideoMetadata(downloadedPaths[i]);
        metadataList.push(metadata);

        // Check if normalization is needed
        const needsNormalization = metadata.codec !== 'h264' || !metadata.hasAudio;
        
        if (needsNormalization) {
          onProgress?.('normalize', `Video ${i + 1} needs format conversion...`);
          const normalizedPath = path.join(tempDir, `normalized_${i}.mp4`);
          await normalizeVideo(downloadedPaths[i], normalizedPath);
          normalizedPaths.push(normalizedPath);
          tempFiles.push(normalizedPath);
        } else {
          normalizedPaths.push(downloadedPaths[i]);
        }
      } catch (error: any) {
        throw new Error(`Video ${i + 1}: ${error.message}`);
      }
    }

    let musicPath: string | undefined;
    if (enhancements?.backgroundMusic?.audioUrl) {
      onProgress?.('download', 'Downloading background music...');
      musicPath = await downloadAudio(enhancements.backgroundMusic.audioUrl, tempDir);
      tempFiles.push(musicPath);
    }

    const hasEnhancements = !!(
      enhancements?.transitions?.mode === 'crossfade' ||
      enhancements?.backgroundMusic ||
      (enhancements?.textOverlays && enhancements.textOverlays.length > 0) ||
      (enhancements?.speed && enhancements.speed.mode !== 'none') ||
      (enhancements?.clipTrims && Object.keys(enhancements.clipTrims).length > 0)
    );

    const outputFilename = `combined_${jobId}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    tempFiles.push(outputPath);

    let totalDuration = metadataList.reduce((sum, m) => sum + m.duration, 0);
    let ffmpegCommand: string;

    if (!hasEnhancements) {
      onProgress?.('process', 'Combining videos (fast mode)...');
      
      const concatFilePath = path.join(tempDir, 'concat.txt');
      await createConcatFile(normalizedPaths, concatFilePath);
      tempFiles.push(concatFilePath);

      ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputPath}"`;
    } else {
      onProgress?.('process', 'Applying enhancements and combining...');

      const inputFlags = normalizedPaths.map(p => `-i "${p}"`).join(' ');
      const musicInputFlag = musicPath ? `-i "${musicPath}"` : '';

      const { videoFilters, audioFilters, adjustedDurations } = buildFilterGraph(
        normalizedPaths.length,
        enhancements,
        metadataList,
        !!musicPath
      );

      totalDuration = adjustedDurations.reduce((sum, d) => sum + d, 0);

      let completeAudioFilter = audioFilters;
      let finalAudioLabel = '[aout]';
      
      if (musicPath && enhancements?.backgroundMusic) {
        const volume = enhancements.backgroundMusic.volume || 0.3;
        const fadeIn = enhancements.backgroundMusic.fadeInSeconds || 0;
        const fadeOut = enhancements.backgroundMusic.fadeOutSeconds || 0;
        const musicStreamIdx = normalizedPaths.length;

        let musicFilter = `[${musicStreamIdx}:a]atrim=0:${totalDuration},asetpts=PTS-STARTPTS,volume=${volume}`;
        if (fadeIn > 0) {
          musicFilter += `,afade=t=in:st=0:d=${fadeIn}`;
        }
        if (fadeOut > 0) {
          musicFilter += `,afade=t=out:st=${totalDuration - fadeOut}:d=${fadeOut}`;
        }
        musicFilter += `[music]`;

        completeAudioFilter += `;${musicFilter};[aout][music]amix=inputs=2:duration=first:dropout_transition=0[afinal]`;
        finalAudioLabel = '[afinal]';
      }

      const fullFilterComplex = videoFilters + ';' + completeAudioFilter;

      ffmpegCommand = `ffmpeg ${inputFlags} ${musicInputFlag} -filter_complex "${fullFilterComplex}" -map "[vfinal]" -map "${finalAudioLabel}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k "${outputPath}"`;
    }

    onProgress?.('process', 'Running FFmpeg...');
    
    await execAsync(ffmpegCommand, {
      timeout: FFMPEG_TIMEOUT,
      maxBuffer: 50 * 1024 * 1024,
    });

    onProgress?.('complete', 'Video combination complete!');

    const relativePath = `/video-combinations/${outputFilename}`;

    return {
      outputPath: relativePath,
      durationSeconds: Math.round(totalDuration),
      tempFiles,
    };

  } catch (error: any) {
    const errorMsg = error.message || 'Video combination failed';
    const friendlyError = formatFFmpegError(errorMsg);
    onProgress?.('error', friendlyError);
    throw new Error(friendlyError);
  } finally {
    releaseJobSlot();

    if (tempDir) {
      try {
        const filesToClean = tempFiles.filter(f => !f.startsWith(OUTPUT_DIR));
        for (const file of filesToClean) {
          await fs.unlink(file).catch(() => {});
        }
        await fs.rmdir(tempDir).catch(() => {});
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
  }
}

/**
 * Convert raw FFmpeg errors to user-friendly messages
 */
function formatFFmpegError(error: string): string {
  const lowerError = error.toLowerCase();

  if (lowerError.includes('codec') || lowerError.includes('format')) {
    return 'Video format incompatibility detected. Videos were automatically converted to a compatible format. Please try again.';
  }
  if (lowerError.includes('timeout')) {
    return 'Video processing took too long. Try combining fewer videos or shorter clips.';
  }
  if (lowerError.includes('no space')) {
    return 'Insufficient storage space. Please try again later.';
  }
  if (lowerError.includes('permission')) {
    return 'Permission denied. Please check file access.';
  }
  if (lowerError.includes('connection') || lowerError.includes('download')) {
    return 'Failed to download video. Please check your internet connection and try again.';
  }
  if (lowerError.includes('invalid') || lowerError.includes('corrupt')) {
    return 'One or more videos appear to be corrupted. Please re-generate and try again.';
  }
  if (lowerError.includes('filter')) {
    return 'Video enhancement filter failed. Try reducing the number of text overlays or effects.';
  }

  return 'Video combination failed. Please check your videos and try again.';
}

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
