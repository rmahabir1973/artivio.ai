import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { getBaseUrl } from './urlUtils';
import * as s3 from './services/awsS3';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'audio');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max per audio file
const ALLOWED_MIME_TYPES = [
  'audio/mpeg', 
  'audio/mp3', 
  'audio/wav', 
  'audio/m4a', 
  'audio/x-m4a',
  'audio/aac', 
  'audio/x-aac',
  'audio/ogg', 
  'audio/webm',
  'audio/mp4'
];

const FORMATS_NEEDING_CONVERSION = ['webm', 'ogg'];

async function convertToMp3(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-vn',
      '-ar', '44100',
      '-ac', '2',
      '-b:a', '192k',
      '-f', 'mp3',
      '-y',
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

async function ensureUploadsDir() {
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }
}

export async function saveBase64Audio(base64Data: string): Promise<string> {
  await ensureUploadsDir();

  const matches = base64Data.match(/^data:((?:audio|video)\/[\w+-]+)(?:;[^;]+)*;base64,(.+)$/);
  if (!matches) {
    console.error('[audioHosting] Failed to parse base64 audio. Preview:', base64Data.substring(0, 100));
    throw new Error('Invalid base64 audio data URI format');
  }

  let [, mimeType, base64Content] = matches;
  
  if (mimeType === 'video/webm') {
    console.log('[audioHosting] Converting video/webm MIME type to audio/webm...');
    mimeType = 'audio/webm';
  }
  
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid audio type: ${mimeType}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }
  
  const buffer = Buffer.from(base64Content, 'base64');
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`Audio size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds maximum ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  
  let extension = mimeType.split('/')[1];
  if (extension === 'mpeg') extension = 'mp3';
  if (extension === 'x-m4a') extension = 'm4a';
  if (extension === 'x-aac') extension = 'aac';
  if (extension === 'mp4') extension = 'm4a';
  
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  const baseUrl = getBaseUrl();
  
  if (FORMATS_NEEDING_CONVERSION.includes(extension)) {
    console.log(`[audioHosting] Converting ${extension.toUpperCase()} to MP3 for Kie.ai compatibility...`);
    
    const tempFilename = `${Date.now()}-${hash}-temp.${extension}`;
    const tempPath = path.join(UPLOADS_DIR, tempFilename);
    await fs.writeFile(tempPath, buffer);
    
    const mp3Filename = `${Date.now()}-${hash}.mp3`;
    const mp3Path = path.join(UPLOADS_DIR, mp3Filename);
    
    try {
      await convertToMp3(tempPath, mp3Path);
      await fs.unlink(tempPath).catch(() => {});
      
      if (s3.isS3Enabled()) {
        try {
          console.log(`[audioHosting] Uploading converted MP3 to S3...`);
          const mp3Buffer = await fs.readFile(mp3Path);
          const result = await s3.uploadBuffer(mp3Buffer, {
            prefix: 'uploads/audio',
            contentType: 'audio/mpeg',
            filename: mp3Filename,
          });
          
          await fs.unlink(mp3Path).catch(() => {});
          console.log(`✓ Audio uploaded to S3: ${result.key}`);
          return result.signedUrl;
        } catch (s3Error) {
          console.error('[audioHosting] S3 upload failed, using local storage:', s3Error);
        }
      }
      
      console.log(`✓ Audio converted and saved as: ${mp3Filename}`);
      return `${baseUrl}/uploads/audio/${mp3Filename}`;
    } catch (conversionError) {
      await fs.unlink(tempPath).catch(() => {});
      await fs.unlink(mp3Path).catch(() => {});
      throw conversionError;
    }
  }
  
  const filename = `${Date.now()}-${hash}.${extension}`;
  
  if (s3.isS3Enabled()) {
    try {
      console.log(`[audioHosting] Uploading audio to S3...`);
      const result = await s3.uploadBuffer(buffer, {
        prefix: 'uploads/audio',
        contentType: mimeType,
        filename,
      });
      
      console.log(`✓ Audio uploaded to S3: ${result.key}`);
      return result.signedUrl;
    } catch (s3Error) {
      console.error('[audioHosting] S3 upload failed, falling back to local storage:', s3Error);
    }
  }
  
  const filePath = path.join(UPLOADS_DIR, filename);
  await fs.writeFile(filePath, buffer);
  
  return `${baseUrl}/uploads/audio/${filename}`;
}

export async function saveBase64AudioFiles(base64Audios: string[]): Promise<string[]> {
  if (base64Audios.length < 1 || base64Audios.length > 3) {
    throw new Error('Must provide 1-3 audio files');
  }

  const uploadedFiles: string[] = [];
  const uploadedUrls: string[] = [];
  const uploadedS3Keys: string[] = [];
  
  try {
    for (const audio of base64Audios) {
      const url = await saveBase64Audio(audio);
      uploadedUrls.push(url);
      
      if (s3.isS3SignedUrl(url)) {
        const key = s3.extractKeyFromSignedUrl(url);
        if (key) {
          uploadedS3Keys.push(key);
        }
      } else {
        const filename = url.split('/').pop();
        if (filename) {
          uploadedFiles.push(path.join(UPLOADS_DIR, filename));
        }
      }
    }
    return uploadedUrls;
  } catch (error) {
    console.error('Audio upload failed, rolling back:', error);
    
    for (const key of uploadedS3Keys) {
      try {
        await s3.deleteObject(key);
        console.log(`Cleaned up S3 object: ${key}`);
      } catch (cleanupError) {
        console.error(`Failed to clean up S3 object ${key}:`, cleanupError);
      }
    }
    
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
