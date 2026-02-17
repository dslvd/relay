import { del, list } from '@vercel/blob';

const DAY_MS = 24 * 60 * 60 * 1000;

export const RETENTION_DAYS = 7;
export const RETENTION_MS = RETENTION_DAYS * DAY_MS;

export function isExpired(timestamp: number, now = Date.now()): boolean {
  return now - timestamp >= RETENTION_MS;
}

export async function deleteExpiredBlobs(now = Date.now()): Promise<{ deleted: number; scanned: number }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { deleted: 0, scanned: 0 };
  }

  const cutoff = now - RETENTION_MS;
  let cursor: string | undefined;
  let hasMore = true;
  let deleted = 0;
  let scanned = 0;

  while (hasMore) {
    let response;

    try {
      response = await list({
        limit: 1000,
        cursor
      });
    } catch (error) {
      console.warn('Skipping retention cleanup: missing or invalid blob token.', error);
      return { deleted, scanned };
    }

    for (const blob of response.blobs) {
      scanned += 1;
      const uploadedAtMs = new Date(blob.uploadedAt).getTime();

      if (Number.isFinite(uploadedAtMs) && uploadedAtMs < cutoff) {
        await del(blob.url);
        deleted += 1;
      }
    }

    cursor = response.cursor;
    hasMore = response.hasMore;

    if (!hasMore) {
      break;
    }
  }

  return { deleted, scanned };
}

export function pruneExpiredHistoryCache(now = Date.now()): number {
  const holder = global as { uploadHistory?: Array<{ timestamp: number }> };

  if (!holder.uploadHistory) {
    return 0;
  }

  const before = holder.uploadHistory.length;
  const filtered = holder.uploadHistory.filter((record) => !isExpired(record.timestamp, now));

  if (filtered.length !== before) {
    holder.uploadHistory = filtered;
  }

  return before - filtered.length;
}
