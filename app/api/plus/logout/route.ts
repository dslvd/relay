import { NextRequest, NextResponse } from 'next/server';
import { destroyPlusSession } from '@/app/lib/auth/plus-auth';

const PLUS_COOKIE_NAME = 'plus_auth';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(PLUS_COOKIE_NAME)?.value;
  if (token) {
    await destroyPlusSession(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: PLUS_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return response;
}
