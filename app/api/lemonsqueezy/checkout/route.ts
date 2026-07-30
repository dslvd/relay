import { NextRequest, NextResponse } from 'next/server';
import { createLemonSqueezyCheckout, hasLemonSqueezyConfigured } from '@/app/lib/lemonsqueezy';
import { checkRateLimit } from '@/app/lib/security/rate-limit';
import { PLUS_CHECKOUT_ENABLED, PLUS_CHECKOUT_CONTACT_EMAIL } from '@/app/lib/plan-limits';

const MAX_CHECKOUTS_PER_HOUR = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  if (!PLUS_CHECKOUT_ENABLED) {
    return NextResponse.json(
      { error: `Relay Plus checkout is under construction. Please contact ${PLUS_CHECKOUT_CONTACT_EMAIL} for early access.` },
      { status: 503 }
    );
  }

  if (!hasLemonSqueezyConfigured()) {
    return NextResponse.json({ error: 'Checkout is not configured yet' }, { status: 503 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown';

  const rateLimit = await checkRateLimit(`checkout:${ip}`, MAX_CHECKOUTS_PER_HOUR, RATE_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin).replace(/\/+$/, '');
    const url = await createLemonSqueezyCheckout({
      email,
      redirectUrl: `${baseUrl}/plus?checkout=success`,
    });

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('Failed to create Lemon Squeezy checkout:', error);
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 });
  }
}
