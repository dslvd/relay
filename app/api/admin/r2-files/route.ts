import { NextRequest, NextResponse } from 'next/server';
import { listObjectsPage, toObjectKeyFromAppUrl } from '@/app/lib/storage/r2-storage';
import { loadUploadHistory, type UploadRecord } from '@/app/lib/data/upload-history-store';
import { loadQuarantineMap } from '@/app/lib/data/abuse-store';
import { requireAdmin } from '@/app/lib/auth/admin-auth';

// Browses R2 directly rather than the upload-history table, so an object
// that lost its history record (or was never given one) still shows up -
// exactly the case the tracked-history file list can't see.
export async function GET(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const cursor = request.nextUrl.searchParams.get('cursor') || undefined;
  const prefix = request.nextUrl.searchParams.get('prefix') || undefined;

  try {
    const [{ objects, nextCursor }, publicHistory, plusHistory, quarantineMap] = await Promise.all([
      listObjectsPage({ prefix, continuationToken: cursor, maxKeys: 100 }),
      loadUploadHistory('public'),
      loadUploadHistory('plus'),
      loadQuarantineMap(),
    ]);

    // Map every history record to the R2 key(s) it could plausibly point to
    // (see resolveObjectKeyFromAppUrl's doc comment for why there are two
    // candidates) - done once, in memory, against the keys already listed
    // from R2, rather than an existence-check round trip per record.
    const keyToRecord = new Map<string, UploadRecord & { scope: 'public' | 'plus' }>();
    const indexHistory = (history: UploadRecord[], scope: 'public' | 'plus') => {
      for (const record of history) {
        const guessed = toObjectKeyFromAppUrl(record.url);
        if (!guessed) continue;
        const bareKey = guessed.startsWith('d/') ? guessed.slice(2) : guessed;
        keyToRecord.set(guessed, { ...record, scope });
        if (bareKey !== guessed) keyToRecord.set(bareKey, { ...record, scope });
      }
    };
    indexHistory(publicHistory, 'public');
    indexHistory(plusHistory, 'plus');

    const files = objects
      .filter((obj): obj is typeof obj & { Key: string } => Boolean(obj.Key))
      .map((obj) => {
        const record = keyToRecord.get(obj.Key);
        const quarantine = quarantineMap.get(obj.Key);
        return {
          key: obj.Key,
          size: obj.Size ?? 0,
          lastModified: obj.LastModified ? new Date(obj.LastModified).getTime() : null,
          filename: record?.filename || null,
          url: record?.url || null,
          ip: record?.ip || null,
          scope: record?.scope || null,
          tracked: Boolean(record),
          quarantined: Boolean(quarantine),
          quarantineReason: quarantine?.reason || null,
        };
      });

    return NextResponse.json(
      { files, nextCursor: nextCursor || null },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    );
  } catch (error) {
    console.error('R2 file listing error:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
