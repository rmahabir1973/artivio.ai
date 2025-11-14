import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// Ensure uploads directory exists
async function ensureUploadsDir() {
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Convert base64 data URI to hosted URL
 * Saves the image to public/uploads and returns the public URL
 */
export async function saveBase64Image(base64Data: string): Promise<string> {
  await ensureUploadsDir();

  // Extract base64 content from data URI (e.g., "data:image/png;base64,...")
  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 image data');
  }

  const [, extension, base64Content] = matches;
  const buffer = Buffer.from(base64Content, 'base64');
  
  // Generate unique filename
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  const filename = `${Date.now()}-${hash}.${extension}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  
  // Save file
  await fs.writeFile(filePath, buffer);
  
  // Return public URL
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000';
  
  return `${baseUrl}/uploads/${filename}`;
}

/**
 * Convert array of base64 data URIs to hosted URLs
 */
export async function saveBase64Images(base64Images: string[]): Promise<string[]> {
  const promises = base64Images.map(img => saveBase64Image(img));
  return await Promise.all(promises);
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
