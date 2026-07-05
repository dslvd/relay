import { NextRequest, NextResponse } from 'next/server';
import { getFolderByShareCode } from '@/app/lib/data/folder-store';
import { loadUploadHistory } from '@/app/lib/data/upload-history-store';
import { isExpired } from '@/app/lib/storage/retention';

export const dynamic = 'force-dynamic';

// GET /api/folders/shared/[code] — public, unauthenticated lookup for the
// /folder/[code] page. The share code itself is the capability (same model
// as /s/[code] short links and /d/[key] download pages) — only safe,
// presentational fields are returned, never ip/ownerId/ownerEmail.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const folder = await getFolderByShareCode(code);
    if (!folder) {
      return NextResponse.json({ error: 'Shared folder not found' }, { status: 404 });
    }

    const [publicHistory, premiumHistory] = await Promise.all([
      loadUploadHistory('public'),
      loadUploadHistory('premium'),
    ]);

    const files = [...publicHistory, ...premiumHistory]
      .filter((r) => r.folder === folder.id && !isExpired(r.lastAccessTime))
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((r) => ({
        url: r.url,
        filename: r.displayName || r.filename,
        size: r.size,
        timestamp: r.timestamp,
      }));

    return NextResponse.json(
      { success: true, data: { folder: { name: folder.name }, files } },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    );
  } catch (error) {
    console.error('Error loading shared folder:', error);
    return NextResponse.json({ error: 'Failed to load shared folder' }, { status: 500 });
  }
}
