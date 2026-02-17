import { NextRequest, NextResponse } from 'next/server';
import { deleteExpiredBlobs, isExpired, pruneExpiredHistoryCache, RETENTION_MS } from '@/app/lib/retention';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const MAX_DAILY_BYTES = 1024 * 1024 * 1024; // 1GB per IP
const MAX_DAILY_UPLOADS = 100;

interface UploadRecord {
  url: string;
  filename: string;
  timestamp: number;
  lastAccessTime: number;
  expiresAt: number;
  size: number;
  ip?: string;
}

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
    pruneExpiredHistoryCache();
    // In a real implementation, fetch from database
    // For now, using Vercel KV or similar would be ideal
    
    const history = await getHistoryFromStorage();
    
    return NextResponse.json(
      {
        history,
        count: history.length
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
    pruneExpiredHistoryCache();
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

    const record: UploadRecord = {
      url,
      filename,
      size: uploadSize,
      timestamp: now,
      lastAccessTime: now, // Initialize with upload time
      expiresAt: now + RETENTION_MS,
      ip
    };

    quota.bytes += uploadSize;
    quota.count += 1;
    global.uploadQuota[ip] = quota;

    await addToHistory(record);

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

// Storage helper functions
// Replace these with actual database calls in production

async function getHistoryFromStorage(): Promise<UploadRecord[]> {
  // For production, use Vercel KV:
  // const kv = createClient({ ... });
  // const history = await kv.get('upload_history') || [];
  // return history;
  
  // Or use Vercel Postgres:
  // const { rows } = await sql`SELECT * FROM uploads ORDER BY timestamp DESC LIMIT 100`;
  // return rows;
  
  // Temporary in-memory storage (resets on deployment)
  if (typeof global.uploadHistory === 'undefined') {
    global.uploadHistory = [];
  }

  const history = global.uploadHistory as UploadRecord[];
  const filtered = history.filter((record) => !isExpired(record.timestamp));

  if (filtered.length !== history.length) {
    global.uploadHistory = filtered;
  }

  return filtered
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100);
}

async function addToHistory(record: UploadRecord): Promise<void> {
  // For production, use Vercel KV:
  // const kv = createClient({ ... });
  // const history = await kv.get('upload_history') || [];
  // history.unshift(record);
  // await kv.set('upload_history', history.slice(0, 100));
  
  // Or use Vercel Postgres:
  // await sql`INSERT INTO uploads (url, filename, size, timestamp) VALUES (${record.url}, ${record.filename}, ${record.size}, ${record.timestamp})`;
  
  // Temporary in-memory storage
  if (typeof global.uploadHistory === 'undefined') {
    global.uploadHistory = [];
  }
  
  (global.uploadHistory as UploadRecord[]).unshift(record);
  
  // Keep only last 100
  if ((global.uploadHistory as UploadRecord[]).length > 100) {
    global.uploadHistory = (global.uploadHistory as UploadRecord[]).slice(0, 100);
  }
}

// Type declaration for global storage
declare global {
  var uploadHistory: UploadRecord[] | undefined;
  var uploadQuota: Record<string, UploadQuota> | undefined;
}