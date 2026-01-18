/**
 * VPS Video Processor - server.js
 * FFmpeg 8.0.1 Advanced Video Processing Server with Cross-Layer Transitions
 * Updated: January 2026
 * 
 * Full feature support for:
 * - Per-clip settings (fade in/out, volume, mute, speed, trim, image handling)
 * - Audio mixing (background music, audio tracks, per-clip audio)
 * - Aspect ratio conversion (16:9, 9:16, 1:1)
 * - Global effects (fade in/out, watermark, text overlays)
 * - Multi-track timeline with layer-based rendering
 * - Cross-layer transitions (xfade between clips on different tracks)
 * 
 * Deploy to: ~/video-processor/server.js on your VPS
 * Run with: pm2 start server.js --name video-processor
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Cross-layer transitions support with error handling
let crossLayerTransitions;
try {
  crossLayerTransitions = require('./crossLayerTransitions');
  console.log('✓ Cross-layer transitions module loaded');
} catch (error) {
  console.warn('⚠️ Cross-layer transitions module not found:', error.message);
  crossLayerTransitions = { 
    processCrossLayerTransitions: () => null
  };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 3001;
const TEMP_DIR = process.env.TEMP_DIR || '/tmp/video-processing';
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/root/bin/ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/root/bin/ffprobe';
const CALLBACK_SECRET = process.env.CALLBACK_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Validate required environment variables
const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET', 'AWS_REGION'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const S3_BUCKET = process.env.S3_BUCKET;

// Job status tracking
const jobs = new Map();

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ============================================================================
// STARTUP BANNER
// ============================================================================

console.log('----------------------------------------------------------------------------------');
console.log('  VPS Video Processor - FFmpeg 8.0.1 Advanced Edition');
console.log('----------------------------------------------------------------------------------');
console.log(`  Port:          ${PORT}`);
console.log(`  FFmpeg:        ${FFMPEG_PATH}`);
console.log(`  FFprobe:       ${FFPROBE_PATH}`);
console.log(`  S3 Bucket:     ${S3_BUCKET}`);
console.log(`  AWS Region:    ${process.env.AWS_REGION}`);
console.log(`  Callback:      ${CALLBACK_SECRET ? 'Configured ✓' : 'Not configured ⚠️'}`);
console.log(`  Whisper:       ${OPENAI_API_KEY ? 'Enabled ✓' : 'Disabled'}`);
console.log(`  Cross-layer:   ${crossLayerTransitions.processCrossLayerTransitions ? 'Enabled ✓' : 'Disabled ⚠️'}`);
console.log('----------------------------------------------------------------------------------');

// Verify FFmpeg on startup
try {
  const version = execSync(`${FFMPEG_PATH} -version`).toString().split('\n')[0];
  console.log(`✓ FFmpeg verified: ${version}`);
} catch (error) {
  console.error('❌ FFmpeg not accessible at', FFMPEG_PATH);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateHmacSignature(payload) {
  if (!CALLBACK_SECRET) return null;
  const hmac = crypto.createHmac('sha256', CALLBACK_SECRET);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

function updateJobStatus(jobId, stage, progress, additionalData = {}) {
  const current = jobs.get(jobId) || {};
  jobs.set(jobId, {
    ...current,
    status: 'processing',
    stage,
    progress,
    updatedAt: new Date().toISOString(),
    ...additionalData,
  });
  console.log(`[${jobId}] Stage: ${stage} (${progress}%)`);
}

function cleanupJobDir(jobDir, jobId) {
  try {
    if (fs.existsSync(jobDir)) {
      fs.rmSync(jobDir, { recursive: true, force: true });
      console.log(`[${jobId}] ✓ Cleaned up temp directory`);
    }
  } catch (error) {
    console.warn(`[${jobId}] Warning: Could not clean up ${jobDir}:`, error.message);
  }
}

// ============================================================================
// ENDPOINTS
// ============================================================================

app.get('/health', (req, res) => {
  try {
    const version = execSync(`${FFMPEG_PATH} -version`).toString().split('\n')[0];
    res.json({ 
      status: 'ok', 
      ffmpeg: FFMPEG_PATH,
      version: version,
      activeJobs: jobs.size,
      crossLayerEnabled: !!crossLayerTransitions.processCrossLayerTransitions,
      features: [
        'per-clip-fades', 'per-clip-volume', 'per-clip-speed', 'audio-mixing',
        'background-music', 'aspect-ratio', 'watermarks', 'text-overlays',
        'xfade-transitions', 'cross-layer-transitions', 'multi-track-timeline'
      ]
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: 'FFmpeg not accessible' });
  }
});

app.get('/status/:jobId', (req, res) => {
  const status = jobs.get(req.params.jobId);
  if (!status) {
    res.status(404).json({ error: 'Job not found' });
  } else {
    res.json(status);
  }
});

app.post('/process', async (req, res) => {
  const jobId = req.body.jobId || uuidv4();
  const jobDir = path.join(TEMP_DIR, jobId);
  
  try {
    fs.mkdirSync(jobDir, { recursive: true });
    
    const { 
      clips, 
      enhancements, 
      videoSettings,
      multiTrackTimeline,
      crossLayerTransitions: crossLayerTransitionsData,
      callbackUrl 
    } = req.body;
    
    if (!clips || !Array.isArray(clips) || clips.length === 0) {
      return res.status(400).json({ error: 'Invalid or missing clips array' });
    }
    
    const outputFormat = videoSettings?.format || 'mp4';
    
    console.log(`\n[${jobId}] ------------------------------------------------------------`);
    console.log(`[${jobId}] New job received`);
    console.log(`[${jobId}]   Clips: ${clips.length}`);
    console.log(`[${jobId}]   Format: ${outputFormat}`);
    console.log(`[${jobId}]   Multi-track: ${multiTrackTimeline ? 'Yes' : 'No'}`);
    console.log(`[${jobId}]   Cross-layer Transitions: ${crossLayerTransitionsData?.length || 0}`);
    console.log(`[${jobId}] ------------------------------------------------------------\n`);
    
    jobs.set(jobId, {
      status: 'processing',
      startedAt: new Date().toISOString(),
      progress: 0,
      stage: 'initializing'
    });
    
    res.json({ status: 'processing', jobId, message: 'Video processing started' });
    
    processVideo(jobId, jobDir, clips, enhancements, videoSettings, multiTrackTimeline, crossLayerTransitionsData, callbackUrl);
    
  } catch (error) {
    console.error(`[${jobId}] Process error:`, error);
    jobs.set(jobId, { status: 'failed', error: error.message, completedAt: new Date().toISOString() });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// VIDEO PROCESSING PIPELINE
// ============================================================================

async function processVideo(jobId, jobDir, clips, enhancements, videoSettings, multiTrackTimeline, crossLayerTransitionsData, callbackUrl) {
  const outputFormat = videoSettings?.format || 'mp4';
  
  try {
    console.log(`[${jobId}] Starting advanced video processing pipeline`);
    
    // Stage 1: Download all media
    updateJobStatus(jobId, 'downloading', 5);
    const localClips = await downloadClips(clips, enhancements, jobDir, jobId);
    console.log(`[${jobId}] ✓ Downloaded ${localClips.length} clips`);
    
    // Stage 2: Download additional media
    updateJobStatus(jobId, 'downloading_audio', 15);
    const audioAssets = await downloadAudioAssets(enhancements, jobDir, jobId);
    
    // Stage 3: Probe media metadata
    updateJobStatus(jobId, 'analyzing', 25);
    for (let clip of localClips) {
      const metadata = await probeMedia(clip.localPath);
      clip.actualDuration = metadata.duration;
      clip.width = metadata.width;
      clip.height = metadata.height;
      clip.hasAudio = metadata.hasAudio;
      clip.fps = metadata.fps;
      console.log(`[${jobId}]   Clip ${clip.index}: ${clip.actualDuration.toFixed(2)}s, ${clip.width}x${clip.height}, audio: ${clip.hasAudio}`);
    }
    
    // Stage 4: Build FFmpeg filter graph
    updateJobStatus(jobId, 'building_filters', 35);
    const outputPath = path.join(jobDir, `output.${outputFormat}`);
    
    const ffmpegArgs = buildAdvancedFFmpegCommand(
      localClips, 
      enhancements, 
      videoSettings, 
      audioAssets,
      multiTrackTimeline,
      crossLayerTransitionsData,
      clips,
      outputPath,
      jobId
    );
    
    console.log(`[${jobId}] Running FFmpeg...`);
    
    // Stage 5: Execute FFmpeg
    updateJobStatus(jobId, 'encoding', 40);
    await executeFFmpeg(ffmpegArgs, jobId, jobs);
    console.log(`[${jobId}] ✓ FFmpeg encoding complete`);
    
    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg completed but output file not found');
    }
    
    const outputStats = fs.statSync(outputPath);
    console.log(`[${jobId}] Output size: ${(outputStats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Stage 6: Upload to S3
    updateJobStatus(jobId, 'uploading', 85);
    const s3Key = `exports/${jobId}/video.${outputFormat}`;
    const downloadUrl = await uploadToS3(outputPath, s3Key, jobId);
    console.log(`[${jobId}] ✓ Uploaded to S3`);
    
    jobs.set(jobId, {
      status: 'completed',
      downloadUrl: downloadUrl,
      completedAt: new Date().toISOString(),
      progress: 100,
      stage: 'complete'
    });
    
    cleanupJobDir(jobDir, jobId);
    
    if (callbackUrl) {
      await sendCallback(callbackUrl, { jobId, status: 'completed', downloadUrl }, jobId);
    }
    
    console.log(`[${jobId}] ✓ JOB COMPLETED SUCCESSFULLY`);
    console.log(`[${jobId}]   Download: ${downloadUrl}`);
    
    setTimeout(() => jobs.delete(jobId), 3600000);
    
  } catch (error) {
    console.error(`[${jobId}] ❌ Pipeline error:`, error.message);
    console.error(`[${jobId}] Stack:`, error.stack);
    
    jobs.set(jobId, {
      status: 'failed',
      error: error.message,
      completedAt: new Date().toISOString(),
      progress: 0,
      stage: 'failed'
    });
    
    cleanupJobDir(jobDir, jobId);
    
    if (callbackUrl) {
      await sendCallback(callbackUrl, { jobId, status: 'failed', error: error.message }, jobId);
    }
    
    setTimeout(() => jobs.delete(jobId), 3600000);
  }
}

// ============================================================================
// MEDIA DOWNLOADING
// ============================================================================

async function downloadClips(clips, enhancements, jobDir, jobId) {
  const localClips = [];
  const clipSettings = enhancements?.clipSettings || [];
  
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const videoUrl = clip.sourceUrl || clip.url;
    
    if (!videoUrl) {
      throw new Error(`Clip ${i} is missing video URL`);
    }
    
    const settings = clipSettings.find(cs => cs.clipIndex === i) || {};
    
    try {
      const urlPath = new URL(videoUrl).pathname;
      let ext = path.extname(urlPath).slice(1) || 'mp4';
      
      const isImage = settings.isImage || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(urlPath);
      if (isImage) {
        ext = path.extname(urlPath).slice(1) || 'jpg';
      }
      
      const localPath = path.join(jobDir, `clip_${i}.${ext}`);
      
      console.log(`[${jobId}] Downloading clip ${i}: ${videoUrl.substring(0, 80)}...`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000);
      
      const response = await fetch(videoUrl, { 
        signal: controller.signal,
        headers: { 'User-Agent': 'VPS-Video-Processor/2.0' }
      });
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(localPath, Buffer.from(buffer));
      
      const fileSizeMB = (buffer.byteLength / 1024 / 1024).toFixed(2);
      console.log(`[${jobId}]   ✓ Clip ${i}: ${fileSizeMB} MB ${isImage ? '(image)' : ''}`);
      
      localClips.push({
        ...clip,
        ...settings,
        originalUrl: videoUrl,
        localPath,
        index: i,
        isImage,
      });
      
    } catch (error) {
      throw new Error(`Failed to download clip ${i}: ${error.message}`);
    }
  }
  
  return localClips;
}

async function downloadAudioAssets(enhancements, jobDir, jobId) {
  const assets = { backgroundMusic: null, audioTrack: null, watermark: null };
  
  if (enhancements?.backgroundMusic?.audioUrl) {
    try {
      const url = enhancements.backgroundMusic.audioUrl;
      const ext = path.extname(new URL(url).pathname).slice(1) || 'mp3';
      const localPath = path.join(jobDir, `bgm.${ext}`);
      
      console.log(`[${jobId}] Downloading background music...`);
      
      const response = await fetch(url, { headers: { 'User-Agent': 'VPS-Video-Processor/2.0' } });
      
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(localPath, Buffer.from(buffer));
        assets.backgroundMusic = {
          localPath,
          volume: enhancements.backgroundMusic.volume ?? 0.3,
          fadeInSeconds: enhancements.backgroundMusic.fadeInSeconds ?? 0,
          fadeOutSeconds: enhancements.backgroundMusic.fadeOutSeconds ?? 0,
        };
        console.log(`[${jobId}]   ✓ Background music downloaded`);
      }
    } catch (error) {
      console.warn(`[${jobId}] Warning: Could not download background music:`, error.message);
    }
  }
  
  if (enhancements?.audioTrack?.audioUrl) {
    try {
      const url = enhancements.audioTrack.audioUrl;
      const ext = path.extname(new URL(url).pathname).slice(1) || 'mp3';
      const localPath = path.join(jobDir, `audio_track.${ext}`);
      
      console.log(`[${jobId}] Downloading audio track...`);
      
      const response = await fetch(url, { headers: { 'User-Agent': 'VPS-Video-Processor/2.0' } });
      
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(localPath, Buffer.from(buffer));
        assets.audioTrack = {
          localPath,
          volume: enhancements.audioTrack.volume ?? 1,
          startAtSeconds: enhancements.audioTrack.startAtSeconds ?? 0,
          type: enhancements.audioTrack.type || 'voice',
        };
        console.log(`[${jobId}]   ✓ Audio track downloaded`);
      }
    } catch (error) {
      console.warn(`[${jobId}] Warning: Could not download audio track:`, error.message);
    }
  }
  
  if (enhancements?.watermark?.imageUrl) {
    try {
      const url = enhancements.watermark.imageUrl;
      const ext = path.extname(new URL(url).pathname).slice(1) || 'png';
      const localPath = path.join(jobDir, `watermark.${ext}`);
      
      console.log(`[${jobId}] Downloading watermark...`);
      
      const response = await fetch(url, { headers: { 'User-Agent': 'VPS-Video-Processor/2.0' } });
      
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(localPath, Buffer.from(buffer));
        assets.watermark = {
          localPath,
          position: enhancements.watermark.position || 'bottom-right',
          size: enhancements.watermark.size || 'medium',
          opacity: enhancements.watermark.opacity ?? 0.8,
        };
        console.log(`[${jobId}]   ✓ Watermark downloaded`);
      }
    } catch (error) {
      console.warn(`[${jobId}] Warning: Could not download watermark:`, error.message);
    }
  }
  
  return assets;
}

// ============================================================================
// MEDIA PROBING
// ============================================================================

async function probeMedia(filePath) {
  return new Promise((resolve) => {
    const ffprobe = spawn(FFPROBE_PATH, [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=width,height,codec_type,r_frame_rate',
      '-of', 'json',
      filePath
    ]);
    
    let stdout = '';
    let stderr = '';
    
    ffprobe.stdout.on('data', (data) => { stdout += data.toString(); });
    ffprobe.stderr.on('data', (data) => { stderr += data.toString(); });
    
    ffprobe.on('close', (code) => {
      try {
        if (code === 0 && stdout) {
          const info = JSON.parse(stdout);
          const duration = parseFloat(info.format?.duration) || 5;
          
          let width = 1920, height = 1080, hasAudio = false, fps = 30;
          
          for (const stream of (info.streams || [])) {
            if (stream.codec_type === 'video') {
              width = stream.width || width;
              height = stream.height || height;
              if (stream.r_frame_rate) {
                const [num, den] = stream.r_frame_rate.split('/');
                fps = Math.round(parseInt(num) / (parseInt(den) || 1));
              }
            }
            if (stream.codec_type === 'audio') {
              hasAudio = true;
            }
          }
          
          resolve({ duration, width, height, hasAudio, fps });
          return;
        }
      } catch (e) {
        console.warn(`Could not parse probe output for ${filePath}:`, e.message);
      }
      
      resolve({ duration: 5, width: 1920, height: 1080, hasAudio: false, fps: 30 });
    });
    
    ffprobe.on('error', () => {
      resolve({ duration: 5, width: 1920, height: 1080, hasAudio: false, fps: 30 });
    });
  });
}

// ============================================================================
// FFMPEG COMMAND BUILDER
// ============================================================================

function buildAdvancedFFmpegCommand(
  localClips, 
  enhancements, 
  videoSettings, 
  audioAssets, 
  multiTrackTimeline,
  crossLayerTransitionsData,
  originalClips,
  outputPath, 
  jobId
) {
  const args = [];
  
  args.push('-y');
  args.push('-hide_banner');
  args.push('-loglevel', 'info');
  
  const inputMap = new Map();
  let inputIndex = 0;
  
  localClips.forEach((clip, i) => {
    args.push('-i', clip.localPath);
    inputMap.set(`clip_${i}`, inputIndex++);
  });
  
  if (audioAssets.backgroundMusic) {
    args.push('-i', audioAssets.backgroundMusic.localPath);
    inputMap.set('bgm', inputIndex++);
  }
  
  if (audioAssets.audioTrack) {
    args.push('-i', audioAssets.audioTrack.localPath);
    inputMap.set('audioTrack', inputIndex++);
  }
  
  if (audioAssets.watermark) {
    args.push('-i', audioAssets.watermark.localPath);
    inputMap.set('watermark', inputIndex++);
  }
  
  // ============================================
  // CROSS-LAYER TRANSITIONS PROCESSING
  // ============================================
  let crossLayerResult = null;
  let useCrossLayerMode = false;
  
  if (crossLayerTransitionsData && crossLayerTransitionsData.length > 0 && multiTrackTimeline) {
    console.log(`[${jobId}] [CrossLayer] Processing ${crossLayerTransitionsData.length} cross-layer transition(s)`);
    
    const downloadedClips = localClips.map((clip, i) => ({
      id: clip.id || `clip_${i}`,
      localPath: clip.localPath,
      index: i,
      hasAudio: clip.hasAudio || false,
      actualDuration: clip.actualDuration || 5
    }));
    
    try {
      const payload = {
        clips: originalClips,
        multiTrackTimeline,
        crossLayerTransitions: crossLayerTransitionsData,
        enhancements,
        videoSettings,
        localClips: downloadedClips
      };
      
      crossLayerResult = crossLayerTransitions.processCrossLayerTransitions(payload, downloadedClips);
      
      if (crossLayerResult && crossLayerResult.filterComplex) {
        console.log(`[${jobId}] [CrossLayer] Generated filter complex successfully`);
        useCrossLayerMode = true;
      } else {
        console.warn(`[${jobId}] [CrossLayer] No filter complex generated`);
      }
    } catch (error) {
      console.error(`[${jobId}] [CrossLayer] Error:`, error.message);
    }
  }
  
  // ============================================
  // BUILD FILTER COMPLEX
  // ============================================
  let filterComplex, videoOutput, audioOutput;
  
  if (useCrossLayerMode && crossLayerResult) {
    console.log(`[${jobId}] Using cross-layer transition mode`);
    filterComplex = crossLayerResult.filterComplex;
    videoOutput = crossLayerResult.videoOutput || '[outv]';
    audioOutput = crossLayerResult.audioOutput || '[outa]';
  } else {
    console.log(`[${jobId}] Using standard processing mode`);
    const filterGraph = buildFilterGraph(localClips, enhancements, videoSettings, audioAssets, inputMap, jobId);
    filterComplex = filterGraph.filterComplex;
    videoOutput = filterGraph.videoOutput;
    audioOutput = filterGraph.audioOutput;
  }
  
  if (filterComplex) {
    args.push('-filter_complex', filterComplex);
    args.push('-map', videoOutput);
    args.push('-map', audioOutput);
  } else {
    args.push('-map', '0:v');
    args.push('-map', '0:a?');
  }
  
  const quality = videoSettings?.quality || 'high';
  const crf = quality === 'high' ? 18 : quality === 'medium' ? 23 : 28;
  const preset = quality === 'high' ? 'slow' : quality === 'medium' ? 'medium' : 'fast';
  
  args.push(
    '-c:v', 'libx264',
    '-preset', preset,
    '-crf', crf.toString(),
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '48000',
    '-ac', '2',
    '-movflags', '+faststart',
    outputPath
  );
  
  return args;
}

function buildFilterGraph(clips, enhancements, videoSettings, audioAssets, inputMap, jobId) {
  if (clips.length === 1 && !audioAssets.backgroundMusic && !audioAssets.audioTrack && !audioAssets.watermark) {
    const clip = clips[0];
    if (!clip.fadeInSeconds && !clip.fadeOutSeconds && (clip.speed || 1) === 1 && (clip.volume ?? 1) === 1 && !clip.muted) {
      return { filterComplex: null, videoOutput: '[0:v]', audioOutput: '[0:a]' };
    }
  }
  
  const filterSteps = [];
  const videoStreams = [];
  const audioStreams = [];
  
  let targetWidth = 1920;
  let targetHeight = 1080;
  
  if (enhancements?.aspectRatio) {
    switch (enhancements.aspectRatio) {
      case '9:16': targetWidth = 1080; targetHeight = 1920; break;
      case '1:1': targetWidth = 1080; targetHeight = 1080; break;
      case '4:3': targetWidth = 1440; targetHeight = 1080; break;
      default: targetWidth = 1920; targetHeight = 1080;
    }
  }
  
  if (videoSettings?.resolution) {
    const scale = videoSettings.resolution === '720p' ? 0.667 : 
                  videoSettings.resolution === '480p' ? 0.444 :
                  videoSettings.resolution === '4k' ? 2 : 1;
    targetWidth = Math.round(targetWidth * scale);
    targetHeight = Math.round(targetHeight * scale);
  }
  
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const idx = inputMap.get(`clip_${i}`);
    
    const speed = clip.speed ?? 1;
    const volume = clip.muted ? 0 : (clip.volume ?? 1);
    const fadeIn = clip.fadeInSeconds ?? 0;
    const fadeOut = clip.fadeOutSeconds ?? 0;
    const trimStart = clip.trimStartSeconds ?? 0;
    const trimEnd = clip.trimEndSeconds;
    const displayDuration = clip.isImage ? (clip.displayDuration ?? 5) : null;
    
    let originalDuration = clip.actualDuration || 5;
    if (trimEnd !== undefined) {
      originalDuration = Math.min(originalDuration, trimEnd) - trimStart;
    } else if (trimStart > 0) {
      originalDuration = originalDuration - trimStart;
    }
    const adjustedDuration = originalDuration / speed;
    
    let videoFilters = [];
    
    if (clip.isImage) {
      videoFilters.push(`loop=loop=${Math.ceil(displayDuration * 30)}:size=1:start=0`);
      videoFilters.push('fps=30');
    }
    
    if (trimStart > 0 || trimEnd !== undefined) {
      const trimFilter = trimEnd !== undefined 
        ? `trim=start=${trimStart}:end=${trimEnd}`
        : `trim=start=${trimStart}`;
      videoFilters.push(trimFilter);
      videoFilters.push('setpts=PTS-STARTPTS');
    }
    
    if (speed !== 1 && !clip.isImage) {
      videoFilters.push(`setpts=${(1.0 / speed).toFixed(4)}*PTS`);
    }
    
    videoFilters.push(`scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease`);
    videoFilters.push(`pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black`);
    videoFilters.push('setsar=1');
    
    if (fadeIn > 0) {
      const effectiveFadeIn = Math.min(fadeIn, adjustedDuration / 2);
      videoFilters.push(`fade=t=in:st=0:d=${effectiveFadeIn.toFixed(3)}`);
    }
    if (fadeOut > 0) {
      const effectiveFadeOut = Math.min(fadeOut, adjustedDuration / 2);
      const fadeOutStart = Math.max(0, adjustedDuration - effectiveFadeOut);
      videoFilters.push(`fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${effectiveFadeOut.toFixed(3)}`);
    }
    
    const videoLabel = `v${i}`;
    filterSteps.push(`[${idx}:v]${videoFilters.join(',')}[${videoLabel}]`);
    videoStreams.push(`[${videoLabel}]`);
    
    let audioFilters = [];
    
    if (clip.hasAudio && !clip.muted && !clip.isImage) {
      if (trimStart > 0 || trimEnd !== undefined) {
        const aTrimFilter = trimEnd !== undefined 
          ? `atrim=start=${trimStart}:end=${trimEnd}`
          : `atrim=start=${trimStart}`;
        audioFilters.push(aTrimFilter);
        audioFilters.push('asetpts=PTS-STARTPTS');
      }
      
      if (speed !== 1) {
        if (speed <= 2) {
          audioFilters.push(`atempo=${speed.toFixed(4)}`);
        } else {
          audioFilters.push('atempo=2.0');
          audioFilters.push(`atempo=${(speed / 2).toFixed(4)}`);
        }
      }
      
      if (volume !== 1) {
        audioFilters.push(`volume=${volume.toFixed(3)}`);
      }
      
      if (fadeIn > 0) {
        audioFilters.push(`afade=t=in:st=0:d=${Math.min(fadeIn, adjustedDuration / 2).toFixed(3)}`);
      }
      if (fadeOut > 0) {
        const fadeOutStart = Math.max(0, adjustedDuration - fadeOut);
        audioFilters.push(`afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOut.toFixed(3)}`);
      }
      
      audioFilters.push('aresample=async=1:first_pts=0');
      audioFilters.push('aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo');
      
      const audioLabel = `a${i}`;
      filterSteps.push(`[${idx}:a]${audioFilters.join(',')}[${audioLabel}]`);
      audioStreams.push(`[${audioLabel}]`);
    } else {
      const silentDuration = Math.max(clip.isImage ? displayDuration : adjustedDuration, 0.1);
      const audioLabel = `a${i}`;
      filterSteps.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${silentDuration.toFixed(3)}[${audioLabel}]`);
      audioStreams.push(`[${audioLabel}]`);
    }
  }
  
  let totalDuration = 0;
  clips.forEach(clip => {
    const speed = clip.speed ?? 1;
    const displayDuration = clip.isImage ? (clip.displayDuration ?? 5) : null;
    let dur = displayDuration || clip.actualDuration || 5;
    if (clip.trimStartSeconds) dur -= clip.trimStartSeconds;
    if (clip.trimEndSeconds && clip.trimEndSeconds < dur) dur = clip.trimEndSeconds - (clip.trimStartSeconds || 0);
    dur = Math.max(dur / speed, 0.1);
    totalDuration += dur;
  });
  
  const safeDuration = Math.max(totalDuration, 0.1);
  
  if (audioStreams.length === 0) {
    filterSteps.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${safeDuration.toFixed(3)}[silent_fallback]`);
    audioStreams.push('[silent_fallback]');
  }
  
  let finalVideoLabel = '';
  let finalAudioLabel = '';
  
  if (clips.length > 1) {
    filterSteps.push(`${videoStreams.join('')}concat=n=${clips.length}:v=1:a=0[concat_video]`);
    finalVideoLabel = '[concat_video]';
    
    if (audioStreams.length === clips.length) {
      filterSteps.push(`${audioStreams.join('')}concat=n=${clips.length}:v=0:a=1[concat_audio]`);
      finalAudioLabel = '[concat_audio]';
    } else if (audioStreams.length === 1) {
      finalAudioLabel = audioStreams[0];
    } else {
      finalAudioLabel = '[silent_fallback]';
    }
  } else {
    finalVideoLabel = videoStreams[0];
    finalAudioLabel = audioStreams.length > 0 ? audioStreams[0] : '[silent_fallback]';
  }
  
  if (!finalAudioLabel || finalAudioLabel.trim() === '' || finalAudioLabel === '[]') {
    filterSteps.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${safeDuration.toFixed(3)}[late_silent]`);
    finalAudioLabel = '[late_silent]';
  }
  
  if (enhancements?.fadeIn || enhancements?.fadeOut) {
    const fadeDuration = enhancements.fadeDuration || 1;
    let globalFadeFilters = [];
    
    if (enhancements.fadeIn) {
      globalFadeFilters.push(`fade=t=in:st=0:d=${fadeDuration}`);
    }
    if (enhancements.fadeOut) {
      const fadeOutStart = Math.max(0, totalDuration - fadeDuration);
      globalFadeFilters.push(`fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeDuration}`);
    }
    
    if (globalFadeFilters.length > 0) {
      filterSteps.push(`${finalVideoLabel}${globalFadeFilters.join(',')}[global_faded]`);
      finalVideoLabel = '[global_faded]';
    }
  }
  
  if (audioAssets.watermark) {
    const wmIdx = inputMap.get('watermark');
    const position = getWatermarkPosition(audioAssets.watermark.position, targetWidth, targetHeight);
    const opacity = audioAssets.watermark.opacity || 0.8;
    const wmSize = audioAssets.watermark.size === 'small' ? 0.1 : audioAssets.watermark.size === 'large' ? 0.25 : 0.15;
    const wmWidth = Math.round(targetWidth * wmSize);
    
    filterSteps.push(`[${wmIdx}:v]scale=${wmWidth}:-1,format=rgba,colorchannelmixer=aa=${opacity}[wm_scaled]`);
    filterSteps.push(`${finalVideoLabel}[wm_scaled]overlay=${position.x}:${position.y}[watermarked]`);
    finalVideoLabel = '[watermarked]';
  }
  
  const audioSources = [];
  
  if (finalAudioLabel && finalAudioLabel.trim() !== '' && finalAudioLabel !== '[]') {
    audioSources.push(finalAudioLabel);
  } else {
    filterSteps.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${totalDuration.toFixed(3)}[base_silent]`);
    audioSources.push('[base_silent]');
    finalAudioLabel = '[base_silent]';
  }
  
  if (audioAssets.backgroundMusic) {
    const bgmIdx = inputMap.get('bgm');
    let bgmFilters = [];
    
    bgmFilters.push(`aloop=loop=-1:size=2e9`);
    bgmFilters.push(`atrim=duration=${totalDuration.toFixed(3)}`);
    bgmFilters.push(`volume=${audioAssets.backgroundMusic.volume}`);
    
    if (audioAssets.backgroundMusic.fadeInSeconds > 0) {
      bgmFilters.push(`afade=t=in:st=0:d=${audioAssets.backgroundMusic.fadeInSeconds}`);
    }
    if (audioAssets.backgroundMusic.fadeOutSeconds > 0) {
      const fadeStart = Math.max(0, totalDuration - audioAssets.backgroundMusic.fadeOutSeconds);
      bgmFilters.push(`afade=t=out:st=${fadeStart.toFixed(3)}:d=${audioAssets.backgroundMusic.fadeOutSeconds}`);
    }
    
    bgmFilters.push('aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo');
    
    filterSteps.push(`[${bgmIdx}:a]${bgmFilters.join(',')}[bgm_proc]`);
    audioSources.push('[bgm_proc]');
  }
  
  if (audioAssets.audioTrack) {
    const atIdx = inputMap.get('audioTrack');
    let atFilters = [];
    
    if (audioAssets.audioTrack.startAtSeconds > 0) {
      atFilters.push(`adelay=${Math.round(audioAssets.audioTrack.startAtSeconds * 1000)}|${Math.round(audioAssets.audioTrack.startAtSeconds * 1000)}`);
    }
    
    atFilters.push(`volume=${audioAssets.audioTrack.volume}`);
    atFilters.push('aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo');
    atFilters.push(`apad=whole_dur=${totalDuration.toFixed(3)}`);
    atFilters.push(`atrim=duration=${totalDuration.toFixed(3)}`);
    
    filterSteps.push(`[${atIdx}:a]${atFilters.join(',')}[at_proc]`);
    audioSources.push('[at_proc]');
  }
  
  if (audioSources.length > 1) {
    filterSteps.push(`${audioSources.join('')}amix=inputs=${audioSources.length}:duration=longest:normalize=0[final_audio]`);
    finalAudioLabel = '[final_audio]';
  }
  
  if (!finalVideoLabel.startsWith('[') || !finalVideoLabel.endsWith(']')) {
    finalVideoLabel = `[${finalVideoLabel.replace(/[\[\]]/g, '')}]`;
  }
  
  if (!finalAudioLabel || finalAudioLabel.trim() === '' || finalAudioLabel === '[]') {
    filterSteps.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${safeDuration.toFixed(3)}[final_silent]`);
    finalAudioLabel = '[final_silent]';
  }
  
  filterSteps.push(`${finalVideoLabel}null[outv]`);
  filterSteps.push(`${finalAudioLabel}anull[outa]`);
  
  console.log(`[${jobId}] Filter complex built: ${filterSteps.length} steps`);
  
  return {
    filterComplex: filterSteps.join(';'),
    videoOutput: '[outv]',
    audioOutput: '[outa]',
  };
}

function getWatermarkPosition(position, width, height) {
  const padding = 20;
  
  switch (position) {
    case 'top-left': return { x: padding, y: padding };
    case 'top-right': return { x: `W-w-${padding}`, y: padding };
    case 'bottom-left': return { x: padding, y: `H-h-${padding}` };
    case 'bottom-right': default: return { x: `W-w-${padding}`, y: `H-h-${padding}` };
    case 'center': return { x: '(W-w)/2', y: '(H-h)/2' };
  }
}

// ============================================================================
// FFMPEG EXECUTION
// ============================================================================

function executeFFmpeg(args, jobId, jobsMap) {
  return new Promise((resolve, reject) => {
    console.log(`[${jobId}] FFmpeg args:`, args.slice(0, 10).join(' ') + '...');
    
    const ffmpeg = spawn(FFMPEG_PATH, args, { maxBuffer: 1024 * 1024 * 100 });
    
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      
      const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (timeMatch) {
        const currentTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseFloat(timeMatch[3]);
        const currentJob = jobsMap.get(jobId);
        if (currentJob && currentJob.stage === 'encoding') {
          const estimatedProgress = 40 + Math.min(45, Math.floor(currentTime * 3));
          jobsMap.set(jobId, { ...currentJob, progress: estimatedProgress });
        }
      }
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const errorLines = stderr.split('\n')
          .filter(line => line.includes('Error') || line.includes('Invalid') || line.includes('No such'))
          .slice(-10);
        
        const errorMessage = errorLines.length > 0 ? errorLines.join('\n') : `FFmpeg exited with code ${code}`;
        console.error(`[${jobId}] FFmpeg stderr (last 2000 chars):`, stderr.slice(-2000));
        reject(new Error(errorMessage));
      }
    });
    
    ffmpeg.on('error', (error) => {
      reject(new Error(`FFmpeg spawn error: ${error.message}`));
    });
  });
}

// ============================================================================
// S3 UPLOAD
// ============================================================================

async function uploadToS3(filePath, s3Key, jobId) {
  const fileContent = fs.readFileSync(filePath);
  const contentType = s3Key.endsWith('.mp4') ? 'video/mp4' : 
                      s3Key.endsWith('.webm') ? 'video/webm' : 
                      'application/octet-stream';
  
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: fileContent,
    ContentType: contentType,
  });
  
  await s3Client.send(command);
  
  return `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
}

// ============================================================================
// CALLBACK
// ============================================================================

async function sendCallback(callbackUrl, payload, jobId) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'VPS-Video-Processor/2.0',
    };
    
    if (CALLBACK_SECRET) {
      headers['X-Signature'] = generateHmacSignature(payload);
    }
    
    console.log(`[${jobId}] Sending callback to ${callbackUrl}`);
    
    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      console.warn(`[${jobId}] Callback returned ${response.status}`);
    } else {
      console.log(`[${jobId}] ✓ Callback sent successfully`);
    }
    
  } catch (error) {
    console.error(`[${jobId}] Callback failed:`, error.message);
  }
}

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 VPS Video Processor listening on port ${PORT}`);
  console.log(`  Health check: http://localhost:${PORT}/health`);
  console.log(`  Process video: POST http://localhost:${PORT}/process\n`);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
