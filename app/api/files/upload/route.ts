import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/lib/auth/api-auth';
import { createPresignedUploadUrl, createPresignedDownloadUrl, buildApiObjectKey } from '@/app/lib/storage/r2-storage';
import { createFileRecord, getAccountApiStorageUsage } from '@/app/lib/data/api-file-store';
import { isFreeAccountId } from '@/app/lib/auth/api-key-account';
import { syncPlusApiUpload } from '@/app/lib/data/api-upload-sync';
import { dispatchFileWebhook } from '@/app/lib/webhooks/dispatch';
import { checkRateLimit } from '@/app/lib/security/rate-limit';
import { FREE_MAX_FILE_BYTES, PLUS_MAX_FILE_BYTES, FREE_API_STORAGE_LIMIT_BYTES, PLUS_STORAGE_LIMIT_BYTES } from '@/app/lib/plan-limits';

const ANON_MAX_FILE_BYTES = 25 * 1024 * 1024 * 1024; // 25GB, matches rootz's anonymous cap
const ANON_EXPIRY_MS = 15 * 24 * 60 * 60 * 1000; // 15 days, matches rootz's anonymous expiry
const ANON_RATE_LIMIT_PER_HOUR = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown'
  );
}

function toApiFileResponse(record: {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: number;
  isAnonymous: boolean;
  expiresAt: number | null;
  shortId: string;
}, url: string, viewUrl: string) {
  return {
    id: record.id,
    name: record.name,
    size: record.size,
    url,
    viewUrl,
    mimeType: record.mimeType,
    createdAt: new Date(record.createdAt).toISOString(),
    isAnonymous: record.isAnonymous,
    expiresAt: record.expiresAt ? new Date(record.expiresAt).toISOString() : null,
    shortId: record.shortId,
  };
}

// POST /api/files/upload - direct upload for files under ~4MB (rootz-compatible)
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request);
    // `userId` on an API key is the owning ACCOUNT (a plus_users.id, or a
    // synthetic `ip:{address}` for free accounts) - not the key itself - so
    // storage/size limits are pooled across every key an account has.
    const ownerId = auth.success ? auth.apiKey!.userId ?? null : null;
    const isPlusAccount = ownerId ? !isFreeAccountId(ownerId) : false;

    if (!ownerId) {
      const ip = getClientIp(request);
      const rateLimit = await checkRateLimit(`files-upload:${ip}`, ANON_RATE_LIMIT_PER_HOUR, RATE_WINDOW_MS);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded. Anonymous users can upload 20 files per hour.',
            rateLimitExceeded: true,
            resetAt: new Date(rateLimit.resetAt).toISOString(),
          },
          { status: 429 }
        );
      }
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ success: false, error: 'Expected multipart/form-data body' }, { status: 400 });
    }

    const file = formData.get('file');
    const folderId = formData.get('folderId');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'file is required' }, { status: 400 });
    }

    // Authenticated uploads are capped at the account's OWN per-upload limit
    // (never maxed against the anonymous ceiling - a Plus account is capped
    // at 8GB, not bumped up to the 25GB anonymous allowance).
    const maxFileBytes = ownerId ? (isPlusAccount ? PLUS_MAX_FILE_BYTES : FREE_MAX_FILE_BYTES) : ANON_MAX_FILE_BYTES;
    if (file.size > maxFileBytes) {
      return NextResponse.json(
        {
          success: false,
          error: ownerId
            ? `Uploads with this API key are limited to ${Math.round(maxFileBytes / (1024 ** 3))}GB per file.`
            : `Anonymous uploads are limited to ${Math.round(ANON_MAX_FILE_BYTES / (1024 ** 3))}GB. Please create an account for larger files.`,
        },
        { status: 413 }
      );
    }

    if (ownerId) {
      const storageLimit = isPlusAccount ? PLUS_STORAGE_LIMIT_BYTES : FREE_API_STORAGE_LIMIT_BYTES;
      const used = await getAccountApiStorageUsage(ownerId, isPlusAccount);
      if (used + file.size > storageLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `Storage limit exceeded: ${used} of ${storageLimit} bytes used, this upload needs ${file.size} more.`,
          },
          { status: 507 }
        );
      }
    }

    const objectKey = buildApiObjectKey(ownerId, file.name);
    const contentType = file.type || 'application/octet-stream';

    const uploadUrl = await createPresignedUploadUrl({ objectKey, contentType, expiresInSeconds: 60 });
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: await file.arrayBuffer(),
    });

    if (!putRes.ok) {
      return NextResponse.json({ success: false, error: 'Failed to store file' }, { status: 502 });
    }

    const record = await createFileRecord({
      objectKey,
      name: file.name,
      size: file.size,
      mimeType: contentType,
      folderId: typeof folderId === 'string' && folderId ? folderId : null,
      ownerId,
      expiresAt: ownerId ? null : Date.now() + ANON_EXPIRY_MS,
    });

    const downloadUrl = await createPresignedDownloadUrl({ objectKey, expiresInSeconds: 24 * 60 * 60 });
    const viewUrl = new URL(`/i/${record.shortId}`, request.nextUrl.origin).toString();

    if (auth.success) {
      dispatchFileWebhook(auth.apiKey!, 'file.created', {
        id: record.id,
        name: record.name,
        size: record.size,
        mimeType: record.mimeType,
        shortId: record.shortId,
      });
    }

    if (isPlusAccount && ownerId) {
      await syncPlusApiUpload({
        plusUserId: ownerId,
        plusEmail: auth.apiKey?.email,
        url: viewUrl,
        filename: file.name,
        size: file.size,
      });
    }

    return NextResponse.json({
      success: true,
      data: toApiFileResponse(record, downloadUrl, viewUrl),
    });
  } catch (error) {
    console.error('Files upload error:', error);
    return NextResponse.json({ success: false, error: 'Failed to upload file' }, { status: 500 });
  }
}
