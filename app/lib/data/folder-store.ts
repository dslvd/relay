import { getRedisClient, hasRedisConfigured } from '@/app/lib/data/redis-client';

export type FolderRecord = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt?: number;
  // Present once the folder has been shared — the public /folder/[shareCode]
  // page looks folders up by this instead of the internal id.
  shareCode?: string;
};

const FOLDERS_KEY = 'folders:list';
const MAX_FOLDERS = 500;

function getGlobalFolders(): FolderRecord[] {
  if (typeof global.folderStore === 'undefined') {
    global.folderStore = [];
  }
  return global.folderStore;
}

async function readAll(): Promise<FolderRecord[]> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(FOLDERS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as FolderRecord[];
    } catch {
      return [];
    }
  }
  return getGlobalFolders();
}

async function writeAll(folders: FolderRecord[]): Promise<void> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(FOLDERS_KEY, JSON.stringify(folders.slice(0, MAX_FOLDERS)));
    return;
  }
  global.folderStore = folders.slice(0, MAX_FOLDERS);
}

export async function listFolders(): Promise<FolderRecord[]> {
  return readAll();
}

export async function getFolder(id: string): Promise<FolderRecord | null> {
  const folders = await readAll();
  return folders.find((f) => f.id === id) || null;
}

export async function getFolderByShareCode(shareCode: string): Promise<FolderRecord | null> {
  const folders = await readAll();
  return folders.find((f) => f.shareCode === shareCode) || null;
}

export async function createFolder(name: string): Promise<FolderRecord> {
  const folders = await readAll();
  const record: FolderRecord = {
    id: `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: Date.now(),
  };
  await writeAll([record, ...folders]);
  return record;
}

export async function renameFolder(id: string, name: string): Promise<FolderRecord | null> {
  const folders = await readAll();
  let updated: FolderRecord | null = null;
  const next = folders.map((f) => {
    if (f.id !== id) return f;
    updated = { ...f, name, updatedAt: Date.now() };
    return updated;
  });
  if (!updated) return null;
  await writeAll(next);
  return updated;
}

export async function deleteFolder(id: string): Promise<boolean> {
  const folders = await readAll();
  const next = folders.filter((f) => f.id !== id);
  if (next.length === folders.length) return false;
  await writeAll(next);
  return true;
}

/** Generates and persists a share code for a folder, or returns the existing one. */
export async function ensureFolderShareCode(id: string): Promise<string | null> {
  const folders = await readAll();
  const target = folders.find((f) => f.id === id);
  if (!target) return null;
  if (target.shareCode) return target.shareCode;

  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }

  const next = folders.map((f) => (f.id === id ? { ...f, shareCode: code, updatedAt: Date.now() } : f));
  await writeAll(next);
  return code;
}

export async function revokeFolderShareCode(id: string): Promise<boolean> {
  const folders = await readAll();
  let found = false;
  const next = folders.map((f) => {
    if (f.id !== id) return f;
    found = true;
    const { shareCode: _shareCode, ...rest } = f;
    return rest;
  });
  if (!found) return false;
  await writeAll(next);
  return true;
}

declare global {
  // eslint-disable-next-line no-var
  var folderStore: FolderRecord[] | undefined;
}
