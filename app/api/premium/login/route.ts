import { NextRequest, NextResponse } from 'next/server';
import { authenticatePremiumUser, createPremiumSession } from '@/app/lib/premium-auth';

const PREMIUM_COOKIE_NAME = 'premium_auth';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;

type AuthRateEntry = {
  windowStart: number;
  count: number;
};

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown';
}

function getRateEntry(ip: string, now: number): AuthRateEntry {
  if (typeof global.premiumLoginRateLimit === 'undefined') {
    global.premiumLoginRateLimit = {};
  }

  const existing = global.premiumLoginRateLimit[ip] || { windowStart: now, count: 0 };
  if (now - existing.windowStart > LOGIN_WINDOW_MS) {
    return { windowStart: now, count: 0 };
  }

  return existing;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const now = Date.now();
    const entry = getRateEntry(ip, now);

    if (entry.count >= MAX_LOGIN_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 });
    }

    const { email, password } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const passwordValue = String(password || '');

    if (!normalizedEmail || !passwordValue) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (passwordValue.length > 256) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
    }

    const user = await authenticatePremiumUser(normalizedEmail, passwordValue);
    if (!user) {
      entry.count += 1;
      global.premiumLoginRateLimit![ip] = entry;
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    global.premiumLoginRateLimit![ip] = { windowStart: now, count: 0 };

    const sessionToken = await createPremiumSession(user.id);
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      }
    });

    response.cookies.set({
      name: PREMIUM_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    console.error('Premium login error:', error);
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 });
  }
}

declare global {
  var premiumLoginRateLimit: Record<string, AuthRateEntry> | undefined;
}
