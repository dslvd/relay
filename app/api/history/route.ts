import { NextRequest, NextResponse } from 'next/server';
import { deleteExpiredBlobs, isExpired, pruneExpiredHistoryCache, pruneMissingHistoryEntries, RETENTION_MS } from '@/app/lib/storage/retention';
import { getPlusUserFromSession } from '@/app/lib/auth/plus-auth';
import { addUploadRecord, loadUploadHistory, saveUploadHistory, updateUploadRecordByUrl, type UploadRecord } from '@/app/lib/data/upload-history-store';
import { isAdminRequest, requireAdmin } from '@/app/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const MAX_DAILY_BYTES = 1024 * 1024 * 1024; // 1GB per IP
const MAX_DAILY_UPLOADS = 100;

const PLUS_COOKIE_NAME = 'plus_auth';

interface UploadQuota {
  dayStart: number;
  bytes: number;
  count: number;
}

function stripOwnershipFields(record: UploadRecord) {
  const {
    url,
    filename,
    timestamp,
    lastAccessTime,
    expiresAt,
    size,
    ip,
    folder,
    tags,
    favorite,
    displayName,
    updatedAt,
  } = record;

  return {
    url,
    filename,
    timestamp,
    lastAccessTime,
    expiresAt,
    size,
    ip,
    folder,
    tags,
    favorite,
    displayName,
    updatedAt,
  };
}

async function runBestEffortHistoryMaintenance(options?: { includePlus?: boolean }) {
  const includePlus = options?.includePlus ?? false;

  const tasks: Promise<unknown>[] = [
    deleteExpiredBlobs(),
    pruneExpiredHistoryCache(),
    pruneMissingHistoryEntries({ scope: 'public' }),
  ];

  if (includePlus) {
    tasks.push(pruneMissingHistoryEntries({ scope: 'plus' }));
  }

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('History maintenance task failed:', result.reason);
    }
  }
}

// This would ideally be stored in a database, but for simplicity we'll use persistent storage
// For production, use a database like Vercel KV, PostgreSQL, or similar
export async function GET(request: NextRequest) {
  try {
    // This endpoint returns raw uploader IPs (see stripOwnershipFields), and no
    // part of the app's own UI reads it — it's an admin/moderation tool only.
    const authError = requireAdmin(request);
    if (authError) return authError;

    const includePlusRequested = request.nextUrl.searchParams.get('includePlus') === '1';
    const includePlus = includePlusRequested && isAdminRequest(request);
    await runBestEffortHistoryMaintenance({ includePlus });

    const publicHistory = await loadUploadHistory('public');
    const publicFiltered = publicHistory.filter((record) => !isExpired(record.lastAccessTime));

    const plusHistory = includePlus ? await loadUploadHistory('plus') : [];
    const plusFiltered = plusHistory.filter((record) => !isExpired(record.lastAccessTime));

    if (publicFiltered.length !== publicHistory.length) {
      await saveUploadHistory(publicFiltered, 'public');
    }

    if (includePlus && plusFiltered.length !== plusHistory.length) {
      await saveUploadHistory(plusFiltered, 'plus');
    }

    const combined = [...publicFiltered, ...plusFiltered]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(stripOwnershipFields);

    return NextResponse.json(
      {
        history: combined,
        count: combined.length,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching history:', error);
    return NextResponse.json(
      {
        history: [],
        error: 'Failed to fetch history',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await runBestEffortHistoryMaintenance();
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

    const token = request.cookies.get(PLUS_COOKIE_NAME)?.value;
    const plusUser = token ? await getPlusUserFromSession(token) : null;

    const record: UploadRecord = {
      url,
      filename,
      size: uploadSize,
      timestamp: now,
      lastAccessTime: now, // Initialize with upload time
      expiresAt: now + RETENTION_MS,
      ip,
      ownerId: plusUser?.id,
      ownerEmail: plusUser?.email
    };

    quota.bytes += uploadSize;
    quota.count += 1;
    global.uploadQuota[ip] = quota;

    await addUploadRecord(record, plusUser ? 'plus' : 'public');

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

// PATCH: update per-file metadata (folder, display name, size after a
// replace-file overwrite). No auth beyond knowing the file's URL — same
// capability model as DELETE /api/delete, which already allows anyone with
// the URL to remove the file outright, so this isn't a new trust boundary.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    const update: Partial<Pick<UploadRecord, 'folder' | 'displayName' | 'size'>> = {};
    let hasUpdate = false;

    if ('size' in body) {
      const size = Number(body.size);
      if (!Number.isFinite(size) || size < 0) {
        return NextResponse.json({ error: 'size must be a non-negative number' }, { status: 400 });
      }
      update.size = size;
      hasUpdate = true;
    }

    if ('folder' in body) {
      update.folder = body.folder === null ? undefined : String(body.folder).trim() || undefined;
      hasUpdate = true;
    }

    if ('displayName' in body) {
      update.displayName = body.displayName === null ? undefined : String(body.displayName).trim().slice(0, 200) || undefined;
      hasUpdate = true;
    }

    if (!hasUpdate) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    const applyUpdate = (record: UploadRecord): UploadRecord => ({
      ...record,
      ...update,
      updatedAt: Date.now(),
    });

    let updated = await updateUploadRecordByUrl(url, applyUpdate, 'public');
    if (!updated) {
      updated = await updateUploadRecordByUrl(url, applyUpdate, 'plus');
    }

    if (!updated) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, record: stripOwnershipFields(updated) });
  } catch (error) {
    console.error('Error updating history record:', error);
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
  }
}

// Type declaration for global storage
declare global {
  var uploadQuota: Record<string, UploadQuota> | undefined;
}
