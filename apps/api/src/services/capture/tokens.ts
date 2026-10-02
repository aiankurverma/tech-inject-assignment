// Pure token maths for the Capture Engine: colour clustering + roles, scale detection, theme CSS.
// No I/O here, so every function is unit-tested (capture.test.ts).

import {
  chroma,
  contrast,
  deltaE,
  lightness,
  parseColor,
  readableOn,
  toHex,
  type Rgb,
} from "@ti/core";

export { chroma, contrast, deltaE, lightness, parseColor, toHex, toLab, type Rgb } from "@ti/core";

/** Where a colour was seen. Weight = painted area for backgrounds, element count otherwise. */
export type ColorUse = "bg" | "text" | "border";

export interface ColorSample {
  value: string;
  use: ColorUse;
  weight: number;
}

export interface ColorCluster {
  hex: string;
  weight: number;
  uses: Record<ColorUse, number>;
  /** How many raw colours were merged into this one. */
  members: number;
}

export type ColorRole = "bg" | "surface" | "text" | "mutedText" | "border" | "accent";

export interface ScaleStep {
  value: number;
  count: number;
}

export interface CaptureTokens {
  palette: ColorCluster[];
  roles: Partial<Record<ColorRole, string>>;
  fonts: { family: string; count: number }[];
  typeScale: { steps: ScaleStep[]; ratio: number | null };
  radii: ScaleStep[];
  spacing: { steps: ScaleStep[]; base: number | null };
  shadows: { value: string; count: number }[];
}

/** Raw counts collected in the page (see browser.ts EXTRACT). */
export interface RawStyles {
  colors: ColorSample[];
  fonts: Record<string, number>;
  fontSizes: Record<string, number>;
  radii: Record<string, number>;
  spacing: Record<string, number>;
  shadows: Record<string, number>;
}

/**
 * Greedy weighted clustering: heaviest colours seed clusters, lighter ones join the nearest
 * seed within `threshold` delta E. Fully transparent colours are dropped; the cluster keeps
 * the seed's exact hex (a real value from the site, not an average nobody used).
 */
export function clusterColors(samples: ColorSample[], threshold = 8, max = 16): ColorCluster[] {
  const byHex = new Map<string, { rgb: Rgb; weight: number; uses: Record<ColorUse, number> }>();
  for (const s of samples) {
    const rgb = parseColor(s.value);
    if (!rgb || rgb.a < 0.1 || s.weight <= 0) continue;
    const hex = toHex(rgb);
    const e = byHex.get(hex) ?? { rgb, weight: 0, uses: { bg: 0, text: 0, border: 0 } };
    e.weight += s.weight;
    e.uses[s.use] += s.weight;
    byHex.set(hex, e);
  }
  const sorted = [...byHex.entries()].sort((a, b) => b[1].weight - a[1].weight);
  const clusters: (ColorCluster & { rgb: Rgb })[] = [];
  for (const [hex, e] of sorted) {
    let best: (typeof clusters)[number] | undefined;
    let bestD = Infinity;
    for (const c of clusters) {
      const d = deltaE(c.rgb, e.rgb);
      if (d < bestD) [best, bestD] = [c, d];
    }
    if (best && bestD <= threshold) {
      best.weight += e.weight;
      best.members += 1;
      for (const u of ["bg", "text", "border"] as const) best.uses[u] += e.uses[u];
    } else {
      clusters.push({ hex, rgb: e.rgb, weight: e.weight, uses: { ...e.uses }, members: 1 });
    }
  }
  return clusters
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max)
    .map(({ rgb: _rgb, ...c }) => c);
}

/**
 * Guesses semantic roles from where each cluster was used:
 * bg = biggest painted background; surface = next background close in lightness;
 * text = most-used text colour with readable contrast; mutedText = next text colour;
 * border = most-used border colour; accent = heaviest saturated colour (chroma > 30).
 */
export function guessRoles(palette: ColorCluster[]): Partial<Record<ColorRole, string>> {
  const rgb = (c: ColorCluster) => parseColor(c.hex)!;
  const top = (use: ColorUse, skip: string[] = []) =>
    palette
      .filter((c) => c.uses[use] > 0 && !skip.includes(c.hex))
      .sort((a, b) => b.uses[use] - a.uses[use]);
  const roles: Partial<Record<ColorRole, string>> = {};

  const bg = top("bg").find((c) => chroma(rgb(c)) < 30) ?? top("bg")[0];
  if (bg) roles.bg = bg.hex;
  const bgRgb = bg ? rgb(bg) : { r: 255, g: 255, b: 255, a: 1 };

  const surface = top("bg", bg ? [bg.hex] : []).find((c) => {
    const d = Math.abs(lightness(rgb(c)) - lightness(bgRgb));
    return d > 0.5 && d < 20 && chroma(rgb(c)) < 30;
  });
  if (surface) roles.surface = surface.hex;

  const texts = top("text").filter((c) => contrast(rgb(c), bgRgb) >= 3);
  if (texts[0]) roles.text = texts[0].hex;
  const muted = texts.find((c) => c.hex !== texts[0]?.hex && chroma(rgb(c)) < 30);
  if (muted) roles.mutedText = muted.hex;

  const border = top("border").find((c) => c.hex !== roles.text);
  if (border) roles.border = border.hex;

  const accent = palette.find((c) => chroma(rgb(c)) > 30);
  if (accent) roles.accent = accent.hex;
  return roles;
}

/* ------------------------------------------------------------------ scales */

/** Turns `{ "16px": 40, "15.9px": 2 }` into steps, merging values within `snap` px. */
export function detectScale(
  counts: Record<string, number>,
  { snap = 0.5, minCount = 2, max = 12, minValue = 0 } = {},
): ScaleStep[] {
  const raw = Object.entries(counts)
    .map(([k, count]) => ({ value: parseFloat(k), count }))
    .filter((s) => Number.isFinite(s.value) && s.value >= minValue && s.count > 0)
    .sort((a, b) => b.count - a.count);
  const steps: ScaleStep[] = [];
  for (const s of raw) {
    const near = steps.find((t) => Math.abs(t.value - s.value) <= snap);
    if (near) near.count += s.count;
    else steps.push({ value: Math.round(s.value * 100) / 100, count: s.count });
  }
  return steps
    .filter((s) => s.count >= minCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, max)
    .sort((a, b) => a.value - b.value);
}

/** Geometric mean of consecutive step ratios (e.g. 1.25 = major third). Null under 3 steps. */
export function scaleRatio(steps: ScaleStep[]): number | null {
  const v = steps.map((s) => s.value).filter((n) => n > 0);
  if (v.length < 3) return null;
  let logSum = 0;
  for (let i = 1; i < v.length; i++) logSum += Math.log(v[i]! / v[i - 1]!);
  return Math.round(Math.exp(logSum / (v.length - 1)) * 1000) / 1000;
}

/** The grid unit (8, 4 or 2) that divides most of the spacing usage, or null if none fits 60%. */
export function spacingBase(steps: ScaleStep[]): number | null {
  const total = steps.reduce((n, s) => n + s.count, 0);
  if (!total) return null;
  for (const base of [8, 4, 2]) {
    const fit = steps.filter((s) => s.value % base === 0).reduce((n, s) => n + s.count, 0);
    if (fit / total >= 0.6) return base;
  }
  return null;
}

/** First family of a CSS font stack, unquoted ("Inter", system-ui -> Inter). */
export const primaryFamily = (stack: string) =>
  (stack.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");

const topEntries = (m: Record<string, number>, n: number) =>
  Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);

/** Raw page counts -> the saved token set. */
export function buildTokens(raw: RawStyles): CaptureTokens {
  const palette = clusterColors(raw.colors);
  const fontCounts: Record<string, number> = {};
  for (const [stack, n] of Object.entries(raw.fonts)) {
    const f = primaryFamily(stack);
    if (f) fontCounts[f] = (fontCounts[f] ?? 0) + n;
  }
  const typeSteps = detectScale(raw.fontSizes, { snap: 0.5, minCount: 2, max: 10, minValue: 8 });
  const spacingSteps = detectScale(raw.spacing, { snap: 0.5, minCount: 3, max: 12, minValue: 1 });
  return {
    palette,
    roles: guessRoles(palette),
    fonts: topEntries(fontCounts, 5).map(([family, count]) => ({ family, count })),
    typeScale: { steps: typeSteps, ratio: scaleRatio(typeSteps) },
    radii: detectScale(raw.radii, { snap: 0.5, minCount: 2, max: 8, minValue: 1 }),
    spacing: { steps: spacingSteps, base: spacingBase(spacingSteps) },
    shadows: topEntries(raw.shadows, 4).map(([value, count]) => ({ value, count })),
  };
}

/* --------------------------------------------------------------- theme CSS */

const ROLE_VARS: [ColorRole, string][] = [
  ["bg", "--color-crm-bg"],
  ["surface", "--color-crm-card"],
  ["text", "--color-crm-fg"],
  ["mutedText", "--color-crm-soft"],
  ["border", "--color-crm-border"],
  ["accent", "--color-crm-primary"],
];

const cssString = (s: string) => s.replace(/[^\w\s#().,%-]/g, "");

/**
 * A drop-in `@theme` block using the crm-theme.css variable names, so every Kitbase component
 * picks up the captured look. Missing roles are left out (the base theme keeps its value).
 */
export function generateThemeCss(tokens: CaptureTokens, source: string): string {
  const lines: string[] = [];
  const font = tokens.fonts[0]?.family;
  if (font) lines.push(`  --font-crm: "${cssString(font)}", ui-sans-serif, system-ui, sans-serif;`);
  for (const [role, v] of ROLE_VARS) {
    const hex = tokens.roles[role];
    if (hex) lines.push(`  ${v}: ${hex};`);
  }
  if (tokens.roles.accent) {
    const a = parseColor(tokens.roles.accent)!;
    lines.push(`  --color-crm-primary-fg: ${readableOn(toHex(a))};`);
  }
  if (tokens.roles.surface) lines.push(`  --color-crm-raised: ${tokens.roles.surface};`);
  if (tokens.roles.border) lines.push(`  --color-crm-input: ${tokens.roles.border};`);
  // Most-used radius is the default component radius.
  const radius = [...tokens.radii].sort((a, b) => b.count - a.count)[0];
  if (radius) lines.push(`  --radius-crm: ${radius.value}px;`);
  const shadow = tokens.shadows[0];
  if (shadow) lines.push(`  --shadow-crm-raised: ${cssString(shadow.value)};`);
  if (tokens.spacing.base) lines.push(`  --spacing-cap: ${tokens.spacing.base}px;`);
  tokens.typeScale.steps.forEach((s, i) => lines.push(`  --text-cap-${i + 1}: ${s.value}px;`));

  const palette = tokens.palette.map((c, i) => `  --color-cap-${i + 1}: ${c.hex};`);
  return [
    `/* Kitbase theme captured from ${source.replaceAll("*/", "")}`,
    `   Import after crm-theme.css to override it. Review contrast before shipping. */`,
    "",
    "@theme {",
    ...lines,
    "",
    "  /* Full captured palette */",
    ...palette,
    "}",
    "",
  ].join("\n");
}
