import { NextRequest, NextResponse } from 'next/server';
import { deleteObject, toObjectKeyFromAppUrl } from '@/app/lib/storage/r2-storage';
import { removeUploadUrls, updateUploadRecordsByUrls } from '@/app/lib/data/upload-history-store';

export const dynamic = 'force-dynamic';

type BulkAction = 'delete' | 'move' | 'favorite' | 'tag';

const MAX_URLS_PER_REQUEST = 200;
const MAX_TAG_LENGTH = 40;

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
        removeUploadUrls(urls, 'premium'),
      ]);
      return NextResponse.json({ success: true, data: { deleted } });
    }

    if (action === 'move') {
      const folderRaw = body?.folder;
      const folder = folderRaw === null || folderRaw === undefined ? undefined : String(folderRaw).trim() || undefined;
      const [publicCount, premiumCount] = await Promise.all([
        updateUploadRecordsByUrls(urls, (r) => ({ ...r, folder, updatedAt: Date.now() }), 'public'),
        updateUploadRecordsByUrls(urls, (r) => ({ ...r, folder, updatedAt: Date.now() }), 'premium'),
      ]);
      return NextResponse.json({ success: true, data: { updated: publicCount + premiumCount } });
    }

    if (action === 'favorite') {
      const favorite = Boolean(body?.favorite);
      const [publicCount, premiumCount] = await Promise.all([
        updateUploadRecordsByUrls(urls, (r) => ({ ...r, favorite, updatedAt: Date.now() }), 'public'),
        updateUploadRecordsByUrls(urls, (r) => ({ ...r, favorite, updatedAt: Date.now() }), 'premium'),
      ]);
      return NextResponse.json({ success: true, data: { updated: publicCount + premiumCount } });
    }

    if (action === 'tag') {
      const newTags: string[] = Array.isArray(body?.tags)
        ? body.tags.filter((t: unknown): t is string => typeof t === 'string').map((t: string) => t.trim().slice(0, MAX_TAG_LENGTH)).filter(Boolean)
        : [];
      if (newTags.length === 0) {
        return NextResponse.json({ error: 'tags are required' }, { status: 400 });
      }
      const mergeTags = (r: Parameters<Parameters<typeof updateUploadRecordsByUrls>[1]>[0]) => ({
        ...r,
        tags: Array.from(new Set([...(r.tags || []), ...newTags])).slice(0, 20),
        updatedAt: Date.now(),
      });
      const [publicCount, premiumCount] = await Promise.all([
        updateUploadRecordsByUrls(urls, mergeTags, 'public'),
        updateUploadRecordsByUrls(urls, mergeTags, 'premium'),
      ]);
      return NextResponse.json({ success: true, data: { updated: publicCount + premiumCount } });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Bulk action error:', error);
    return NextResponse.json({ error: 'Bulk action failed' }, { status: 500 });
  }
}
