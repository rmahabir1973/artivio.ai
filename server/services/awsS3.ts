import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET || 'artivio-video-exports';
const SIGNED_URL_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.');
    }
    
    s3Client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    
    console.log(`[S3] Initialized S3 client for bucket: ${S3_BUCKET} in region: ${AWS_REGION}`);
  }
  
  return s3Client;
}

export function isS3Enabled(): boolean {
  return !!(
    process.env.USE_S3 === 'true' &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}

export type S3Prefix = 'uploads/images' | 'uploads/audio' | 'uploads/video' | 'generations' | 'video-exports';

export interface UploadResult {
  key: string;
  bucket: string;
  signedUrl: string;
  expiresAt: Date;
}

export interface UploadOptions {
  prefix: S3Prefix;
  contentType: string;
  filename?: string;
}

function generateUniqueFilename(buffer: Buffer, extension: string, customFilename?: string): string {
  if (customFilename) {
    return customFilename;
  }
  
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  const timestamp = Date.now();
  return `${timestamp}-${hash}.${extension}`;
}

export async function uploadBuffer(
  buffer: Buffer,
  options: UploadOptions
): Promise<UploadResult> {
  const client = getS3Client();
  
  const extension = options.contentType.split('/')[1] || 'bin';
  const filename = generateUniqueFilename(buffer, extension, options.filename);
  const key = `${options.prefix}/${filename}`;
  
  console.log(`[S3] Uploading ${buffer.length} bytes to ${key} (${options.contentType})`);
  
  await client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: options.contentType,
  }));
  
  const signedUrl = await generateSignedUrl(key);
  const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000);
  
  console.log(`[S3] Upload complete: ${key}`);
  
  return {
    key,
    bucket: S3_BUCKET,
    signedUrl,
    expiresAt,
  };
}

export async function uploadFromUrl(
  sourceUrl: string,
  options: UploadOptions
): Promise<UploadResult> {
  console.log(`[S3] Downloading from URL: ${sourceUrl.substring(0, 100)}...`);
  
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch source URL: ${response.status} ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return uploadBuffer(buffer, options);
}

export async function generateSignedUrl(key: string, expirySeconds?: number): Promise<string> {
  const client = getS3Client();
  
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  
  const signedUrl = await getSignedUrl(client, command, {
    expiresIn: expirySeconds || SIGNED_URL_EXPIRY_SECONDS,
  });
  
  return signedUrl;
}

export async function deleteObject(key: string): Promise<void> {
  const client = getS3Client();
  
  console.log(`[S3] Deleting object: ${key}`);
  
  await client.send(new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  }));
  
  console.log(`[S3] Deleted: ${key}`);
}

export async function deleteObjects(keys: string[]): Promise<void> {
  for (const key of keys) {
    try {
      await deleteObject(key);
    } catch (error) {
      console.error(`[S3] Failed to delete ${key}:`, error);
    }
  }
}

export async function objectExists(key: string): Promise<boolean> {
  const client = getS3Client();
  
  try {
    await client.send(new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }));
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

export function extractKeyFromSignedUrl(signedUrl: string): string | null {
  try {
    const url = new URL(signedUrl);
    const pathname = url.pathname;
    return pathname.startsWith('/') ? pathname.slice(1) : pathname;
  } catch {
    return null;
  }
}

export function isS3SignedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('s3') && 
           parsed.hostname.includes('amazonaws.com') &&
           parsed.searchParams.has('X-Amz-Signature');
  } catch {
    return false;
  }
}

export async function refreshSignedUrl(url: string): Promise<string> {
  if (!isS3SignedUrl(url)) {
    return url;
  }
  
  const key = extractKeyFromSignedUrl(url);
  if (!key) {
    throw new Error('Could not extract S3 key from URL');
  }
  
  return generateSignedUrl(key);
}

export { S3_BUCKET, AWS_REGION, SIGNED_URL_EXPIRY_SECONDS };
