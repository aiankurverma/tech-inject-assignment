// OKLCH colour tools for the Theme Studio: scales, harmonies, light/dark derivation and
// contrast fixing. culori does the colour-space maths; everything here stays pure so the API
// and the browser share it.

import { clampChroma, formatHex, oklch as toOklchMode, parse } from "culori";
import { contrast, parseColor, toHex } from "./color";

export interface Oklch {
  /** Lightness 0..1 */
  l: number;
  /** Chroma 0..~0.4 */
  c: number;
  /** Hue in degrees 0..360 */
  h: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const wrapHue = (h: number) => ((h % 360) + 360) % 360;

/** Any CSS colour -> OKLCH, or null when it cannot be parsed. */
export function toOklch(color: string): Oklch | null {
  const parsed = parse(color.trim()) ?? rgbFallback(color);
  if (!parsed) return null;
  const ok = toOklchMode(parsed);
  if (!ok) return null;
  return { l: clamp01(ok.l), c: Math.max(0, ok.c), h: Number.isFinite(ok.h) ? wrapHue(ok.h!) : 0 };
}

/** Our own parser covers the computed-style syntaxes culori's CSS parser may not. */
function rgbFallback(color: string) {
  const rgb = parseColor(color);
  return rgb ? { mode: "rgb" as const, r: rgb.r / 255, g: rgb.g / 255, b: rgb.b / 255 } : null;
}

/** OKLCH -> sRGB hex. Out-of-gamut colours lose chroma (not lightness) until they fit. */
export function fromOklch({ l, c, h }: Oklch): string {
  const safe = clampChroma(
    { mode: "oklch" as const, l: clamp01(l), c: Math.max(0, c), h: wrapHue(h) },
    "oklch",
  );
  return formatHex(safe);
}

/** Returns `color` with some OKLCH channels replaced. Unparseable input comes back as-is. */
export function withOklch(color: string, patch: Partial<Oklch>): string {
  const ok = toOklch(color);
  return ok ? fromOklch({ ...ok, ...patch }) : color;
}

/** Perceptual mix in OKLCH (hue takes the short arc). `t` = 0 is `a`, 1 is `b`. */
export function mixOklch(a: string, b: string, t: number): string {
  const x = toOklch(a);
  const y = toOklch(b);
  if (!x || !y) return a;
  const k = clamp01(t);
  // Achromatic ends have no hue of their own; borrow the other side's so grey mixes stay clean.
  const hx = x.c < 0.005 ? y.h : x.h;
  const hy = y.c < 0.005 ? hx : y.h;
  let dh = hy - hx;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return fromOklch({ l: x.l + (y.l - x.l) * k, c: x.c + (y.c - x.c) * k, h: hx + dh * k });
}

/** True when the colour is closer to white than black (OKLCH lightness above 0.6). */
export const isLightColor = (color: string) => (toOklch(color)?.l ?? 0) > 0.6;

/* ------------------------------------------------------------------ scales */

export const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type ScaleStep = (typeof SCALE_STEPS)[number];
export type Scale = Record<ScaleStep, string>;

/** Target lightness per step; 500 sits where most brand colours live. */
const STEP_LIGHTNESS: Record<ScaleStep, number> = {
  50: 0.975,
  100: 0.95,
  200: 0.9,
  300: 0.83,
  400: 0.74,
  500: 0.64,
  600: 0.56,
  700: 0.48,
  800: 0.4,
  900: 0.32,
  950: 0.24,
};

/** Chroma a hue can hold peaks mid-scale and fades toward white and black. */
const chromaCurve = (l: number) => Math.max(0.15, 1 - ((l - 0.62) / 0.45) ** 2);

/**
 * 50..950 ramp from one base colour, keeping its hue. The step nearest the base's lightness is
 * the base itself, so a brand colour always appears verbatim in its own scale.
 */
export function generateScale(base: string): Scale {
  const ok = toOklch(base) ?? { l: 0.5, c: 0, h: 0 };
  const nearest = SCALE_STEPS.reduce((best, s) =>
    Math.abs(STEP_LIGHTNESS[s] - ok.l) < Math.abs(STEP_LIGHTNESS[best] - ok.l) ? s : best,
  );
  const scale = {} as Scale;
  for (const step of SCALE_STEPS) {
    if (step === nearest) {
      scale[step] = fromOklch(ok);
      continue;
    }
    const l = STEP_LIGHTNESS[step];
    const c = Math.min(ok.c * 1.15, (ok.c * chromaCurve(l)) / chromaCurve(ok.l));
    scale[step] = fromOklch({ l, c, h: ok.h });
  }
  return scale;
}

/** Near-grey ramp tinted with the base's hue (used for the neutral scale). */
export function generateNeutralScale(base: string): Scale {
  const ok = toOklch(base) ?? { l: 0.5, c: 0, h: 0 };
  return generateScale(fromOklch({ l: 0.5, c: Math.min(ok.c, 0.02), h: ok.h }));
}

/* ---------------------------------------------------------------- harmony */

export type HarmonyScheme = "analogous" | "complementary" | "triadic" | "split" | "mono";
export const HARMONY_SCHEMES: HarmonyScheme[] = [
  "analogous",
  "complementary",
  "triadic",
  "split",
  "mono",
];

const HARMONY_OFFSETS: Record<HarmonyScheme, number[]> = {
  analogous: [30, -30],
  complementary: [180],
  triadic: [120, 240],
  split: [150, 210],
  mono: [0],
};

/** Hues (degrees) that pair with `primary` under a colour-harmony scheme, primary first. */
export function harmonyHues(primary: string, scheme: HarmonyScheme): number[] {
  const h = toOklch(primary)?.h ?? 0;
  return [h, ...HARMONY_OFFSETS[scheme].map((d) => wrapHue(h + d))];
}

/**
 * Companion colours for `primary`: the accent takes the first harmony hue with the primary's
 * lightness and slightly less chroma; surfaces get a faint tint of the primary hue.
 */
export function harmonize(
  primary: string,
  scheme: HarmonyScheme,
): { accent: string; tintHue: number } {
  const ok = toOklch(primary) ?? { l: 0.6, c: 0.2, h: 260 };
  const [, accentHue = ok.h] = harmonyHues(primary, scheme);
  const accent = fromOklch({
    l: scheme === "mono" ? clamp01(ok.l + 0.15) : ok.l,
    c: Math.max(0.06, ok.c * 0.8),
    h: accentHue,
  });
  return { accent, tintHue: ok.h };
}

/* --------------------------------------------------------------- contrast */

/** WCAG contrast between two CSS colours; 1 when either cannot be parsed. */
export function contrastOf(fg: string, bg: string): number {
  const a = parseColor(fg) ?? parseColor(fromOklch(toOklch(fg) ?? { l: 0, c: 0, h: 0 }));
  const b = parseColor(bg) ?? parseColor(fromOklch(toOklch(bg) ?? { l: 1, c: 0, h: 0 }));
  return a && b ? contrast(a, b) : 1;
}

/**
 * Smallest lightness change to `fg` that reaches `min` contrast against `bg` (hue and chroma
 * stay). Moves away from the background's lightness; falls back to black/white when even the
 * extreme cannot pass (a mid-grey background, for example).
 */
export function fixContrast(fg: string, bg: string, min: number): string {
  if (contrastOf(fg, bg) >= min) return fg;
  const ok = toOklch(fg);
  const bgOk = toOklch(bg);
  if (!ok || !bgOk) return fg;
  const lighten = bgOk.l < 0.5;
  const extreme = lighten ? 1 : 0;
  const reaches = (l: number) => contrastOf(fromOklch({ ...ok, l }), bg) >= min;
  if (!reaches(extreme)) {
    // Even the extreme hue-preserving colour fails; pure black/white is the best available.
    const bw = lighten ? "#ffffff" : "#000000";
    const alt = lighten ? "#000000" : "#ffffff";
    return contrastOf(bw, bg) >= contrastOf(alt, bg) ? bw : alt;
  }
  let lo = ok.l;
  let hi = extreme;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (reaches(mid)) hi = mid;
    else lo = mid;
  }
  return fromOklch({ ...ok, l: hi });
}

/** Normalised 6-digit hex for any parseable colour, else null. */
export function toHexColor(color: string): string | null {
  const rgb = parseColor(color);
  if (rgb) return toHex(rgb);
  const ok = toOklch(color);
  return ok ? fromOklch(ok) : null;
}
