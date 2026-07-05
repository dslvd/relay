import { NextRequest, NextResponse } from 'next/server';
import {
  deleteFolder,
  ensureFolderShareCode,
  getFolder,
  renameFolder,
  revokeFolderShareCode,
} from '@/app/lib/data/folder-store';
import { loadUploadHistory, updateUploadRecordsByUrls } from '@/app/lib/data/upload-history-store';

export const dynamic = 'force-dynamic';

// PATCH /api/folders/[id] — rename, or share/unshare (generates or revokes
// the code the public /folder/[shareCode] page is looked up by).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    if (body?.action === 'share') {
      const shareCode = await ensureFolderShareCode(id);
      if (!shareCode) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: { shareCode } });
    }

    if (body?.action === 'unshare') {
      const ok = await revokeFolderShareCode(id);
      if (!ok) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 100) : '';
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const folder = await renameFolder(id, name);
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { folder } });
  } catch (error) {
    console.error('Error updating folder:', error);
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
  }
}

// DELETE /api/folders/[id] — deletes the folder record and clears the
// `folder` field on any files that were in it (files themselves aren't
// touched — only their folder assignment).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await getFolder(id);
    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    for (const scope of ['public', 'premium'] as const) {
      const history = await loadUploadHistory(scope);
      const urls = history.filter((r) => r.folder === id).map((r) => r.url);
      if (urls.length > 0) {
        await updateUploadRecordsByUrls(urls, (record) => ({ ...record, folder: undefined, updatedAt: Date.now() }), scope);
      }
    }

    await deleteFolder(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
