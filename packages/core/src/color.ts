// Pure colour maths shared by the Capture Engine (apps/api) and the Theme Studio (apps/web).
// Parses every CSS colour syntax browsers compute to; Lab distance and WCAG contrast.

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

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
