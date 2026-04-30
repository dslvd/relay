import { getRedisClient, hasRedisConfigured } from '@/app/lib/data/redis-client';

export type StorageStats = {
  bytes: number;
  objects: number;
  updatedAt: number;
};

const STORAGE_STATS_KEY = 'admin:storage:stats';

function getGlobalCache(): StorageStats | null {
  if (typeof global.storageStatsCache === 'undefined') {
    global.storageStatsCache = null;
  }
  return global.storageStatsCache;
}

function setGlobalCache(stats: StorageStats | null) {
  global.storageStatsCache = stats;
}

export async function loadCachedStorageStats(ttlMs: number): Promise<StorageStats | null> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(STORAGE_STATS_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as StorageStats;
      if (Date.now() - parsed.updatedAt > ttlMs) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  const cached = getGlobalCache();
  if (!cached) return null;
  if (Date.now() - cached.updatedAt > ttlMs) return null;
  return cached;
}

export async function saveCachedStorageStats(stats: StorageStats, ttlSeconds?: number): Promise<void> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const raw = JSON.stringify(stats);
    if (ttlSeconds && ttlSeconds > 0) {
      await client.set(STORAGE_STATS_KEY, raw, { EX: ttlSeconds });
    } else {
      await client.set(STORAGE_STATS_KEY, raw);
    }
    return;
  }

  setGlobalCache(stats);
}

declare global {
  // eslint-disable-next-line no-var
  var storageStatsCache: StorageStats | null | undefined;
}
