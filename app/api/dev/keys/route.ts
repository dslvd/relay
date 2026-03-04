import { NextRequest, NextResponse } from 'next/server';
import { createApiKey, listApiKeys, revokeApiKey, deleteApiKey } from '@/app/lib/data/api-key-store';
import { getPremiumUserFromSession } from '@/app/lib/auth/premium-auth';

const PREMIUM_COOKIE_NAME = 'premium_auth';

// Helper to get authenticated user
async function getAuthenticatedUser(request: NextRequest) {
  const token = request.cookies.get(PREMIUM_COOKIE_NAME)?.value;
  if (!token) return null;

  const premiumUser = await getPremiumUserFromSession(token);
  return premiumUser;
}

// GET /api/dev/keys - List all API keys for the current user
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    // Allow both authenticated users and unauthenticated (for testing)
    // In production, you might want to require authentication
    const userId = user?.id;
    const email = user?.email;

    const keys = await listApiKeys(userId);

    // Remove sensitive information
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
      // Show masked key for identification
      keyPreview: key.hashedKey.substring(0, 8) + '...',
    }));

    return NextResponse.json({
      success: true,
      data: {
        keys: sanitizedKeys,
        user: user ? { id: user.id, email: user.email } : null,
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
    const user = await getAuthenticatedUser(request);
    const body = await request.json();

    const name = typeof body?.name === 'string' ? body.name : 'Unnamed Key';
    const permissions = body?.permissions || {};
    const rateLimit = body?.rateLimit || {};
    const expiresInDays = typeof body?.expiresInDays === 'number' ? body.expiresInDays : undefined;

    if (name.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Key name must be 100 characters or less',
        },
        { status: 400 }
      );
    }

    const result = await createApiKey({
      name,
      userId: user?.id,
      email: user?.email,
      permissions,
      rateLimit,
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
