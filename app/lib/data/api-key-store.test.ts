import { describe, expect, it } from 'vitest';
import { checkApiKeyRateLimit, createApiKey, revokeApiKey, validateApiKey } from './api-key-store';

describe('api-key-store (in-memory fallback)', () => {
  it('creates a key and validates it by its plain-text value', async () => {
    const { apiKey, plainKey } = await createApiKey({ name: 'Test key' });
    expect(plainKey).toMatch(/^vbc_/);

    const validated = await validateApiKey(plainKey);
    expect(validated?.id).toBe(apiKey.id);
  });

  it('rejects an unknown key', async () => {
    const validated = await validateApiKey('vbc_does-not-exist');
    expect(validated).toBeNull();
  });

  it('rejects a revoked key', async () => {
    const { apiKey, plainKey } = await createApiKey({ name: 'Revoke me' });
    await revokeApiKey(apiKey.id);

    const validated = await validateApiKey(plainKey);
    expect(validated).toBeNull();
  });

  it('enforces requestsPerHour via the shared rate limiter', async () => {
    const { apiKey } = await createApiKey({ name: 'Tight limit', rateLimit: { requestsPerHour: 2 } });

    const first = await checkApiKeyRateLimit(apiKey);
    const second = await checkApiKeyRateLimit(apiKey);
    const third = await checkApiKeyRateLimit(apiKey);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(third).toBe(false);
  });
});
