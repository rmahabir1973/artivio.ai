import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getBaseUrl } from './urlUtils';
import * as uploadService from './services/uploadService';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max per image
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

async function ensureUploadsDir() {
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }
}

export async function saveBase64Image(base64Data: string): Promise<string> {
  const matches = base64Data.match(/^data:(image\/[\w+]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 image data URI format');
  }

  const [, mimeType] = matches;
  
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid image type: ${mimeType}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }
  
  const result = await uploadService.saveImage(base64Data);
  return result.url;
}

export async function saveBase64Images(base64Images: string[]): Promise<string[]> {
  for (const img of base64Images) {
    const matches = img.match(/^data:(image\/[\w+]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 image data URI format');
    }
    const [, mimeType] = matches;
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Invalid image type: ${mimeType}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`);
    }
  }
  
  const results = await uploadService.saveImages(base64Images);
  return results.map(r => r.url);
}

export async function saveBase64Video(base64Data: string): Promise<string> {
  const result = await uploadService.saveVideo(base64Data);
  return result.url;
}

export async function processImageInputs(images: string[]): Promise<string[]> {
  const results: string[] = [];
  const dataUrisToConvert: string[] = [];
  const dataUriIndices: number[] = [];
  
  console.log(`[processImageInputs] Processing ${images.length} image inputs...`);
  
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const preview = img.substring(0, 50) + (img.length > 50 ? '...' : '');
    
    if (img.startsWith('data:image/')) {
      console.log(`  [${i}] Data URI detected (will convert to hosted URL): ${preview}`);
      dataUrisToConvert.push(img);
      dataUriIndices.push(i);
      results.push('');
    } else if (img.startsWith('https://') || img.startsWith('http://')) {
      console.log(`  [${i}] URL detected (passing through): ${preview}`);
      results.push(img);
    } else {
      console.error(`  [${i}] REJECTED - Invalid image input format: ${preview}`);
      throw new Error(`Invalid image input at index ${i}: must be data URI (data:image/...) or HTTP/HTTPS URL. Got: ${preview}`);
    }
  }
  
  if (dataUrisToConvert.length > 0) {
    console.log(`[processImageInputs] Converting ${dataUrisToConvert.length} data URIs to hosted URLs...`);
    const hostedUrls = await saveBase64Images(dataUrisToConvert);
    for (let i = 0; i < dataUriIndices.length; i++) {
      results[dataUriIndices[i]] = hostedUrls[i];
      console.log(`  [${dataUriIndices[i]}] Converted to: ${hostedUrls[i]}`);
    }
  }
  
  console.log(`[processImageInputs] Successfully processed all ${images.length} images`);
  return results;
}

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

export function getStorageStatus() {
  return uploadService.getStorageStatus();
}

export async function refreshUrl(url: string): Promise<string> {
  return uploadService.refreshUrl(url);
}
