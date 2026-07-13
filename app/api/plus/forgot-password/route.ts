import { NextRequest, NextResponse } from 'next/server';
import { createPasswordResetToken } from '@/app/lib/auth/plus-auth';
import { sendPasswordResetEmail } from '@/app/lib/email';
import { checkRateLimit } from '@/app/lib/rate-limit';

const RATE_LIMIT_PER_HOUR = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim() : '';

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'Unknown';
    const rateLimit = await checkRateLimit(`forgot-password:${ip}`, RATE_LIMIT_PER_HOUR, RATE_WINDOW_MS);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    const token = await createPasswordResetToken(email);
    if (token) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
      const resetUrl = `${baseUrl}/plus/reset?token=${encodeURIComponent(token)}`;
      try {
        await sendPasswordResetEmail(email, resetUrl);
      } catch (emailError) {
        // Logged, but not surfaced: letting a delivery failure produce a
        // different response than "email not found" would leak which
        // addresses have accounts (200 vs 500 becomes an oracle).
        console.error('Failed to send password reset email:', emailError);
      }
    }

    // Same response whether or not the email has an account, and whether or
    // not delivery succeeded - avoids leaking which addresses are registered.
    return NextResponse.json({
      success: true,
      message: 'If that email has a Plus account, a reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot-password error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
