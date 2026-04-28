import { NextRequest, NextResponse } from 'next/server';
import { createPresignedUploadUrl, normalizeObjectKey } from '@/app/lib/storage/r2-storage';
import { deleteExpiredBlobs, pruneExpiredHistoryCache } from '@/app/lib/storage/retention';
import { getPremiumUserFromSession } from '@/app/lib/auth/premium-auth';

const MAX_UPLOADS_PER_HOUR = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const FREE_MAX_FILE_BYTES = 100 * 1024 * 1024;
const PREMIUM_MAX_FILE_BYTES = 500 * 1024 * 1024;
const PREMIUM_COOKIE_NAME = 'premium_auth';

type RateEntry = {
  windowStart: number;
  count: number;
};

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown'
  );
}

function tryGetFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  // Minimal parsing for common `filename="..."` forms.
  const match = header.match(/filename\*?=(?:UTF-8''|\"?)([^\";]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim();
  }
}

function guessExtensionFromContentType(contentType: string | null): string {
  const ct = (contentType || '').toLowerCase().split(';')[0].trim();
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
  };
  return map[ct] || '';
}

function sanitizeFilename(input: string): string {
  // Keep it simple: strip path separators and control chars.
  return input
    .replace(/[/\\]/g, '-')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 180) || 'remote-file';
}

function generateRandomBasename(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let randomName = '';
  for (let i = 0; i < 10; i++) {
    randomName += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return randomName;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  if (typeof global.remoteUploadRateLimit === 'undefined') {
    global.remoteUploadRateLimit = {};
  }

  const now = Date.now();
  const entry = global.remoteUploadRateLimit[ip] || { windowStart: now, count: 0 };
  if (now - entry.windowStart > RATE_WINDOW_MS) {
    entry.windowStart = now;
    entry.count = 0;
  }

  if (entry.count >= MAX_UPLOADS_PER_HOUR) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }

  entry.count += 1;
  global.remoteUploadRateLimit[ip] = entry;

  try {
    const body = await request.json().catch(() => ({}));
    const sourceUrl = typeof body?.url === 'string' ? body.url.trim() : '';
    const filenameOverride = typeof body?.filename === 'string' ? body.filename.trim() : '';
    const extraHeadersRaw = body?.headers && typeof body.headers === 'object' ? body.headers as Record<string, unknown> : null;
    if (!sourceUrl) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(sourceUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'URL must start with http:// or https://' }, { status: 400 });
    }

    const token = request.cookies.get(PREMIUM_COOKIE_NAME)?.value;
    const premiumUser = token ? await getPremiumUserFromSession(token) : null;
    const maxFileBytes = premiumUser ? PREMIUM_MAX_FILE_BYTES : FREE_MAX_FILE_BYTES;

    const allowedHeaderNames = new Set(['authorization', 'cookie', 'referer']);
    const extraHeaders: Record<string, string> = {};
    if (extraHeadersRaw) {
      for (const [k, v] of Object.entries(extraHeadersRaw)) {
        if (!allowedHeaderNames.has(k.toLowerCase())) continue;
        if (typeof v !== 'string') continue;
        const trimmed = v.trim();
        if (!trimmed) continue;
        extraHeaders[k] = trimmed;
      }
    }

    const remoteResponse = await fetch(sourceUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        // Avoid getting compressed bodies so Content-Length, when present, is meaningful.
        'accept-encoding': 'identity',
        'user-agent': 'RelayRemoteUploader/1.0',
        ...extraHeaders,
      },
    });

    if (!remoteResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch remote URL (status ${remoteResponse.status})` },
        { status: 400 }
      );
    }

    const contentType = remoteResponse.headers.get('content-type') || 'application/octet-stream';
    const contentLengthHeader = remoteResponse.headers.get('content-length');
    const declaredSize = contentLengthHeader ? Number(contentLengthHeader) : NaN;

    if (Number.isFinite(declaredSize) && declaredSize > maxFileBytes) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const dispositionName = tryGetFilenameFromContentDisposition(
      remoteResponse.headers.get('content-disposition')
    );
    const urlNameRaw = parsedUrl.pathname.split('/').filter(Boolean).pop() || '';
    const originalFilename = sanitizeFilename(
      filenameOverride || dispositionName || urlNameRaw || 'remote-file'
    );

    const originalExt = originalFilename.includes('.')
      ? `.${originalFilename.split('.').pop()}`
      : '';
    const extension = originalExt || guessExtensionFromContentType(contentType);

    const randomFilename = `${generateRandomBasename()}${extension}`;
    const pathname = `d/${randomFilename}`;
    const objectKey = normalizeObjectKey(pathname);

    const uploadUrl = await createPresignedUploadUrl({
      objectKey,
      contentType,
      expiresInSeconds: 60,
    });

    const bodyStream = remoteResponse.body;
    if (!bodyStream) {
      return NextResponse.json({ error: 'Remote response had no body' }, { status: 400 });
    }

    let streamedBytes = 0;
    const limiter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        streamedBytes += chunk.byteLength;
        if (streamedBytes > maxFileBytes) {
          controller.error(new Error('File too large'));
          return;
        }
        controller.enqueue(chunk);
      },
    });

    const limitedBody = bodyStream.pipeThrough(limiter);

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: limitedBody,
      // Node fetch requires `duplex` when sending a ReadableStream body.
      // @ts-expect-error - not yet in TS lib.dom types in some setups
      duplex: 'half',
    });

    if (!putRes.ok) {
      return NextResponse.json({ error: 'Failed to upload remote file' }, { status: 502 });
    }

    await deleteExpiredBlobs();
    await pruneExpiredHistoryCache();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const downloadUrl = `${baseUrl}/download/${randomFilename}`;

    return NextResponse.json({
      success: true,
      data: {
        url: downloadUrl,
        filename: originalFilename,
        size: Number.isFinite(declaredSize) ? declaredSize : streamedBytes,
        contentType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remote upload';
    const status = message === 'File too large' ? 413 : 500;
    console.error('Remote upload failed:', error);
    return NextResponse.json({ error: message }, { status });
  }
}

declare global {
  // eslint-disable-next-line no-var
  var remoteUploadRateLimit: Record<string, RateEntry> | undefined;
}
