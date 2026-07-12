import { randomBytes, randomUUID } from 'crypto';
import { getRedisClient, hasRedisConfigured } from '@/app/lib/data/redis-client';

export interface ApiFileRecord {
  id: string;
  shortId: string;
  objectKey: string;
  name: string;
  size: number;
  mimeType: string;
  folderId: string | null;
  ownerId: string | null;
  isAnonymous: boolean;
  deletionToken: string | null;
  createdAt: number;
  expiresAt: number | null;
  downloadCount: number;
}

const FILES_KEY = 'api:files:list';
const MAX_RECORDS = 5000;
const SHORT_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateShortId(length = 8): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += SHORT_ID_ALPHABET.charAt(Math.floor(Math.random() * SHORT_ID_ALPHABET.length));
  }
  return code;
}

function generateDeletionToken(): string {
  return randomBytes(24).toString('hex');
}

function getFallbackStore(): ApiFileRecord[] {
  if (typeof global.apiFileStore === 'undefined') {
    global.apiFileStore = [];
  }
  return global.apiFileStore;
}

async function readAll(): Promise<ApiFileRecord[]> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(FILES_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ApiFileRecord[];
    } catch {
      return [];
    }
  }
  return [...getFallbackStore()];
}

async function writeAll(records: ApiFileRecord[]): Promise<void> {
  const capped = records.slice(0, MAX_RECORDS);
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(FILES_KEY, JSON.stringify(capped));
    return;
  }
  global.apiFileStore = capped;
}

export async function createFileRecord(input: {
  objectKey: string;
  name: string;
  size: number;
  mimeType: string;
  folderId?: string | null;
  ownerId?: string | null;
  expiresAt?: number | null;
}): Promise<ApiFileRecord> {
  const records = await readAll();
  const isAnonymous = !input.ownerId;

  let shortId = generateShortId();
  const existingShortIds = new Set(records.map((r) => r.shortId));
  while (existingShortIds.has(shortId)) {
    shortId = generateShortId();
  }

  const record: ApiFileRecord = {
    id: randomUUID(),
    shortId,
    objectKey: input.objectKey,
    name: input.name,
    size: input.size,
    mimeType: input.mimeType || 'application/octet-stream',
    folderId: input.folderId ?? null,
    ownerId: input.ownerId ?? null,
    isAnonymous,
    deletionToken: isAnonymous ? generateDeletionToken() : null,
    createdAt: Date.now(),
    expiresAt: input.expiresAt ?? null,
    downloadCount: 0,
  };

  await writeAll([record, ...records]);
  return record;
}

export async function getFileRecordById(id: string): Promise<ApiFileRecord | null> {
  const records = await readAll();
  return records.find((r) => r.id === id) || null;
}

export async function getFileRecordByShortId(shortId: string): Promise<ApiFileRecord | null> {
  const records = await readAll();
  return records.find((r) => r.shortId === shortId) || null;
}

export async function listFileRecordsByOwner(options: {
  ownerId: string;
  folderId?: string | null;
  page?: number;
  limit?: number;
}): Promise<{ records: ApiFileRecord[]; total: number }> {
  const records = await readAll();
  let filtered = records.filter((r) => r.ownerId === options.ownerId);

  if (options.folderId !== undefined) {
    filtered = filtered.filter((r) => r.folderId === options.folderId);
  }

  const total = filtered.length;
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.max(1, Math.min(200, options.limit ?? 50));
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  return { records: paged, total };
}

export async function countFilesInFolder(folderId: string): Promise<{ count: number; totalSize: number }> {
  const records = await readAll();
  const inFolder = records.filter((r) => r.folderId === folderId);
  return {
    count: inFolder.length,
    totalSize: inFolder.reduce((sum, r) => sum + r.size, 0),
  };
}

export async function incrementDownloadCount(id: string): Promise<void> {
  const records = await readAll();
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) return;
  records[index] = { ...records[index], downloadCount: records[index].downloadCount + 1 };
  await writeAll(records);
}

export async function deleteFileRecord(id: string): Promise<ApiFileRecord | null> {
  const records = await readAll();
  const record = records.find((r) => r.id === id);
  if (!record) return null;
  await writeAll(records.filter((r) => r.id !== id));
  return record;
}

declare global {
  var apiFileStore: ApiFileRecord[] | undefined;
}
