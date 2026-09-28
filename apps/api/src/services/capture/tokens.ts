// Pure token maths for the Capture Engine: colour clustering + roles, scale detection, theme CSS.
// No I/O here, so every function is unit-tested (capture.test.ts).

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

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

/* ----------------------------------------------------------------- colour */

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** Parses `rgb()/rgba()` (space or comma syntax) and `#rgb/#rrggbb/#rrggbbaa`. */
export function parseColor(input: string): Rgb | null {
  const s = input.trim().toLowerCase();
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const hex = /^#([0-9a-f]{3,8})$/.exec(s)?.[1];
  if (hex) {
    const full =
      hex.length <= 4
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    if (full.length !== 6 && full.length !== 8) return null;
    const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) / 255 : 1 };
  }
  const ok = /^(oklab|oklch)\(([^)]+)\)$/.exec(s);
  if (ok) return parseOklab(ok[1] as "oklab" | "oklch", ok[2]!);
  const cie = /^(lab|lch)\(([^)]+)\)$/.exec(s);
  if (cie) return parseCieLab(cie[1] as "lab" | "lch", cie[2]!);
  const srgb = /^color\(srgb\s+([^)]+)\)$/.exec(s)?.[1];
  if (srgb) {
    const [r, g, b, a] = splitArgs(srgb).map((p) => num(p, 1));
    if ([r, g, b].some((n) => n === undefined || Number.isNaN(n))) return null;
    return { r: clamp(r! * 255), g: clamp(g! * 255), b: clamp(b! * 255), a: a ?? 1 };
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(s)?.[1];
  if (!fn) return null;
  const parts = fn
    .replace("/", " ")
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3) return null;
  const nums = parts.map((p) => (p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p)));
  if (nums.slice(0, 3).some((n) => Number.isNaN(n))) return null;
  const alphaRaw = parts[3];
  const a =
    alphaRaw === undefined
      ? 1
      : alphaRaw.endsWith("%")
        ? parseFloat(alphaRaw) / 100
        : parseFloat(alphaRaw);
  return { r: clamp(nums[0]!), g: clamp(nums[1]!), b: clamp(nums[2]!), a: Number.isNaN(a) ? 1 : a };
}

const splitArgs = (body: string) =>
  body
    .replace("/", " ")
    .split(/[\s,]+/)
    .filter(Boolean);
/** Number or percentage (`pct` = the value 100% maps to). "none" counts as 0. */
const num = (p: string, pct: number) =>
  p === "none" ? 0 : p.endsWith("%") ? (parseFloat(p) / 100) * pct : parseFloat(p);

/** Tailwind v4 and modern sites compute to oklab()/oklch(); convert to sRGB (gamut-clipped). */
function parseOklab(kind: "oklab" | "oklch", body: string): Rgb | null {
  const [p0, p1, p2, p3] = splitArgs(body);
  if (!p0 || !p1 || !p2) return null;
  const L = num(p0, 1);
  let a: number;
  let b: number;
  if (kind === "oklch") {
    const C = num(p1, 0.4);
    const h = (parseFloat(p2) * Math.PI) / 180;
    [a, b] = [C * Math.cos(h), C * Math.sin(h)];
  } else [a, b] = [num(p1, 0.4), num(p2, 0.4)];
  if ([L, a, b].some(Number.isNaN)) return null;
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const k = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const enc = (x: number) => {
    const v = Math.max(0, Math.min(1, x));
    return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  };
  const alpha = p3 === undefined ? 1 : num(p3, 1);
  return {
    r: clamp(enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * k)),
    g: clamp(enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * k)),
    b: clamp(enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * k)),
    a: Number.isNaN(alpha) ? 1 : alpha,
  };
}

const encode = (x: number) => {
  const v = Math.max(0, Math.min(1, x));
  return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
};

/** CSS lab()/lch() (CIE, D50) -> sRGB via XYZ with Bradford adaptation to D65. */
function parseCieLab(kind: "lab" | "lch", body: string): Rgb | null {
  const [p0, p1, p2, p3] = splitArgs(body);
  if (!p0 || !p1 || !p2) return null;
  const L = num(p0, 100);
  let a: number;
  let b: number;
  if (kind === "lch") {
    const C = num(p1, 150);
    const h = (parseFloat(p2) * Math.PI) / 180;
    [a, b] = [C * Math.cos(h), C * Math.sin(h)];
  } else [a, b] = [num(p1, 125), num(p2, 125)];
  if ([L, a, b].some(Number.isNaN)) return null;
  const fy = (L + 16) / 116;
  const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (116 * t - 16) / 903.3);
  const X = 0.96422 * inv(fy + a / 500);
  const Y = L > 8 ? fy ** 3 : L / 903.3;
  const Z = 0.82521 * inv(fy - b / 200);
  const alpha = p3 === undefined ? 1 : num(p3, 1);
  return {
    r: clamp(encode(3.1341359569958707 * X - 1.6173863321612538 * Y - 0.4906619460083532 * Z)),
    g: clamp(encode(-0.978795502912089 * X + 1.916254567259524 * Y + 0.03344273116131949 * Z)),
    b: clamp(encode(0.07195537988411677 * X - 0.2289768264158322 * Y + 1.405386058324125 * Z)),
    a: Number.isNaN(alpha) ? 1 : alpha,
  };
}

export const toHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("")}`;

/** sRGB -> CIE Lab (D65). Distances in Lab track what the eye sees far better than RGB. */
export function toLab({ r, g, b }: Rgb): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIE76 delta E. ~2.3 is a just-noticeable difference; ~10 is "clearly another colour". */
export function deltaE(a: Rgb, b: Rgb) {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export const chroma = (c: Rgb) => {
  const [, a, b] = toLab(c);
  return Math.hypot(a, b);
};
export const lightness = (c: Rgb) => toLab(c)[0];

/** WCAG relative-luminance contrast ratio (1..21). */
export function contrast(a: Rgb, b: Rgb) {
  const lum = ({ r, g, b: bl }: Rgb) => {
    const ch = (c: number) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(bl);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
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
    lines.push(
      `  --color-crm-primary-fg: ${contrast(a, parseColor("#fff")!) >= 3 ? "#ffffff" : "#111111"};`,
    );
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
