import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/app/lib/data/admin-audit-store';
import { ADMIN_COOKIE_NAME, getAdminPassword, verifyAdminPassword } from '@/app/lib/auth/admin-auth';

const MAX_ATTEMPTS_PER_WINDOW = 10;
const RATE_WINDOW_MS = 15 * 60 * 1000;

type RateEntry = { windowStart: number; count: number };

function isRateLimited(ip: string): boolean {
  if (typeof global.adminLoginRateLimit === 'undefined') {
    global.adminLoginRateLimit = {};
  }

  const now = Date.now();
  const entry: RateEntry = global.adminLoginRateLimit[ip] || { windowStart: now, count: 0 };
  if (now - entry.windowStart > RATE_WINDOW_MS) {
    entry.windowStart = now;
    entry.count = 0;
  }

  entry.count += 1;
  global.adminLoginRateLimit[ip] = entry;

  return entry.count > MAX_ATTEMPTS_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'Unknown';
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, message: 'Too many attempts. Try again later.' },
        { status: 429 }
      );
    }

    const adminPassword = getAdminPassword();

    if (adminPassword && typeof password === 'string' && verifyAdminPassword(password)) {
      const response = NextResponse.json({
        success: true,
        message: 'Authentication successful'
      });

      response.cookies.set({
        name: ADMIN_COOKIE_NAME,
        value: adminPassword,
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });

      await appendAuditLog({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        action: 'admin.login.success',
        actorIp: ip,
        userAgent,
      });

      return response;
    } else {
      await appendAuditLog({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        action: 'admin.login.failed',
        actorIp: ip,
        userAgent,
      });
      return NextResponse.json(
        { success: false, message: 'Invalid password' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { success: false, message: 'Authentication failed' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: '',
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, message: 'Logout failed' },
      { status: 500 }
    );
  }
}

declare global {
  // eslint-disable-next-line no-var
  var adminLoginRateLimit: Record<string, RateEntry> | undefined;
}
