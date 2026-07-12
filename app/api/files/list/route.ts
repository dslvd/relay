import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/app/lib/api-auth';
import { listFileRecordsByOwner } from '@/app/lib/data/api-file-store';
import { listFolders } from '@/app/lib/data/folder-store';

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

// GET /api/files/list - list files (and optionally folders) owned by the authenticated API key
export async function GET(request: NextRequest) {
  return withApiAuth(request, 'list', async (apiKey) => {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const folderIdParam = searchParams.get('folderId');
    const includeFolders = searchParams.get('includeFolders') !== 'false';

    const folderId = folderIdParam === null ? undefined : folderIdParam === 'null' ? null : folderIdParam;

    const { records, total } = await listFileRecordsByOwner({
      ownerId: apiKey.id,
      folderId,
      page,
      limit,
    });

    const data = records.map((record) => ({
      id: record.id,
      name: record.name,
      size: record.size,
      mime_type: record.mimeType,
      path: record.objectKey,
      short_id: record.shortId,
      folder_id: record.folderId,
      owner_id: record.ownerId,
      is_anonymous: record.isAnonymous,
      expires_at: record.expiresAt ? toIso(record.expiresAt) : null,
      created_at: toIso(record.createdAt),
      updated_at: toIso(record.createdAt),
      download_count: record.downloadCount,
    }));

    const response: Record<string, unknown> = {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };

    // Our folders are a flat, unowned list (no parent/hierarchy support yet) -
    // only surfaced when listing the root, matching rootz's root-listing behavior.
    if (includeFolders && (folderId === undefined || folderId === null)) {
      const folders = await listFolders();
      response.folders = folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        parent_id: null,
        owner_id: null,
        created_at: toIso(folder.createdAt),
        updated_at: toIso(folder.updatedAt ?? folder.createdAt),
      }));
    }

    return NextResponse.json(response);
  });
}
