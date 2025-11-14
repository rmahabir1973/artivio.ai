import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max per image
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

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
 * Saves the image to public/uploads and returns the public URL
 */
export async function saveBase64Image(base64Data: string): Promise<string> {
  await ensureUploadsDir();

  // Extract base64 content from data URI (e.g., "data:image/png;base64,...")
  const matches = base64Data.match(/^data:(image\/[\w+]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 image data URI format');
  }

  const [, mimeType, base64Content] = matches;
  
  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid image type: ${mimeType}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }
  
  // Decode and validate size
  const buffer = Buffer.from(base64Content, 'base64');
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`Image size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds maximum ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  
  // Extract extension from MIME type
  const extension = mimeType.split('/')[1];
  
  // Generate unique filename with hash to prevent duplicates
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  const filename = `${Date.now()}-${hash}.${extension}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  
  // Save file
  await fs.writeFile(filePath, buffer);
  
  // Return public URL (prefer production domain if available)
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000';
  
  return `${baseUrl}/uploads/${filename}`;
}

/**
 * Convert array of base64 data URIs to hosted URLs with rollback on failure
 */
export async function saveBase64Images(base64Images: string[]): Promise<string[]> {
  const uploadedFiles: string[] = [];
  const uploadedUrls: string[] = [];
  
  try {
    // Upload all images
    for (const img of base64Images) {
      const url = await saveBase64Image(img);
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
    console.error('Image upload failed, rolling back:', error);
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
 * Clean up old uploaded files (optional - can be called periodically)
 * Removes files older than maxAgeMs
 */
export async function cleanupOldUploads(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
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
        console.log(`Cleaned up old upload: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up uploads:', error);
  }
}
