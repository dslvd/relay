import { NextRequest, NextResponse } from 'next/server';
import { deleteObject, toObjectKeyFromAppUrl } from '@/app/lib/storage/r2-storage';
import { removeUploadUrls, updateUploadRecordsByUrls } from '@/app/lib/data/upload-history-store';

export const dynamic = 'force-dynamic';

type BulkAction = 'delete' | 'move';

const MAX_URLS_PER_REQUEST = 200;

// POST /api/bulk — batched version of the single-file actions each user
// already has (DELETE /api/delete, PATCH /api/history). Same capability
// model as those: knowing a file's URL is what authorizes acting on it,
// there's no separate ownership check. This is the non-admin counterpart to
// /api/admin/bulk, which is for moderators acting on files they don't own.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action as BulkAction;
    const urls = Array.isArray(body?.urls) ? body.urls.filter((u: unknown): u is string => typeof u === 'string') : [];

    if (!action || urls.length === 0) {
      return NextResponse.json({ error: 'action and urls are required' }, { status: 400 });
    }
    if (urls.length > MAX_URLS_PER_REQUEST) {
      return NextResponse.json({ error: `Too many urls (max ${MAX_URLS_PER_REQUEST})` }, { status: 400 });
    }

    if (action === 'delete') {
      let deleted = 0;
      for (const url of urls) {
        const objectKey = toObjectKeyFromAppUrl(url);
        if (!objectKey) continue;
        try {
          await deleteObject(objectKey);
          deleted += 1;
        } catch (err) {
          console.error('Bulk delete failed for', objectKey, err);
        }
      }
      await Promise.all([
        removeUploadUrls(urls, 'public'),
        removeUploadUrls(urls, 'plus'),
      ]);
      return NextResponse.json({ success: true, data: { deleted } });
    }

    if (action === 'move') {
      const folderRaw = body?.folder;
      const folder = folderRaw === null || folderRaw === undefined ? undefined : String(folderRaw).trim() || undefined;
      const [publicCount, plusCount] = await Promise.all([
        updateUploadRecordsByUrls(urls, (r) => ({ ...r, folder, updatedAt: Date.now() }), 'public'),
        updateUploadRecordsByUrls(urls, (r) => ({ ...r, folder, updatedAt: Date.now() }), 'plus'),
      ]);
      return NextResponse.json({ success: true, data: { updated: publicCount + plusCount } });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Bulk action error:', error);
    return NextResponse.json({ error: 'Bulk action failed' }, { status: 500 });
  }
}
