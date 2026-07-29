import IORedis from 'ioredis'

declare global {
  // eslint-disable-next-line no-var
  var __aiRedis__: IORedis | undefined
}

function createRedis(): IORedis | null {
  try {
    const redisUrl = process.env.REDIS_URL?.trim()
    if (redisUrl) {
      return new IORedis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        connectTimeout: 2000,
      })
    }

    const host = process.env.REDIS_HOST?.trim()
    if (!host) return null

    return new IORedis({
      host,
      port: Number(process.env.REDIS_PORT?.trim() || '6379'),
      password: process.env.REDIS_PASSWORD?.trim() || undefined,
      db: process.env.REDIS_DB ? Number(process.env.REDIS_DB) : undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      connectTimeout: 2000,
    })
  } catch {
    return null
  }
}

function getRedis(): IORedis | null {
  if (globalThis.__aiRedis__ === undefined) {
    globalThis.__aiRedis__ = createRedis() ?? undefined
  }
  return globalThis.__aiRedis__ ?? null
}

/**
 * Get a cached JSON value, or compute and store it.
 * Falls back to the loader when Redis is unavailable.
 */
export async function cachedJson<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const redis = getRedis()
  if (!redis) return loader()

  try {
    if (redis.status !== 'ready') {
      await redis.connect().catch(() => null)
    }
    const hit = await redis.get(key)
    if (hit) return JSON.parse(hit) as T
  } catch {
    // ignore cache read failures
  }

  const value = await loader()

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch {
    // ignore cache write failures
  }

  return value
}
