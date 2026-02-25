import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type _Object,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const DEFAULT_MAX_UPLOAD_FILE_BYTES = 100 * 1024 * 1024;

let r2Client: S3Client | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export function getMaxUploadFileBytes(): number {
  const value = Number(process.env.MAX_UPLOAD_FILE_MB);
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_MAX_UPLOAD_FILE_BYTES;
  }

  return Math.floor(value * 1024 * 1024);
}

export function getR2BucketName(): string {
  return getRequiredEnv('R2_BUCKET');
}

export function getR2PublicBaseUrl(): string {
  const configured = getRequiredEnv('R2_PUBLIC_BASE_URL').trim();
  return configured.replace(/\/+$/, '');
}

function getR2Endpoint(): string {
  const accountId = getRequiredEnv('R2_ACCOUNT_ID');
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function getR2Client(): S3Client {
  if (r2Client) {
    return r2Client;
  }

  r2Client = new S3Client({
    region: 'auto',
    endpoint: getR2Endpoint(),
    credentials: {
      accessKeyId: getRequiredEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: getRequiredEnv('R2_SECRET_ACCESS_KEY'),
    },
  });

  return r2Client;
}

export function normalizeObjectKey(key: string): string {
  return key.replace(/^\/+/, '');
}

export function buildPublicObjectUrl(objectKey: string): string {
  return `${getR2PublicBaseUrl()}/${normalizeObjectKey(objectKey)}`;
}

export function toObjectKeyFromAppUrl(fileUrl: string): string | null {
  try {
    const parsed = new URL(fileUrl, 'http://localhost');
    const path = parsed.pathname;

    if (path.startsWith('/download/')) {
      return `d/${path.slice('/download/'.length)}`;
    }

    if (path.startsWith('/d/')) {
      return path.slice(1);
    }

    return null;
  } catch {
    return null;
  }
}

export async function createPresignedUploadUrl(input: {
  objectKey: string;
  contentType?: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getR2BucketName(),
    Key: normalizeObjectKey(input.objectKey),
    ContentType: input.contentType || 'application/octet-stream',
  });

  return getSignedUrl(getR2Client(), command, {
    expiresIn: input.expiresInSeconds ?? 60,
  });
}

export async function deleteObject(objectKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: getR2BucketName(),
    Key: normalizeObjectKey(objectKey),
  });

  await getR2Client().send(command);
}

export async function objectExists(objectKey: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: getR2BucketName(),
      Key: normalizeObjectKey(objectKey),
    });
    await getR2Client().send(command);
    return true;
  } catch {
    return false;
  }
}

export async function listAllObjects(prefix?: string): Promise<_Object[]> {
  const objects: _Object[] = [];
  let continuationToken: string | undefined;

  while (true) {
    const response = await getR2Client().send(
      new ListObjectsV2Command({
        Bucket: getR2BucketName(),
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    );

    if (response.Contents?.length) {
      objects.push(...response.Contents);
    }

    if (!response.IsTruncated) {
      break;
    }

    continuationToken = response.NextContinuationToken;
  }

  return objects;
}
