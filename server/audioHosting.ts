import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { getBaseUrl } from './urlUtils';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'audio');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max per audio file
const ALLOWED_MIME_TYPES = [
  'audio/mpeg', 
  'audio/mp3', 
  'audio/wav', 
  'audio/m4a', 
  'audio/x-m4a',  // Alternative MIME type for M4A files
  'audio/aac', 
  'audio/x-aac',  // Alternative MIME type for AAC files
  'audio/ogg', 
  'audio/webm',
  'audio/mp4'     // Some systems report M4A as audio/mp4
];

// Formats that need conversion to MP3 for Kie.ai compatibility
const FORMATS_NEEDING_CONVERSION = ['webm', 'ogg'];

/**
 * Convert audio file to MP3 using FFmpeg
 */
async function convertToMp3(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-vn',              // No video
      '-ar', '44100',     // Sample rate
      '-ac', '2',         // Stereo
      '-b:a', '192k',     // Bitrate
      '-f', 'mp3',        // Force MP3 format
      '-y',               // Overwrite output
      outputPath
    ]);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ Audio converted to MP3: ${outputPath}`);
        resolve();
      } else {
        console.error(`FFmpeg conversion failed with code ${code}:`, stderr);
        reject(new Error(`Audio conversion failed: ${stderr.slice(-500)}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });
  });
}

// Ensure uploads directory exists
async function ensureUploadsDir() {
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Convert base64 data URI to hosted URL with strict validation
 * Saves the audio to public/uploads/audio and returns the public URL
 * Automatically converts WebM/OGG to MP3 for Kie.ai compatibility
 */
export async function saveBase64Audio(base64Data: string): Promise<string> {
  await ensureUploadsDir();

  // Extract base64 content from data URI
  // Handles formats like:
  //   "data:audio/mpeg;base64,..."
  //   "data:audio/webm;codecs=opus;base64,..." (browser recordings with codec info)
  //   "data:video/webm;base64,..." (some browsers record audio as video/webm)
  const matches = base64Data.match(/^data:((?:audio|video)\/[\w+-]+)(?:;[^;]+)*;base64,(.+)$/);
  if (!matches) {
    console.error('[audioHosting] Failed to parse base64 audio. Preview:', base64Data.substring(0, 100));
    throw new Error('Invalid base64 audio data URI format');
  }

  let [, mimeType, base64Content] = matches;
  
  // Normalize video/webm to audio/webm (browsers record audio as video/webm)
  if (mimeType === 'video/webm') {
    console.log('[audioHosting] Converting video/webm MIME type to audio/webm...');
    mimeType = 'audio/webm';
  }
  
  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid audio type: ${mimeType}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }
  
  // Decode and validate size
  const buffer = Buffer.from(base64Content, 'base64');
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`Audio size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds maximum ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  
  // Extract extension from MIME type
  let extension = mimeType.split('/')[1];
  // Handle special cases and alternative MIME types
  if (extension === 'mpeg') extension = 'mp3';
  if (extension === 'x-m4a') extension = 'm4a';
  if (extension === 'x-aac') extension = 'aac';
  if (extension === 'mp4') extension = 'm4a'; // audio/mp4 is often M4A
  
  // Generate unique filename with hash to prevent duplicates
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  const baseUrl = getBaseUrl();
  
  // Check if format needs conversion to MP3 (WebM, OGG not supported by Kie.ai)
  if (FORMATS_NEEDING_CONVERSION.includes(extension)) {
    console.log(`[audioHosting] Converting ${extension.toUpperCase()} to MP3 for Kie.ai compatibility...`);
    
    // Save original file temporarily
    const tempFilename = `${Date.now()}-${hash}-temp.${extension}`;
    const tempPath = path.join(UPLOADS_DIR, tempFilename);
    await fs.writeFile(tempPath, buffer);
    
    // Convert to MP3
    const mp3Filename = `${Date.now()}-${hash}.mp3`;
    const mp3Path = path.join(UPLOADS_DIR, mp3Filename);
    
    try {
      await convertToMp3(tempPath, mp3Path);
      
      // Clean up temp file
      await fs.unlink(tempPath).catch(() => {});
      
      console.log(`✓ Audio converted and saved as: ${mp3Filename}`);
      return `${baseUrl}/uploads/audio/${mp3Filename}`;
    } catch (conversionError) {
      // Clean up on failure
      await fs.unlink(tempPath).catch(() => {});
      await fs.unlink(mp3Path).catch(() => {});
      throw conversionError;
    }
  }
  
  // For already-compatible formats, save directly
  const filename = `${Date.now()}-${hash}.${extension}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  await fs.writeFile(filePath, buffer);
  
  return `${baseUrl}/uploads/audio/${filename}`;
}

/**
 * Convert array of base64 data URIs to hosted URLs with rollback on failure
 */
export async function saveBase64AudioFiles(base64Audios: string[]): Promise<string[]> {
  // Validate array length (max 3 to stay within 50MB Express limit with base64 encoding)
  if (base64Audios.length < 1 || base64Audios.length > 3) {
    throw new Error('Must provide 1-3 audio files');
  }

  const uploadedFiles: string[] = [];
  const uploadedUrls: string[] = [];
  
  try {
    // Upload all audio files
    for (const audio of base64Audios) {
      const url = await saveBase64Audio(audio);
      uploadedUrls.push(url);
      // Extract filename from URL for cleanup
      const filename = url.split('/').pop();
      if (filename) {
        uploadedFiles.push(path.join(UPLOADS_DIR, filename));
      }
    }
    return uploadedUrls;
  } catch (error) {
    // Rollback: delete all uploaded files on failure
    console.error('Audio upload failed, rolling back:', error);
    for (const filePath of uploadedFiles) {
      try {
        await fs.unlink(filePath);
        console.log(`Cleaned up failed upload: ${filePath}`);
      } catch (cleanupError) {
        console.error(`Failed to clean up ${filePath}:`, cleanupError);
      }
    }
    throw error;
  }
}

/**
 * Clean up old uploaded audio files (optional - can be called periodically)
 * Removes files older than maxAgeMs
 */
export async function cleanupOldAudioUploads(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
  try {
    await ensureUploadsDir();
    const files = await fs.readdir(UPLOADS_DIR);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtimeMs;
      
      if (age > maxAgeMs) {
        await fs.unlink(filePath);
        console.log(`Cleaned up old audio upload: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up audio uploads:', error);
  }
}
