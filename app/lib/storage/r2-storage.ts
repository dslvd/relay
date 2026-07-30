import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutObjectCommand,
  S3Client,
  type _Object,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';
import { resolveAliasObjectKey } from '@/app/lib/data/file-alias-store';

let r2Client: S3Client | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export function getR2BucketName(): string {
  return getRequiredEnv('R2_BUCKET');
}

export function getR2PublicBaseUrl(): string {
  const configured = getRequiredEnv('R2_PUBLIC_BASE_URL').trim();
  return configured.replace(/\/+$/, '');
}

function getR2Endpoint(): string {
  const accountId = getRequiredEnv('CLOUDFLARE_ACCOUNT_ID');

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

// Builds the storage key for a file uploaded via an API key: every file for a
// given key lives flat under one `d/api/{ownerId}/` prefix (no per-upload
// subfolder), so browsing the bucket shows one folder per key. The filename
// is sanitized so it can't introduce extra path segments of its own.
export function buildApiObjectKey(ownerId: string | null, fileName: string): string {
  const safeName = fileName.replace(/[/\\]/g, '_').trim().slice(-150) || 'file';
  const uniquePrefix = `${Date.now()}-${randomBytes(4).toString('hex')}`;
  return normalizeObjectKey(`d/api/${ownerId || 'anon'}/${uniquePrefix}-${safeName}`);
}

// Builds a plain `d/{unique-name}` storage key, matching the shape the
// first-party web UI already uses for regular file uploads (see
// app/page.tsx's `newUrl = ${origin}/d/${objectKey.split('/').pop()}`) so
// server-generated objects (like snippets) resolve through the same /d/
// share page without any special-casing.
export function buildObjectKey(fileName: string): string {
  const safeName = fileName.replace(/[/\\]/g, '_').trim().slice(-150) || 'file';
  const uniquePrefix = `${Date.now()}-${randomBytes(4).toString('hex')}`;
  return normalizeObjectKey(`d/${uniquePrefix}-${safeName}`);
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

// toObjectKeyFromAppUrl() above always guesses a "d/"-prefixed key. That's
// correct for objects created via buildObjectKey() (snippets, remote-upload)
// but NOT for the main multipart-upload flow, which stores the bare
// filename with no prefix (see app/page.tsx: `pathname = randomFilename`).
// Both conventions produce the identical /d/<x> URL, so the URL alone can't
// tell you which one a given file actually used - guessing wrong here means
// delete/quarantine/replace silently target a key that was never real while
// the actual file stays completely unaffected.
//
// This checks the file-alias-store first (populated by nothing today, but
// forward-looking), then verifies both key candidates directly against R2
// and returns whichever one is real.
export async function resolveObjectKeyFromAppUrl(fileUrl: string): Promise<string | null> {
  const guessed = toObjectKeyFromAppUrl(fileUrl);
  if (!guessed) return null;

  const bareKey = guessed.startsWith('d/') ? guessed.slice(2) : guessed;

  const aliasTarget = await resolveAliasObjectKey(bareKey);
  if (aliasTarget) return aliasTarget;

  if (bareKey !== guessed && (await objectExists(bareKey))) {
    return bareKey;
  }
  if (await objectExists(guessed)) {
    return guessed;
  }

  // Neither candidate exists right now (already deleted, or never did) -
  // fall back to the historical guess so callers that already handle
  // "object not found" gracefully keep doing so instead of getting null.
  return guessed;
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

export async function createPresignedDownloadUrl(input: {
  objectKey: string;
  expiresInSeconds?: number;
  responseContentDisposition?: string;
}): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getR2BucketName(),
    Key: normalizeObjectKey(input.objectKey),
    ResponseContentDisposition: input.responseContentDisposition,
  });

  return getSignedUrl(getR2Client(), command, {
    expiresIn: input.expiresInSeconds ?? 60,
  });
}

// Direct server-side put for small, server-generated text payloads (e.g.
// pasted code snippets) - unlike file uploads there's no client involved
// that needs a presigned URL to PUT its own bytes to, so this skips that
// round trip entirely.
export async function putObjectText(input: {
  objectKey: string;
  content: string;
  contentType?: string;
}): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: getR2BucketName(),
    Key: normalizeObjectKey(input.objectKey),
    Body: input.content,
    ContentType: input.contentType || 'text/plain; charset=utf-8',
  });

  await getR2Client().send(command);
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
  } catch (error) {
    // Only a confirmed 404 means the object is actually gone. Callers use
    // this to decide whether to prune history/dedupe records, so any other
    // failure (network blip, throttling, misconfiguration) must not be
    // treated the same as "missing" - that would silently delete valid
    // records. Fail open (assume it still exists) instead.
    const status =
      (error as { $metadata?: { httpStatusCode?: number } } | undefined)?.$metadata?.httpStatusCode;
    const name = (error as { name?: string } | undefined)?.name;
    if (status === 404 || name === 'NotFound') {
      return false;
    }
    console.warn('objectExists check failed (treating as still-existing):', objectKey, error);
    return true;
  }
}

export async function getObjectMetadata(objectKey: string): Promise<{
  contentType?: string;
  contentLength?: number;
} | null> {
  try {
    const command = new HeadObjectCommand({
      Bucket: getR2BucketName(),
      Key: normalizeObjectKey(objectKey),
    });
    const response = await getR2Client().send(command);

    return {
      contentType: response.ContentType,
      contentLength: typeof response.ContentLength === 'number' ? response.ContentLength : undefined,
    };
  } catch {
    return null;
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

// Single-page counterpart to listAllObjects() above, which loops until the
// whole bucket is read - fine for the stats endpoint's one-off total, but
// wrong for an interactive file manager where the bucket could hold far more
// objects than should ever load into one response/render.
export async function listObjectsPage(input: {
  prefix?: string;
  continuationToken?: string;
  maxKeys?: number;
}): Promise<{ objects: _Object[]; nextCursor?: string }> {
  const response = await getR2Client().send(
    new ListObjectsV2Command({
      Bucket: getR2BucketName(),
      Prefix: input.prefix,
      ContinuationToken: input.continuationToken,
      MaxKeys: Math.max(1, Math.min(input.maxKeys ?? 100, 1000)),
    })
  );

  return {
    objects: response.Contents || [],
    nextCursor: response.IsTruncated ? response.NextContinuationToken : undefined,
  };
}

export async function createMultipartUpload(input: {
  objectKey: string;
  contentType?: string;
}): Promise<{ uploadId: string; objectKey: string }> {
  const command = new CreateMultipartUploadCommand({
    Bucket: getR2BucketName(),
    Key: normalizeObjectKey(input.objectKey),
    ContentType: input.contentType || 'application/octet-stream',
  });

  const res = await getR2Client().send(command);
  if (!res.UploadId) {
    throw new Error('Failed to create multipart upload');
  }

  return { uploadId: res.UploadId, objectKey: normalizeObjectKey(input.objectKey) };
}

export async function createPresignedUploadPartUrl(input: {
  objectKey: string;
  uploadId: string;
  partNumber: number;
  expiresInSeconds?: number;
}): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: getR2BucketName(),
    Key: normalizeObjectKey(input.objectKey),
    UploadId: input.uploadId,
    PartNumber: input.partNumber,
  });

  return getSignedUrl(getR2Client(), command, {
    expiresIn: input.expiresInSeconds ?? 300,
  });
}

export async function completeMultipartUpload(input: {
  objectKey: string;
  uploadId: string;
  parts: Array<{ etag: string; partNumber: number }>;
}): Promise<void> {
  const command = new CompleteMultipartUploadCommand({
    Bucket: getR2BucketName(),
    Key: normalizeObjectKey(input.objectKey),
    UploadId: input.uploadId,
    MultipartUpload: {
      Parts: input.parts.map((p) => ({
        ETag: p.etag,
        PartNumber: p.partNumber,
      })),
    },
  });

  await getR2Client().send(command);
}

export async function abortMultipartUpload(input: {
  objectKey: string;
  uploadId: string;
}): Promise<void> {
  const command = new AbortMultipartUploadCommand({
    Bucket: getR2BucketName(),
    Key: normalizeObjectKey(input.objectKey),
    UploadId: input.uploadId,
  });

  await getR2Client().send(command);
}
