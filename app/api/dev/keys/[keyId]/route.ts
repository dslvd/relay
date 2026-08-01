import { NextRequest, NextResponse } from 'next/server';
import { getApiKey, revokeApiKey, deleteApiKey, updateApiKey, setApiKeyWebhook } from '@/app/lib/data/api-key-store';
import { getAccountApiStorageUsage } from '@/app/lib/data/api-file-store';
import { resolveApiKeyAccount } from '@/app/lib/auth/api-key-account';
import { FREE_API_MAX_REQUESTS_PER_HOUR, PLUS_API_MAX_REQUESTS_PER_HOUR, FREE_MAX_FILE_BYTES, PLUS_MAX_FILE_BYTES } from '@/app/lib/plan-limits';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

// GET /api/dev/keys/[keyId] - Get a specific API key
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const account = await resolveApiKeyAccount(request);
    const { keyId } = await params;

    const apiKey = await getApiKey(keyId);

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key not found',
        },
        { status: 404 }
      );
    }

    if (apiKey.userId !== account.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        createdAt: new Date(apiKey.createdAt).toISOString(),
        lastUsedAt: apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toISOString() : null,
        expiresAt: apiKey.expiresAt ? new Date(apiKey.expiresAt).toISOString() : null,
        isActive: apiKey.isActive,
        permissions: apiKey.permissions,
        usage: apiKey.usage,
        rateLimit: apiKey.rateLimit,
        storageUsed: await getAccountApiStorageUsage(account.id, account.isPlus),
        webhookUrl: apiKey.webhook?.url ?? null,
        webhookSecret: account.isPlus ? apiKey.webhook?.secret ?? null : null,
        keyPreview: apiKey.hashedKey.substring(0, 8) + '...',
      },
    });
  } catch (error) {
    console.error('Get API key error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get API key',
      },
      { status: 500 }
    );
  }
}

// PATCH /api/dev/keys/[keyId] - Update an API key (revoke, rename, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const account = await resolveApiKeyAccount(request);
    const { keyId } = await params;
    const body = await request.json();

    const apiKey = await getApiKey(keyId);

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key not found',
        },
        { status: 404 }
      );
    }

    if (apiKey.userId !== account.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 403 }
      );
    }

    // Handle revoke action
    if (body.action === 'revoke') {
      const success = await revokeApiKey(keyId);

      if (!success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to revoke API key',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          message: 'API key revoked successfully',
        },
      });
    }

    // Handle webhook URL changes separately - setApiKeyWebhook also rotates
    // the signing secret so a stale integration can't keep verifying.
    // Plus-only: webhooks aren't offered on free/IP-scoped keys, since
    // free-tier key management is shared across anyone on the same IP and
    // webhook secrets shouldn't be exposed to that wider a group.
    if ('webhookUrl' in body) {
      if (!account.isPlus) {
        return NextResponse.json({ success: false, error: 'Webhooks are a Plus feature' }, { status: 403 });
      }
      const webhookUrl = typeof body.webhookUrl === 'string' && body.webhookUrl ? body.webhookUrl : null;
      if (webhookUrl) {
        try {
          const parsed = new URL(webhookUrl);
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('bad protocol');
        } catch {
          return NextResponse.json({ success: false, error: 'webhookUrl must be a valid http(s) URL' }, { status: 400 });
        }
      }
      const updated = await setApiKeyWebhook(keyId, webhookUrl);
      if (!updated) {
        return NextResponse.json({ success: false, error: 'Failed to update webhook' }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        data: { id: updated.id, webhookUrl: updated.webhook?.url ?? null, webhookSecret: updated.webhook?.secret ?? null },
      });
    }

    // Handle other updates (name, permissions, etc.)
    const updates: any = {};

    if (typeof body.name === 'string') {
      updates.name = body.name;
    }

    if (typeof body.isActive === 'boolean') {
      updates.isActive = body.isActive;
    }

    if (body.permissions) {
      updates.permissions = body.permissions;
    }

    if (body.rateLimit) {
      const maxRequestsPerHour = account.isPlus ? PLUS_API_MAX_REQUESTS_PER_HOUR : FREE_API_MAX_REQUESTS_PER_HOUR;
      const maxUploadSizeBytes = account.isPlus ? PLUS_MAX_FILE_BYTES : FREE_MAX_FILE_BYTES;
      const nextRateLimit = { ...apiKey.rateLimit, ...body.rateLimit };
      updates.rateLimit = {
        ...nextRateLimit,
        requestsPerHour: clamp(Number(nextRateLimit.requestsPerHour), 1, maxRequestsPerHour),
        uploadSizeLimit: clamp(Number(nextRateLimit.uploadSizeLimit), 1, maxUploadSizeBytes),
      };
    }

    const updated = await updateApiKey(keyId, updates);

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update API key',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        isActive: updated.isActive,
        permissions: updated.permissions,
        rateLimit: updated.rateLimit,
      },
    });
  } catch (error) {
    console.error('Update API key error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update API key',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/dev/keys/[keyId] - Delete an API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const account = await resolveApiKeyAccount(request);
    const { keyId } = await params;

    const apiKey = await getApiKey(keyId);

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key not found',
        },
        { status: 404 }
      );
    }

    if (apiKey.userId !== account.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 403 }
      );
    }

    const success = await deleteApiKey(keyId);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete API key',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'API key deleted successfully',
      },
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete API key',
      },
      { status: 500 }
    );
  }
}
