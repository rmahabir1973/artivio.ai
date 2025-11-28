import * as s3 from './awsS3';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getBaseUrl } from '../urlUtils';

const LOCAL_UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const LOCAL_AUDIO_DIR = path.join(LOCAL_UPLOADS_DIR, 'audio');

export interface StorageResult {
  url: string;
  storageType: 'local' | 's3';
  key?: string;
  expiresAt?: Date;
}

async function ensureLocalDir(dir: string): Promise<void> {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

function generateFilename(buffer: Buffer, extension: string): string {
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  const timestamp = Date.now();
  return `${timestamp}-${hash}.${extension}`;
}

async function saveToLocal(
  buffer: Buffer,
  directory: string,
  filename: string
): Promise<string> {
  await ensureLocalDir(directory);
  const filepath = path.join(directory, filename);
  await fs.writeFile(filepath, buffer);
  return filepath;
}

async function deleteLocalFile(filepath: string): Promise<void> {
  try {
    await fs.unlink(filepath);
    console.log(`[Local] Deleted: ${filepath}`);
  } catch (error) {
    console.error(`[Local] Failed to delete ${filepath}:`, error);
  }
}

export async function saveImage(base64Data: string): Promise<StorageResult> {
  const matches = base64Data.match(/^data:(image\/[\w+]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 image data URI format');
  }

  const [, mimeType, base64Content] = matches;
  const buffer = Buffer.from(base64Content, 'base64');
  
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`Image size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds maximum ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const extension = mimeType.split('/')[1];
  const filename = generateFilename(buffer, extension);

  if (s3.isS3Enabled()) {
    try {
      console.log(`[Upload] Uploading image to S3...`);
      const result = await s3.uploadBuffer(buffer, {
        prefix: 'uploads/images',
        contentType: mimeType,
        filename,
      });
      
      return {
        url: result.signedUrl,
        storageType: 's3',
        key: result.key,
        expiresAt: result.expiresAt,
      };
    } catch (error) {
      console.error('[Upload] S3 upload failed, falling back to local storage:', error);
    }
  }

  console.log(`[Upload] Saving image to local storage...`);
  await saveToLocal(buffer, LOCAL_UPLOADS_DIR, filename);
  const baseUrl = getBaseUrl();
  
  return {
    url: `${baseUrl}/uploads/${filename}`,
    storageType: 'local',
  };
}

export async function saveImages(base64Images: string[]): Promise<StorageResult[]> {
  const results: StorageResult[] = [];
  const uploadedS3Keys: string[] = [];
  const uploadedLocalPaths: string[] = [];

  try {
    for (const img of base64Images) {
      const result = await saveImage(img);
      results.push(result);
      
      if (result.storageType === 's3' && result.key) {
        uploadedS3Keys.push(result.key);
      } else if (result.storageType === 'local') {
        const filename = result.url.split('/').pop();
        if (filename) {
          uploadedLocalPaths.push(path.join(LOCAL_UPLOADS_DIR, filename));
        }
      }
    }
    return results;
  } catch (error) {
    console.error('[Upload] Batch upload failed, rolling back:', error);
    
    for (const key of uploadedS3Keys) {
      try {
        await s3.deleteObject(key);
      } catch (e) {
        console.error(`[Upload] Failed to rollback S3 object ${key}:`, e);
      }
    }
    
    for (const filepath of uploadedLocalPaths) {
      await deleteLocalFile(filepath);
    }
    
    throw error;
  }
}

export async function saveAudio(
  base64Data: string, 
  skipConversion: boolean = false
): Promise<StorageResult> {
  const matches = base64Data.match(/^data:((?:audio|video)\/[\w+-]+)(?:;[^;]+)*;base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 audio data URI format');
  }

  let [, mimeType, base64Content] = matches;
  
  if (mimeType === 'video/webm') {
    mimeType = 'audio/webm';
  }

  const buffer = Buffer.from(base64Content, 'base64');
  
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`Audio size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds maximum ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  let extension = mimeType.split('/')[1];
  if (extension === 'mpeg') extension = 'mp3';
  if (extension === 'x-m4a') extension = 'm4a';
  if (extension === 'x-aac') extension = 'aac';
  if (extension === 'mp4') extension = 'm4a';

  const filename = generateFilename(buffer, extension);

  if (s3.isS3Enabled()) {
    try {
      console.log(`[Upload] Uploading audio to S3...`);
      const result = await s3.uploadBuffer(buffer, {
        prefix: 'uploads/audio',
        contentType: mimeType,
        filename,
      });
      
      return {
        url: result.signedUrl,
        storageType: 's3',
        key: result.key,
        expiresAt: result.expiresAt,
      };
    } catch (error) {
      console.error('[Upload] S3 upload failed, falling back to local storage:', error);
    }
  }

  console.log(`[Upload] Saving audio to local storage...`);
  await saveToLocal(buffer, LOCAL_AUDIO_DIR, filename);
  const baseUrl = getBaseUrl();
  
  return {
    url: `${baseUrl}/uploads/audio/${filename}`,
    storageType: 'local',
  };
}

export async function saveVideo(base64Data: string): Promise<StorageResult> {
  let base64Content = base64Data;
  let extension = 'mp4';
  let mimeType = 'video/mp4';

  if (base64Data.includes('data:')) {
    const matches = base64Data.match(/^data:(video\/[\w+]+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      base64Content = matches[2];
      extension = mimeType.split('/')[1] || 'mp4';
    }
  }

  const buffer = Buffer.from(base64Content, 'base64');
  
  const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
  if (buffer.length > MAX_VIDEO_SIZE) {
    throw new Error(`Video size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds maximum ${MAX_VIDEO_SIZE / 1024 / 1024}MB`);
  }

  const filename = generateFilename(buffer, extension);

  if (s3.isS3Enabled()) {
    try {
      console.log(`[Upload] Uploading video to S3...`);
      const result = await s3.uploadBuffer(buffer, {
        prefix: 'uploads/video',
        contentType: mimeType,
        filename,
      });
      
      return {
        url: result.signedUrl,
        storageType: 's3',
        key: result.key,
        expiresAt: result.expiresAt,
      };
    } catch (error) {
      console.error('[Upload] S3 upload failed, falling back to local storage:', error);
    }
  }

  console.log(`[Upload] Saving video to local storage...`);
  await saveToLocal(buffer, LOCAL_UPLOADS_DIR, filename);
  const baseUrl = getBaseUrl();
  
  return {
    url: `${baseUrl}/uploads/${filename}`,
    storageType: 'local',
  };
}

export async function uploadFromUrl(
  sourceUrl: string,
  options: { prefix: s3.S3Prefix; contentType: string; filename?: string }
): Promise<StorageResult> {
  if (s3.isS3Enabled()) {
    try {
      console.log(`[Upload] Uploading from URL to S3...`);
      const result = await s3.uploadFromUrl(sourceUrl, options);
      
      return {
        url: result.signedUrl,
        storageType: 's3',
        key: result.key,
        expiresAt: result.expiresAt,
      };
    } catch (error) {
      console.error('[Upload] S3 upload from URL failed:', error);
      throw error;
    }
  }

  throw new Error('S3 not enabled for URL uploads');
}

export async function refreshUrl(url: string): Promise<string> {
  if (s3.isS3SignedUrl(url)) {
    return s3.refreshSignedUrl(url);
  }
  return url;
}

export async function deleteFile(urlOrKey: string): Promise<void> {
  if (s3.isS3SignedUrl(urlOrKey)) {
    const key = s3.extractKeyFromSignedUrl(urlOrKey);
    if (key) {
      await s3.deleteObject(key);
    }
  } else if (urlOrKey.startsWith('uploads/') || urlOrKey.startsWith('generations/')) {
    await s3.deleteObject(urlOrKey);
  } else {
    const filename = urlOrKey.split('/').pop();
    if (filename) {
      const filepath = path.join(LOCAL_UPLOADS_DIR, filename);
      await deleteLocalFile(filepath);
    }
  }
}

export function isS3Url(url: string): boolean {
  return s3.isS3SignedUrl(url);
}

export function getStorageStatus(): { enabled: boolean; bucket: string; region: string } {
  return {
    enabled: s3.isS3Enabled(),
    bucket: s3.S3_BUCKET,
    region: s3.AWS_REGION,
  };
}
