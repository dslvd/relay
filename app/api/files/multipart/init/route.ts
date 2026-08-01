import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/lib/auth/api-auth';
import { createMultipartUpload, buildApiObjectKey } from '@/app/lib/storage/r2-storage';
import { getAccountApiStorageUsage } from '@/app/lib/data/api-file-store';
import { isFreeAccountId } from '@/app/lib/auth/api-key-account';
import { checkRateLimit } from '@/app/lib/security/rate-limit';
import { FREE_MAX_FILE_BYTES, PLUS_MAX_FILE_BYTES, FREE_API_STORAGE_LIMIT_BYTES, PLUS_STORAGE_LIMIT_BYTES } from '@/app/lib/plan-limits';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB parts
const ANON_MAX_FILE_BYTES = 25 * 1024 * 1024 * 1024; // 25GB, matches upload/remote-upload's anonymous cap
const ANON_RATE_LIMIT_PER_HOUR = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown'
  );
}

// POST /api/files/multipart/init - start a multipart upload for large files
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
      const rateLimit = await checkRateLimit(`files-multipart-init:${ip}`, ANON_RATE_LIMIT_PER_HOUR, RATE_WINDOW_MS);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded. Anonymous users can start 20 multipart uploads per hour.',
            rateLimitExceeded: true,
            resetAt: new Date(rateLimit.resetAt).toISOString(),
          },
          { status: 429 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const fileName = typeof body?.fileName === 'string' ? body.fileName : '';
    const fileSize = Number(body?.fileSize);
    const fileType = typeof body?.fileType === 'string' ? body.fileType : 'application/octet-stream';

    if (!fileName) {
      return NextResponse.json({ success: false, error: 'fileName is required' }, { status: 400 });
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ success: false, error: 'fileSize must be a positive number' }, { status: 400 });
    }

    // NOTE: fileSize is client-declared - this rejects honest callers over
    // the limit, but a malicious client could under-report it here and then
    // upload more parts than declared, since presigned part URLs are handed
    // out per part (see multipart/batch-urls) without server-side byte
    // accounting against the declared total. Closing that fully would need
    // tracking issued part counts per uploadId; out of scope for now.
    const maxFileBytes = ownerId ? (isPlusAccount ? PLUS_MAX_FILE_BYTES : FREE_MAX_FILE_BYTES) : ANON_MAX_FILE_BYTES;
    if (fileSize > maxFileBytes) {
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
      if (used + fileSize > storageLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `Storage limit exceeded: ${used} of ${storageLimit} bytes used, this upload needs ${fileSize} more.`,
          },
          { status: 507 }
        );
      }
    }

    const objectKey = buildApiObjectKey(ownerId, fileName);

    const { uploadId, objectKey: key } = await createMultipartUpload({ objectKey, contentType: fileType });
    const totalParts = Math.max(1, Math.ceil(fileSize / CHUNK_SIZE));

    return NextResponse.json({
      success: true,
      uploadId,
      key,
      chunkSize: CHUNK_SIZE,
      totalParts,
    });
  } catch (error) {
    console.error('Multipart init error:', error);
    return NextResponse.json({ success: false, error: 'Failed to initialize multipart upload' }, { status: 500 });
  }
}
