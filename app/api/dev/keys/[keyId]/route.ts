import { NextRequest, NextResponse } from 'next/server';
import { getApiKey, revokeApiKey, deleteApiKey, updateApiKey } from '@/app/lib/data/api-key-store';
import { getPremiumUserFromSession } from '@/app/lib/auth/premium-auth';

const PREMIUM_COOKIE_NAME = 'premium_auth';

async function getAuthenticatedUser(request: NextRequest) {
  const token = request.cookies.get(PREMIUM_COOKIE_NAME)?.value;
  if (!token) return null;

  const premiumUser = await getPremiumUserFromSession(token);
  return premiumUser;
}

// GET /api/dev/keys/[keyId] - Get a specific API key
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
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

    // Check ownership if user is authenticated
    if (user && apiKey.userId && apiKey.userId !== user.id) {
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
    const user = await getAuthenticatedUser(request);
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

    // Check ownership if user is authenticated
    if (user && apiKey.userId && apiKey.userId !== user.id) {
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
      updates.rateLimit = body.rateLimit;
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
    const user = await getAuthenticatedUser(request);
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

    // Check ownership if user is authenticated
    if (user && apiKey.userId && apiKey.userId !== user.id) {
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
