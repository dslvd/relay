import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, updateApiKeyUsage, checkApiKeyRateLimit, type ApiKeyRecord } from '@/app/lib/data/api-key-store';

export interface AuthenticatedRequest extends NextRequest {
  apiKey?: ApiKeyRecord;
}

export async function authenticateApiKey(request: NextRequest): Promise<{
  success: boolean;
  apiKey?: ApiKeyRecord;
  error?: string;
  statusCode?: number;
}> {
  // Extract API key from Authorization header or query parameter
  const authHeader = request.headers.get('authorization');
  const apiKeyParam = new URL(request.url).searchParams.get('api_key');

  let apiKeyValue: string | null = null;

  if (authHeader) {
    // Support "Bearer <key>" or just "<key>"
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      apiKeyValue = parts[1];
    } else if (parts.length === 1) {
      apiKeyValue = parts[0];
    }
  } else if (apiKeyParam) {
    apiKeyValue = apiKeyParam;
  }

  if (!apiKeyValue) {
    return {
      success: false,
      error: 'API key is required. Provide it via Authorization header or api_key query parameter.',
      statusCode: 401,
    };
  }

  // Validate the API key
  const apiKey = await validateApiKey(apiKeyValue);

  if (!apiKey) {
    return {
      success: false,
      error: 'Invalid or expired API key.',
      statusCode: 401,
    };
  }

  // Check rate limit
  const withinRateLimit = await checkApiKeyRateLimit(apiKey);

  if (!withinRateLimit) {
    return {
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
      statusCode: 429,
    };
  }

  // Update usage
  await updateApiKeyUsage(apiKey.id, {
    lastUsedAt: Date.now(),
    requestCount: 1,
  });

  return {
    success: true,
    apiKey,
  };
}

export function requirePermission(apiKey: ApiKeyRecord, permission: keyof ApiKeyRecord['permissions']): boolean {
  return apiKey.permissions[permission] === true;
}

export function createUnauthorizedResponse(error: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status: 401 }
  );
}

export function createForbiddenResponse(error: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status: 403 }
  );
}

export function createRateLimitResponse(error: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status: 429 }
  );
}

export async function withApiAuth<T>(
  request: NextRequest,
  requiredPermission: keyof ApiKeyRecord['permissions'] | null,
  handler: (apiKey: ApiKeyRecord) => Promise<NextResponse | Response>
): Promise<NextResponse | Response> {
  const auth = await authenticateApiKey(request);

  if (!auth.success) {
    if (auth.statusCode === 429) {
      return createRateLimitResponse(auth.error!);
    }
    return createUnauthorizedResponse(auth.error!);
  }

  // Check required permission
  if (requiredPermission && !requirePermission(auth.apiKey!, requiredPermission)) {
    return createForbiddenResponse(
      `This API key does not have permission to ${requiredPermission}.`
    );
  }

  return handler(auth.apiKey!);
}
