import { Redis } from "ioredis";

export type { Redis };

let client: Redis | null | undefined;

const log = (level: "info" | "error", msg: string, fields: Record<string, unknown> = {}) =>
  (level === "error" ? console.error : console.log)(
    JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields }),
  );

/**
 * The shared Redis connection, created on first use from REDIS_URL.
 * Returns null when REDIS_URL is not set: callers then use their in-memory fallback.
 */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.REDIS_URL;
  if (!url) return (client = null);

  // Fail fast (one retry) so a Redis outage shows up as an error instead of a hung request.
  const redis = new Redis(url, { maxRetriesPerRequest: 1 });
  let errorLogged = false;
  redis.on("ready", () => {
    errorLogged = false;
    log("info", "redis connected");
  });
  redis.on("error", (e: Error) => {
    if (errorLogged) return;
    errorLogged = true;
    // Only the message: it never contains the password from REDIS_URL.
    log("error", "redis error", { error: e.message });
  });
  return (client = redis);
}

/** Closes the shared connection (graceful shutdown). Safe to call when Redis is not used. */
export async function closeRedis(): Promise<void> {
  const redis = client;
  client = undefined;
  if (!redis) return;
  await redis.quit().catch(() => redis.disconnect());
}
