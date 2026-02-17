import { del, list } from '@vercel/blob';

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

  const holder = global as { uploadHistory?: Array<{ url: string; lastAccessTime: number }> };
  
  if (!holder.uploadHistory) {
    return { deleted: 0, scanned: 0 };
  }

  let deleted = 0;
  const scanned = holder.uploadHistory.length;
  const urlsToDelete: string[] = [];

  // Check each file in history for expiration based on last access time
  for (const record of holder.uploadHistory) {
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

export function pruneExpiredHistoryCache(now = Date.now()): number {
  const holder = global as { uploadHistory?: Array<{ lastAccessTime: number }> };

  if (!holder.uploadHistory) {
    return 0;
  }

  const before = holder.uploadHistory.length;
  const filtered = holder.uploadHistory.filter((record) => !isExpired(record.lastAccessTime, now));

  if (filtered.length !== before) {
    holder.uploadHistory = filtered;
  }

  return before - filtered.length;
}

export function updateLastAccessTime(url: string): void {
  const holder = global as { uploadHistory?: Array<{ url: string; lastAccessTime: number }> };
  
  if (!holder.uploadHistory) {
    return;
  }

  const record = holder.uploadHistory.find(r => r.url === url || r.url.includes(url));
  if (record) {
    record.lastAccessTime = Date.now();
  }
}
