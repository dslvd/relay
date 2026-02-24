import { del } from '@vercel/blob';
import { loadUploadHistory, saveUploadHistory } from '@/app/lib/upload-history-store';

const DAY_MS = 24 * 60 * 60 * 1000;

export const RETENTION_DAYS = 15;
export const RETENTION_MS = RETENTION_DAYS * DAY_MS;

export function isExpired(lastAccessTime: number, now = Date.now()): boolean {
  return now - lastAccessTime >= RETENTION_MS;
}

export async function deleteExpiredBlobs(now = Date.now()): Promise<{ deleted: number; scanned: number }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { deleted: 0, scanned: 0 };
  }

  const history = await loadUploadHistory();
  if (history.length === 0) {
    return { deleted: 0, scanned: 0 };
  }

  let deleted = 0;
  const scanned = history.length;
  const urlsToDelete: string[] = [];

  // Check each file in history for expiration based on last access time
  for (const record of history) {
    if (isExpired(record.lastAccessTime, now)) {
      // Extract the blob URL from the download URL
      const pathMatch = record.url.match(/\/download\/(.+)$/);
      if (pathMatch) {
        const blobUrl = `https://rcltxppgseuupozb.public.blob.vercel-storage.com/d/${pathMatch[1]}`;
        urlsToDelete.push(blobUrl);
      }
    }
  }

  // Delete expired blobs
  for (const url of urlsToDelete) {
    try {
      await del(url);
      deleted += 1;
    } catch (error) {
      console.error('Failed to delete blob:', url, error);
    }
  }

  return { deleted, scanned };
}

export async function pruneExpiredHistoryCache(now = Date.now()): Promise<number> {
  const history = await loadUploadHistory();
  if (history.length === 0) {
    return 0;
  }

  const filtered = history.filter((record) => !isExpired(record.lastAccessTime, now));
  if (filtered.length !== history.length) {
    await saveUploadHistory(filtered);
  }

  return history.length - filtered.length;
}

export async function updateLastAccessTime(url: string): Promise<void> {
  const history = await loadUploadHistory();
  if (history.length === 0) {
    return;
  }

  const updated = history.map((record) => {
    if (record.url === url || record.url.includes(url)) {
      return { ...record, lastAccessTime: Date.now() };
    }
    return record;
  });

  await saveUploadHistory(updated);
}
