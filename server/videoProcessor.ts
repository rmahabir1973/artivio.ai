import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import axios from 'axios';
import { nanoid } from 'nanoid';
import type { VideoEnhancements } from '@shared/schema';
import * as s3 from './services/awsS3';

const execAsync = promisify(exec);

// Configuration
const TEMP_DIR = path.join(process.cwd(), 'temp', 'video-processing');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'video-combinations');
const THUMBNAIL_DIR = path.join(process.cwd(), 'public', 'thumbnails');
const MAX_CONCURRENT_JOBS = 8; // Increased for better parallelism
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
  previewMode?: boolean; // Generate low-res 360p preview for speed
  onProgress?: (stage: string, message: string) => void;
}

export interface CombineVideosResult {
  outputPath: string;
  outputUrl: string; // S3 URL or local path for serving
  durationSeconds: number;
  duration: number; // Alias for durationSeconds
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
  await fs.mkdir(THUMBNAIL_DIR, { recursive: true });
}

// Helper to detect if URL points to an image
function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
  const pathname = new URL(url).pathname.toLowerCase();
  return imageExtensions.some(ext => pathname.endsWith(ext));
}

// Download an image file
async function downloadImage(url: string, tempDir: string, index: number): Promise<string> {
  const ext = path.extname(new URL(url).pathname) || '.png';
  const filename = `image_${index}${ext}`;
  const filepath = path.join(tempDir, filename);

  try {
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 60000,
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const writer = createWriteStream(filepath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', () => resolve());
      writer.on('error', reject);
    });

    const stats = await fs.stat(filepath);
    if (stats.size === 0) {
      throw new Error('Downloaded image is empty');
    }
    
    console.log(`✓ Downloaded image ${index}: ${filepath} (${(stats.size / 1024).toFixed(2)}KB)`);
    return filepath;
  } catch (error: any) {
    throw new Error(`Failed to download image ${index + 1}: ${error.message}`);
  }
}

// Convert an image to a video with specified duration
async function imageToVideo(imagePath: string, outputPath: string, durationSeconds: number, previewMode: boolean = false): Promise<void> {
  try {
    const resolution = previewMode ? '640:360' : '1280:720';
    const bitrate = previewMode ? '800k' : '2500k';
    const crf = previewMode ? 28 : 24;
    const preset = previewMode ? 'ultrafast' : 'fast';
    
    // Loop the image for the specified duration with Ken Burns style zoom (subtle)
    // -loop 1 loops the image, -t sets duration, -r sets framerate
    // scale filter ensures proper resolution, pad adds letterboxing if needed
    const command = `ffmpeg -loop 1 -i "${imagePath}" -c:v libx264 -t ${durationSeconds} -pix_fmt yuv420p -r 30 -vf "scale=${resolution}:force_original_aspect_ratio=decrease,pad=${resolution}:-1:-1:color=black,fps=30" -b:v ${bitrate} -preset ${preset} -crf ${crf} -an -movflags +faststart -y "${outputPath}"`;
    
    await execAsync(command, {
      timeout: 60000,
      maxBuffer: 20 * 1024 * 1024,
    });
    
    console.log(`✓ Converted image to video: ${outputPath} (${durationSeconds}s, ${previewMode ? '360p' : '720p'})`);
  } catch (error: any) {
    console.error(`Image to video conversion error:`, error.message);
    throw new Error(`Failed to convert image to video: ${error.message}`);
  }
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
      timeout: 120000, // Increased timeout for larger files
      validateStatus: (status) => status >= 200 && status < 300, // Only accept 2xx
    });

    // Check Content-Type to ensure we're downloading a video, not an error page
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('video') && !contentType.includes('octet-stream') && !contentType.includes('application/mp4')) {
      // If response is HTML or text, the URL likely expired
      if (contentType.includes('text/html') || contentType.includes('text/plain') || contentType.includes('application/xml')) {
        throw new Error('Video link has expired. Please re-generate the video or try again later.');
      }
      console.warn(`Unexpected content type for video ${index}: ${contentType}`);
    }

    const writer = createWriteStream(filepath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', () => resolve());
      writer.on('error', reject);
    });

    const stats = await fs.stat(filepath);
    if (stats.size === 0) {
      throw new Error('Downloaded file is empty - video link may have expired');
    }
    
    // Additional check: if file is too small, it might be an error page
    if (stats.size < 1000) {
      // Read the file to check if it's HTML
      const content = await fs.readFile(filepath, 'utf-8').catch(() => '');
      if (content.includes('<html') || content.includes('<!DOCTYPE') || content.includes('AccessDenied') || content.includes('expired')) {
        throw new Error('Video link has expired. Please re-generate the video or try again later.');
      }
    }
    
    console.log(`✓ Downloaded video ${index}: ${filepath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);

    return filepath;
  } catch (error: any) {
    // Handle specific axios errors
    if (error.response) {
      const status = error.response.status;
      if (status === 403 || status === 401) {
        throw new Error(`Video ${index + 1} link has expired or is no longer accessible. Please re-generate the video.`);
      }
      if (status === 404) {
        throw new Error(`Video ${index + 1} not found. The video may have been deleted or the link has expired.`);
      }
    }
    
    // Check for expired link indicators in error message
    const errMsg = error.message?.toLowerCase() || '';
    if (errMsg.includes('expired') || errMsg.includes('access denied') || errMsg.includes('forbidden')) {
      throw new Error(`Video ${index + 1} link has expired. Please re-generate the video or try again later.`);
    }
    
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

  // Use format duration for precise timing (more accurate than stream duration)
  const command = `ffprobe -v error -show_entries format=duration -show_entries stream=codec_type,codec_name,width,height -of json "${filepath}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
    
    const data = JSON.parse(stdout);
    const streams = data.streams || [];
    const format = data.format || {};

    if (streams.length === 0) {
      throw new Error('No streams found in video');
    }

    const videoStream = streams.find((s: any) => s.codec_type === 'video');
    if (!videoStream) {
      throw new Error('No video stream found');
    }

    const audioStream = streams.find((s: any) => s.codec_type === 'audio');

    // Use format.duration for precise timing (avoids rounding issues)
    const duration = format.duration ? parseFloat(format.duration) : 0;

    const metadata = {
      duration,
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
 * Get audio file duration in seconds
 */
async function getAudioDuration(filepath: string): Promise<number> {
  try {
    const stats = await fs.stat(filepath);
    if (stats.size === 0) {
      throw new Error('Audio file is empty');
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Audio file not found`);
    }
    throw new Error(`Cannot access audio file: ${error.message}`);
  }

  const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filepath}"`;
  
  try {
    const { stdout } = await execAsync(command, { timeout: 10000 });
    const duration = parseFloat(stdout.trim());
    
    if (isNaN(duration) || duration <= 0) {
      throw new Error('Invalid audio duration');
    }
    
    return duration;
  } catch (error: any) {
    throw new Error(`Failed to read audio duration: ${error.message}`);
  }
}

interface NormalizeOptions {
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  previewMode?: boolean; // Use 360p and faster encoding for preview
}

/**
 * Normalize video to standard format (MP4 with H.264 + AAC) with bitrate limiting
 * CRITICAL: Ensures consistent fps, resolution, and audio sample rate for smooth transitions
 * Supports optional trimming via trimStartSeconds and trimEndSeconds
 */
async function normalizeVideo(inputPath: string, outputPath: string, options?: NormalizeOptions): Promise<void> {
  try {
    // Get metadata first to check for audio
    const metadata = await getVideoMetadata(inputPath);
    
    // Build audio encoding based on whether video has audio
    // CRITICAL: Force 44100Hz sample rate and stereo for consistent audio concatenation
    const audioFlags = metadata.hasAudio 
      ? '-c:a aac -b:a 128k -ar 44100 -ac 2' 
      : '-an'; // No audio output if input has no audio
    
    // Build seek/trim flags for clip splitting
    let seekFlags = '';
    let durationFlags = '';
    
    if (options?.trimStartSeconds !== undefined && options.trimStartSeconds > 0) {
      // Use -ss before -i for fast seeking
      seekFlags = `-ss ${options.trimStartSeconds.toFixed(3)}`;
    }
    
    if (options?.trimEndSeconds !== undefined && options.trimEndSeconds > 0) {
      // Calculate duration if we have an end time
      const startTime = options?.trimStartSeconds ?? 0;
      const duration = Math.max(0.1, options.trimEndSeconds - startTime);
      durationFlags = `-t ${duration.toFixed(3)}`;
    }
    
    // Preview mode uses 360p and faster encoding for speed
    // Normal mode uses 720p with higher quality
    const resolution = options?.previewMode ? '640:360' : '1280:720';
    const bitrate = options?.previewMode ? '800k' : '2500k';
    const crf = options?.previewMode ? 28 : 24;
    const preset = options?.previewMode ? 'ultrafast' : 'fast';
    
    // Optimize for streaming: movflags +faststart enables instant playback
    // CRITICAL: Use pad filter to ensure consistent resolution for proper concatenation
    // CRITICAL: Force 30fps for consistent frame timing across all clips (prevents transition jitter)
    const command = `ffmpeg ${seekFlags} -i "${inputPath}" ${durationFlags} -vf "scale=${resolution}:force_original_aspect_ratio=decrease,pad=${resolution}:-1:-1:color=black,fps=30" -c:v libx264 -b:v ${bitrate} -preset ${preset} -crf ${crf} -movflags +faststart ${audioFlags} -y "${outputPath}"`;
    
    await execAsync(command, {
      timeout: 300000,
      maxBuffer: 50 * 1024 * 1024,
    });

    const trimInfo = (options?.trimStartSeconds || options?.trimEndSeconds) 
      ? `, trim: ${options.trimStartSeconds ?? 0}s - ${options.trimEndSeconds ?? 'end'}` 
      : '';
    console.log(`✓ Normalized video: ${outputPath} (audio: ${metadata.hasAudio ? 'yes' : 'no'}, resolution: 720p, fps: 30, bitrate: 2500k${trimInfo})`);
  } catch (error: any) {
    console.error(`Normalization error for ${inputPath}:`, error.message);
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
): { videoFilters: string; audioFilters: string; adjustedDurations: number[]; transitionDuration: number } {
  const videoFilterSteps: string[] = [];
  const audioFilterSteps: string[] = [];
  const adjustedDurations: number[] = [];
  
  let videoStreams: string[] = [];
  let audioStreamLabels: string[] = [];
  
  // Get transition duration (used for offset calculations and tpad)
  const transitionDuration = (enhancements?.transitions?.mode === 'crossfade' && videoCount > 1) 
    ? (enhancements.transitions.durationSeconds || 1.0) 
    : 0;
  
  // Helper to get clip settings (mute, volume) for a specific clip
  const getClipSettings = (clipIndex: number) => {
    const clipSetting = enhancements?.clipSettings?.find(cs => cs.clipIndex === clipIndex);
    return {
      muted: clipSetting?.muted ?? false,
      volume: clipSetting?.volume ?? 1.0,
    };
  };
  
  for (let i = 0; i < videoCount; i++) {
    const speedFactor = getSpeedFactorForClip(i, enhancements?.speed);
    const originalDuration = metadataList[i].duration;
    const hasAudio = metadataList[i].hasAudio;
    const { muted, volume } = getClipSettings(i);
    
    const adjustedDuration = originalDuration / speedFactor;
    adjustedDurations.push(adjustedDuration);
    
    if (speedFactor !== 1.0) {
      videoFilterSteps.push(`[${i}:v]setpts=${(1.0 / speedFactor).toFixed(3)}*PTS[v${i}s]`);
      videoStreams.push(`[v${i}s]`);
      
      if (hasAudio && !muted) {
        // Apply volume and speed adjustment
        const volumeFilter = volume !== 1.0 ? `,volume=${volume.toFixed(2)}` : '';
        const aSpeed = speedFactor <= 2.0
          ? `[${i}:a]atempo=${speedFactor.toFixed(3)}${volumeFilter}[a${i}s]`
          : `[${i}:a]atempo=2.0,atempo=${(speedFactor / 2.0).toFixed(3)}${volumeFilter}[a${i}s]`;
        audioFilterSteps.push(aSpeed);
        audioStreamLabels.push(`[a${i}s]`);
      } else {
        // Muted or no audio - use silent audio
        audioFilterSteps.push(`anullsrc=channel_layout=stereo:sample_rate=44100:duration=${adjustedDuration.toFixed(3)}[a${i}s]`);
        audioStreamLabels.push(`[a${i}s]`);
      }
    } else {
      videoStreams.push(`[${i}:v]`);
      if (hasAudio && !muted) {
        if (volume !== 1.0) {
          // Apply volume adjustment without speed change
          audioFilterSteps.push(`[${i}:a]volume=${volume.toFixed(2)}[a${i}v]`);
          audioStreamLabels.push(`[a${i}v]`);
        } else {
          audioStreamLabels.push(`[${i}:a]`);
        }
      } else {
        // Muted or no audio - use silent audio
        audioFilterSteps.push(`anullsrc=channel_layout=stereo:sample_rate=44100:duration=${originalDuration.toFixed(3)}[a${i}s]`);
        audioStreamLabels.push(`[a${i}s]`);
      }
    }
  }

  // Precompute start times for each clip (cumulative sum of previous durations)
  // CRITICAL FIX: Calculate proper xfade offsets to prevent early clipping
  if (enhancements?.transitions?.mode === 'crossfade' && videoCount > 1) {
    const duration = transitionDuration;
    let currentStream = videoStreams[0];
    
    // Calculate cumulative start times for each clip
    const startTimes: number[] = [0];
    for (let i = 1; i < videoCount; i++) {
      // Each clip starts at the end of the previous clip minus the transition overlap
      startTimes.push(startTimes[i - 1] + adjustedDurations[i - 1] - duration);
    }
    
    for (let i = 1; i < videoCount; i++) {
      // Offset is the start time of clip i (clamped to >= 0)
      const offset = Math.max(0, startTimes[i]);
      const isLast = i === videoCount - 1;
      // Use intermediate label for the xfade output, then apply tpad to final
      const nextLabel = isLast ? 'vxfout' : `v${i}xf`;
      videoFilterSteps.push(`${currentStream}${videoStreams[i]}xfade=transition=fade:duration=${duration.toFixed(3)}:offset=${offset.toFixed(3)}[${nextLabel}]`);
      currentStream = `[${nextLabel}]`;
    }
    
    // CRITICAL: Add tpad to preserve full original duration
    // Crossfade consumes (n-1)*transitionDuration, so we pad that much back
    const totalPadDuration = (videoCount - 1) * duration;
    videoFilterSteps.push(`[vxfout]tpad=stop_duration=${totalPadDuration.toFixed(3)}[vout]`);
  } else if (videoCount > 1) {
    videoFilterSteps.push(`${videoStreams.join('')}concat=n=${videoCount}:v=1:a=0[vout]`);
  } else {
    videoFilterSteps.push(`${videoStreams[0]}null[vout]`);
  }

  // Calculate effective total duration accounting for crossfade overlap and tpad
  const rawTotalDuration = adjustedDurations.reduce((sum, d) => sum + d, 0);
  const crossfadeOverlap = transitionDuration > 0 ? (videoCount - 1) * transitionDuration : 0;
  const totalPadDuration = transitionDuration > 0 ? (videoCount - 1) * transitionDuration : 0;
  // Final duration = raw sum - overlap + totalPadDuration (preserves original duration)
  const effectiveTotalDuration = rawTotalDuration - crossfadeOverlap + totalPadDuration;
  
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
        enableClause = `:enable='gte(t,${effectiveTotalDuration - dur})'`;
      }
      
      videoFilterSteps.push(
        `${textFilter}drawtext=${fontfile}text='${escapedText}':${position}:fontsize=${fontsize}:fontcolor=${fontcolor}${enableClause}[${outputLabel}]`
      );
      textFilter = `[${outputLabel}]`;
    }
  } else {
    videoFilterSteps.push('[vout]null[vfinal]');
  }

  // CRITICAL FIX: Enhanced audio processing to eliminate glitches between scenes
  // 1. Resample to consistent 44100Hz
  // 2. Reset timestamps with asetpts=PTS-STARTPTS to ensure clean alignment
  // 3. Apply lowpass filter to remove high-frequency artifacts at transition points
  const resampledLabels: string[] = [];
  for (let i = 0; i < audioStreamLabels.length; i++) {
    const resampledLabel = `[ar${i}]`;
    // Chain: resample -> reset timestamps -> gentle highpass to remove DC offset
    // async=1 handles variable-rate sources, first_pts=0 aligns start
    // asetpts=PTS-STARTPTS resets each clip's timestamps to 0
    audioFilterSteps.push(`${audioStreamLabels[i]}aresample=44100:async=1:first_pts=0,asetpts=PTS-STARTPTS,highpass=f=20${resampledLabel}`);
    resampledLabels.push(resampledLabel);
  }

  if (videoCount > 1 && enhancements?.transitions?.mode === 'crossfade') {
    const duration = transitionDuration;
    let currentAudioStream = resampledLabels[0];
    
    for (let i = 1; i < videoCount; i++) {
      const isLast = i === videoCount - 1;
      // Use intermediate label for crossfade, then add apad to final
      const nextLabel = isLast ? '[axfout]' : `[a${i}xf]`;
      // Use curve=tri for smoother triangular crossfade (less abrupt than default)
      audioFilterSteps.push(`${currentAudioStream}${resampledLabels[i]}acrossfade=d=${duration.toFixed(3)}:c1=tri:c2=tri${nextLabel}`);
      currentAudioStream = nextLabel;
    }
    
    // CRITICAL: Add apad to preserve audio duration matching video tpad
    // Scale padding to (n-1)*transitionDuration to match video tpad
    const totalAudioPadDuration = (videoCount - 1) * duration;
    audioFilterSteps.push(`[axfout]apad=pad_dur=${totalAudioPadDuration.toFixed(3)}[aout]`);
  } else if (videoCount > 1) {
    audioFilterSteps.push(`${resampledLabels.join('')}concat=n=${videoCount}:v=0:a=1[aout]`);
  } else {
    audioFilterSteps.push(`${resampledLabels[0]}anull[aout]`);
  }

  const videoFilters = videoFilterSteps.join(';');
  const audioFilters = audioFilterSteps.join(';');

  return { videoFilters, audioFilters, adjustedDurations, transitionDuration };
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
  const { videoUrls, enhancements, previewMode = false, onProgress } = options;

  // In preview mode, allow single videos; otherwise require 2+
  const minVideos = previewMode ? 1 : 2;
  if (!videoUrls || videoUrls.length < minVideos) {
    throw new Error(`At least ${minVideos} videos are required`);
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

    onProgress?.('download', `Downloading ${videoUrls.length} media files...`);

    // Download all media (videos and images) in parallel
    // For images, we'll convert them to videos after download
    const downloadedPaths = await Promise.all(
      videoUrls.map(async (url, i) => {
        // Check if this is an image based on URL extension OR clipSettings.isImage flag
        const clipSetting = enhancements?.clipSettings?.find(cs => cs.clipIndex === i);
        const urlIsImage = isImageUrl(url);
        const isImage = clipSetting?.isImage || urlIsImage;
        
        if (isImage) {
          // Download image
          const imagePath = await downloadImage(url, tempDir!, i);
          
          // Convert image to video with specified duration (default 5s)
          const displayDuration = clipSetting?.displayDuration ?? 5;
          const videoOutputPath = path.join(tempDir!, `image_video_${i}.mp4`);
          await imageToVideo(imagePath, videoOutputPath, displayDuration, previewMode);
          
          tempFiles.push(imagePath);
          tempFiles.push(videoOutputPath);
          return videoOutputPath;
        } else {
          // Download video normally
          return downloadVideo(url, tempDir!, i);
        }
      })
    );
    downloadedPaths.forEach(filepath => {
      if (!tempFiles.includes(filepath)) {
        tempFiles.push(filepath);
      }
    });

    onProgress?.('validate', 'Validating and normalizing videos...');

    // Get metadata for all videos in parallel
    const metadataList = await Promise.all(
      downloadedPaths.map(filepath => getVideoMetadata(filepath))
    );

    // CRITICAL: Always normalize ALL videos to ensure consistent fps (30), resolution (720p or 360p for preview), 
    // and audio sample rate (44100Hz) for smooth crossfade transitions
    // Without consistent parameters, xfade transitions produce visual/audio artifacts
    // Also applies per-clip trimming from clipSettings (for split clips)
    // Note: Images converted to video already have correct fps/resolution, but we still normalize for consistency
    const normalizePromises = downloadedPaths.map(async (filepath, i) => {
      onProgress?.('normalize', `Normalizing clip ${i + 1}/${downloadedPaths.length}${previewMode ? ' (preview)' : ''}...`);
      const normalizedPath = path.join(tempDir!, `normalized_${i}.mp4`);
      
      // Get trim settings for this clip (if it was split)
      // Note: For images, we don't apply trim since duration is already set in imageToVideo
      const clipSetting = enhancements?.clipSettings?.find(cs => cs.clipIndex === i);
      const isImage = clipSetting?.isImage || isImageUrl(videoUrls[i]);
      
      const trimOptions: NormalizeOptions = {
        // Only apply trim for videos, not images (images already have correct duration)
        trimStartSeconds: isImage ? undefined : clipSetting?.trimStartSeconds,
        trimEndSeconds: isImage ? undefined : clipSetting?.trimEndSeconds,
        previewMode, // Pass preview mode for lower quality encoding
      };
      
      await normalizeVideo(filepath, normalizedPath, trimOptions);
      tempFiles.push(normalizedPath);
      return normalizedPath;
    });

    const normalizedPaths = await Promise.all(normalizePromises);

    // CRITICAL FIX: Re-probe normalized videos for accurate duration
    // The original metadata may differ after normalization (fps change, re-encoding)
    // This fixes duration mismatch issues (e.g., showing 1:48 when actual is 0:48)
    onProgress?.('validate', 'Verifying normalized video durations...');
    const normalizedMetadata = await Promise.all(
      normalizedPaths.map(filepath => getVideoMetadata(filepath))
    );
    // Update metadataList with accurate durations from normalized videos
    for (let i = 0; i < metadataList.length; i++) {
      metadataList[i].duration = normalizedMetadata[i].duration;
      console.log(`✓ Clip ${i + 1} normalized duration: ${normalizedMetadata[i].duration.toFixed(3)}s`);
    }

    let musicPath: string | undefined;
    if (enhancements?.backgroundMusic?.audioUrl) {
      onProgress?.('download', 'Downloading background music...');
      musicPath = await downloadAudio(enhancements.backgroundMusic.audioUrl, tempDir!);
      tempFiles.push(musicPath);
    }

    // Download voice/TTS audio track if specified
    let voicePath: string | undefined;
    if (enhancements?.audioTrack?.audioUrl) {
      onProgress?.('download', 'Downloading voice track...');
      const voiceExt = path.extname(new URL(enhancements.audioTrack.audioUrl).pathname) || '.mp3';
      const voiceFilename = `voice_track${voiceExt}`;
      const voiceFilepath = path.join(tempDir!, voiceFilename);
      
      const response = await axios({
        method: 'GET',
        url: enhancements.audioTrack.audioUrl,
        responseType: 'stream',
        timeout: 60000,
      });
      
      const writer = createWriteStream(voiceFilepath);
      response.data.pipe(writer);
      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });
      
      voicePath = voiceFilepath;
      tempFiles.push(voicePath);
    }

    // Download avatar overlay video if specified
    let avatarPath: string | undefined;
    if (enhancements?.avatarOverlay?.videoUrl) {
      onProgress?.('download', 'Downloading avatar overlay...');
      avatarPath = await downloadVideo(enhancements.avatarOverlay.videoUrl, tempDir!, 999);
      tempFiles.push(avatarPath);
      
      // Normalize avatar to same format as main videos
      const normalizedAvatarPath = path.join(tempDir!, 'normalized_avatar.mp4');
      await normalizeVideo(avatarPath, normalizedAvatarPath);
      tempFiles.push(normalizedAvatarPath);
      avatarPath = normalizedAvatarPath;
    }

    const hasEnhancements = !!(
      enhancements?.transitions?.mode === 'crossfade' ||
      enhancements?.backgroundMusic ||
      enhancements?.audioTrack ||
      enhancements?.avatarOverlay ||
      (enhancements?.textOverlays && enhancements.textOverlays.length > 0) ||
      (enhancements?.speed && enhancements.speed.mode !== 'none') ||
      (enhancements?.clipSettings && enhancements.clipSettings.some(cs => cs.muted || cs.volume !== 1))
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

      // Re-encode with HTML5-compatible settings and bitrate limiting for fast streaming
      // Resolution: max 720p | Bitrate: 2500k | Preset: fast | CRF: 24 | movflags: faststart
      // CRITICAL: Use pad filter to ensure all videos are EXACTLY 1280x720 for proper concatenation
      // Without padding, videos with different aspect ratios cause distortion when joined
      ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:-1:-1:color=black" -c:v libx264 -b:v 2500k -profile:v high -level 4.1 -pix_fmt yuv420p -movflags +faststart -preset fast -crf 24 -c:a aac -b:a 128k "${outputPath}"`;
    } else {
      onProgress?.('process', 'Applying enhancements and combining...');

      // Build input flags - track indices for each input type
      let inputIdx = normalizedPaths.length; // Start after video inputs
      const inputFlags = normalizedPaths.map(p => `-i "${p}"`).join(' ');
      
      const musicInputFlag = musicPath ? `-i "${musicPath}"` : '';
      const musicStreamIdx = musicPath ? inputIdx++ : -1;
      
      const voiceInputFlag = voicePath ? `-i "${voicePath}"` : '';
      const voiceStreamIdx = voicePath ? inputIdx++ : -1;
      
      const avatarInputFlag = avatarPath ? `-i "${avatarPath}"` : '';
      const avatarStreamIdx = avatarPath ? inputIdx++ : -1;

      const { videoFilters, audioFilters, adjustedDurations, transitionDuration } = buildFilterGraph(
        normalizedPaths.length,
        enhancements,
        metadataList,
        !!musicPath
      );

      // CRITICAL FIX: Calculate total duration accounting for crossfade overlap and tpad
      // When using crossfade, each transition overlaps by transitionDuration
      // tpad/apad add back (n-1)*transitionDuration to preserve full original duration
      const rawDuration = adjustedDurations.reduce((sum, d) => sum + d, 0);
      const crossfadeOverlap = transitionDuration > 0 ? (normalizedPaths.length - 1) * transitionDuration : 0;
      const totalPadDuration = transitionDuration > 0 ? (normalizedPaths.length - 1) * transitionDuration : 0;
      // Final duration = raw sum - overlap + totalPadDuration (preserves original duration)
      totalDuration = rawDuration - crossfadeOverlap + totalPadDuration;

      let completeVideoFilter = videoFilters;
      let finalVideoLabel = '[vfinal]';
      let completeAudioFilter = audioFilters;
      let finalAudioLabel = '[aout]';
      
      // Add background music track
      if (musicPath && enhancements?.backgroundMusic && musicStreamIdx >= 0) {
        // Get actual music duration using ffprobe
        const musicDuration = await getAudioDuration(musicPath);
        
        const volume = enhancements.backgroundMusic.volume || 0.3;
        const fadeIn = enhancements.backgroundMusic.fadeInSeconds || 0;
        const fadeOut = enhancements.backgroundMusic.fadeOutSeconds || 0;
        const trimStart = Math.max(0, enhancements.backgroundMusic.trimStartSeconds || 0);
        const trimEnd = enhancements.backgroundMusic.trimEndSeconds || 0;

        // Clamp trimStart to music duration
        const safeTrimStart = Math.min(trimStart, Math.max(0, musicDuration - 0.1));
        
        // Build atrim filter and calculate effective duration
        let musicFilter: string;
        let effectiveDuration: number;
        
        if (trimEnd > 0) {
          // User specified trim end - clamp to actual music duration
          const safeTrimEnd = Math.min(trimEnd, musicDuration);
          const actualTrimEnd = Math.max(safeTrimStart + 0.1, safeTrimEnd);
          effectiveDuration = actualTrimEnd - safeTrimStart;
          musicFilter = `[${musicStreamIdx}:a]atrim=${safeTrimStart}:${actualTrimEnd},asetpts=PTS-STARTPTS,volume=${volume}`;
        } else {
          // Auto mode - use full audio from trimStart to end
          effectiveDuration = Math.max(0.1, musicDuration - safeTrimStart);
          musicFilter = `[${musicStreamIdx}:a]atrim=start=${safeTrimStart},asetpts=PTS-STARTPTS,volume=${volume}`;
        }
        
        // Apply fades within the effective duration
        if (fadeIn > 0) {
          const effectiveFadeIn = Math.min(fadeIn, effectiveDuration / 2);
          musicFilter += `,afade=t=in:st=0:d=${effectiveFadeIn}`;
        }
        if (fadeOut > 0) {
          const effectiveFadeOut = Math.min(fadeOut, effectiveDuration / 2);
          const fadeOutStart = Math.max(0, effectiveDuration - effectiveFadeOut);
          musicFilter += `,afade=t=out:st=${fadeOutStart}:d=${effectiveFadeOut}`;
        }
        musicFilter += `[music]`;

        completeAudioFilter += `;${musicFilter};${finalAudioLabel}[music]amix=inputs=2:duration=first:dropout_transition=0[amix1]`;
        finalAudioLabel = '[amix1]';
      }
      
      // Add voice/TTS track overlay
      if (voicePath && enhancements?.audioTrack && voiceStreamIdx >= 0) {
        const voiceVolume = enhancements.audioTrack.volume ?? 0.8;
        const startAt = enhancements.audioTrack.startAtSeconds ?? 0;
        const fadeIn = enhancements.audioTrack.fadeInSeconds ?? 0;
        const fadeOut = enhancements.audioTrack.fadeOutSeconds ?? 0;
        
        let voiceFilter = `[${voiceStreamIdx}:a]volume=${voiceVolume.toFixed(2)}`;
        
        // Apply fade in/out if specified
        if (fadeIn > 0) {
          voiceFilter += `,afade=t=in:st=0:d=${fadeIn.toFixed(2)}`;
        }
        if (fadeOut > 0) {
          const voiceDuration = await getAudioDuration(voicePath);
          const fadeOutStart = Math.max(0, voiceDuration - fadeOut);
          voiceFilter += `,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeOut.toFixed(2)}`;
        }
        
        // Delay voice start if startAt > 0
        if (startAt > 0) {
          voiceFilter += `,adelay=${Math.round(startAt * 1000)}|${Math.round(startAt * 1000)}`;
        }
        voiceFilter += `[voice]`;
        
        completeAudioFilter += `;${voiceFilter};${finalAudioLabel}[voice]amix=inputs=2:duration=first:dropout_transition=0[amix2]`;
        finalAudioLabel = '[amix2]';
      }
      
      // Add avatar PiP overlay
      if (avatarPath && enhancements?.avatarOverlay && avatarStreamIdx >= 0) {
        const position = enhancements.avatarOverlay.position ?? 'bottom-right';
        const size = enhancements.avatarOverlay.size ?? 'medium';
        const startAt = enhancements.avatarOverlay.startAtSeconds ?? 0;
        const endAt = enhancements.avatarOverlay.endAtSeconds ?? totalDuration;
        
        // Size percentages: small=15%, medium=25%, large=35%
        const sizePercent = size === 'small' ? 0.15 : size === 'large' ? 0.35 : 0.25;
        const scaledWidth = Math.round(1280 * sizePercent);
        const scaledHeight = Math.round(720 * sizePercent);
        
        // Position coordinates (10px padding from edges)
        const padding = 20;
        let overlayX = padding;
        let overlayY = padding;
        
        switch (position) {
          case 'top-left':
            overlayX = padding;
            overlayY = padding;
            break;
          case 'top-right':
            overlayX = 1280 - scaledWidth - padding;
            overlayY = padding;
            break;
          case 'bottom-left':
            overlayX = padding;
            overlayY = 720 - scaledHeight - padding;
            break;
          case 'bottom-right':
            overlayX = 1280 - scaledWidth - padding;
            overlayY = 720 - scaledHeight - padding;
            break;
        }
        
        // Scale avatar video for PiP
        const scaleFilter = `[${avatarStreamIdx}:v]scale=${scaledWidth}:${scaledHeight}[pip_scaled]`;
        
        // Enable expression for timing (show only between startAt and endAt)
        const enableExpr = `between(t,${startAt.toFixed(2)},${endAt.toFixed(2)})`;
        
        // Overlay filter with timing
        const overlayFilter = `${finalVideoLabel}[pip_scaled]overlay=${overlayX}:${overlayY}:enable='${enableExpr}'[vavatar]`;
        
        completeVideoFilter += `;${scaleFilter};${overlayFilter}`;
        finalVideoLabel = '[vavatar]';
        
        // Mix avatar audio with main audio (if avatar has audio)
        const avatarAudioFilter = `[${avatarStreamIdx}:a]volume=0.7,adelay=${Math.round(startAt * 1000)}|${Math.round(startAt * 1000)}[avatar_audio]`;
        completeAudioFilter += `;${avatarAudioFilter};${finalAudioLabel}[avatar_audio]amix=inputs=2:duration=first:dropout_transition=0[amix_avatar]`;
        finalAudioLabel = '[amix_avatar]';
      }

      const fullFilterComplex = completeVideoFilter + ';' + completeAudioFilter;

      // Optimized for streaming: resolution capped at 720p, bitrate limited to 2500k
      // Resolution: max 720p | Bitrate: 2500k | Preset: fast | CRF: 24 | movflags: faststart
      // CRITICAL: Videos are already normalized to 720p in normalizeVideo() step
      // DO NOT add -vf here - it conflicts with filter_complex outputs and causes artifacts
      // The normalized inputs already have consistent 720p, 30fps, 44100Hz audio
      const allInputFlags = [inputFlags, musicInputFlag, voiceInputFlag, avatarInputFlag].filter(Boolean).join(' ');
      ffmpegCommand = `ffmpeg ${allInputFlags} -filter_complex "${fullFilterComplex}" -map "${finalVideoLabel}" -map "${finalAudioLabel}" -c:v libx264 -b:v 2500k -profile:v high -level 4.1 -pix_fmt yuv420p -movflags +faststart -preset fast -crf 24 -c:a aac -b:a 128k -ar 44100 "${outputPath}"`;
    }

    onProgress?.('process', 'Running FFmpeg...');
    
    await execAsync(ffmpegCommand, {
      timeout: FFMPEG_TIMEOUT,
      maxBuffer: 50 * 1024 * 1024,
    });

    // CRITICAL FIX: Get actual duration from output file instead of calculating
    // This ensures the duration we report matches what the video player will show
    try {
      const outputMetadata = await getVideoMetadata(outputPath);
      totalDuration = outputMetadata.duration;
      console.log(`✓ Final output duration verified: ${totalDuration.toFixed(3)}s`);
    } catch (probeError) {
      console.warn('Could not verify output duration, using calculated value:', probeError);
      // Keep the calculated totalDuration as fallback
    }

    // Upload to S3 if enabled
    let finalUrl: string;
    if (s3.isS3Enabled()) {
      try {
        onProgress?.('upload', 'Uploading to cloud storage...');
        const videoBuffer = await fs.readFile(outputPath);
        const result = await s3.uploadBuffer(videoBuffer, {
          prefix: 'video-exports',
          contentType: 'video/mp4',
          filename: outputFilename,
        });
        finalUrl = result.signedUrl;
        console.log(`✓ Combined video uploaded to S3: ${result.key}`);
        
        // Clean up local file after successful S3 upload
        await fs.unlink(outputPath).catch(() => {});
      } catch (s3Error) {
        console.error('[VideoProcessor] S3 upload failed, using local path:', s3Error);
        finalUrl = `/video-combinations/${outputFilename}`;
      }
    } else {
      finalUrl = `/video-combinations/${outputFilename}`;
    }

    onProgress?.('complete', 'Video combination complete!');

    return {
      outputPath: finalUrl,
      outputUrl: finalUrl,
      durationSeconds: Math.round(totalDuration),
      duration: Math.round(totalDuration),
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

export interface GenerateThumbnailOptions {
  videoUrl?: string;          // Remote URL to download
  videoPath?: string;         // Local file path (for already-downloaded videos)
  generationId: string;
  timestampSeconds?: number;
}

export interface GenerateThumbnailResult {
  thumbnailUrl: string;
  thumbnailPath: string;
}

export async function generateThumbnail(options: GenerateThumbnailOptions): Promise<GenerateThumbnailResult> {
  const { videoUrl, videoPath, generationId, timestampSeconds = 2 } = options;
  
  if (!videoUrl && !videoPath) {
    throw new Error('Either videoUrl or videoPath must be provided');
  }
  
  await fs.mkdir(THUMBNAIL_DIR, { recursive: true });
  
  let tempVideoPath: string | null = null;
  let tempDir: string | null = null;
  
  try {
    // Use local path if provided, otherwise download from URL
    if (videoPath) {
      tempVideoPath = videoPath;
      tempDir = null; // No temp directory needed for local files
    } else if (videoUrl) {
      tempDir = path.join(TEMP_DIR, `thumb-${nanoid()}`);
      await fs.mkdir(tempDir, { recursive: true });
      tempVideoPath = await downloadVideo(videoUrl, tempDir, 0);
    }
    
    const thumbnailFilename = `${generationId}.jpg`;
    const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailFilename);
    
    const command = `ffmpeg -ss ${timestampSeconds} -i "${tempVideoPath}" -frames:v 1 -q:v 2 "${thumbnailPath}" -y`;
    
    const { stderr } = await execAsync(command, { 
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024 
    });
    
    const stats = await fs.stat(thumbnailPath);
    if (stats.size === 0) {
      throw new Error('Generated thumbnail is empty');
    }
    
    // Upload to S3 if enabled
    let thumbnailUrl: string;
    if (s3.isS3Enabled()) {
      try {
        const thumbnailBuffer = await fs.readFile(thumbnailPath);
        const result = await s3.uploadBuffer(thumbnailBuffer, {
          prefix: 'uploads/images',
          contentType: 'image/jpeg',
          filename: `thumb-${thumbnailFilename}`,
        });
        thumbnailUrl = result.signedUrl;
        console.log(`✓ Thumbnail uploaded to S3 for ${generationId}`);
        await fs.unlink(thumbnailPath).catch(() => {});
      } catch (s3Error) {
        console.error('[Thumbnail] S3 upload failed, using local path:', s3Error);
        thumbnailUrl = `/thumbnails/${thumbnailFilename}`;
      }
    } else {
      thumbnailUrl = `/thumbnails/${thumbnailFilename}`;
    }
    
    console.log(`✓ Generated thumbnail for ${generationId}: ${thumbnailUrl}`);
    
    return {
      thumbnailUrl,
      thumbnailPath,
    };
  } catch (error: any) {
    console.error(`✗ Thumbnail generation failed for ${generationId}:`, error.message);
    throw new Error(`Failed to generate thumbnail: ${error.message}`);
  } finally {
    // Only cleanup temp directory if we created one (for downloaded videos)
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
  }
}

/**
 * Generate a thumbnail from an image URL by downloading and resizing it
 * For images, we create a small version for preview purposes
 */
export async function generateImageThumbnail(imageUrl: string, generationId: string): Promise<GenerateThumbnailResult> {
  await fs.mkdir(THUMBNAIL_DIR, { recursive: true });
  
  let tempDir: string | null = null;
  
  try {
    tempDir = path.join(TEMP_DIR, `img-thumb-${nanoid()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Download image
    console.log(`📥 Downloading image for thumbnail: ${imageUrl}`);
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
    const imageBuffer = Buffer.from(response.data);
    const tempImagePath = path.join(tempDir, 'image.jpg');
    await fs.writeFile(tempImagePath, imageBuffer);
    
    // Generate thumbnail by resizing image to 300x300 max (ffmpeg works for images too)
    const thumbnailFilename = `${generationId}.jpg`;
    const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailFilename);
    
    // Use ffmpeg to resize image to 300x300 max while maintaining aspect ratio
    const command = `ffmpeg -i "${tempImagePath}" -vf "scale=300:300:force_original_aspect_ratio=decrease" -q:v 5 "${thumbnailPath}" -y`;
    
    const { stderr } = await execAsync(command, { 
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024 
    });
    
    const stats = await fs.stat(thumbnailPath);
    if (stats.size === 0) {
      throw new Error('Generated thumbnail is empty');
    }
    
    // Upload to S3 if enabled
    let thumbnailUrl: string;
    if (s3.isS3Enabled()) {
      try {
        const thumbnailBuffer = await fs.readFile(thumbnailPath);
        const result = await s3.uploadBuffer(thumbnailBuffer, {
          prefix: 'uploads/images',
          contentType: 'image/jpeg',
          filename: `img-thumb-${thumbnailFilename}`,
        });
        thumbnailUrl = result.signedUrl;
        console.log(`✓ Image thumbnail uploaded to S3 for ${generationId}`);
        await fs.unlink(thumbnailPath).catch(() => {});
      } catch (s3Error) {
        console.error('[ImageThumbnail] S3 upload failed, using local path:', s3Error);
        thumbnailUrl = `/thumbnails/${thumbnailFilename}`;
      }
    } else {
      thumbnailUrl = `/thumbnails/${thumbnailFilename}`;
    }
    
    console.log(`✓ Generated image thumbnail for ${generationId}: ${thumbnailUrl}`);
    
    return {
      thumbnailUrl,
      thumbnailPath,
    };
  } catch (error: any) {
    console.error(`✗ Image thumbnail generation failed for ${generationId}:`, error.message);
    throw new Error(`Failed to generate image thumbnail: ${error.message}`);
  } finally {
    // Cleanup temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
  }
}

/**
 * Re-encode a video from URL for optimized streaming
 * Downloads, re-encodes with bitrate limits, and saves to public directory
 */
export async function reencodeVideoForStreaming(videoUrl: string, generationId: string): Promise<string> {
  const tempDir = path.join(TEMP_DIR, `reencode-${generationId}`);
  
  try {
    await fs.mkdir(tempDir, { recursive: true });
    
    // Download original video
    console.log(`Downloading video for re-encoding: ${videoUrl}`);
    const originalPath = await downloadVideo(videoUrl, tempDir, 0);
    
    // Re-encode with optimization settings
    const optimizedFilename = `optimized-${generationId}.mp4`;
    const optimizedPath = path.join(OUTPUT_DIR, optimizedFilename);
    
    console.log(`Re-encoding video for streaming optimization...`);
    await normalizeVideo(originalPath, optimizedPath);
    
    // Upload to S3 if enabled
    let publicUrl: string;
    if (s3.isS3Enabled()) {
      try {
        const videoBuffer = await fs.readFile(optimizedPath);
        const result = await s3.uploadBuffer(videoBuffer, {
          prefix: 'video-exports',
          contentType: 'video/mp4',
          filename: optimizedFilename,
        });
        publicUrl = result.signedUrl;
        console.log(`✓ Re-encoded video uploaded to S3: ${result.key}`);
        await fs.unlink(optimizedPath).catch(() => {});
      } catch (s3Error) {
        console.error('[ReencodeVideo] S3 upload failed, using local path:', s3Error);
        publicUrl = `/video-combinations/${optimizedFilename}`;
      }
    } else {
      publicUrl = `/video-combinations/${optimizedFilename}`;
    }
    
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    
    console.log(`✓ Video re-encoded and optimized: ${publicUrl}`);
    return publicUrl;
  } catch (error: any) {
    // Clean up on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
    throw new Error(`Failed to re-encode video: ${error.message}`);
  }
}
