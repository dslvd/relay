import { NextRequest, NextResponse } from 'next/server';
import { getPremiumUserFromSession } from '@/app/lib/auth/premium-auth';

const PREMIUM_COOKIE_NAME = 'premium_auth';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(PREMIUM_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ premium: false });
  }

  const user = await getPremiumUserFromSession(token);
  if (!user) {
    return NextResponse.json({ premium: false });
  }

  return NextResponse.json({
    premium: true,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    }
  });
}
