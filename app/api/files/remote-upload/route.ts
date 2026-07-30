import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/lib/auth/api-auth';
import { createPresignedUploadUrl, createPresignedDownloadUrl, buildApiObjectKey } from '@/app/lib/storage/r2-storage';
import { createFileRecord, getOwnerStorageUsed } from '@/app/lib/data/api-file-store';
import { getStorageLimit } from '@/app/lib/data/api-key-store';
import { checkRateLimit } from '@/app/lib/security/rate-limit';
import { dispatchFileWebhook } from '@/app/lib/webhooks/dispatch';
import { fetchWithValidatedRedirects } from '@/app/lib/security/ssrf-guard';

const ANON_MAX_FILE_BYTES = 25 * 1024 * 1024 * 1024; // 25GB
const ANON_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches rootz's anonymous remote-upload expiry
const ANON_RATE_LIMIT_PER_HOUR = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown'
  );
}

function sanitizeFilename(input: string): string {
  return input
    .replace(/[/\\]/g, '-')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
    .slice(0, 180) || 'remote-file';
}

// POST /api/files/remote-upload - basic single-shot remote upload (rootz-compatible).
// Large (>5GB) remote-multipart flow is not implemented; see docs for the gap.
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request);
    const ownerId = auth.success ? auth.apiKey!.id : null;

    if (!ownerId) {
      const ip = getClientIp(request);
      const rateLimit = await checkRateLimit(`files-remote-upload:${ip}`, ANON_RATE_LIMIT_PER_HOUR, RATE_WINDOW_MS);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded. Anonymous users can upload 10 files from remote URLs per hour.',
            rateLimitExceeded: true,
            resetAt: new Date(rateLimit.resetAt).toISOString(),
          },
          { status: 429 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const sourceUrl = typeof body?.url === 'string' ? body.url.trim() : '';
    const folderId = typeof body?.folderId === 'string' && body.folderId ? body.folderId : null;

    if (!sourceUrl) {
      return NextResponse.json(
        { success: false, error: 'No URL provided. Please provide a valid URL in the request body.' },
        { status: 400 }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(sourceUrl);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid URL' }, { status: 400 });
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ success: false, error: 'URL must start with http:// or https://' }, { status: 400 });
    }

    const remoteResponse = await fetchWithValidatedRedirects(parsedUrl, {
      method: 'GET',
      headers: {
        'accept-encoding': 'identity',
        'user-agent': 'RelayRemoteUploader/1.0',
      },
    });

    if (!remoteResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to download file from URL', remoteStatus: remoteResponse.status },
        { status: 400 }
      );
    }

    const contentType = remoteResponse.headers.get('content-type') || 'application/octet-stream';
    const contentLengthHeader = remoteResponse.headers.get('content-length');
    const declaredSize = contentLengthHeader ? Number(contentLengthHeader) : NaN;

    const maxFileBytes = ownerId ? Math.max(ANON_MAX_FILE_BYTES, auth.apiKey!.rateLimit.uploadSizeLimit) : ANON_MAX_FILE_BYTES;
    if (Number.isFinite(declaredSize) && declaredSize > maxFileBytes) {
      return NextResponse.json(
        { success: false, error: `Anonymous uploads are limited to ${Math.round(ANON_MAX_FILE_BYTES / (1024 ** 3))}GB. Please create an account for larger files.` },
        { status: 413 }
      );
    }

    let remainingQuota = Infinity;
    if (ownerId) {
      const storageLimit = getStorageLimit(auth.apiKey!);
      const used = await getOwnerStorageUsed(ownerId);
      remainingQuota = storageLimit - used;
      if (remainingQuota <= 0 || (Number.isFinite(declaredSize) && declaredSize > remainingQuota)) {
        return NextResponse.json(
          {
            success: false,
            error: `Storage limit exceeded: ${used} of ${storageLimit} bytes used.`,
          },
          { status: 507 }
        );
      }
    }

    const urlNameRaw = parsedUrl.pathname.split('/').filter(Boolean).pop() || '';
    const fileName = sanitizeFilename(urlNameRaw || 'remote-file');

    const objectKey = buildApiObjectKey(ownerId, fileName);

    const uploadUrl = await createPresignedUploadUrl({ objectKey, contentType, expiresInSeconds: 60 });

    const bodyStream = remoteResponse.body;
    if (!bodyStream) {
      return NextResponse.json({ success: false, error: 'Remote response had no body' }, { status: 400 });
    }

    const streamCap = Math.min(maxFileBytes, remainingQuota);
    let streamedBytes = 0;
    const limiter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        streamedBytes += chunk.byteLength;
        if (streamedBytes > streamCap) {
          controller.error(new Error('File too large'));
          return;
        }
        controller.enqueue(chunk);
      },
    });

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: bodyStream.pipeThrough(limiter),
      // Node fetch requires `duplex` when sending a ReadableStream body.
      // @ts-expect-error - not yet in TS lib.dom types in some setups
      duplex: 'half',
    });

    if (!putRes.ok) {
      return NextResponse.json({ success: false, error: 'Failed to upload remote file' }, { status: 502 });
    }

    const record = await createFileRecord({
      objectKey,
      name: fileName,
      size: Number.isFinite(declaredSize) ? declaredSize : streamedBytes,
      mimeType: contentType,
      folderId,
      ownerId,
      expiresAt: ownerId ? null : Date.now() + ANON_EXPIRY_MS,
    });

    const url = await createPresignedDownloadUrl({ objectKey, expiresInSeconds: 24 * 60 * 60 });

    if (auth.success) {
      dispatchFileWebhook(auth.apiKey!, 'file.created', {
        id: record.id,
        name: record.name,
        size: record.size,
        mimeType: record.mimeType,
        shortId: record.shortId,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: record.id,
        name: record.name,
        size: record.size,
        url,
        mimeType: record.mimeType,
        createdAt: new Date(record.createdAt).toISOString(),
        isAnonymous: record.isAnonymous,
        expiresAt: record.expiresAt ? new Date(record.expiresAt).toISOString() : null,
        shortId: record.shortId,
      },
    });
  } catch (error) {
    console.error('Files remote-upload error:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload from remote URL';
    const status = message.includes('private or reserved') || message.includes('resolve URL host') || message.includes('Redirect target') || message.includes('Too many redirects')
      ? 400
      : 500;
    return NextResponse.json({ success: false, error: status === 400 ? message : 'Failed to upload from remote URL' }, { status });
  }
}
