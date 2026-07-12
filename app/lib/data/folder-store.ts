import { getSupabaseClient, hasSupabaseConfigured } from '@/app/lib/data/supabase-client';

export type FolderRecord = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt?: number;
  // Present once the folder has been shared — the public /folder/[shareCode]
  // page looks folders up by this instead of the internal id.
  shareCode?: string;
};

interface FolderRow {
  id: string;
  name: string;
  created_at: number;
  updated_at: number | null;
  share_code: string | null;
}

const MAX_FOLDERS = 500;

function folderFromRow(row: FolderRow): FolderRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    shareCode: row.share_code ?? undefined,
  };
}

function generateFolderId(): string {
  return `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getGlobalFolders(): FolderRecord[] {
  if (typeof global.folderStore === 'undefined') {
    global.folderStore = [];
  }
  return global.folderStore;
}

function saveGlobalFolders(folders: FolderRecord[]): void {
  global.folderStore = folders.slice(0, MAX_FOLDERS);
}

export async function listFolders(): Promise<FolderRecord[]> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('folders').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data as FolderRow[]).map(folderFromRow);
  }

  return [...getGlobalFolders()];
}

export async function getFolder(id: string): Promise<FolderRecord | null> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('folders').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? folderFromRow(data as FolderRow) : null;
  }

  return getGlobalFolders().find((f) => f.id === id) || null;
}

export async function getFolderByShareCode(shareCode: string): Promise<FolderRecord | null> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('folders').select('*').eq('share_code', shareCode).maybeSingle();
    if (error) throw error;
    return data ? folderFromRow(data as FolderRow) : null;
  }

  return getGlobalFolders().find((f) => f.shareCode === shareCode) || null;
}

export async function createFolder(name: string): Promise<FolderRecord> {
  const record: FolderRecord = {
    id: generateFolderId(),
    name,
    createdAt: Date.now(),
  };

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('folders').insert({
      id: record.id,
      name: record.name,
      created_at: record.createdAt,
    });
    if (error) throw error;
    return record;
  }

  saveGlobalFolders([record, ...getGlobalFolders()]);
  return record;
}

export async function renameFolder(id: string, name: string): Promise<FolderRecord | null> {
  const updatedAt = Date.now();

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('folders')
      .update({ name, updated_at: updatedAt })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? folderFromRow(data as FolderRow) : null;
  }

  const folders = getGlobalFolders();
  let updated: FolderRecord | null = null;
  const next = folders.map((f) => {
    if (f.id !== id) return f;
    updated = { ...f, name, updatedAt };
    return updated;
  });
  if (!updated) return null;
  saveGlobalFolders(next);
  return updated;
}

export async function deleteFolder(id: string): Promise<boolean> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('folders').delete().eq('id', id).select('id');
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  const folders = getGlobalFolders();
  const next = folders.filter((f) => f.id !== id);
  if (next.length === folders.length) return false;
  saveGlobalFolders(next);
  return true;
}

/** Generates and persists a share code for a folder, or returns the existing one. */
export async function ensureFolderShareCode(id: string): Promise<string | null> {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const generateCode = () => {
    let code = '';
    for (let i = 0; i < 10; i++) {
      code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return code;
  };

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const existing = await getFolder(id);
    if (!existing) return null;
    if (existing.shareCode) return existing.shareCode;

    const code = generateCode();
    // Only set it if it's still unset - avoids two concurrent callers
    // generating and persisting two different codes for the same folder.
    const { data, error } = await supabase
      .from('folders')
      .update({ share_code: code, updated_at: Date.now() })
      .eq('id', id)
      .is('share_code', null)
      .select('share_code')
      .maybeSingle();
    if (error) throw error;
    if (data) return data.share_code as string;

    // Someone else set it first between our check and this write - read
    // whatever they set.
    const refreshed = await getFolder(id);
    return refreshed?.shareCode ?? null;
  }

  const folders = getGlobalFolders();
  const target = folders.find((f) => f.id === id);
  if (!target) return null;
  if (target.shareCode) return target.shareCode;

  const code = generateCode();
  const next = folders.map((f) => (f.id === id ? { ...f, shareCode: code, updatedAt: Date.now() } : f));
  saveGlobalFolders(next);
  return code;
}

export async function revokeFolderShareCode(id: string): Promise<boolean> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('folders')
      .update({ share_code: null, updated_at: Date.now() })
      .eq('id', id)
      .select('id');
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  const folders = getGlobalFolders();
  let found = false;
  const next = folders.map((f) => {
    if (f.id !== id) return f;
    found = true;
    const { shareCode: _shareCode, ...rest } = f;
    return rest;
  });
  if (!found) return false;
  saveGlobalFolders(next);
  return true;
}

declare global {
  var folderStore: FolderRecord[] | undefined;
}
