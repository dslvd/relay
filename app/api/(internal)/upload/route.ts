import { NextRequest, NextResponse } from 'next/server';
import { deleteExpiredBlobs, pruneExpiredHistoryCache } from '@/app/lib/storage/retention';
import { createPresignedUploadUrl, normalizeObjectKey } from '@/app/lib/storage/r2-storage';
import { getPlusUserFromSession } from '@/app/lib/auth/plus-auth';
import { isBlacklisted } from '@/app/lib/data/abuse-store';
import { checkRateLimit } from '@/app/lib/security/rate-limit';

const MAX_UPLOADS_PER_HOUR = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const FREE_MAX_FILE_BYTES = 100 * 1024 * 1024;
const PLUS_MAX_FILE_BYTES = 500 * 1024 * 1024;
const PLUS_COOKIE_NAME = 'plus_auth';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown';

  const rateLimit = await checkRateLimit(`upload:${ip}`, MAX_UPLOADS_PER_HOUR, RATE_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const pathname = typeof body?.pathname === 'string' ? body.pathname : '';
    const contentType = typeof body?.contentType === 'string' ? body.contentType : undefined;
    const size = Number(body?.size);
    const filename = typeof body?.filename === 'string' ? body.filename : '';

    if (!pathname || !pathname.startsWith('d/')) {
      return NextResponse.json({ error: 'Invalid pathname' }, { status: 400 });
    }

    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: 'Invalid file size' }, { status: 400 });
    }

    if (await isBlacklisted(ip, filename)) {
      return NextResponse.json({ error: 'Upload blocked' }, { status: 403 });
    }

    const token = request.cookies.get(PLUS_COOKIE_NAME)?.value;
    const plusUser = token ? await getPlusUserFromSession(token) : null;
    const maxFileBytes = plusUser ? PLUS_MAX_FILE_BYTES : FREE_MAX_FILE_BYTES;

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
