import type { Request, RequestHandler } from "express";
import type { Limiter } from "./types";

export interface RateLimitOptions {
  algorithm: Limiter;
  /** Who is being limited, e.g. the client IP. */
  key: (req: Request) => string;
  message?: string;
}

/** Express middleware: 429 `{ error: "rate_limited", message }` with a Retry-After header. */
export function rateLimit({
  algorithm,
  key,
  message = "Too many requests. Try again later.",
}: RateLimitOptions): RequestHandler {
  return async (req, res, next) => {
    let decision;
    try {
      decision = await algorithm.hit(key(req));
    } catch (e) {
      // Store down (Redis outage): let the request through rather than take the site down.
      console.error(
        JSON.stringify({ level: "error", msg: "rate limiter unavailable", error: String(e) }),
      );
      return next();
    }
    if (decision.allowed) return next();
    res.set("Retry-After", String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))));
    res.status(429).json({ error: "rate_limited", message });
  };
}
