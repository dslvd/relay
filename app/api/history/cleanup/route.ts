import { NextRequest, NextResponse } from 'next/server';
import { pruneExpiredHistoryCache } from '@/app/lib/retention';
import { removeUploadUrls } from '@/app/lib/upload-history-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  try {
    await pruneExpiredHistoryCache(Date.now(), 'public');
    const body = await request.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json(
        { error: 'Invalid request: urls array required' },
        { status: 400 }
      );
    }

    const removed = await removeUploadUrls(urls, 'public');

    return NextResponse.json({ 
      success: true,
      removed
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error cleaning up history:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup history' },
      { status: 500 }
    );
  }
}
