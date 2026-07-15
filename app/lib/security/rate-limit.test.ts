import { describe, expect, it } from 'vitest';
import { checkRateLimit } from './rate-limit';

// These tests exercise the in-memory fallback path (no REDIS_URL in the test
// environment) - the Redis-backed path is verified against a real project
// once REDIS_URL is configured.
describe('checkRateLimit (in-memory fallback)', () => {
  it('allows requests up to the limit and blocks the one after', async () => {
    const key = `test-${crypto.randomUUID()}`;

    const first = await checkRateLimit(key, 3, 60_000);
    const second = await checkRateLimit(key, 3, 60_000);
    const third = await checkRateLimit(key, 3, 60_000);
    const fourth = await checkRateLimit(key, 3, 60_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(true);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it('tracks separate keys independently', async () => {
    const keyA = `test-${crypto.randomUUID()}`;
    const keyB = `test-${crypto.randomUUID()}`;

    await checkRateLimit(keyA, 1, 60_000);
    const aSecond = await checkRateLimit(keyA, 1, 60_000);
    const bFirst = await checkRateLimit(keyB, 1, 60_000);

    expect(aSecond.allowed).toBe(false);
    expect(bFirst.allowed).toBe(true);
  });

  it('resets the count once the window elapses', async () => {
    const key = `test-${crypto.randomUUID()}`;

    const first = await checkRateLimit(key, 1, 10);
    expect(first.allowed).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const afterWindow = await checkRateLimit(key, 1, 10);
    expect(afterWindow.allowed).toBe(true);
  });
});
