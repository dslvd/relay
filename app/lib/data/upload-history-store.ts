import { getSupabaseClient, hasSupabaseConfigured } from '@/app/lib/data/supabase-client';

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

interface UploadRow {
  id: number;
  scope: UploadHistoryScope;
  url: string;
  filename: string;
  size: number;
  created_at: number;
  last_access_time: number;
  expires_at: number;
  ip: string | null;
  owner_id: string | null;
  owner_email: string | null;
  folder: string | null;
  tags: string[] | null;
  favorite: boolean | null;
  display_name: string | null;
  updated_at: number | null;
}

// Only used by the in-memory fallback (no Supabase configured) - a real
// database has no reason to cap total rows.
const FALLBACK_HISTORY_LIMIT = 100;

function recordFromRow(row: UploadRow): UploadRecord {
  return {
    url: row.url,
    filename: row.filename,
    timestamp: row.created_at,
    lastAccessTime: row.last_access_time,
    expiresAt: row.expires_at,
    size: row.size,
    ip: row.ip ?? undefined,
    ownerId: row.owner_id ?? undefined,
    ownerEmail: row.owner_email ?? undefined,
    folder: row.folder ?? undefined,
    tags: row.tags ?? undefined,
    favorite: row.favorite ?? undefined,
    displayName: row.display_name ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function recordToRow(record: UploadRecord, scope: UploadHistoryScope) {
  return {
    scope,
    url: record.url,
    filename: record.filename,
    size: record.size,
    created_at: record.timestamp,
    last_access_time: record.lastAccessTime,
    expires_at: record.expiresAt,
    ip: record.ip ?? null,
    owner_id: record.ownerId ?? null,
    owner_email: record.ownerEmail ?? null,
    folder: record.folder ?? null,
    tags: record.tags ?? null,
    favorite: record.favorite ?? null,
    display_name: record.displayName ?? null,
    updated_at: record.updatedAt ?? null,
  };
}

function getGlobalHistory(scope: UploadHistoryScope): UploadRecord[] {
  if (typeof global.uploadHistoryByScope === 'undefined') {
    global.uploadHistoryByScope = { public: [], plus: [] };
  }
  return global.uploadHistoryByScope[scope] as UploadRecord[];
}

function saveGlobalHistory(history: UploadRecord[], scope: UploadHistoryScope): void {
  if (typeof global.uploadHistoryByScope === 'undefined') {
    global.uploadHistoryByScope = { public: [], plus: [] };
  }
  global.uploadHistoryByScope[scope] = history.slice(0, FALLBACK_HISTORY_LIMIT);
}

export async function loadUploadHistory(scope: UploadHistoryScope = 'public'): Promise<UploadRecord[]> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('upload_records')
      .select('*')
      .eq('scope', scope)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as UploadRow[]).map(recordFromRow);
  }

  return [...getGlobalHistory(scope)];
}

// Batched alternative to loadUploadHistory() for maintenance jobs (retention,
// cron cleanup) that would otherwise load an unbounded number of rows into a
// single function invocation - risking a timeout or OOM once a scope grows
// into the tens/hundreds of thousands of rows. Order is arbitrary (by id)
// since these jobs process the whole table, not a user-facing recent-first
// list.
export async function* iterateUploadHistory(
  scope: UploadHistoryScope,
  batchSize = 500
): AsyncGenerator<UploadRecord[]> {
  if (!hasSupabaseConfigured()) {
    // The fallback store is capped at FALLBACK_HISTORY_LIMIT rows - small
    // enough to yield as a single batch.
    yield [...getGlobalHistory(scope)];
    return;
  }

  const supabase = getSupabaseClient();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('upload_records')
      .select('*')
      .eq('scope', scope)
      .order('id', { ascending: true })
      .range(offset, offset + batchSize - 1);
    if (error) throw error;

    const rows = (data as UploadRow[]) || [];
    if (rows.length === 0) break;

    yield rows.map(recordFromRow);

    if (rows.length < batchSize) break;
    offset += batchSize;
  }
}

export async function addUploadRecord(
  record: UploadRecord,
  scope: UploadHistoryScope = 'public'
): Promise<void> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('upload_records').insert(recordToRow(record, scope));
    if (error) throw error;
    return;
  }

  const history = getGlobalHistory(scope);
  saveGlobalHistory([record, ...history], scope);
}

export async function removeUploadUrls(
  urls: string[],
  scope: UploadHistoryScope = 'public'
): Promise<number> {
  if (urls.length === 0) return 0;

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('upload_records')
      .delete()
      .eq('scope', scope)
      .in('url', urls)
      .select('id');
    if (error) throw error;
    return data?.length ?? 0;
  }

  const history = getGlobalHistory(scope);
  const filtered = history.filter((record) => !urls.includes(record.url));
  if (filtered.length !== history.length) {
    saveGlobalHistory(filtered, scope);
  }
  return history.length - filtered.length;
}

// Deletes every record for a scope. Used only by the admin "clear all" action.
export async function clearUploadHistory(scope: UploadHistoryScope): Promise<void> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('upload_records').delete().eq('scope', scope);
    if (error) throw error;
    return;
  }

  saveGlobalHistory([], scope);
}

export async function updateUploadRecordByUrl(
  url: string,
  update: (record: UploadRecord) => UploadRecord | null,
  scope: UploadHistoryScope = 'public'
): Promise<UploadRecord | null> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data: existingRow, error: readError } = await supabase
      .from('upload_records')
      .select('*')
      .eq('scope', scope)
      .eq('url', url)
      .maybeSingle();
    if (readError) throw readError;
    if (!existingRow) return null;

    const nextRecord = update(recordFromRow(existingRow as UploadRow));
    if (!nextRecord) return null;

    const { data: updatedRow, error: updateError } = await supabase
      .from('upload_records')
      .update(recordToRow(nextRecord, scope))
      .eq('id', (existingRow as UploadRow).id)
      .select('*')
      .maybeSingle();
    if (updateError) throw updateError;
    return updatedRow ? recordFromRow(updatedRow as UploadRow) : null;
  }

  const history = getGlobalHistory(scope);
  let updatedRecord: UploadRecord | null = null;

  const updatedHistory = history
    .map((record) => {
      if (record.url !== url) return record;
      const nextRecord = update(record);
      if (!nextRecord) return record;
      updatedRecord = nextRecord;
      return nextRecord;
    })
    .filter(Boolean) as UploadRecord[];

  if (updatedRecord) {
    saveGlobalHistory(updatedHistory, scope);
  }

  return updatedRecord;
}

export async function updateUploadRecordsByUrls(
  urls: string[],
  update: (record: UploadRecord) => UploadRecord | null,
  scope: UploadHistoryScope = 'public'
): Promise<number> {
  if (urls.length === 0) return 0;

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data: rows, error: readError } = await supabase
      .from('upload_records')
      .select('*')
      .eq('scope', scope)
      .in('url', urls);
    if (readError) throw readError;

    let updatedCount = 0;
    for (const row of (rows as UploadRow[]) || []) {
      const nextRecord = update(recordFromRow(row));
      if (!nextRecord) continue;
      const { error: updateError } = await supabase
        .from('upload_records')
        .update(recordToRow(nextRecord, scope))
        .eq('id', row.id);
      if (updateError) throw updateError;
      updatedCount += 1;
    }
    return updatedCount;
  }

  const history = getGlobalHistory(scope);
  const targetUrls = new Set(urls);
  let updatedCount = 0;

  const updatedHistory = history
    .map((record) => {
      if (!targetUrls.has(record.url)) return record;
      const nextRecord = update(record);
      if (!nextRecord) return record;
      updatedCount += 1;
      return nextRecord;
    })
    .filter(Boolean) as UploadRecord[];

  if (updatedCount > 0) {
    saveGlobalHistory(updatedHistory, scope);
  }

  return updatedCount;
}

// Single-row, best-effort timestamp bump for the download/view path - this
// used to reload and rewrite the *entire* scope's history just to touch one
// record. Falls back to a substring match for legacy/loosely-formatted URLs,
// matching the old blob-scan's `record.url.includes(url)` behavior.
export async function touchLastAccessTime(url: string, now = Date.now()): Promise<void> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('upload_records')
      .update({ last_access_time: now })
      .eq('url', url)
      .select('id');
    if (error) throw error;
    if (data && data.length > 0) return;

    const { error: fuzzyError } = await supabase
      .from('upload_records')
      .update({ last_access_time: now })
      .ilike('url', `%${url}%`);
    if (fuzzyError) throw fuzzyError;
    return;
  }

  for (const scope of ['public', 'plus'] as UploadHistoryScope[]) {
    const history = getGlobalHistory(scope);
    if (history.length === 0) continue;
    let changed = false;
    const updated = history.map((record) => {
      if (record.url === url || record.url.includes(url)) {
        changed = true;
        return { ...record, lastAccessTime: now };
      }
      return record;
    });
    if (changed) saveGlobalHistory(updated, scope);
  }
}

declare global {
  var uploadHistoryByScope: Record<UploadHistoryScope, UploadRecord[]> | undefined;
}
