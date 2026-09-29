/**
 * Integer minor-unit money maths for the CPQ quote builder.
 *
 * Written in-house on purpose: dinero.js is not on the Kitbase allow-list, and quoting needs only a
 * narrow, auditable subset (multiply by integer quantity, apply basis-point discounts, convert with
 * a fixed-point rate, allocate without losing cents). Every amount is an integer count of the
 * currency's minor unit (cents, pence, yen). Intermediate products use BigInt so a 10k-line quote
 * with large quantities can never overflow or pick up float drift. Rounding is half-to-even
 * (banker's rounding), the default for most finance systems.
 */

/** ISO 4217 minor-unit exponents for the currencies we format; unknown codes fall back to 2. */
const EXPONENTS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  INR: 2,
  AUD: 2,
  CAD: 2,
  SGD: 2,
  CHF: 2,
  JPY: 0,
  KRW: 0,
  BHD: 3,
  KWD: 3,
};

export function currencyExponent(code: string): number {
  return EXPONENTS[code.toUpperCase()] ?? 2;
}

/** Rates are fixed-point with 8 decimals (1 USD = 0.92 EUR -> 92_000_000n). */
export const RATE_SCALE = 100_000_000n;

/** Divide with half-to-even rounding. Denominator must be positive. */
export function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError("divRound: denominator must be > 0");
  const negative = numerator < 0n;
  const n = negative ? -numerator : numerator;
  const q = n / denominator;
  const r = n % denominator;
  const twice = r * 2n;
  let result = q;
  if (twice > denominator || (twice === denominator && q % 2n === 1n)) result = q + 1n;
  return negative ? -result : result;
}

function toSafe(v: bigint): number {
  if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError("Money amount exceeds safe integer range");
  }
  return Number(v);
}

/** amount (minor) x integer quantity. */
export function multiply(minor: number, qty: number): number {
  return toSafe(BigInt(minor) * BigInt(Math.trunc(qty)));
}

/** Apply a ratio numerator/denominator with banker's rounding. */
export function scale(minor: number, numerator: number, denominator: number): number {
  return toSafe(divRound(BigInt(minor) * BigInt(numerator), BigInt(denominator)));
}

/** Discount amount for a basis-point rate (1250 bp = 12.5%). */
export function discountAmount(minor: number, basisPoints: number): number {
  return scale(minor, Math.round(basisPoints), 10_000);
}

/** Parse a decimal string rate like "0.92345" into fixed-point bigint. */
export function parseRate(rate: string | number): bigint {
  const s = typeof rate === "number" ? rate.toFixed(8) : rate.trim();
  const m = /^(\d+)(?:\.(\d{0,8})\d*)?$/.exec(s);
  if (!m) throw new RangeError(`Invalid FX rate: ${s}`);
  const whole = BigInt(m[1] ?? "0");
  const frac = BigInt((m[2] ?? "").padEnd(8, "0") || "0");
  return whole * RATE_SCALE + frac;
}

/**
 * Convert a minor amount between currencies. `rate` is the price of 1 unit of `from` expressed in
 * `to`. Exponent differences (USD cents -> JPY yen) are handled exactly.
 */
export function convert(minor: number, from: string, to: string, rate: bigint): number {
  if (from === to) return minor;
  const expDiff = currencyExponent(to) - currencyExponent(from);
  let num = BigInt(minor) * rate;
  let den = RATE_SCALE;
  if (expDiff > 0) num *= 10n ** BigInt(expDiff);
  else if (expDiff < 0) den *= 10n ** BigInt(-expDiff);
  return toSafe(divRound(num, den));
}

/**
 * Split an amount across weights without losing a minor unit (largest-remainder method). Used to
 * spread a header-level discount across lines so the PDF lines sum exactly to the total.
 */
export function allocate(minor: number, weights: readonly number[]): number[] {
  const total = weights.reduce((a, w) => a + Math.max(0, w), 0);
  if (total === 0 || weights.length === 0) return weights.map(() => 0);
  const big = BigInt(minor);
  const t = BigInt(total);
  const parts = weights.map((w) => (big * BigInt(Math.max(0, w))) / t);
  let remainder = big - parts.reduce((a, p) => a + p, 0n);
  const order = weights
    .map((w, i) => ({ i, rem: (big * BigInt(Math.max(0, w))) % t }))
    .sort((a, b) => (b.rem > a.rem ? 1 : b.rem < a.rem ? -1 : a.i - b.i));
  const step = remainder >= 0n ? 1n : -1n;
  for (let k = 0; remainder !== 0n && order.length > 0; k = (k + 1) % order.length) {
    const idx = order[k]!.i;
    parts[idx] = parts[idx]! + step;
    remainder -= step;
  }
  return parts.map(toSafe);
}

/** Major decimal string (e.g. "1299.5") -> minor integer, exact (no float maths). */
export function toMinor(major: string | number, currency: string): number {
  const exp = currencyExponent(currency);
  const s = typeof major === "number" ? major.toFixed(exp) : major.trim();
  const m = /^(-)?(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m) throw new RangeError(`Invalid amount: ${s}`);
  const frac = (m[3] ?? "").padEnd(exp + 1, "0");
  const head = BigInt((m[2] || "0") + frac.slice(0, exp));
  const roundDigit = Number(frac[exp] ?? "0");
  const v = head + (roundDigit >= 5 ? 1n : 0n);
  return toSafe(m[1] ? -v : v);
}

const formatters = new Map<string, Intl.NumberFormat>();

/** Locale-aware currency formatting from minor units. Formatters are cached per locale/currency. */
export function formatMoney(minor: number, currency: string, locale = "en-US"): string {
  const key = `${locale}|${currency}`;
  let f = formatters.get(key);
  if (!f) {
    const exp = currencyExponent(currency);
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: exp,
      maximumFractionDigits: exp,
    });
    formatters.set(key, f);
  }
  const exp = currencyExponent(currency);
  // Divide via string to keep exactness for display.
  const negative = minor < 0;
  const abs = Math.abs(minor)
    .toString()
    .padStart(exp + 1, "0");
  const major = exp === 0 ? abs : `${abs.slice(0, -exp)}.${abs.slice(-exp)}`;
  return f.format(Number(`${negative ? "-" : ""}${major}`));
}

/** Basis points -> "12.5%". */
export function formatBp(bp: number): string {
  return `${(bp / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}
