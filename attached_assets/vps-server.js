/**
 * VPS Video Processor - server.js
 * FFmpeg 8.0.1 Video Processing Server
 * 
 * Deploy to: ~/video-processor/server.js on your VPS
 * Run with: pm2 start server.js --name video-processor
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Configuration
const PORT = process.env.PORT || 3001;
const TEMP_DIR = '/tmp/video-processing';
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/root/bin/ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/root/bin/ffprobe';
const CALLBACK_SECRET = process.env.CALLBACK_SECRET;

// Validate required environment variables
const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET', 'AWS_REGION'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

if (!CALLBACK_SECRET) {
  console.warn('⚠️  CALLBACK_SECRET not set - callbacks will not be signed');
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

// Startup banner
console.log('═══════════════════════════════════════════════════════');
console.log('  VPS Video Processor - FFmpeg 8.0.1');
console.log('═══════════════════════════════════════════════════════');
console.log(`  Port:        ${PORT}`);
console.log(`  FFmpeg:      ${FFMPEG_PATH}`);
console.log(`  FFprobe:     ${FFPROBE_PATH}`);
console.log(`  S3 Bucket:   ${S3_BUCKET}`);
console.log(`  AWS Region:  ${process.env.AWS_REGION}`);
console.log(`  Callback:    ${CALLBACK_SECRET ? 'Configured ✓' : 'Not configured ⚠️'}`);
console.log('═══════════════════════════════════════════════════════');

// Verify FFmpeg on startup
spawn(FFMPEG_PATH, ['-version']).on('close', (code) => {
  if (code === 0) {
    console.log('✓ FFmpeg verified and accessible');
  } else {
    console.error('❌ FFmpeg not accessible at', FFMPEG_PATH);
  }
});

// ============================================================================
// ENDPOINTS
// ============================================================================

// Health check endpoint
app.get('/health', (req, res) => {
  const ffmpeg = spawn(FFMPEG_PATH, ['-version']);
  let version = '';
  
  ffmpeg.stdout.on('data', (data) => {
    version += data.toString();
  });
  
  ffmpeg.on('close', (code) => {
    if (code === 0) {
      const versionLine = version.split('\n')[0] || 'unknown';
      res.json({ 
        status: 'ok', 
        ffmpeg: FFMPEG_PATH,
        version: versionLine,
        activeJobs: jobs.size
      });
    } else {
      res.status(500).json({ 
        status: 'error', 
        ffmpeg: FFMPEG_PATH,
        error: 'FFmpeg not accessible'
      });
    }
  });
  
  ffmpeg.on('error', () => {
    res.status(500).json({ 
      status: 'error', 
      ffmpeg: FFMPEG_PATH,
      error: 'FFmpeg not found'
    });
  });
});

// Job status endpoint
app.get('/status/:jobId', (req, res) => {
  const status = jobs.get(req.params.jobId);
  if (!status) {
    res.status(404).json({ error: 'Job not found' });
  } else {
    res.json(status);
  }
});

// Main video processing endpoint
app.post('/process', async (req, res) => {
  const jobId = req.body.jobId || uuidv4();
  const jobDir = path.join(TEMP_DIR, jobId);
  
  try {
    fs.mkdirSync(jobDir, { recursive: true });
    
    const { 
      clips, 
      enhancements, 
      videoSettings,
      callbackUrl 
    } = req.body;
    
    // Validate input
    if (!clips || !Array.isArray(clips) || clips.length === 0) {
      return res.status(400).json({ error: 'Invalid or missing clips array' });
    }
    
    const outputFormat = videoSettings?.format || 'mp4';
    
    console.log(`\n[${jobId}] ═══════════════════════════════════════════`);
    console.log(`[${jobId}] New job received`);
    console.log(`[${jobId}]   Clips: ${clips.length}`);
    console.log(`[${jobId}]   Format: ${outputFormat}`);
    console.log(`[${jobId}]   Quality: ${videoSettings?.quality || 'high'}`);
    console.log(`[${jobId}]   Callback: ${callbackUrl ? 'Yes' : 'No'}`);
    console.log(`[${jobId}] ═══════════════════════════════════════════\n`);
    
    // Initialize job status
    jobs.set(jobId, {
      status: 'processing',
      startedAt: new Date().toISOString(),
      progress: 0,
      stage: 'initializing'
    });
    
    // Acknowledge receipt immediately
    res.json({ 
      status: 'processing', 
      jobId,
      message: 'Video processing started' 
    });
    
    // Process video asynchronously
    processVideo(jobId, jobDir, clips, enhancements, videoSettings, callbackUrl);
    
  } catch (error) {
    console.error(`[${jobId}] Process error:`, error);
    jobs.set(jobId, {
      status: 'failed',
      error: error.message,
      completedAt: new Date().toISOString()
    });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// VIDEO PROCESSING PIPELINE
// ============================================================================

async function processVideo(jobId, jobDir, clips, enhancements, videoSettings, callbackUrl) {
  const outputFormat = videoSettings?.format || 'mp4';
  
  try {
    console.log(`[${jobId}] Starting video processing pipeline`);
    
    // Stage 1: Download clips
    updateJobStatus(jobId, 'downloading', 10);
    const localClips = await downloadClips(clips, jobDir, jobId);
    console.log(`[${jobId}] ✓ Downloaded ${localClips.length} clips`);
    
    // Stage 2: Probe video durations
    updateJobStatus(jobId, 'analyzing', 25);
    for (let clip of localClips) {
      clip.actualDuration = await getVideoDuration(clip.localPath);
      console.log(`[${jobId}]   Clip ${clip.index}: ${clip.actualDuration.toFixed(2)}s`);
    }
    
    // Stage 3: Build and execute FFmpeg command
    updateJobStatus(jobId, 'encoding', 35);
    const outputPath = path.join(jobDir, `output.${outputFormat}`);
    const ffmpegArgs = buildFFmpegCommand(localClips, enhancements, videoSettings, outputPath);
    
    console.log(`[${jobId}] Running FFmpeg...`);
    console.log(`[${jobId}] Command: ${FFMPEG_PATH} ${ffmpegArgs.join(' ')}`);
    
    await executeFFmpeg(ffmpegArgs, jobId);
    console.log(`[${jobId}] ✓ FFmpeg encoding complete`);
    
    // Verify output exists
    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg completed but output file not found');
    }
    
    const outputStats = fs.statSync(outputPath);
    console.log(`[${jobId}] Output size: ${(outputStats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Stage 4: Upload to S3
    updateJobStatus(jobId, 'uploading', 80);
    const s3Key = `exports/${jobId}/video.${outputFormat}`;
    const downloadUrl = await uploadToS3(outputPath, s3Key, jobId);
    console.log(`[${jobId}] ✓ Uploaded to S3`);
    
    // Mark as complete
    jobs.set(jobId, {
      status: 'completed',
      downloadUrl: downloadUrl,
      completedAt: new Date().toISOString(),
      progress: 100,
      stage: 'complete'
    });
    
    // Cleanup temp files
    cleanupJobDir(jobDir, jobId);
    
    // Send callback
    if (callbackUrl) {
      await sendCallback(callbackUrl, {
        jobId,
        status: 'completed',
        downloadUrl
      }, jobId);
    }
    
    console.log(`[${jobId}] ══════════════════════════════════════════`);
    console.log(`[${jobId}] ✓ JOB COMPLETED SUCCESSFULLY`);
    console.log(`[${jobId}]   Download: ${downloadUrl}`);
    console.log(`[${jobId}] ══════════════════════════════════════════\n`);
    
    // Clean up job status after 1 hour
    setTimeout(() => jobs.delete(jobId), 3600000);
    
  } catch (error) {
    console.error(`[${jobId}] ❌ Pipeline error:`, error.message);
    
    jobs.set(jobId, {
      status: 'failed',
      error: error.message,
      completedAt: new Date().toISOString(),
      progress: 0,
      stage: 'failed'
    });
    
    // Cleanup on error
    cleanupJobDir(jobDir, jobId);
    
    // Callback with error
    if (callbackUrl) {
      await sendCallback(callbackUrl, {
        jobId,
        status: 'failed',
        error: error.message
      }, jobId);
    }
    
    // Clean up job status after 1 hour
    setTimeout(() => jobs.delete(jobId), 3600000);
  }
}

function updateJobStatus(jobId, stage, progress) {
  const current = jobs.get(jobId) || {};
  jobs.set(jobId, {
    ...current,
    status: 'processing',
    stage,
    progress,
    updatedAt: new Date().toISOString()
  });
  console.log(`[${jobId}] Stage: ${stage} (${progress}%)`);
}

// ============================================================================
// CLIP DOWNLOADING
// ============================================================================

async function downloadClips(clips, jobDir, jobId) {
  const localClips = [];
  
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    
    // Support both 'url' and 'sourceUrl' property names
    const videoUrl = clip.sourceUrl || clip.url;
    
    if (!videoUrl) {
      throw new Error(`Clip ${i} is missing video URL (no url or sourceUrl property)`);
    }
    
    try {
      // Extract extension from URL
      const urlPath = new URL(videoUrl).pathname;
      const ext = path.extname(urlPath).slice(1) || 'mp4';
      const localPath = path.join(jobDir, `clip_${i}.${ext}`);
      
      console.log(`[${jobId}] Downloading clip ${i}: ${videoUrl.substring(0, 80)}...`);
      
      // Download with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout
      
      const response = await fetch(videoUrl, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'VPS-Video-Processor/1.0'
        }
      });
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(localPath, Buffer.from(buffer));
      
      const fileSizeMB = (buffer.byteLength / 1024 / 1024).toFixed(2);
      console.log(`[${jobId}]   ✓ Clip ${i}: ${fileSizeMB} MB`);
      
      localClips.push({
        ...clip,
        originalUrl: videoUrl,
        localPath,
        index: i
      });
      
    } catch (error) {
      throw new Error(`Failed to download clip ${i}: ${error.message}`);
    }
  }
  
  return localClips;
}

// ============================================================================
// FFPROBE - VIDEO DURATION
// ============================================================================

async function getVideoDuration(filePath) {
  return new Promise((resolve) => {
    const ffprobe = spawn(FFPROBE_PATH, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);
    
    let stdout = '';
    let stderr = '';
    
    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        const duration = parseFloat(stdout.trim());
        if (!isNaN(duration) && duration > 0) {
          resolve(duration);
          return;
        }
      }
      console.warn(`Could not determine duration for ${filePath}, using fallback`);
      resolve(5); // Fallback duration
    });
    
    ffprobe.on('error', (error) => {
      console.warn(`FFprobe error for ${filePath}:`, error.message);
      resolve(5); // Fallback duration
    });
  });
}

// ============================================================================
// FFMPEG COMMAND BUILDER
// ============================================================================

function buildSimpleSingleClipCommand(clip, videoSettings, outputPath) {
  // For single clips, use simple re-encoding without filter_complex
  const args = [];
  
  args.push('-y');
  args.push('-hide_banner');
  args.push('-i', clip.localPath);
  
  // Video encoding settings
  const quality = videoSettings?.quality || 'high';
  const crf = quality === 'high' ? 18 : quality === 'medium' ? 23 : 28;
  const preset = quality === 'high' ? 'slow' : quality === 'medium' ? 'medium' : 'fast';
  
  args.push(
    '-c:v', 'libx264',
    '-preset', preset,
    '-crf', crf.toString(),
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p'
  );
  
  // Audio - copy if exists, otherwise add silent audio
  args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
  
  // Fast start for web
  args.push('-movflags', '+faststart');
  
  args.push(outputPath);
  
  return args;
}

function buildFFmpegCommand(clips, enhancements, videoSettings, outputPath) {
  const args = [];
  
  // Global options
  args.push('-y'); // Overwrite output
  args.push('-hide_banner');
  
  // Add all input files
  clips.forEach(clip => {
    args.push('-i', clip.localPath);
  });
  
  // Build filter complex
  let filterComplex = '';
  let videoOutput = '';
  let audioOutput = '';
  
  const hasTransitions = enhancements?.clipTransitions?.perClip?.length > 0;
  
  if (clips.length === 1) {
    // Single clip - simple passthrough without filter_complex
    // We'll handle this case by not using filter_complex at all
    return buildSimpleSingleClipCommand(clips[0], videoSettings, outputPath);
  } else if (hasTransitions) {
    // Multiple clips with transitions - use xfade for video only
    // Audio crossfade is problematic when clips lack audio, so we skip it
    const { videoFilter } = buildTransitionsFilter(clips, enhancements.clipTransitions);
    filterComplex = videoFilter;
    videoOutput = '[outv]';
    audioOutput = ''; // Will use optional audio mapping instead
  } else {
    // Multiple clips - concat video only first
    const videoInputs = clips.map((_, i) => `[${i}:v]`).join('');
    filterComplex = `${videoInputs}concat=n=${clips.length}:v=1:a=0[outv]`;
    videoOutput = '[outv]';
    audioOutput = ''; // Will handle audio separately
  }
  
  args.push('-filter_complex', filterComplex);
  args.push('-map', videoOutput);
  
  // For audio: try to map first input's audio, or generate silence
  // Using '0:a?' makes audio optional - won't fail if no audio
  if (audioOutput) {
    args.push('-map', audioOutput);
  } else {
    // No audio filter output - try to copy audio from first clip or skip
    args.push('-map', '0:a?'); // ? makes it optional
  }
  
  // Video encoding settings based on quality
  const quality = videoSettings?.quality || 'high';
  const crf = quality === 'high' ? 18 : quality === 'medium' ? 23 : 28;
  const preset = quality === 'high' ? 'slow' : quality === 'medium' ? 'medium' : 'fast';
  
  args.push(
    '-c:v', 'libx264',
    '-preset', preset,
    '-crf', crf.toString(),
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p'
  );
  
  // Resolution if specified
  if (videoSettings?.resolution) {
    const [width, height] = videoSettings.resolution.split('x');
    if (width && height) {
      args.push('-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`);
    }
  }
  
  // Audio encoding
  args.push(
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '48000'
  );
  
  // Fast start for web playback
  args.push('-movflags', '+faststart');
  
  // Output path
  args.push(outputPath);
  
  return args;
}

function buildTransitionsFilter(clips, transitions) {
  // FFmpeg 8.0.1 xfade transitions
  const perClip = transitions.perClip || [];
  
  // Build video transitions
  let videoFilter = '';
  let lastVideoOutput = '[0:v]';
  let offset = 0;
  
  for (let i = 0; i < clips.length - 1; i++) {
    const clipDuration = clips[i].actualDuration || clips[i].duration || 5;
    const transition = perClip.find(t => t.afterClipIndex === i);
    const transitionDuration = transition?.durationSeconds || 0.5;
    const transitionType = mapTransitionType(transition?.type || 'fade');
    
    offset += clipDuration - transitionDuration;
    
    const nextInput = `[${i + 1}:v]`;
    const outputLabel = i === clips.length - 2 ? '[outv]' : `[xv${i}]`;
    
    videoFilter += `${lastVideoOutput}${nextInput}xfade=transition=${transitionType}:duration=${transitionDuration}:offset=${offset}${outputLabel}`;
    
    if (i < clips.length - 2) {
      videoFilter += ';';
    }
    
    lastVideoOutput = outputLabel;
  }
  
  // Build audio crossfade
  let audioFilter = '';
  let lastAudioOutput = '[0:a]';
  offset = 0;
  
  for (let i = 0; i < clips.length - 1; i++) {
    const clipDuration = clips[i].actualDuration || clips[i].duration || 5;
    const transition = perClip.find(t => t.afterClipIndex === i);
    const transitionDuration = transition?.durationSeconds || 0.5;
    
    offset += clipDuration - transitionDuration;
    
    const nextInput = `[${i + 1}:a]`;
    const outputLabel = i === clips.length - 2 ? '[outa]' : `[xa${i}]`;
    
    audioFilter += `${lastAudioOutput}${nextInput}acrossfade=d=${transitionDuration}:c1=tri:c2=tri${outputLabel}`;
    
    if (i < clips.length - 2) {
      audioFilter += ';';
    }
    
    lastAudioOutput = outputLabel;
  }
  
  return { videoFilter, audioFilter };
}

function mapTransitionType(type) {
  // Map frontend transition types to FFmpeg xfade transitions
  const mapping = {
    'fade': 'fade',
    'dissolve': 'dissolve',
    'wipe': 'wipeleft',
    'wipeLeft': 'wipeleft',
    'wipeRight': 'wiperight',
    'wipeUp': 'wipeup',
    'wipeDown': 'wipedown',
    'slideLeft': 'slideleft',
    'slideRight': 'slideright',
    'slideUp': 'slideup',
    'slideDown': 'slidedown',
    'circleOpen': 'circleopen',
    'circleClose': 'circleclose',
    'pixelize': 'pixelize',
    'radial': 'radial',
    'smoothleft': 'smoothleft',
    'smoothright': 'smoothright',
    'smoothup': 'smoothup',
    'smoothdown': 'smoothdown',
    'diagtl': 'diagtl',
    'diagtr': 'diagtr',
    'diagbl': 'diagbl',
    'diagbr': 'diagbr',
  };
  
  return mapping[type] || 'fade';
}

// ============================================================================
// FFMPEG EXECUTION
// ============================================================================

function executeFFmpeg(args, jobId) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG_PATH, args);
    
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      
      // Parse progress from FFmpeg output
      const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (timeMatch) {
        const currentTime = 
          parseInt(timeMatch[1]) * 3600 + 
          parseInt(timeMatch[2]) * 60 + 
          parseFloat(timeMatch[3]);
        
        // Update progress (35% to 80% during encoding)
        const currentJob = jobs.get(jobId);
        if (currentJob && currentJob.stage === 'encoding') {
          const estimatedProgress = 35 + Math.min(45, Math.floor(currentTime * 2));
          jobs.set(jobId, { ...currentJob, progress: estimatedProgress });
        }
      }
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        // Extract meaningful error from stderr
        const errorLines = stderr.split('\n')
          .filter(line => 
            line.includes('Error') || 
            line.includes('Invalid') || 
            line.includes('No such') ||
            line.includes('does not contain')
          )
          .slice(-5)
          .join('\n');
        
        const errorMsg = errorLines || stderr.slice(-500);
        reject(new Error(`FFmpeg failed (code ${code}): ${errorMsg}`));
      }
    });
    
    ffmpeg.on('error', (error) => {
      reject(new Error(`FFmpeg process error: ${error.message}`));
    });
  });
}

// ============================================================================
// S3 UPLOAD
// ============================================================================

async function uploadToS3(filePath, key, jobId) {
  console.log(`[${jobId}] Uploading to S3: s3://${S3_BUCKET}/${key}`);
  
  const fileStream = fs.createReadStream(filePath);
  const fileStats = fs.statSync(filePath);
  
  const putCommand = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: fileStream,
    ContentLength: fileStats.size,
    ContentType: 'video/mp4',
  });
  
  await s3Client.send(putCommand);
  
  // Return public URL (bucket policy allows public read on exports/*)
  const downloadUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  console.log(`[${jobId}] Upload complete: ${downloadUrl}`);
  
  return downloadUrl;
}

// ============================================================================
// CALLBACK
// ============================================================================

async function sendCallback(callbackUrl, payload, jobId) {
  try {
    console.log(`[${jobId}] Sending callback to: ${callbackUrl}`);
    
    const body = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Sign the callback with HMAC if secret is configured
    if (CALLBACK_SECRET) {
      const signature = crypto
        .createHmac('sha256', CALLBACK_SECRET)
        .update(body)
        .digest('hex');
      headers['x-callback-signature'] = signature;
      console.log(`[${jobId}] Callback signed with HMAC-SHA256`);
    }
    
    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers,
      body,
    });
    
    if (response.ok) {
      console.log(`[${jobId}] ✓ Callback sent successfully`);
    } else {
      const errorText = await response.text();
      console.error(`[${jobId}] Callback failed (${response.status}): ${errorText}`);
    }
  } catch (error) {
    console.error(`[${jobId}] Callback error:`, error.message);
  }
}

// ============================================================================
// CLEANUP
// ============================================================================

function cleanupJobDir(jobDir, jobId) {
  try {
    if (fs.existsSync(jobDir)) {
      fs.rmSync(jobDir, { recursive: true, force: true });
      console.log(`[${jobId}] Cleaned up temp files`);
    }
  } catch (error) {
    console.warn(`[${jobId}] Cleanup warning:`, error.message);
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// ============================================================================
// START SERVER
// ============================================================================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 VPS Video Processor listening on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Process: POST http://localhost:${PORT}/process\n`);
});
