import { NextRequest, NextResponse } from 'next/server';
import { destroyPremiumSession } from '@/app/lib/premium-auth';

const PREMIUM_COOKIE_NAME = 'premium_auth';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(PREMIUM_COOKIE_NAME)?.value;
  if (token) {
    destroyPremiumSession(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: PREMIUM_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return response;
}
