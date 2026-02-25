import { del } from '@vercel/blob';
import { loadUploadHistory, saveUploadHistory, type UploadHistoryScope } from '@/app/lib/upload-history-store';

const DAY_MS = 24 * 60 * 60 * 1000;

export const RETENTION_DAYS = 15;
export const RETENTION_MS = RETENTION_DAYS * DAY_MS;
const HISTORY_SCOPES: UploadHistoryScope[] = ['public', 'premium'];

export function isExpired(lastAccessTime: number, now = Date.now()): boolean {
  return now - lastAccessTime >= RETENTION_MS;
}

export async function deleteExpiredBlobs(now = Date.now()): Promise<{ deleted: number; scanned: number }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { deleted: 0, scanned: 0 };
  }

  let deleted = 0;
  let scanned = 0;
  const urlsToDelete: string[] = [];

  for (const scope of HISTORY_SCOPES) {
    const history = await loadUploadHistory(scope);
    if (history.length === 0) {
      continue;
    }

    scanned += history.length;

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

export async function pruneExpiredHistoryCache(
  now = Date.now(),
  scope?: UploadHistoryScope
): Promise<number> {
  const scopes = scope ? [scope] : HISTORY_SCOPES;
  let totalRemoved = 0;

  for (const currentScope of scopes) {
    const history = await loadUploadHistory(currentScope);
    if (history.length === 0) {
      continue;
    }

    const filtered = history.filter((record) => !isExpired(record.lastAccessTime, now));
    if (filtered.length !== history.length) {
      await saveUploadHistory(filtered, currentScope);
      totalRemoved += history.length - filtered.length;
    }
  }

  return totalRemoved;
}

export async function updateLastAccessTime(url: string): Promise<void> {
  for (const scope of HISTORY_SCOPES) {
    const history = await loadUploadHistory(scope);
    if (history.length === 0) {
      continue;
    }

    const updated = history.map((record) => {
      if (record.url === url || record.url.includes(url)) {
        return { ...record, lastAccessTime: Date.now() };
      }
      return record;
    });

    await saveUploadHistory(updated, scope);
  }
}
