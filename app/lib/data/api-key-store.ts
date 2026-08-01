import { createHash, randomBytes } from 'crypto';
import { getSupabaseClient, hasSupabaseConfigured } from '@/app/lib/data/supabase-client';
import { checkRateLimit } from '@/app/lib/security/rate-limit';
import { isFreeAccountId } from '@/app/lib/auth/api-key-account';
import { FREE_API_MAX_REQUESTS_PER_HOUR, PLUS_API_MAX_REQUESTS_PER_HOUR } from '@/app/lib/plan-limits';

export interface ApiKeyRecord {
  id: string;
  key: string;
  hashedKey: string;
  name: string;
  userId?: string;
  email?: string;
  createdAt: number;
  lastUsedAt?: number;
  expiresAt?: number;
  isActive: boolean;
  permissions: ApiKeyPermissions;
  usage: ApiKeyUsage;
  rateLimit: {
    requestsPerHour: number;
    uploadSizeLimit: number; // in bytes, per upload
    // Storage is enforced per-account (pooled across all of that account's
    // keys), not per-key - see getAccountStorageUsage() below and
    // FREE_API_STORAGE_LIMIT_BYTES / PLUS_STORAGE_LIMIT_BYTES. Kept optional
    // here only so rows written before this change still deserialize.
    storageLimit?: number;
  };
  webhook?: { url: string; secret: string } | null;
}

export interface ApiKeyPermissions {
  upload: boolean;
  download: boolean;
  delete: boolean;
  list: boolean;
}

export interface ApiKeyUsage {
  requestCount: number;
  uploadCount: number;
  downloadCount: number;
  totalBytesUploaded: number;
  totalBytesDownloaded: number;
}

interface ApiKeyRow {
  id: string;
  hashed_key: string;
  name: string;
  user_id: string | null;
  email: string | null;
  created_at: number;
  last_used_at: number | null;
  expires_at: number | null;
  is_active: boolean;
  permissions: ApiKeyPermissions;
  usage: ApiKeyUsage;
  rate_limit: { requestsPerHour: number; uploadSizeLimit: number; storageLimit?: number };
  webhook: { url: string; secret: string } | null;
}

interface FallbackStore {
  apiKeys?: ApiKeyRecord[];
}

function rowFromRecord(record: ApiKeyRecord): Omit<ApiKeyRow, 'id'> & { id: string } {
  return {
    id: record.id,
    hashed_key: record.hashedKey,
    name: record.name,
    user_id: record.userId ?? null,
    email: record.email ?? null,
    created_at: record.createdAt,
    last_used_at: record.lastUsedAt ?? null,
    expires_at: record.expiresAt ?? null,
    is_active: record.isActive,
    permissions: record.permissions,
    usage: record.usage,
    rate_limit: record.rateLimit,
    webhook: record.webhook ?? null,
  };
}

function recordFromRow(row: ApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    key: '',
    hashedKey: row.hashed_key,
    name: row.name,
    userId: row.user_id ?? undefined,
    email: row.email ?? undefined,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    isActive: row.is_active,
    permissions: row.permissions,
    usage: row.usage,
    rateLimit: row.rate_limit,
    webhook: row.webhook ?? null,
  };
}

function generateApiKey(): string {
  // Generate a secure random API key with prefix
  const randomPart = randomBytes(32).toString('hex');
  return `vbc_${randomPart}`;
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function getFallbackStore(): FallbackStore {
  if (typeof global.apiKeysFallbackStore === 'undefined') {
    global.apiKeysFallbackStore = { apiKeys: [] };
  }
  return global.apiKeysFallbackStore;
}

function saveApiKeyToFallback(apiKey: ApiKeyRecord): void {
  const store = getFallbackStore();
  const index = store.apiKeys!.findIndex((k) => k.id === apiKey.id);
  if (index >= 0) {
    store.apiKeys![index] = apiKey;
  } else {
    store.apiKeys!.push(apiKey);
  }
}

function getApiKeyFromFallback(id: string): ApiKeyRecord | null {
  return getFallbackStore().apiKeys!.find((k) => k.id === id) || null;
}

function getApiKeyByHashFromFallback(hashedKey: string): ApiKeyRecord | null {
  return getFallbackStore().apiKeys!.find((k) => k.hashedKey === hashedKey) || null;
}

function listApiKeysFromFallback(): ApiKeyRecord[] {
  return [...getFallbackStore().apiKeys!];
}

function deleteApiKeyFromFallback(id: string): boolean {
  const store = getFallbackStore();
  const index = store.apiKeys!.findIndex((k) => k.id === id);
  if (index >= 0) {
    store.apiKeys!.splice(index, 1);
    return true;
  }
  return false;
}

function updateApiKeyInFallback(id: string, updates: Partial<ApiKeyRecord>): ApiKeyRecord | null {
  const store = getFallbackStore();
  const index = store.apiKeys!.findIndex((k) => k.id === id);
  if (index >= 0) {
    store.apiKeys![index] = { ...store.apiKeys![index], ...updates };
    return store.apiKeys![index];
  }
  return null;
}

export async function createApiKey(input: {
  name: string;
  userId?: string;
  email?: string;
  permissions?: Partial<ApiKeyPermissions>;
  rateLimit?: {
    requestsPerHour?: number;
    uploadSizeLimit?: number;
  };
  expiresInDays?: number;
}): Promise<{ apiKey: ApiKeyRecord; plainKey: string }> {
  const key = generateApiKey();
  const hashedKey = hashApiKey(key);
  const now = Date.now();

  const apiKey: ApiKeyRecord = {
    id: randomBytes(16).toString('hex'),
    key: '', // Never store the plain key
    hashedKey,
    name: input.name,
    userId: input.userId,
    email: input.email,
    createdAt: now,
    isActive: true,
    permissions: {
      upload: input.permissions?.upload ?? true,
      download: input.permissions?.download ?? true,
      delete: input.permissions?.delete ?? false,
      list: input.permissions?.list ?? true,
    },
    usage: {
      requestCount: 0,
      uploadCount: 0,
      downloadCount: 0,
      totalBytesUploaded: 0,
      totalBytesDownloaded: 0,
    },
    rateLimit: {
      requestsPerHour: input.rateLimit?.requestsPerHour ?? 1000,
      uploadSizeLimit: input.rateLimit?.uploadSizeLimit ?? 100 * 1024 * 1024, // 100MB default
    },
    webhook: null,
    expiresAt: input.expiresInDays ? now + input.expiresInDays * 24 * 60 * 60 * 1000 : undefined,
  };

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('api_keys').insert(rowFromRecord(apiKey));
    if (error) throw error;
  } else {
    saveApiKeyToFallback(apiKey);
  }

  return { apiKey, plainKey: key };
}

export async function validateApiKey(key: string): Promise<ApiKeyRecord | null> {
  const hashedKey = hashApiKey(key);

  let apiKey: ApiKeyRecord | null;
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('api_keys').select('*').eq('hashed_key', hashedKey).maybeSingle();
    if (error) throw error;
    apiKey = data ? recordFromRow(data as ApiKeyRow) : null;
  } else {
    apiKey = getApiKeyByHashFromFallback(hashedKey);
  }

  if (!apiKey) return null;
  if (!apiKey.isActive) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < Date.now()) return null;

  await updateApiKeyUsage(apiKey.id, { lastUsedAt: Date.now() });
  return apiKey;
}

export async function getApiKey(id: string): Promise<ApiKeyRecord | null> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('api_keys').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? recordFromRow(data as ApiKeyRow) : null;
  }
  return getApiKeyFromFallback(id);
}

export async function listApiKeys(userId?: string): Promise<ApiKeyRecord[]> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    let query = supabase.from('api_keys').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data as ApiKeyRow[]).map(recordFromRow);
  }

  let keys = listApiKeysFromFallback();
  if (userId) keys = keys.filter((k) => k.userId === userId);
  return keys;
}

export async function deleteApiKey(id: string): Promise<boolean> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('api_keys').delete().eq('id', id).select('id');
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }
  return deleteApiKeyFromFallback(id);
}

export async function updateApiKey(id: string, updates: Partial<ApiKeyRecord>): Promise<ApiKeyRecord | null> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const existing = await getApiKey(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    const { error } = await supabase.from('api_keys').update(rowFromRecord(merged)).eq('id', id);
    if (error) throw error;
    return merged;
  }
  return updateApiKeyInFallback(id, updates);
}

export async function updateApiKeyUsage(
  id: string,
  usage: {
    lastUsedAt?: number;
    requestCount?: number;
    uploadCount?: number;
    downloadCount?: number;
    bytesUploaded?: number;
    bytesDownloaded?: number;
  }
): Promise<void> {
  const apiKey = await getApiKey(id);
  if (!apiKey) return;

  const updates: Partial<ApiKeyRecord> = {
    lastUsedAt: usage.lastUsedAt ?? apiKey.lastUsedAt,
    usage: {
      requestCount: apiKey.usage.requestCount + (usage.requestCount ?? 0),
      uploadCount: apiKey.usage.uploadCount + (usage.uploadCount ?? 0),
      downloadCount: apiKey.usage.downloadCount + (usage.downloadCount ?? 0),
      totalBytesUploaded: apiKey.usage.totalBytesUploaded + (usage.bytesUploaded ?? 0),
      totalBytesDownloaded: apiKey.usage.totalBytesDownloaded + (usage.bytesDownloaded ?? 0),
    },
  };

  await updateApiKey(id, updates);
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const result = await updateApiKey(id, { isActive: false });
  return result !== null;
}

// Sets (or clears, with url: null) the webhook Relay POSTs file.created /
// file.deleted events to. Generates a fresh signing secret whenever the URL
// changes so an old integration can't keep verifying with a stale secret.
export async function setApiKeyWebhook(id: string, url: string | null): Promise<ApiKeyRecord | null> {
  const webhook = url ? { url, secret: `whsec_${randomBytes(24).toString('hex')}` } : null;
  return updateApiKey(id, { webhook });
}

// Fixed-window limit (`rateLimit.requestsPerHour` per rolling hour), enforced
// via the shared Redis-backed limiter so it holds across every serverless
// instance. The previous version compared a lifetime-cumulative usage
// counter against the hourly limit and only reset it after an hour of total
// inactivity - an active key would trip the limit once and then stay
// rate-limited forever, since `usage.requestCount` never actually resets.
//
// The effective limit is also clamped to an absolute per-plan ceiling here,
// not just at key-creation time - creation/update-time clamping keeps newly
// stored values honest, but this is the one choke point every authenticated
// request passes through, so it's what actually prevents a key whose stored
// value predates these ceilings (or was written some other way) from being
// used to bypass them.
export async function checkApiKeyRateLimit(apiKey: ApiKeyRecord): Promise<boolean> {
  const ceiling = isFreeAccountId(apiKey.userId) ? FREE_API_MAX_REQUESTS_PER_HOUR : PLUS_API_MAX_REQUESTS_PER_HOUR;
  const effectiveLimit = Math.min(apiKey.rateLimit.requestsPerHour, ceiling);
  const result = await checkRateLimit(`api-key:${apiKey.id}`, effectiveLimit, 60 * 60 * 1000);
  return result.allowed;
}

// A key counts against its account's key-count limit while it's actually
// usable - revoked or expired keys don't, so revoking one frees up a slot
// without requiring the user to also delete it.
export function isKeyUsable(apiKey: Pick<ApiKeyRecord, 'isActive' | 'expiresAt'>): boolean {
  return apiKey.isActive && (!apiKey.expiresAt || apiKey.expiresAt > Date.now());
}

declare global {
  var apiKeysFallbackStore: FallbackStore | undefined;
}
