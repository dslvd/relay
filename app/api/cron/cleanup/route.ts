import { NextRequest, NextResponse } from 'next/server';
import { deleteExpiredBlobs, pruneExpiredHistoryCache, pruneMissingHistoryEntries } from '@/app/lib/retention';

// This route is called by Vercel Cron Jobs
// Schedule: Daily at midnight UTC (00:00)
export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('[CRON] Starting scheduled cleanup at', new Date().toISOString());
    
    // Delete expired blobs from Vercel storage
    const { deleted, scanned } = await deleteExpiredBlobs();
    
    // Prune expired entries from in-memory history cache
    const prunedFromCache = await pruneExpiredHistoryCache();

    // Remove history records for files that no longer exist in blob storage
    const prunedMissingFiles = await pruneMissingHistoryEntries({ force: true });
    
    console.log('[CRON] Cleanup complete:', {
      blobsDeleted: deleted,
      blobsScanned: scanned,
      cacheEntriesRemoved: prunedFromCache,
      missingFilesRemoved: prunedMissingFiles,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      blobsDeleted: deleted,
      blobsScanned: scanned,
      cacheEntriesRemoved: prunedFromCache,
      missingFilesRemoved: prunedMissingFiles,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[CRON] Cleanup failed:', error);
    return NextResponse.json(
      { 
        error: 'Cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
