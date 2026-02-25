import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnecting: Promise<ReturnType<typeof createClient>> | null = null;

async function connectRedis(url: string, forceTls: boolean) {
  const client = createClient({
    url,
    socket: forceTls
      ? {
          tls: true,
          rejectUnauthorized: false,
        }
      : undefined,
  });

  client.on('error', (err) => {
    console.error('Redis client error:', err);
    redisClient = null;
  });

  await client.connect();
  return client;
}

export function hasRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export function getRedisClient(): Promise<ReturnType<typeof createClient>> {
  if (redisClient && redisClient.isOpen) {
    return Promise.resolve(redisClient);
  }

  if (redisConnecting) {
    return redisConnecting;
  }

  redisConnecting = (async () => {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    try {
      const client = await connectRedis(url, false);
      redisClient = client;
      redisConnecting = null;
      return client;
    } catch (error) {
      const shouldRetryWithTls = url.startsWith('redis://');
      if (!shouldRetryWithTls) {
        redisConnecting = null;
        throw error;
      }

      const client = await connectRedis(url, true);
      redisClient = client;
      redisConnecting = null;
      return client;
    }
  })();

  return redisConnecting;
}
