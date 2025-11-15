import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getBaseUrl } from './urlUtils';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'audio');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max per audio file
const ALLOWED_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/ogg', 'audio/webm'];

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
 */
export async function saveBase64Audio(base64Data: string): Promise<string> {
  await ensureUploadsDir();

  // Extract base64 content from data URI (e.g., "data:audio/mpeg;base64,...")
  const matches = base64Data.match(/^data:(audio\/[\w+-]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 audio data URI format');
  }

  const [, mimeType, base64Content] = matches;
  
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
  // Handle special cases
  if (extension === 'mpeg') extension = 'mp3';
  
  // Generate unique filename with hash to prevent duplicates
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  const filename = `${Date.now()}-${hash}.${extension}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  
  // Save file
  await fs.writeFile(filePath, buffer);
  
  // Return public URL (prefer production domain if available)
  const baseUrl = getBaseUrl();
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
