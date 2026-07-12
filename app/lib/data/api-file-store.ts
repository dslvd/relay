import { randomBytes, randomUUID } from 'crypto';
import { getSupabaseClient, hasSupabaseConfigured } from '@/app/lib/data/supabase-client';

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

interface ApiFileRow {
  id: string;
  short_id: string;
  object_key: string;
  name: string;
  size: number;
  mime_type: string | null;
  folder_id: string | null;
  owner_id: string | null;
  is_anonymous: boolean;
  deletion_token: string | null;
  created_at: number;
  expires_at: number | null;
  download_count: number;
}

const MAX_RECORDS = 5000;
const SHORT_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function recordFromRow(row: ApiFileRow): ApiFileRecord {
  return {
    id: row.id,
    shortId: row.short_id,
    objectKey: row.object_key,
    name: row.name,
    size: row.size,
    mimeType: row.mime_type || 'application/octet-stream',
    folderId: row.folder_id,
    ownerId: row.owner_id,
    isAnonymous: row.is_anonymous,
    deletionToken: row.deletion_token,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    downloadCount: row.download_count,
  };
}

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

function saveFallbackStore(records: ApiFileRecord[]): void {
  global.apiFileStore = records.slice(0, MAX_RECORDS);
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
  const isAnonymous = !input.ownerId;
  const record: ApiFileRecord = {
    id: randomUUID(),
    shortId: generateShortId(),
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

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();

    // shortId collisions are astronomically rare (62^8 space) but retry a
    // few times against the unique constraint just in case.
    for (let attempt = 0; attempt < 5; attempt++) {
      const shortId = attempt === 0 ? record.shortId : generateShortId();
      const { error } = await supabase.from('api_files').insert({
        id: record.id,
        short_id: shortId,
        object_key: record.objectKey,
        name: record.name,
        size: record.size,
        mime_type: record.mimeType,
        folder_id: record.folderId,
        owner_id: record.ownerId,
        is_anonymous: record.isAnonymous,
        deletion_token: record.deletionToken,
        created_at: record.createdAt,
        expires_at: record.expiresAt,
        download_count: 0,
      });
      if (!error) return { ...record, shortId };
      if (error.code !== '23505') throw error;
    }
    throw new Error('Failed to allocate a unique shortId');
  }

  const records = getFallbackStore();
  const existingShortIds = new Set(records.map((r) => r.shortId));
  while (existingShortIds.has(record.shortId)) {
    record.shortId = generateShortId();
  }
  saveFallbackStore([record, ...records]);
  return record;
}

export async function getFileRecordById(id: string): Promise<ApiFileRecord | null> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('api_files').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? recordFromRow(data as ApiFileRow) : null;
  }

  return getFallbackStore().find((r) => r.id === id) || null;
}

export async function getFileRecordByShortId(shortId: string): Promise<ApiFileRecord | null> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('api_files').select('*').eq('short_id', shortId).maybeSingle();
    if (error) throw error;
    return data ? recordFromRow(data as ApiFileRow) : null;
  }

  return getFallbackStore().find((r) => r.shortId === shortId) || null;
}

export async function listFileRecordsByOwner(options: {
  ownerId: string;
  folderId?: string | null;
  page?: number;
  limit?: number;
}): Promise<{ records: ApiFileRecord[]; total: number }> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.max(1, Math.min(200, options.limit ?? 50));

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('api_files')
      .select('*', { count: 'exact' })
      .eq('owner_id', options.ownerId);

    if (options.folderId !== undefined) {
      query = options.folderId === null ? query.is('folder_id', null) : query.eq('folder_id', options.folderId);
    }

    const from = (page - 1) * limit;
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + limit - 1);
    if (error) throw error;
    return { records: (data as ApiFileRow[]).map(recordFromRow), total: count ?? 0 };
  }

  const records = getFallbackStore();
  let filtered = records.filter((r) => r.ownerId === options.ownerId);
  if (options.folderId !== undefined) {
    filtered = filtered.filter((r) => r.folderId === options.folderId);
  }
  const total = filtered.length;
  const start = (page - 1) * limit;
  return { records: filtered.slice(start, start + limit), total };
}

export async function countFilesInFolder(folderId: string): Promise<{ count: number; totalSize: number }> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('api_files').select('size').eq('folder_id', folderId);
    if (error) throw error;
    const rows = (data as { size: number }[]) || [];
    return { count: rows.length, totalSize: rows.reduce((sum, r) => sum + r.size, 0) };
  }

  const records = getFallbackStore();
  const inFolder = records.filter((r) => r.folderId === folderId);
  return { count: inFolder.length, totalSize: inFolder.reduce((sum, r) => sum + r.size, 0) };
}

export async function incrementDownloadCount(id: string): Promise<void> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('api_files').select('download_count').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return;
    const { error: updateError } = await supabase
      .from('api_files')
      .update({ download_count: (data.download_count as number) + 1 })
      .eq('id', id);
    if (updateError) throw updateError;
    return;
  }

  const records = getFallbackStore();
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) return;
  records[index] = { ...records[index], downloadCount: records[index].downloadCount + 1 };
  saveFallbackStore(records);
}

export async function deleteFileRecord(id: string): Promise<ApiFileRecord | null> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('api_files').delete().eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    return data ? recordFromRow(data as ApiFileRow) : null;
  }

  const records = getFallbackStore();
  const record = records.find((r) => r.id === id);
  if (!record) return null;
  saveFallbackStore(records.filter((r) => r.id !== id));
  return record;
}

declare global {
  var apiFileStore: ApiFileRecord[] | undefined;
}
