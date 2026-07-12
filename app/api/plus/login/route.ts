import { NextRequest, NextResponse } from 'next/server';
import { authenticatePlusUser, createPlusSession } from '@/app/lib/auth/plus-auth';

const PLUS_COOKIE_NAME = 'plus_auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await authenticatePlusUser(email, password);
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const sessionToken = await createPlusSession(user.id);
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      }
    });

    response.cookies.set({
      name: PLUS_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    console.error('Plus login error:', error);
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 });
  }
}
