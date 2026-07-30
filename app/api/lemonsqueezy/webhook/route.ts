import { NextRequest, NextResponse } from 'next/server';
import { verifyLemonSqueezyWebhookSignature } from '@/app/lib/lemonsqueezy';
import { provisionPlusFromLemonSqueezy, createPasswordResetToken, setPlusPlanStatusBySubscriptionId, type PlusPlanStatus } from '@/app/lib/auth/plus-auth';
import { sendPlusWelcomeEmail } from '@/app/lib/email';

interface LemonSqueezyWebhookBody {
  meta: { event_name: string };
  data: {
    id: string;
    attributes: {
      user_email?: string;
      customer_id?: number | string;
      status?: string;
    };
  };
}

// Maps Lemon Squeezy's subscription statuses onto our internal plan_status.
// on_trial/active keep Plus access; paused/cancelled/unpaid/expired revoke it.
function mapSubscriptionStatus(status: string | undefined): PlusPlanStatus {
  if (status === 'active' || status === 'on_trial') return 'active';
  if (status === 'past_due') return 'past_due';
  return 'canceled';
}

async function handleSubscriptionCreated(request: NextRequest, body: LemonSqueezyWebhookBody) {
  const email = body.data.attributes.user_email;
  const customerId = body.data.attributes.customer_id;
  const subscriptionId = body.data.id;

  if (!email || customerId === undefined || !subscriptionId) {
    console.error('Lemon Squeezy subscription_created missing email/customer/subscription', subscriptionId);
    return;
  }

  await provisionPlusFromLemonSqueezy({
    email,
    lemonSqueezyCustomerId: String(customerId),
    lemonSqueezySubscriptionId: subscriptionId,
  });

  const resetToken = await createPasswordResetToken(email);
  if (resetToken) {
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin).replace(/\/+$/, '');
    const setPasswordUrl = `${baseUrl}/plus/reset?token=${encodeURIComponent(resetToken)}`;
    try {
      await sendPlusWelcomeEmail(email, setPasswordUrl);
    } catch (emailError) {
      console.error('Failed to send Plus welcome email:', emailError);
    }
  }
}

async function handleSubscriptionStatusChange(body: LemonSqueezyWebhookBody) {
  const subscriptionId = body.data.id;
  if (!subscriptionId) return;
  await setPlusPlanStatusBySubscriptionId(subscriptionId, mapSubscriptionStatus(body.data.attributes.status));
}

export async function POST(request: NextRequest) {
  if (!process.env.LEMONSQUEEZY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Lemon Squeezy webhook is not configured' }, { status: 503 });
  }

  const signature = request.headers.get('x-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing X-Signature header' }, { status: 400 });
  }

  const rawBody = await request.text();
  if (!verifyLemonSqueezyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let body: LemonSqueezyWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    switch (body.meta?.event_name) {
      case 'subscription_created':
        await handleSubscriptionCreated(request, body);
        break;
      case 'subscription_updated':
      case 'subscription_cancelled':
      case 'subscription_expired':
        await handleSubscriptionStatusChange(body);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(`Failed to handle Lemon Squeezy event ${body.meta?.event_name}:`, error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
