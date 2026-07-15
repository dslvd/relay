import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/app/lib/auth/api-auth';
import { listFolders } from '@/app/lib/data/folder-store';
import { countFilesInFolder } from '@/app/lib/data/api-file-store';

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

// GET /api/folders/list - list folders (rootz-compatible).
// Relay's folders are a flat, unowned list (no parent/hierarchy yet), so
// parent_id is always null and a non-root parentId returns an empty page.
export async function GET(request: NextRequest) {
  return withApiAuth(request, 'list', async () => {
    const searchParams = request.nextUrl.searchParams;
    const parentId = searchParams.get('parentId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const search = searchParams.get('search')?.trim().toLowerCase() || '';

    // Only root (parentId omitted or "null") has any folders in our flat model.
    if (parentId && parentId !== 'null') {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 1 },
      });
    }

    let folders = await listFolders();
    if (search) {
      folders = folders.filter((f) => f.name.toLowerCase().includes(search));
    }

    const total = folders.length;
    const start = (page - 1) * limit;
    const paged = folders.slice(start, start + limit);

    const data = await Promise.all(
      paged.map(async (folder) => {
        const base = {
          id: folder.id,
          name: folder.name,
          parent_id: null,
          created_at: toIso(folder.createdAt),
          updated_at: toIso(folder.updatedAt ?? folder.createdAt),
        };

        if (search) {
          return base;
        }

        const { count, totalSize } = await countFilesInFolder(folder.id);
        return { ...base, file_count: count, total_size: totalSize };
      })
    );

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  });
}
