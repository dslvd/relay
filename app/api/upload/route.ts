import { NextRequest, NextResponse } from 'next/server';
import { deleteExpiredBlobs, pruneExpiredHistoryCache } from '@/app/lib/retention';
import { createPresignedUploadUrl, normalizeObjectKey } from '@/app/lib/r2-storage';
import { getPremiumUserFromSession } from '@/app/lib/premium-auth';

const MAX_UPLOADS_PER_HOUR = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const FREE_MAX_FILE_BYTES = 100 * 1024 * 1024;
const PREMIUM_MAX_FILE_BYTES = 500 * 1024 * 1024;
const PREMIUM_COOKIE_NAME = 'premium_auth';

type RateEntry = {
  windowStart: number;
  count: number;
};

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown';

  if (typeof global.uploadRateLimit === 'undefined') {
    global.uploadRateLimit = {};
  }

  const now = Date.now();
  const entry = global.uploadRateLimit[ip] || { windowStart: now, count: 0 };

  if (now - entry.windowStart > RATE_WINDOW_MS) {
    entry.windowStart = now;
    entry.count = 0;
  }

  if (entry.count >= MAX_UPLOADS_PER_HOUR) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429 }
    );
  }

  entry.count += 1;
  global.uploadRateLimit[ip] = entry;

  try {
    const body = await request.json();
    const pathname = typeof body?.pathname === 'string' ? body.pathname : '';
    const contentType = typeof body?.contentType === 'string' ? body.contentType : undefined;
    const size = Number(body?.size);

    if (!pathname || !pathname.startsWith('d/')) {
      return NextResponse.json({ error: 'Invalid pathname' }, { status: 400 });
    }

    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: 'Invalid file size' }, { status: 400 });
    }

    const token = request.cookies.get(PREMIUM_COOKIE_NAME)?.value;
    const premiumUser = token ? await getPremiumUserFromSession(token) : null;
    const maxFileBytes = premiumUser ? PREMIUM_MAX_FILE_BYTES : FREE_MAX_FILE_BYTES;

    if (size > maxFileBytes) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const objectKey = normalizeObjectKey(pathname);
    const uploadUrl = await createPresignedUploadUrl({
      objectKey,
      contentType,
      expiresInSeconds: 60,
    });

    await deleteExpiredBlobs();
    await pruneExpiredHistoryCache();

    return NextResponse.json({
      uploadUrl,
      pathname: objectKey,
      method: 'PUT',
      maxFileBytes,
    });
  } catch (error) {
    console.error('Failed to create upload URL:', error);
    return NextResponse.json({ error: 'Failed to initialize upload' }, { status: 500 });
  }
}

declare global {
  var uploadRateLimit: Record<string, RateEntry> | undefined;
}
