import { NextRequest, NextResponse } from 'next/server';
import { deleteExpiredBlobs, isExpired, pruneExpiredHistoryCache, RETENTION_MS } from '@/app/lib/retention';
import { getPremiumUserFromSession } from '@/app/lib/premium-auth';
import { addUploadRecord, loadUploadHistory, saveUploadHistory, type UploadRecord } from '@/app/lib/upload-history-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const MAX_DAILY_BYTES = 1024 * 1024 * 1024; // 1GB per IP
const MAX_DAILY_UPLOADS = 100;

const PREMIUM_COOKIE_NAME = 'premium_auth';

interface UploadQuota {
  dayStart: number;
  bytes: number;
  count: number;
}

// This would ideally be stored in a database, but for simplicity we'll use persistent storage
// For production, use a database like Vercel KV, PostgreSQL, or similar
export async function GET() {
  try {
    await deleteExpiredBlobs();
    await pruneExpiredHistoryCache();
    // In a real implementation, fetch from database
    // For now, using Vercel KV or similar would be ideal
    
    const history = await loadUploadHistory();
    const filtered = history.filter((record) => !isExpired(record.lastAccessTime));
    if (filtered.length !== history.length) {
      await saveUploadHistory(filtered);
    }

    const publicHistory = filtered.map(({ ownerId, ownerEmail, ...record }) => record);
    
    return NextResponse.json(
      {
        history: publicHistory,
        count: publicHistory.length
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (error) {
    console.error('Error fetching history:', error);
    return NextResponse.json({ 
      history: [],
      error: 'Failed to fetch history' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await deleteExpiredBlobs();
    await pruneExpiredHistoryCache();
    const body = await request.json();
    const { url, filename, size } = body;

    if (!url || !filename) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               'Unknown';

    const now = Date.now();
    const uploadSize = Number(size) || 0;

    if (typeof global.uploadQuota === 'undefined') {
      global.uploadQuota = {};
    }

    const quota = global.uploadQuota[ip] || { dayStart: now, bytes: 0, count: 0 };
    if (now - quota.dayStart > 24 * 60 * 60 * 1000) {
      quota.dayStart = now;
      quota.bytes = 0;
      quota.count = 0;
    }

    if (quota.bytes + uploadSize > MAX_DAILY_BYTES || quota.count + 1 > MAX_DAILY_UPLOADS) {
      return NextResponse.json(
        { error: 'Quota exceeded. Try again later.' },
        { status: 429 }
      );
    }

    const token = request.cookies.get(PREMIUM_COOKIE_NAME)?.value;
    const premiumUser = token ? await getPremiumUserFromSession(token) : null;

    const record: UploadRecord = {
      url,
      filename,
      size: uploadSize,
      timestamp: now,
      lastAccessTime: now, // Initialize with upload time
      expiresAt: now + RETENTION_MS,
      ip,
      ownerId: premiumUser?.id,
      ownerEmail: premiumUser?.email
    };

    quota.bytes += uploadSize;
    quota.count += 1;
    global.uploadQuota[ip] = quota;

    await addUploadRecord(record);

    return NextResponse.json({ 
      success: true,
      record 
    });
  } catch (error) {
    console.error('Error adding to history:', error);
    return NextResponse.json(
      { error: 'Failed to add to history' },
      { status: 500 }
    );
  }
}

// Type declaration for global storage
declare global {
  var uploadQuota: Record<string, UploadQuota> | undefined;
}