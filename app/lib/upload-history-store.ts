import { getRedisClient, hasRedisConfigured } from '@/app/lib/redis-client';

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
}

const HISTORY_KEY = 'upload:history';
const HISTORY_LIMIT = 100;

function getGlobalHistory(): UploadRecord[] {
  if (typeof global.uploadHistory === 'undefined') {
    global.uploadHistory = [];
  }
  return global.uploadHistory as UploadRecord[];
}

export async function loadUploadHistory(): Promise<UploadRecord[]> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const data = await client.get(HISTORY_KEY);
    return data ? (JSON.parse(data) as UploadRecord[]) : [];
  }

  return [...getGlobalHistory()];
}

export async function saveUploadHistory(history: UploadRecord[]): Promise<void> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(HISTORY_KEY, JSON.stringify(history));
    return;
  }

  global.uploadHistory = history;
}

export async function addUploadRecord(record: UploadRecord): Promise<void> {
  const history = await loadUploadHistory();
  const updated = [record, ...history].slice(0, HISTORY_LIMIT);
  await saveUploadHistory(updated);
}

export async function removeUploadUrls(urls: string[]): Promise<number> {
  const history = await loadUploadHistory();
  const filtered = history.filter((record) => !urls.includes(record.url));
  if (filtered.length !== history.length) {
    await saveUploadHistory(filtered);
  }
  return history.length - filtered.length;
}

export async function updateUploadHistory(update: (history: UploadRecord[]) => UploadRecord[]): Promise<void> {
  const history = await loadUploadHistory();
  const updated = update(history);
  if (updated !== history) {
    await saveUploadHistory(updated);
  }
}

declare global {
  var uploadHistory: UploadRecord[] | undefined;
}
