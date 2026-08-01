import { NextRequest, NextResponse } from 'next/server';
import { createApiKey, listApiKeys, isKeyUsable } from '@/app/lib/data/api-key-store';
import { getAccountApiStorageUsage } from '@/app/lib/data/api-file-store';
import { resolveApiKeyAccount } from '@/app/lib/auth/api-key-account';
import {
  FREE_MAX_API_KEYS,
  PLUS_MAX_API_KEYS,
  FREE_API_MAX_REQUESTS_PER_HOUR,
  PLUS_API_MAX_REQUESTS_PER_HOUR,
  FREE_MAX_FILE_BYTES,
  PLUS_MAX_FILE_BYTES,
  FREE_API_STORAGE_LIMIT_BYTES,
  PLUS_STORAGE_LIMIT_BYTES,
} from '@/app/lib/plan-limits';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

// GET /api/dev/keys - List all API keys for the current account (a Plus
// session, or a free/anonymous account scoped by IP - see resolveApiKeyAccount).
export async function GET(request: NextRequest) {
  try {
    const account = await resolveApiKeyAccount(request);
    const keys = await listApiKeys(account.id);

    const sanitizedKeys = keys.map((key) => ({
      id: key.id,
      name: key.name,
      createdAt: new Date(key.createdAt).toISOString(),
      lastUsedAt: key.lastUsedAt ? new Date(key.lastUsedAt).toISOString() : null,
      expiresAt: key.expiresAt ? new Date(key.expiresAt).toISOString() : null,
      isActive: key.isActive,
      permissions: key.permissions,
      usage: key.usage,
      rateLimit: key.rateLimit,
      webhookUrl: key.webhook?.url ?? null,
      // Show masked key for identification
      keyPreview: key.hashedKey.substring(0, 8) + '...',
    }));

    // Storage is pooled per-account (see getAccountApiStorageUsage), not
    // per-key, so it's reported once here rather than per key in the list.
    const storageUsed = await getAccountApiStorageUsage(account.id, account.isPlus);

    return NextResponse.json({
      success: true,
      data: {
        keys: sanitizedKeys,
        user: account.isPlus ? { id: account.id, email: account.email } : null,
        account: {
          isPlus: account.isPlus,
          keyCount: keys.filter(isKeyUsable).length,
          maxKeys: account.isPlus ? PLUS_MAX_API_KEYS : FREE_MAX_API_KEYS,
          storageUsed,
          storageLimit: account.isPlus ? PLUS_STORAGE_LIMIT_BYTES : FREE_API_STORAGE_LIMIT_BYTES,
          maxRequestsPerHour: account.isPlus ? PLUS_API_MAX_REQUESTS_PER_HOUR : FREE_API_MAX_REQUESTS_PER_HOUR,
          maxUploadSizeBytes: account.isPlus ? PLUS_MAX_FILE_BYTES : FREE_MAX_FILE_BYTES,
        },
      },
    });
  } catch (error) {
    console.error('List API keys error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list API keys',
      },
      { status: 500 }
    );
  }
}

// POST /api/dev/keys - Create a new API key
export async function POST(request: NextRequest) {
  try {
    const account = await resolveApiKeyAccount(request);

    const maxKeys = account.isPlus ? PLUS_MAX_API_KEYS : FREE_MAX_API_KEYS;
    const existingKeys = await listApiKeys(account.id);
    if (existingKeys.filter(isKeyUsable).length >= maxKeys) {
      return NextResponse.json(
        {
          success: false,
          error: `API key limit reached (${maxKeys} for ${account.isPlus ? 'Plus' : 'free'} accounts). Revoke or delete an existing key first.`,
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const name = typeof body?.name === 'string' ? body.name : 'Unnamed Key';
    const permissions = body?.permissions || {};
    const rateLimit = body?.rateLimit || {};
    const expiresInDays =
      typeof body?.expiresInDays === 'number' && body.expiresInDays > 0
        ? Math.min(body.expiresInDays, 3650)
        : undefined;

    if (name.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Key name must be 100 characters or less',
        },
        { status: 400 }
      );
    }

    // Ceilings a key's own rate/size settings can be configured to - without
    // this, the create-key form's numeric inputs had no server-side upper
    // bound at all, so any caller could self-report an effectively unlimited
    // rate limit or upload size. checkApiKeyRateLimit() enforces the same
    // ceiling again at request time as a second line of defense.
    const maxRequestsPerHour = account.isPlus ? PLUS_API_MAX_REQUESTS_PER_HOUR : FREE_API_MAX_REQUESTS_PER_HOUR;
    const maxUploadSizeBytes = account.isPlus ? PLUS_MAX_FILE_BYTES : FREE_MAX_FILE_BYTES;

    const result = await createApiKey({
      name,
      userId: account.id,
      email: account.email,
      permissions,
      rateLimit: {
        requestsPerHour: clamp(Number(rateLimit.requestsPerHour) || 1000, 1, maxRequestsPerHour),
        uploadSizeLimit: clamp(Number(rateLimit.uploadSizeLimit) || maxUploadSizeBytes, 1, maxUploadSizeBytes),
      },
      expiresInDays,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: result.apiKey.id,
        name: result.apiKey.name,
        key: result.plainKey, // Only time the plain key is returned!
        createdAt: new Date(result.apiKey.createdAt).toISOString(),
        expiresAt: result.apiKey.expiresAt ? new Date(result.apiKey.expiresAt).toISOString() : null,
        permissions: result.apiKey.permissions,
        rateLimit: result.apiKey.rateLimit,
        warning: 'This is the only time the key will be displayed. Please save it securely.',
      },
    });
  } catch (error) {
    console.error('Create API key error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create API key',
      },
      { status: 500 }
    );
  }
}
