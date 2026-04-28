import { getRedisClient, hasRedisConfigured } from '@/app/lib/data/redis-client';

export type FileAliasRecord = {
  objectKey: string;
  createdAt: number;
};

const KEY_PREFIX = 'file:alias:';

function getGlobalStore(): Record<string, FileAliasRecord> {
  if (typeof global.fileAliasStore === 'undefined') {
    global.fileAliasStore = {};
  }
  return global.fileAliasStore;
}

export async function loadAliasRecord(aliasKey: string): Promise<FileAliasRecord | null> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(`${KEY_PREFIX}${aliasKey}`);
    if (!raw) return null;
    return JSON.parse(raw) as FileAliasRecord;
  }

  const store = getGlobalStore();
  return store[aliasKey] || null;
}

export async function saveAliasRecord(aliasKey: string, objectKey: string, createdAt = Date.now()): Promise<void> {
  const record: FileAliasRecord = { objectKey, createdAt };

  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(`${KEY_PREFIX}${aliasKey}`, JSON.stringify(record));
    return;
  }

  const store = getGlobalStore();
  store[aliasKey] = record;
}

export async function resolveAliasObjectKey(aliasKey: string): Promise<string | null> {
  const record = await loadAliasRecord(aliasKey);
  return record?.objectKey || null;
}

declare global {
  // eslint-disable-next-line no-var
  var fileAliasStore: Record<string, FileAliasRecord> | undefined;
}
