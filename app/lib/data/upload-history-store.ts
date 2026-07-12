import { getRedisClient, hasRedisConfigured } from '@/app/lib/data/redis-client';

export interface UploadRecord {
  url: string;
  filename: string;
  timestamp: number;
  lastAccessTime: number;
  expiresAt: number;
  size: number;
  ip?: string;
  ownerId?: string;
  ownerEmail?: string;
  folder?: string;
  tags?: string[];
  favorite?: boolean;
  displayName?: string;
  updatedAt?: number;
}

export type UploadHistoryScope = 'public' | 'plus';

const HISTORY_KEY_BY_SCOPE: Record<UploadHistoryScope, string> = {
  public: 'upload:history:public',
  plus: 'upload:history:plus'
};
const LEGACY_HISTORY_KEY = 'upload:history';
const HISTORY_LIMIT = 100;

function getGlobalHistory(scope: UploadHistoryScope): UploadRecord[] {
  if (typeof global.uploadHistoryByScope === 'undefined') {
    global.uploadHistoryByScope = {
      public: [],
      plus: []
    };
  }
  return global.uploadHistoryByScope[scope] as UploadRecord[];
}

export async function loadUploadHistory(scope: UploadHistoryScope = 'public'): Promise<UploadRecord[]> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const data = await client.get(HISTORY_KEY_BY_SCOPE[scope]);
    if (data) {
      return JSON.parse(data) as UploadRecord[];
    }

    if (scope === 'public') {
      const legacy = await client.get(LEGACY_HISTORY_KEY);
      if (legacy) {
        return JSON.parse(legacy) as UploadRecord[];
      }
    }

    return [];
  }

  if (scope === 'public' && typeof global.uploadHistory !== 'undefined') {
    return [...global.uploadHistory];
  }

  return [...getGlobalHistory(scope)];
}

export async function saveUploadHistory(
  history: UploadRecord[],
  scope: UploadHistoryScope = 'public'
): Promise<void> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(HISTORY_KEY_BY_SCOPE[scope], JSON.stringify(history));
    return;
  }

  if (typeof global.uploadHistoryByScope === 'undefined') {
    global.uploadHistoryByScope = {
      public: [],
      plus: []
    };
  }

  global.uploadHistoryByScope[scope] = history;
}

export async function addUploadRecord(
  record: UploadRecord,
  scope: UploadHistoryScope = 'public'
): Promise<void> {
  const history = await loadUploadHistory(scope);
  const updated = [record, ...history].slice(0, HISTORY_LIMIT);
  await saveUploadHistory(updated, scope);
}

export async function removeUploadUrls(
  urls: string[],
  scope: UploadHistoryScope = 'public'
): Promise<number> {
  const history = await loadUploadHistory(scope);
  const filtered = history.filter((record) => !urls.includes(record.url));
  if (filtered.length !== history.length) {
    await saveUploadHistory(filtered, scope);
  }
  return history.length - filtered.length;
}

export async function updateUploadRecordByUrl(
  url: string,
  update: (record: UploadRecord) => UploadRecord | null,
  scope: UploadHistoryScope = 'public'
): Promise<UploadRecord | null> {
  const history = await loadUploadHistory(scope);
  let updatedRecord: UploadRecord | null = null;

  const updatedHistory = history
    .map((record) => {
      if (record.url !== url) {
        return record;
      }

      const nextRecord = update(record);
      if (!nextRecord) {
        return record;
      }

      updatedRecord = nextRecord;
      return nextRecord;
    })
    .filter(Boolean) as UploadRecord[];

  if (updatedRecord) {
    await saveUploadHistory(updatedHistory, scope);
  }

  return updatedRecord;
}

export async function updateUploadRecordsByUrls(
  urls: string[],
  update: (record: UploadRecord) => UploadRecord | null,
  scope: UploadHistoryScope = 'public'
): Promise<number> {
  const history = await loadUploadHistory(scope);
  const targetUrls = new Set(urls);
  let updatedCount = 0;

  const updatedHistory = history
    .map((record) => {
      if (!targetUrls.has(record.url)) {
        return record;
      }

      const nextRecord = update(record);
      if (!nextRecord) {
        return record;
      }

      updatedCount += 1;
      return nextRecord;
    })
    .filter(Boolean) as UploadRecord[];

  if (updatedCount > 0) {
    await saveUploadHistory(updatedHistory, scope);
  }

  return updatedCount;
}

export async function updateUploadHistory(
  update: (history: UploadRecord[]) => UploadRecord[],
  scope: UploadHistoryScope = 'public'
): Promise<void> {
  const history = await loadUploadHistory(scope);
  const updated = update(history);
  if (updated !== history) {
    await saveUploadHistory(updated, scope);
  }
}

declare global {
  var uploadHistory: UploadRecord[] | undefined;
  var uploadHistoryByScope:
    | Record<UploadHistoryScope, UploadRecord[]>
    | undefined;
}
