export interface Decision {
  allowed: boolean;
  /** How long until the next request would be allowed (0 when allowed). */
  retryAfterMs: number;
}

/** A rate-limit algorithm: records one hit for `key` and says whether it is allowed. */
export interface Limiter {
  hit(key: string): Promise<Decision>;
}
