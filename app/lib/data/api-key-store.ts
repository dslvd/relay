import { createHash, randomBytes } from 'crypto';
import { getRedisClient, hasRedisConfigured } from './redis-client';

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
    uploadSizeLimit: number; // in bytes
  };
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

interface FallbackStore {
  apiKeys?: ApiKeyRecord[];
}

const API_KEYS_KEY_PREFIX = 'api_key:';
const API_KEY_BY_HASH_PREFIX = 'api_key_hash:';
const API_KEYS_LIST_KEY = 'api_keys_list';
const FALLBACK_STATE_KEY = 'api_keys_fallback_state';

function generateApiKey(): string {
  // Generate a secure random API key with prefix
  const randomPart = randomBytes(32).toString('hex');
  return `vbc_${randomPart}`;
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// Redis-based storage
async function saveApiKeyToRedis(apiKey: ApiKeyRecord): Promise<void> {
  const redis = await getRedisClient();
  const keyId = `${API_KEYS_KEY_PREFIX}${apiKey.id}`;
  const hashKey = `${API_KEY_BY_HASH_PREFIX}${apiKey.hashedKey}`;

  await redis.set(keyId, JSON.stringify(apiKey));
  await redis.set(hashKey, apiKey.id);
  await redis.sAdd(API_KEYS_LIST_KEY, apiKey.id);
}

async function getApiKeyFromRedis(id: string): Promise<ApiKeyRecord | null> {
  const redis = await getRedisClient();
  const keyId = `${API_KEYS_KEY_PREFIX}${id}`;
  const data = await redis.get(keyId);

  if (!data) return null;

  return JSON.parse(data) as ApiKeyRecord;
}

async function getApiKeyByHashFromRedis(hashedKey: string): Promise<ApiKeyRecord | null> {
  const redis = await getRedisClient();
  const hashKey = `${API_KEY_BY_HASH_PREFIX}${hashedKey}`;
  const id = await redis.get(hashKey);

  if (!id) return null;

  return getApiKeyFromRedis(id);
}

async function listApiKeysFromRedis(): Promise<ApiKeyRecord[]> {
  const redis = await getRedisClient();
  const ids = await redis.sMembers(API_KEYS_LIST_KEY);

  const keys = await Promise.all(
    ids.map((id) => getApiKeyFromRedis(id))
  );

  return keys.filter((k): k is ApiKeyRecord => k !== null);
}

async function deleteApiKeyFromRedis(id: string): Promise<boolean> {
  const redis = await getRedisClient();
  const apiKey = await getApiKeyFromRedis(id);

  if (!apiKey) return false;

  const keyId = `${API_KEYS_KEY_PREFIX}${id}`;
  const hashKey = `${API_KEY_BY_HASH_PREFIX}${apiKey.hashedKey}`;

  await redis.del(keyId);
  await redis.del(hashKey);
  await redis.sRem(API_KEYS_LIST_KEY, id);

  return true;
}

async function updateApiKeyInRedis(id: string, updates: Partial<ApiKeyRecord>): Promise<ApiKeyRecord | null> {
  const apiKey = await getApiKeyFromRedis(id);
  if (!apiKey) return null;

  const updated = { ...apiKey, ...updates };
  await saveApiKeyToRedis(updated);

  return updated;
}

// Fallback in-memory storage
function getFallbackStore(): FallbackStore {
  if (typeof global.apiKeysFallbackStore === 'undefined') {
    global.apiKeysFallbackStore = {
      apiKeys: [],
    };
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
  const store = getFallbackStore();
  return store.apiKeys!.find((k) => k.id === id) || null;
}

function getApiKeyByHashFromFallback(hashedKey: string): ApiKeyRecord | null {
  const store = getFallbackStore();
  return store.apiKeys!.find((k) => k.hashedKey === hashedKey) || null;
}

function listApiKeysFromFallback(): ApiKeyRecord[] {
  const store = getFallbackStore();
  return [...store.apiKeys!];
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

// Public API
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
    expiresAt: input.expiresInDays ? now + input.expiresInDays * 24 * 60 * 60 * 1000 : undefined,
  };

  if (hasRedisConfigured()) {
    await saveApiKeyToRedis(apiKey);
  } else {
    saveApiKeyToFallback(apiKey);
  }

  return { apiKey, plainKey: key };
}

export async function validateApiKey(key: string): Promise<ApiKeyRecord | null> {
  const hashedKey = hashApiKey(key);

  let apiKey: ApiKeyRecord | null;

  if (hasRedisConfigured()) {
    apiKey = await getApiKeyByHashFromRedis(hashedKey);
  } else {
    apiKey = getApiKeyByHashFromFallback(hashedKey);
  }

  if (!apiKey) return null;

  // Check if key is active
  if (!apiKey.isActive) return null;

  // Check if key is expired
  if (apiKey.expiresAt && apiKey.expiresAt < Date.now()) {
    return null;
  }

  // Update last used timestamp
  await updateApiKeyUsage(apiKey.id, { lastUsedAt: Date.now() });

  return apiKey;
}

export async function getApiKey(id: string): Promise<ApiKeyRecord | null> {
  if (hasRedisConfigured()) {
    return getApiKeyFromRedis(id);
  } else {
    return getApiKeyFromFallback(id);
  }
}

export async function listApiKeys(userId?: string): Promise<ApiKeyRecord[]> {
  let keys: ApiKeyRecord[];

  if (hasRedisConfigured()) {
    keys = await listApiKeysFromRedis();
  } else {
    keys = listApiKeysFromFallback();
  }

  if (userId) {
    keys = keys.filter((k) => k.userId === userId);
  }

  return keys;
}

export async function deleteApiKey(id: string): Promise<boolean> {
  if (hasRedisConfigured()) {
    return deleteApiKeyFromRedis(id);
  } else {
    return deleteApiKeyFromFallback(id);
  }
}

export async function updateApiKey(id: string, updates: Partial<ApiKeyRecord>): Promise<ApiKeyRecord | null> {
  if (hasRedisConfigured()) {
    return updateApiKeyInRedis(id, updates);
  } else {
    return updateApiKeyInFallback(id, updates);
  }
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

export async function checkApiKeyRateLimit(apiKey: ApiKeyRecord): Promise<boolean> {
  // Check rate limit based on recent usage
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  if (!apiKey.lastUsedAt || apiKey.lastUsedAt < oneHourAgo) {
    // Reset the counter if more than an hour has passed
    return true;
  }

  // For simplicity, we'll track usage per hour in the usage object
  // In a production system, you'd want a more sophisticated rate limiting system
  return apiKey.usage.requestCount < apiKey.rateLimit.requestsPerHour;
}

declare global {
  var apiKeysFallbackStore: FallbackStore | undefined;
}
