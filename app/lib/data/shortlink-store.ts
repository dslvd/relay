import { getRedisClient, hasRedisConfigured } from '@/app/lib/data/redis-client';

export type ShortLinkRecord = {
  url: string;
  createdAt: number;
};

const KEY_PREFIX = 'short:link:'; // + code
const CODE_SET_KEY = 'short:codes';
const MAX_CODES = 25_000;

function getGlobalStore(): Record<string, ShortLinkRecord> {
  if (typeof global.shortLinks === 'undefined') {
    global.shortLinks = {};
  }
  return global.shortLinks;
}

export async function saveShortLink(code: string, url: string, createdAt = Date.now()): Promise<void> {
  const record: ShortLinkRecord = { url, createdAt };

  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(`${KEY_PREFIX}${code}`, JSON.stringify(record));
    // Best-effort pruning. Keep a set of codes to cap growth.
    try {
      await client.sAdd(CODE_SET_KEY, code);
      const size = await client.sCard(CODE_SET_KEY);
      if (size > MAX_CODES) {
        const members = await client.sMembers(CODE_SET_KEY);
        const toRemove = members.slice(0, Math.max(0, members.length - MAX_CODES));
        if (toRemove.length) {
          await client.sRem(CODE_SET_KEY, toRemove);
        }
      }
    } catch {
      // ignore
    }
    return;
  }

  const store = getGlobalStore();
  store[code] = record;
}

export async function loadShortLink(code: string): Promise<ShortLinkRecord | null> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const raw = await client.get(`${KEY_PREFIX}${code}`);
    if (!raw) return null;
    return JSON.parse(raw) as ShortLinkRecord;
  }

  const store = getGlobalStore();
  return store[code] || null;
}

declare global {
  // eslint-disable-next-line no-var
  var shortLinks: Record<string, ShortLinkRecord> | undefined;
}

