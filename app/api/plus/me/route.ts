import { NextRequest, NextResponse } from 'next/server';
import { getPlusUserFromSession } from '@/app/lib/auth/plus-auth';

const PLUS_COOKIE_NAME = 'plus_auth';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(PLUS_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ plus: false });
  }

  const user = await getPlusUserFromSession(token);
  if (!user) {
    return NextResponse.json({ plus: false });
  }

  return NextResponse.json({
    plus: true,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    }
  });
}
