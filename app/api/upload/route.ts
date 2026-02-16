import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { deleteExpiredBlobs, pruneExpiredHistoryCache } from '@/app/lib/retention';

const MAX_UPLOADS_PER_HOUR = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_FILE_BYTES = 100 * 1024 * 1024;

type RateEntry = {
  windowStart: number;
  count: number;
};

export async function POST(request: Request) {
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

  const body = await request.json();

  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname) => {
      return {
        // optional but recommended
        addRandomSuffix: false,
        allowOverwrite: true,
        // set limits (adjust if you want)
        maximumSizeInBytes: MAX_FILE_BYTES,
        // allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'], // uncomment if you want to restrict

        tokenPayload: JSON.stringify({ pathname }),
      };
    },
    onUploadCompleted: async ({ blob }) => {
      console.log('Upload completed:', blob.url);
      await deleteExpiredBlobs();
      pruneExpiredHistoryCache();
    },
  });

  return NextResponse.json(jsonResponse);
}

declare global {
  var uploadRateLimit: Record<string, RateEntry> | undefined;
}
