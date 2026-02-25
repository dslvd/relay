import { NextResponse } from 'next/server';
import { deleteExpiredBlobs, pruneExpiredHistoryCache } from '@/app/lib/storage/retention';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function POST() {
  try {
    const { deleted, scanned } = await deleteExpiredBlobs();
    const historyPruned = pruneExpiredHistoryCache();

    return NextResponse.json({
      success: true,
      deleted,
      scanned,
      historyPruned
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error cleaning up expired blobs:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup expired blobs' },
      { status: 500 }
    );
  }
}
