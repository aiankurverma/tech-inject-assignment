import { useEffect, useState } from "react";

/** Parsed "t=1714000000,v1=abc…,v1=def…" signature header (Stripe / Svix style). */
export interface ParsedSignature {
  timestamp: number | null;
  signatures: string[];
}

export function parseSignatureHeader(header: string | undefined | null): ParsedSignature {
  const out: ParsedSignature = { timestamp: null, signatures: [] };
  if (!header) return out;
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t") out.timestamp = Number(v);
    else if (k.startsWith("v")) out.signatures.push(v.toLowerCase());
  }
  return out;
}

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

/** HMAC-SHA256 hex digest via WebCrypto. Throws when SubtleCrypto is unavailable (insecure origin). */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto is unavailable (page must be served over HTTPS)");
  const enc = new TextEncoder();
  const key = await subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await subtle.sign("HMAC", key, enc.encode(message)));
}

/** Length-independent comparison so the helper does not model a timing-unsafe check. */
export function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export type SignatureCheck =
  | { state: "idle" }
  | { state: "computing" }
  | { state: "error"; message: string }
  | {
      state: "done";
      expected: string;
      valid: boolean;
      /** Seconds between the signed timestamp and the attempt; null when unsigned. */
      skewSeconds: number | null;
      withinTolerance: boolean;
    };

/**
 * Recomputes `HMAC_SHA256(secret, "${t}.${payload}")` and compares it with every v1 signature in the
 * header. Debounced so typing a secret does not hash on each keystroke.
 */
export function useWebhookSignature(opts: {
  secret: string;
  payload: string;
  header: string | undefined;
  attemptedAtMs: number;
  toleranceSeconds?: number;
}): SignatureCheck {
  const { secret, payload, header, attemptedAtMs, toleranceSeconds = 300 } = opts;
  const [result, setResult] = useState<SignatureCheck>({ state: "idle" });
  useEffect(() => {
    if (!secret) {
      setResult({ state: "idle" });
      return;
    }
    let cancelled = false;
    setResult({ state: "computing" });
    const id = setTimeout(() => {
      const parsed = parseSignatureHeader(header);
      const signed = parsed.timestamp != null ? `${parsed.timestamp}.${payload}` : payload;
      hmacSha256Hex(secret, signed).then(
        (expected) => {
          if (cancelled) return;
          const skew =
            parsed.timestamp != null && Number.isFinite(attemptedAtMs)
              ? Math.round(attemptedAtMs / 1000 - parsed.timestamp)
              : null;
          setResult({
            state: "done",
            expected,
            valid: parsed.signatures.some((s) => safeEqual(s, expected)),
            skewSeconds: skew,
            withinTolerance: skew == null || Math.abs(skew) <= toleranceSeconds,
          });
        },
        (e: unknown) => {
          if (!cancelled)
            setResult({ state: "error", message: e instanceof Error ? e.message : String(e) });
        },
      );
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [secret, payload, header, attemptedAtMs, toleranceSeconds]);
  return result;
}
