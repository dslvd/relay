import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';

export const ADMIN_COOKIE_NAME = 'admin_auth';

function constantTimeEquals(a: string, b: string): boolean {
  // Hash both sides to a fixed-length digest first so timingSafeEqual never
  // has to reject on a length mismatch (which would itself leak information).
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Returns the configured admin password, or null if it isn't set. There is no
 * fallback default: an unconfigured password must deny access, not fall open
 * to a guessable value.
 */
export function getAdminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

export function verifyAdminPassword(candidate: string): boolean {
  const expected = getAdminPassword();
  if (!expected || !candidate) return false;
  return constantTimeEquals(candidate, expected);
}

export function isAdminRequest(request: NextRequest): boolean {
  const cookieValue = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!cookieValue) return false;
  return verifyAdminPassword(cookieValue);
}

export function requireAdmin(request: NextRequest): NextResponse | null {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
