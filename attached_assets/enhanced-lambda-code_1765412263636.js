// Artivio Video Processor Lambda - Enhanced with Audio Mixing Support
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import https from 'https';
import http from 'http';
import crypto from 'crypto';

const execAsync = promisify(exec);
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const FFMPEG_PATH = '/opt/bin/ffmpeg';
const TMP_DIR = '/tmp/videos';

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Download file from URL with redirect support
 */
async function downloadFile(url, filepath) {
    const protocol = url.startsWith('https') ? https : http;
    return new Promise((resolve, reject) => {
        const file = createWriteStream(filepath);
        protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode} from ${url}`));
                return;
            }
            pipeline(response, file).then(resolve).catch(reject);
        }).on('error', reject);
    });
}

/**
 * Upload file to S3 and return pre-signed URL
 */
async function uploadToS3(filepath, bucket, key) {
    const fileContent = await readFile(filepath);
    await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileContent,
        ContentType: 'video/mp4',
    }));
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return await getSignedUrl(s3Client, command, { expiresIn: 604800 }); // 7 days
}

/**
 * Notify callback URL with status
 */
async function notifyCallback(callbackUrl, data) {
    if (!callbackUrl) return;
    try {
        await fetch(callbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    } catch (error) {
        console.error('Callback error:', error);
    }
}

/**
 * Cleanup temporary files
 */
async function cleanupFiles(files) {
    for (const file of files) {
        try {
            await unlink(file);
        } catch (error) {
            console.warn(`Failed to delete ${file}:`, error.message);
        }
    }
}

// ============================================
// AUDIO MIXING FUNCTIONS
// ============================================

/**
 * Download audio file with caching support
 */
async function downloadAudioFile(url, tmpDir) {
    // Create cache key from URL hash
    const hash = crypto.createHash('md5').update(url).digest('hex');
    const ext = url.split('.').pop()?.split('?')[0] || 'mp3'; // Get extension before query params
    const filepath = `${tmpDir}/audio_${hash}.${ext}`;
    
    // Check if already cached
    if (existsSync(filepath)) {
        console.log(`Using cached audio: ${filepath}`);
        return filepath;
    }
    
    console.log(`Downloading audio from: ${url}`);
    await downloadFile(url, filepath);
    return filepath;
}

/**
 * Build FFmpeg filter complex for audio mixing
 */
function buildAudioMixFilter(audioConfig) {
    const { backgroundMusic, audioTrack } = audioConfig;
    const filters = [];
    const inputs = [];
    
    // Case 1: Only background music
    if (backgroundMusic && !audioTrack) {
        inputs.push('-i', backgroundMusic.filepath);
        filters.push(`[1:a]volume=${backgroundMusic.volume}[audio]`);
        return {
            inputs,
            filterComplex: filters.join(';'),
            audioMap: '[audio]',
        };
    }
    
    // Case 2: Only audio track (voice/TTS)
    if (audioTrack && !backgroundMusic) {
        inputs.push('-i', audioTrack.filepath);
        filters.push(`[1:a]volume=${audioTrack.volume}[audio]`);
        return {
            inputs,
            filterComplex: filters.join(';'),
            audioMap: '[audio]',
        };
    }
    
    // Case 3: Both music and voice - MIX THEM!
    if (backgroundMusic && audioTrack) {
        inputs.push('-i', backgroundMusic.filepath);
        inputs.push('-i', audioTrack.filepath);
        
        filters.push(
            // Apply volume to music (input 1)
            `[1:a]volume=${backgroundMusic.volume},aresample=48000[music]`,
            // Apply volume to voice (input 2)
            `[2:a]volume=${audioTrack.volume},aresample=48000[voice]`,
            // Mix both streams together
            `[music][voice]amix=inputs=2:duration=longest:dropout_transition=0,dynaudnorm[audio]`
        );
        
        return {
            inputs,
            filterComplex: filters.join(';'),
            audioMap: '[audio]',
        };
    }
    
    // Case 4: No audio
    return {
        inputs: [],
        filterComplex: '',
        audioMap: '',
    };
}

// ============================================
// VIDEO PROCESSING
// ============================================

/**
 * Apply clip settings (speed, trim, volume, mute)
 */
function applyClipSettings(clipSettings = []) {
    // For now, we'll handle this in the main FFmpeg command
    // Full implementation would require complex filter chains per clip
    return {
        hasSpeed: clipSettings.some(cs => cs.speed && cs.speed !== 1.0),
        hasTrim: clipSettings.some(cs => cs.trimStartSeconds !== undefined || cs.trimEndSeconds !== undefined),
        hasMute: clipSettings.some(cs => cs.muted),
    };
}

/**
 * Build aspect ratio filter
 */
function buildAspectRatioFilter(aspectRatio) {
    const ratios = {
        '16:9': { width: 1920, height: 1080 },
        '9:16': { width: 1080, height: 1920 },
        '1:1': { width: 1080, height: 1080 },
    };
    
    const { width, height } = ratios[aspectRatio] || ratios['16:9'];
    
    return `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
           `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,` +
           `setsar=1`;
}

/**
 * Build transitions filter
 */
function buildTransitionsFilter(transitions) {
    if (!transitions || transitions.mode === 'none') return '';
    
    // Simplified - full implementation would build xfade chains
    if (transitions.mode === 'crossfade') {
        return `xfade=transition=fade:duration=${transitions.durationSeconds}:offset=0`;
    }
    
    return '';
}

// ============================================
// MAIN HANDLER
// ============================================

export const handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    let body = event;
    if (typeof event.body === 'string') body = JSON.parse(event.body);
    else if (event.body) body = event.body;
    
    const { 
        jobId, 
        userId, 
        outputBucket, 
        videoSettings = {}, 
        project, 
        enhancements = {},
        previewMode = false,
        maxDuration,
        callbackUrl 
    } = body;
    
    if (!jobId || !project?.clips?.length) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Missing required fields: jobId or project.clips' })
        };
    }
    
    const filesToCleanup = [];
    
    try {
        // Ensure temp directory exists
        if (!existsSync(TMP_DIR)) {
            await mkdir(TMP_DIR, { recursive: true });
        }
        
        console.log(`Processing ${project.clips.length} clips for job ${jobId}`);
        console.log(`Preview mode: ${previewMode}, Max duration: ${maxDuration}`);
        
        // ============================================
        // STEP 1: Download all video clips
        // ============================================
        
        const clipLimit = previewMode ? Math.min(project.clips.length, 3) : project.clips.length;
        const localFiles = [];
        
        for (let i = 0; i < clipLimit; i++) {
            const clip = project.clips[i];
            const localPath = `${TMP_DIR}/clip_${jobId}_${i}.mp4`;
            console.log(`Downloading clip ${i + 1}/${clipLimit}: ${clip.sourceUrl}`);
            
            try {
                await downloadFile(clip.sourceUrl, localPath);
                localFiles.push(localPath);
                filesToCleanup.push(localPath);
            } catch (error) {
                console.error(`Failed to download clip ${i}:`, error);
                throw new Error(`Failed to download clip ${i + 1}: ${error.message}`);
            }
        }
        
        // ============================================
        // STEP 2: Create concatenation list
        // ============================================
        
        const concatListPath = `${TMP_DIR}/concat_list_${jobId}.txt`;
        await writeFile(concatListPath, localFiles.map(f => `file '${f}'`).join('\n'));
        filesToCleanup.push(concatListPath);
        
        // ============================================
        // STEP 3: Download audio files (if present)
        // ============================================
        
        const audioConfig = {};
        
        if (enhancements.backgroundMusic?.audioUrl) {
            console.log('Downloading background music...');
            const musicPath = await downloadAudioFile(enhancements.backgroundMusic.audioUrl, TMP_DIR);
            audioConfig.backgroundMusic = {
                filepath: musicPath,
                volume: enhancements.backgroundMusic.volume || 0.3,
            };
            filesToCleanup.push(musicPath);
        }
        
        if (enhancements.audioTrack?.audioUrl) {
            console.log('Downloading audio track (voice)...');
            const voicePath = await downloadAudioFile(enhancements.audioTrack.audioUrl, TMP_DIR);
            audioConfig.audioTrack = {
                filepath: voicePath,
                volume: enhancements.audioTrack.volume || 1.0,
            };
            filesToCleanup.push(voicePath);
        }
        
        // ============================================
        // STEP 4: Build FFmpeg command
        // ============================================
        
        const outputPath = `${TMP_DIR}/output_${jobId}.mp4`;
        filesToCleanup.push(outputPath);
        
        const ffmpegArgs = [
            FFMPEG_PATH,
            '-y', // Overwrite output
            '-f', 'concat',
            '-safe', '0',
            '-i', concatListPath, // Input 0: video clips
        ];
        
        // Add audio inputs if present
        const audioMix = buildAudioMixFilter(audioConfig);
        ffmpegArgs.push(...audioMix.inputs);
        
        // Build video filter
        const videoFilters = [];
        
        // Aspect ratio
        if (enhancements.aspectRatio) {
            videoFilters.push(buildAspectRatioFilter(enhancements.aspectRatio));
        }
        
        // Resolution scaling
        if (videoSettings.resolution) {
            const [w, h] = videoSettings.resolution.split('x');
            videoFilters.push(
                `scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
                `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`
            );
        }
        
        // Fade in/out
        if (enhancements.fadeIn) {
            const duration = enhancements.fadeDuration || 0.5;
            videoFilters.push(`fade=t=in:st=0:d=${duration}`);
        }
        
        if (enhancements.fadeOut) {
            const duration = enhancements.fadeDuration || 0.5;
            // Note: fade out needs total duration, which we don't know yet
            // This is a simplified version
            videoFilters.push(`fade=t=out:d=${duration}`);
        }
        
        // Apply filter complex if we have audio mixing or video filters
        if (audioMix.filterComplex || videoFilters.length > 0) {
            const complexFilters = [];
            
            // Video filter chain
            if (videoFilters.length > 0) {
                complexFilters.push(`[0:v]${videoFilters.join(',')}[v]`);
            }
            
            // Audio filter chain
            if (audioMix.filterComplex) {
                complexFilters.push(audioMix.filterComplex);
            }
            
            ffmpegArgs.push('-filter_complex', complexFilters.join(';'));
            
            // Map outputs
            if (videoFilters.length > 0) {
                ffmpegArgs.push('-map', '[v]');
            } else {
                ffmpegArgs.push('-map', '0:v');
            }
            
            if (audioMix.audioMap) {
                ffmpegArgs.push('-map', audioMix.audioMap);
            } else {
                ffmpegArgs.push('-map', '0:a?'); // Optional audio from video
            }
        } else {
            // No filters, just copy
            ffmpegArgs.push('-map', '0');
        }
        
        // Encoding settings
        if (previewMode) {
            // Fast preview encoding
            ffmpegArgs.push(
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-crf', '28',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-movflags', '+faststart'
            );
        } else {
            // High quality export
            const quality = videoSettings.quality || 'high';
            if (quality === 'high') {
                ffmpegArgs.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18');
            } else if (quality === 'medium') {
                ffmpegArgs.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23');
            } else {
                ffmpegArgs.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '28');
            }
            
            ffmpegArgs.push(
                '-c:a', 'aac',
                '-b:a', '192k',
                '-movflags', '+faststart'
            );
        }
        
        // Limit duration for preview
        if (maxDuration) {
            ffmpegArgs.push('-t', String(maxDuration));
        }
        
        // Output file
        ffmpegArgs.push(outputPath);
        
        const ffmpegCmd = ffmpegArgs.join(' ');
        console.log('Running FFmpeg:', ffmpegCmd);
        
        // ============================================
        // STEP 5: Execute FFmpeg
        // ============================================
        
        try {
            const { stdout, stderr } = await execAsync(ffmpegCmd, { 
                maxBuffer: 50 * 1024 * 1024, // 50MB buffer
                timeout: 600000, // 10 minute timeout
            });
            
            console.log('FFmpeg completed successfully');
            if (stdout) console.log('FFmpeg stdout:', stdout);
            if (stderr) console.log('FFmpeg stderr:', stderr);
            
        } catch (execError) {
            console.error('FFmpeg execution error:', execError);
            throw new Error(`FFmpeg failed: ${execError.message}`);
        }
        
        // ============================================
        // STEP 6: Upload to S3
        // ============================================
        
        const s3Key = previewMode 
            ? `previews/${userId || 'guest'}/${jobId}.mp4`
            : `exports/${userId || 'guest'}/${jobId}.mp4`;
        
        console.log(`Uploading to S3: ${outputBucket}/${s3Key}`);
        const downloadUrl = await uploadToS3(outputPath, outputBucket, s3Key);
        
        // ============================================
        // STEP 7: Cleanup and return
        // ============================================
        
        await cleanupFiles(filesToCleanup);
        
        const result = {
            status: 'completed',
            jobId,
            [previewMode ? 'previewUrl' : 'downloadUrl']: downloadUrl,
            metadata: {
                clipsProcessed: clipLimit,
                hasBackgroundMusic: !!audioConfig.backgroundMusic,
                hasVoiceTrack: !!audioConfig.audioTrack,
                aspectRatio: enhancements.aspectRatio || '16:9',
                duration: maxDuration || 'full',
            }
        };
        
        await notifyCallback(callbackUrl, result);
        
        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(result)
        };
        
    } catch (error) {
        console.error('Processing error:', error);
        
        // Cleanup on error
        await cleanupFiles(filesToCleanup);
        
        const errorResult = {
            status: 'failed',
            jobId,
            error: error.message,
            errorType: error.name,
        };
        
        await notifyCallback(callbackUrl, errorResult);
        
        return {
            statusCode: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(errorResult)
        };
    }
};
