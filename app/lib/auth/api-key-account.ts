import { NextRequest } from 'next/server';
import { getPlusUserFromSession } from '@/app/lib/auth/plus-auth';

const PLUS_COOKIE_NAME = 'plus_auth';

export interface ApiKeyAccount {
  // Real plus_users.id for a logged-in Plus account, or a synthetic
  // `ip:{address}` id for a free/anonymous account - same identity model
  // the rest of the free tier already uses for storage/upload quotas.
  id: string;
  email?: string;
  isPlus: boolean;
}

export function isFreeAccountId(accountId: string | null | undefined): boolean {
  return !accountId || accountId.startsWith('ip:');
}

// Every request resolves to SOME account - Plus via session cookie, or a
// free/anonymous one keyed by IP - so callers never need to handle "no
// account" as a distinct case the way the old plus_auth-only gate did.
export async function resolveApiKeyAccount(request: NextRequest): Promise<ApiKeyAccount> {
  const token = request.cookies.get(PLUS_COOKIE_NAME)?.value;
  if (token) {
    const plusUser = await getPlusUserFromSession(token);
    if (plusUser) {
      return { id: plusUser.id, email: plusUser.email, isPlus: true };
    }
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown';
  return { id: `ip:${ip}`, isPlus: false };
}
