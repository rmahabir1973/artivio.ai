import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getBaseUrl } from './urlUtils';

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
  const baseUrl = getBaseUrl();
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
 * Save base64 video to hosted URL with minimal validation
 * Accepts video base64 data (with or without data URI prefix)
 */
export async function saveBase64Video(base64Data: string): Promise<string> {
  await ensureUploadsDir();

  // Handle both raw base64 and data URI formats
  let base64Content = base64Data;
  let extension = 'mp4'; // Default to mp4

  // Try to extract from data URI if present
  if (base64Data.includes('data:')) {
    const matches = base64Data.match(/^data:(video\/[\w+]+);base64,(.+)$/);
    if (matches) {
      const [, mimeType, content] = matches;
      base64Content = content;
      // Extract extension from MIME type (e.g., video/mp4 -> mp4)
      extension = mimeType.split('/')[1] || 'mp4';
    }
  }

  // Decode and validate size
  const buffer = Buffer.from(base64Content, 'base64');
  const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB max for video
  if (buffer.length > MAX_VIDEO_SIZE) {
    throw new Error(`Video size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds maximum ${MAX_VIDEO_SIZE / 1024 / 1024}MB`);
  }

  // Generate unique filename with hash to prevent duplicates
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  const filename = `${Date.now()}-${hash}.${extension}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  // Save file
  await fs.writeFile(filePath, buffer);

  // Return public URL
  const baseUrl = getBaseUrl();
  return `${baseUrl}/uploads/${filename}`;
}

/**
 * Process array of images that can be either base64 data URIs or HTTP/HTTPS URLs
 * Converts data URIs to hosted URLs, passes through URLs unchanged
 * Preserves original array order
 */
export async function processImageInputs(images: string[]): Promise<string[]> {
  const results: string[] = [];
  const dataUrisToConvert: string[] = [];
  const dataUriIndices: number[] = [];
  
  console.log(`[processImageInputs] Processing ${images.length} image inputs...`);
  
  // Separate data URIs from URLs
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const preview = img.substring(0, 50) + (img.length > 50 ? '...' : '');
    
    if (img.startsWith('data:image/')) {
      console.log(`  [${i}] Data URI detected (will convert to hosted URL): ${preview}`);
      dataUrisToConvert.push(img);
      dataUriIndices.push(i);
      results.push(''); // Placeholder, will be filled later
    } else if (img.startsWith('https://') || img.startsWith('http://')) {
      console.log(`  [${i}] URL detected (passing through): ${preview}`);
      results.push(img); // Pass through URLs unchanged
    } else {
      console.error(`  [${i}] REJECTED - Invalid image input format: ${preview}`);
      throw new Error(`Invalid image input at index ${i}: must be data URI (data:image/...) or HTTP/HTTPS URL. Got: ${preview}`);
    }
  }
  
  // Convert all data URIs to hosted URLs
  if (dataUrisToConvert.length > 0) {
    console.log(`[processImageInputs] Converting ${dataUrisToConvert.length} data URIs to hosted URLs...`);
    const hostedUrls = await saveBase64Images(dataUrisToConvert);
    // Fill in placeholders with converted URLs
    for (let i = 0; i < dataUriIndices.length; i++) {
      results[dataUriIndices[i]] = hostedUrls[i];
      console.log(`  [${dataUriIndices[i]}] Converted to: ${hostedUrls[i]}`);
    }
  }
  
  console.log(`[processImageInputs] Successfully processed all ${images.length} images`);
  return results;
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
      
      if (stats.isDirectory()) {
        continue;
      }
      
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
