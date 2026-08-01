import { addUploadRecord, type UploadRecord } from '@/app/lib/data/upload-history-store';
import { getOrCreateFolderByName } from '@/app/lib/data/folder-store';
import { RETENTION_MS } from '@/app/lib/storage/retention';

export const API_UPLOADS_FOLDER_NAME = 'API Uploads';

// Plus API uploads (app/api/files/upload, remote-upload, multipart/complete)
// are stored in api-file-store for the REST API's own id/shortId scheme, but
// are ALSO mirrored here into upload-history-store so they: (1) show up in
// the Plus dashboard under a dedicated "API Uploads" folder, and (2) count
// toward the same 80GB vault total the dashboard already computes from this
// store (see getPlusStorageUsedBytes) - one shared pool, not a second one.
// Best-effort: a failure here shouldn't fail the upload itself, since the
// file is already safely stored and recorded in api-file-store.
export async function syncPlusApiUpload(input: {
  plusUserId: string;
  plusEmail?: string;
  url: string;
  filename: string;
  size: number;
}): Promise<void> {
  try {
    const folder = await getOrCreateFolderByName('API Uploads');
    const now = Date.now();
    const record: UploadRecord = {
      url: input.url,
      filename: input.filename,
      size: input.size,
      timestamp: now,
      lastAccessTime: now,
      expiresAt: now + RETENTION_MS,
      ownerId: input.plusUserId,
      ownerEmail: input.plusEmail,
      folder: folder.id,
      kind: 'file',
    };
    await addUploadRecord(record, 'plus');
  } catch (err) {
    console.error('Failed to sync API upload into Plus dashboard history:', err);
  }
}
