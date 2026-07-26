import { createHmac } from 'crypto';
import { after } from 'next/server';
import type { ApiKeyRecord } from '@/app/lib/data/api-key-store';

export type FileWebhookEvent = 'file.created' | 'file.deleted';

// Fire-and-forget: scheduled via `after()` so it runs post-response and never
// adds latency to (or can fail) the API call that triggered it.
export function dispatchFileWebhook(
  apiKey: Pick<ApiKeyRecord, 'webhook'>,
  event: FileWebhookEvent,
  data: Record<string, unknown>
): void {
  const webhook = apiKey.webhook;
  if (!webhook?.url) return;

  after(async () => {
    try {
      const payload = JSON.stringify({ event, createdAt: new Date().toISOString(), data });
      const signature = createHmac('sha256', webhook.secret).update(payload).digest('hex');

      await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Relay-Event': event,
          'X-Relay-Signature': `sha256=${signature}`,
        },
        body: payload,
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      console.error(`Webhook dispatch failed for event ${event}:`, error);
    }
  });
}
