import { NextRequest, NextResponse } from 'next/server';
import { loadUploadHistory, type UploadRecord } from '@/app/lib/data/upload-history-store';
import { getObjectMetadata } from '@/app/lib/storage/r2-storage';

function findRecordByKey(history: UploadRecord[], key: string): UploadRecord | null {
  for (const record of history) {
    try {
      const parsed = new URL(record.url, 'http://localhost');
      const pathname = parsed.pathname;

      // Prefer exact matches for download URLs.
      if (pathname === `/download/${key}`) return record;
      if (pathname.endsWith(`/download/${key}`)) return record;

      // Back-compat / loose matching.
      if (pathname.includes(key)) return record;
    } catch {
      if (record.url.includes(key)) return record;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get('key')?.trim() || '';
    if (!key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }

    const [publicHistory, premiumHistory] = await Promise.all([
      loadUploadHistory('public'),
      loadUploadHistory('premium'),
    ]);

    const record =
      findRecordByKey(publicHistory, key) ||
      findRecordByKey(premiumHistory, key);

    if (record) {
      return NextResponse.json(
        {
          success: true,
          data: {
            record: {
              url: record.url,
              filename: record.filename,
              timestamp: record.timestamp,
              lastAccessTime: record.lastAccessTime,
              expiresAt: record.expiresAt,
              size: record.size,
            },
          },
        },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }
      );
    }

    // Fallback: object metadata (keeps the download page informative even without history).
    const metadata = await getObjectMetadata(`d/${key}`);
    if (metadata) {
      return NextResponse.json(
        {
          success: true,
          data: {
            record: {
              url: '',
              filename: key.split('/').pop() || key,
              size: metadata.contentLength,
              timestamp: undefined,
              lastAccessTime: undefined,
              expiresAt: undefined,
            },
            metadata,
          },
        },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }
      );
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('Failed to fetch file info:', error);
    return NextResponse.json({ error: 'Failed to fetch file info' }, { status: 500 });
  }
}

