import { NextRequest, NextResponse } from 'next/server';
import { createPremiumUserFromInvite } from '@/app/lib/premium-auth';

const REGISTER_WINDOW_MS = 30 * 60 * 1000;
const MAX_REGISTER_ATTEMPTS = 8;

type RegisterRateEntry = {
  windowStart: number;
  count: number;
};

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown';
}

function getRateEntry(ip: string, now: number): RegisterRateEntry {
  if (typeof global.premiumRegisterRateLimit === 'undefined') {
    global.premiumRegisterRateLimit = {};
  }

  const existing = global.premiumRegisterRateLimit[ip] || { windowStart: now, count: 0 };
  if (now - existing.windowStart > REGISTER_WINDOW_MS) {
    return { windowStart: now, count: 0 };
  }

  return existing;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const now = Date.now();
    const entry = getRateEntry(ip, now);

    if (entry.count >= MAX_REGISTER_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many registration attempts. Try again later.' }, { status: 429 });
    }

    const { token, email, password } = await request.json();
    const inviteToken = String(token || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const passwordValue = String(password || '');

    if (!inviteToken || !normalizedEmail || !passwordValue) {
      return NextResponse.json({ error: 'Token, email, and password are required' }, { status: 400 });
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (passwordValue.length < 8 || passwordValue.length > 256) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const { user, error } = await createPremiumUserFromInvite({
      inviteToken,
      email: normalizedEmail,
      password: passwordValue,
    });

    if (!user) {
      entry.count += 1;
      global.premiumRegisterRateLimit![ip] = entry;
      return NextResponse.json({ error: error || 'Failed to create account' }, { status: 400 });
    }

    global.premiumRegisterRateLimit![ip] = { windowStart: now, count: 0 };

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      }
    });
  } catch (error) {
    console.error('Premium register error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

declare global {
  var premiumRegisterRateLimit: Record<string, RegisterRateEntry> | undefined;
}
