import {
  loadUploadHistory,
  removeUploadUrls,
  touchLastAccessTime,
  type UploadHistoryScope,
} from '@/app/lib/data/upload-history-store';
import { resolveAliasObjectKey } from '@/app/lib/data/file-alias-store';
import { loadQuarantineMap } from '@/app/lib/data/abuse-store';
import { deleteObject, objectExists, toObjectKeyFromAppUrl } from '@/app/lib/storage/r2-storage';

const DAY_MS = 24 * 60 * 60 * 1000;

export const RETENTION_DAYS = 15;
export const RETENTION_MS = RETENTION_DAYS * DAY_MS;
const HISTORY_SCOPES: UploadHistoryScope[] = ['public', 'plus'];
const EXISTENCE_CHECK_INTERVAL_MS = 10 * 60 * 1000;

async function resolveObjectKeyFromAppUrl(url: string): Promise<string | null> {
  const objectKey = toObjectKeyFromAppUrl(url);
  if (!objectKey) return null;
  const key = objectKey.startsWith('d/') ? objectKey.slice(2) : objectKey;
  const aliasTarget = await resolveAliasObjectKey(key);
  return aliasTarget || objectKey;
}

export async function pruneMissingHistoryEntries(input?: {
  now?: number;
  scope?: UploadHistoryScope;
  force?: boolean;
}): Promise<number> {
  const now = input?.now ?? Date.now();
  const scopes = input?.scope ? [input.scope] : HISTORY_SCOPES;
  const force = input?.force ?? false;
  let totalRemoved = 0;

  if (typeof global.lastHistoryExistenceCheckByScope === 'undefined') {
    global.lastHistoryExistenceCheckByScope = {
      public: 0,
      plus: 0,
    };
  }

  for (const currentScope of scopes) {
    const lastCheck = global.lastHistoryExistenceCheckByScope[currentScope] || 0;
    if (!force && now - lastCheck < EXISTENCE_CHECK_INTERVAL_MS) {
      continue;
    }

    const history = await loadUploadHistory(currentScope);
    if (history.length === 0) {
      global.lastHistoryExistenceCheckByScope[currentScope] = now;
      continue;
    }

    const missingUrls: string[] = [];
    await Promise.all(
      history.map(async (record) => {
        const objectKey = await resolveObjectKeyFromAppUrl(record.url);
        const exists = objectKey ? await objectExists(objectKey) : false;
        if (!exists) missingUrls.push(record.url);
      })
    );

    if (missingUrls.length > 0) {
      const removed = await removeUploadUrls(missingUrls, currentScope);
      totalRemoved += removed;
    }

    global.lastHistoryExistenceCheckByScope[currentScope] = now;
  }

  return totalRemoved;
}

export function isExpired(lastAccessTime: number, now = Date.now()): boolean {
  return now - lastAccessTime >= RETENTION_MS;
}

export async function deleteExpiredBlobs(now = Date.now()): Promise<{ deleted: number; scanned: number }> {
  if (!process.env.R2_BUCKET) {
    return { deleted: 0, scanned: 0 };
  }

  let deleted = 0;
  let scanned = 0;
  const objectStatus = new Map<string, { anyActive: boolean }>();
  const quarantineMap = await loadQuarantineMap();

  for (const scope of HISTORY_SCOPES) {
    const history = await loadUploadHistory(scope);
    if (history.length === 0) {
      continue;
    }

    scanned += history.length;

    // Check each file in history for expiration based on last access time.
    for (const record of history) {
      const objectKey = await resolveObjectKeyFromAppUrl(record.url);
      if (!objectKey) {
        continue;
      }
      const state = objectStatus.get(objectKey) || { anyActive: false };
      if (!isExpired(record.lastAccessTime, now)) {
        state.anyActive = true;
      }
      objectStatus.set(objectKey, state);
    }
  }

  const keysToDelete = Array.from(objectStatus.entries())
    .filter(([objectKey, state]) => !state.anyActive && !quarantineMap.has(objectKey))
    .map(([objectKey]) => objectKey);

  for (const objectKey of keysToDelete) {
    try {
      await deleteObject(objectKey);
      deleted += 1;
    } catch (error) {
      console.error('Failed to delete object:', objectKey, error);
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
  const quarantineMap = await loadQuarantineMap();

  for (const currentScope of scopes) {
    const history = await loadUploadHistory(currentScope);
    if (history.length === 0) {
      continue;
    }

    const urlsToRemove: string[] = [];
    await Promise.all(
      history.map(async (record) => {
        if (!isExpired(record.lastAccessTime, now)) return;
        const objectKey = await resolveObjectKeyFromAppUrl(record.url);
        if (objectKey && quarantineMap.has(objectKey)) return;
        urlsToRemove.push(record.url);
      })
    );

    if (urlsToRemove.length > 0) {
      const removed = await removeUploadUrls(urlsToRemove, currentScope);
      totalRemoved += removed;
    }
  }

  return totalRemoved;
}

export async function updateLastAccessTime(url: string): Promise<void> {
  await touchLastAccessTime(url);
}

declare global {
  var lastHistoryExistenceCheckByScope:
    | Record<UploadHistoryScope, number>
    | undefined;
}
