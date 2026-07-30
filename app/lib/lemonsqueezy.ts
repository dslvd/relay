import { createHmac, timingSafeEqual } from 'crypto';

const API_BASE = 'https://api.lemonsqueezy.com/v1';

export function hasLemonSqueezyConfigured(): boolean {
  return Boolean(
    process.env.LEMONSQUEEZY_API_KEY &&
    process.env.LEMONSQUEEZY_STORE_ID &&
    process.env.LEMONSQUEEZY_VARIANT_ID
  );
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

// Lemon Squeezy has no "create product" API - checkouts must reference a
// variant already created in the dashboard (see LEMONSQUEEZY_VARIANT_ID).
// The price actually charged comes from that variant's configuration, not
// from anything in this codebase.
export async function createLemonSqueezyCheckout(input: {
  email: string;
  redirectUrl: string;
}): Promise<string> {
  const apiKey = getRequiredEnv('LEMONSQUEEZY_API_KEY');
  const storeId = getRequiredEnv('LEMONSQUEEZY_STORE_ID');
  const variantId = getRequiredEnv('LEMONSQUEEZY_VARIANT_ID');

  const res = await fetch(`${API_BASE}/checkouts`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          product_options: { redirect_url: input.redirectUrl },
          checkout_data: { email: input.email },
        },
        relationships: {
          store: { data: { type: 'stores', id: storeId } },
          variant: { data: { type: 'variants', id: variantId } },
        },
      },
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = payload?.errors?.[0]?.detail || 'Failed to create checkout';
    throw new Error(detail);
  }

  const url = payload?.data?.attributes?.url;
  if (!url) {
    throw new Error('Lemon Squeezy did not return a checkout URL');
  }

  return url as string;
}

// Lemon Squeezy signs each webhook delivery with HMAC-SHA256 over the raw
// body, sent in the X-Signature header - verify with the secret supplied at
// webhook-creation time (see LEMONSQUEEZY_WEBHOOK_SECRET), which Lemon
// Squeezy never returns again after creation.
export function verifyLemonSqueezyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(signatureHeader, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}
