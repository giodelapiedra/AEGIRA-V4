// Cloudflare R2 Storage Service
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env';
import { AppError } from './errors';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return map[mimeType] || 'jpg';
}

export function validateImageFile(file: File): void {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new AppError(
      'INVALID_FILE_TYPE',
      'Only JPEG, PNG, and WebP images are allowed',
      400
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new AppError(
      'FILE_TOO_LARGE',
      'File size must not exceed 5MB',
      400
    );
  }
}

export async function uploadFile(
  key: string,
  buffer: ArrayBuffer,
  contentType: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: contentType,
    })
  );

  return `${env.R2_PUBLIC_URL}/${key}`;
}

export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    })
  );
}

export function buildAvatarKey(
  companyId: string,
  personId: string,
  mimeType: string
): string {
  const ext = getExtension(mimeType);
  const timestamp = Date.now();
  return `${companyId}/profiles/${personId}/${timestamp}.${ext}`;
}

export function extractKeyFromUrl(url: string): string | null {
  if (!url.startsWith(env.R2_PUBLIC_URL)) return null;
  return url.slice(env.R2_PUBLIC_URL.length + 1); // +1 for the "/"
}
