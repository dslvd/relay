import { NextRequest, NextResponse } from 'next/server';
import { createPlusUserFromInvite } from '@/app/lib/auth/plus-auth';

export async function POST(request: NextRequest) {
  try {
    const { token, email, password } = await request.json();

    if (!token || !email || !password) {
      return NextResponse.json({ error: 'Token, email, and password are required' }, { status: 400 });
    }

    if (String(password).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const { user, error } = await createPlusUserFromInvite({
      inviteToken: String(token),
      email: String(email),
      password: String(password),
    });

    if (!user) {
      return NextResponse.json({ error: error || 'Failed to create account' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      }
    });
  } catch (error) {
    console.error('Plus register error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
