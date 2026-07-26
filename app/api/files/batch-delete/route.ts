import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/app/lib/auth/api-auth';
import { deleteObject } from '@/app/lib/storage/r2-storage';
import { getFileRecordById, deleteFileRecord } from '@/app/lib/data/api-file-store';
import { dispatchFileWebhook } from '@/app/lib/webhooks/dispatch';

const MAX_IDS_PER_REQUEST = 100;

// POST /api/files/batch-delete - delete up to 100 files owned by this API key
// in one call. Anonymous/token-owned files aren't covered - use the
// single-file DELETE endpoint with its deletion token for those.
export async function POST(request: NextRequest) {
  return withApiAuth(request, 'delete', async (apiKey) => {
    const body = await request.json().catch(() => ({}));
    const fileIds = Array.isArray(body?.fileIds) ? body.fileIds.filter((id: unknown) => typeof id === 'string') : [];

    if (!fileIds.length) {
      return NextResponse.json({ success: false, error: 'fileIds must be a non-empty array of strings' }, { status: 400 });
    }
    if (fileIds.length > MAX_IDS_PER_REQUEST) {
      return NextResponse.json(
        { success: false, error: `fileIds must contain at most ${MAX_IDS_PER_REQUEST} items` },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      fileIds.map(async (fileId: string) => {
        const record = await getFileRecordById(fileId);
        if (!record) {
          return { fileId, success: false, error: 'File not found' };
        }
        if (record.ownerId !== apiKey.id) {
          return { fileId, success: false, error: 'Unauthorized to delete this file' };
        }

        await deleteObject(record.objectKey);
        await deleteFileRecord(record.id);
        dispatchFileWebhook(apiKey, 'file.deleted', { id: record.id, name: record.name, shortId: record.shortId });

        return { fileId, success: true };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        results,
        deletedCount: results.filter((r) => r.success).length,
      },
    });
  });
}
