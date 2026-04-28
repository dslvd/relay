import { getRedisClient, hasRedisConfigured } from '@/app/lib/data/redis-client';

export type FileHashRecord = {
  objectKey: string;
  size: number;
  contentType?: string;
  filename?: string;
  createdAt: number;
};

const KEY_PREFIX = 'file:hash:';

function getGlobalStore(): Record<string, FileHashRecord> {
  if (typeof global.fileHashStore === 'undefined') {
    global.fileHashStore = {};
  }
  return global.fileHashStore;
}

export async function loadFileHashRecord(hash: string): Promise<FileHashRecord | null> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(`${KEY_PREFIX}${hash}`);
    if (!raw) return null;
    return JSON.parse(raw) as FileHashRecord;
  }

  const store = getGlobalStore();
  return store[hash] || null;
}

export async function saveFileHashRecord(hash: string, record: FileHashRecord): Promise<void> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(`${KEY_PREFIX}${hash}`, JSON.stringify(record));
    return;
  }

  const store = getGlobalStore();
  store[hash] = record;
}

export async function deleteFileHashRecord(hash: string): Promise<void> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.del(`${KEY_PREFIX}${hash}`);
    return;
  }

  const store = getGlobalStore();
  delete store[hash];
}

declare global {
  // eslint-disable-next-line no-var
  var fileHashStore: Record<string, FileHashRecord> | undefined;
}
