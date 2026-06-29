import { NextRequest, NextResponse } from 'next/server';
import { deleteExpiredBlobs, pruneExpiredHistoryCache } from '@/app/lib/storage/retention';
import { createMultipartUpload, normalizeObjectKey } from '@/app/lib/storage/r2-storage';
import { getPremiumUserFromSession } from '@/app/lib/auth/premium-auth';
import { isBlacklisted } from '@/app/lib/data/abuse-store';

const MAX_UPLOADS_PER_HOUR = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const FREE_MAX_FILE_BYTES = 100 * 1024 * 1024;
const PREMIUM_MAX_FILE_BYTES = 500 * 1024 * 1024;
const PREMIUM_COOKIE_NAME = 'premium_auth';

const MIN_PART_SIZE = 5 * 1024 * 1024;
const DEFAULT_PART_SIZE = 8 * 1024 * 1024;

type RateEntry = { windowStart: number; count: number };

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown';

  if (typeof global.multipartRateLimit === 'undefined') {
    global.multipartRateLimit = {};
  }

  const now = Date.now();
  const entry: RateEntry = global.multipartRateLimit[ip] || { windowStart: now, count: 0 };
  if (now - entry.windowStart > RATE_WINDOW_MS) {
    entry.windowStart = now;
    entry.count = 0;
  }
  if (entry.count >= MAX_UPLOADS_PER_HOUR) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }
  entry.count += 1;
  global.multipartRateLimit[ip] = entry;

  try {
    const body = await request.json().catch(() => ({}));
    const pathname = typeof body?.pathname === 'string' ? body.pathname : '';
    const contentType = typeof body?.contentType === 'string' ? body.contentType : undefined;
    const size = Number(body?.size);
    const filename = typeof body?.filename === 'string' ? body.filename : '';

    if (!pathname) {
      return NextResponse.json({ error: 'Invalid pathname' }, { status: 400 });
    }

    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: 'Invalid file size' }, { status: 400 });
    }

    if (await isBlacklisted(ip, filename)) {
      return NextResponse.json({ error: 'Upload blocked' }, { status: 403 });
    }

    const token = request.cookies.get(PREMIUM_COOKIE_NAME)?.value;
    const premiumUser = token ? await getPremiumUserFromSession(token) : null;
    const maxFileBytes = premiumUser ? PREMIUM_MAX_FILE_BYTES : FREE_MAX_FILE_BYTES;
    if (size > maxFileBytes) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const objectKey = normalizeObjectKey(pathname);
    const { uploadId } = await createMultipartUpload({ objectKey, contentType });

    await deleteExpiredBlobs();
    await pruneExpiredHistoryCache();

    return NextResponse.json({
      success: true,
      data: {
        uploadId,
        objectKey,
        partSize: Math.max(MIN_PART_SIZE, DEFAULT_PART_SIZE),
        maxFileBytes,
      },
    });
  } catch (error) {
    console.error('Failed to init multipart upload:', error);
    return NextResponse.json({ error: 'Failed to initialize multipart upload' }, { status: 500 });
  }
}

declare global {
  // eslint-disable-next-line no-var
  var multipartRateLimit: Record<string, RateEntry> | undefined;
}

