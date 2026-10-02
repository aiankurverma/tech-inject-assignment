// Pure theme generation shared by the Theme Studio (apps/web) and the Capture Engine (apps/api):
// a small editable palette per mode -> every crm-theme.css variable (surfaces, text, borders,
// tag colours, scales, radius, shadows, font, spacing), plus WCAG checks and fixes.

import { contrast, parseColor, toHex } from "./color";
import {
  contrastOf,
  fixContrast,
  fromOklch,
  generateNeutralScale,
  generateScale,
  harmonize,
  isLightColor,
  mixOklch,
  SCALE_STEPS,
  toOklch,
  withOklch,
  type HarmonyScheme,
  type Scale,
} from "./oklch";

export type Density = "compact" | "comfortable" | "spacious";
export type ShadowLevel = "none" | "soft" | "crm";
export type ThemeMode = "light" | "dark";

/** Editable colours of one mode. Everything else in crm-theme.css derives from these. */
export interface ThemePalette {
  primary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  /** Raw crm-theme.css variable overrides applied last (`--color-crm-raised: #222`). */
  overrides: Record<string, string>;
}

/** Shape and type settings shared by both modes. */
export interface ThemeShape {
  /** Component radius in px. */
  radius: number;
  /** Primary font family name (fallback stack is appended). */
  font: string;
  density: Density;
  shadow: ShadowLevel;
}

/** One mode, fully specified: what `themeVariables` renders. */
export interface ThemeSpec extends ThemePalette, ThemeShape {}

/** A complete studio theme: both modes plus which one is being edited. */
export interface Theme {
  name: string;
  mode: ThemeMode;
  /** When true the dark palette is always derived from the light one. */
  autoDark: boolean;
  light: ThemePalette;
  dark: ThemePalette;
  shape: ThemeShape;
}

export const PALETTE_KEYS = [
  "primary",
  "accent",
  "bg",
  "surface",
  "text",
  "muted",
  "border",
  "success",
  "warning",
  "danger",
] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];

/** The stock dark CRM theme (packages/ui/src/styles/crm-theme.css). */
export const DEFAULT_THEME: ThemeSpec = {
  primary: "#4124fb",
  accent: "#676767",
  bg: "#161616",
  surface: "#1b1d20",
  text: "#f9fbff",
  muted: "#a4a4a4",
  border: "#232323",
  success: "#22c55e",
  warning: "#fbbf24",
  danger: "#f97373",
  overrides: {},
  radius: 8,
  font: "Geist",
  density: "comfortable",
  shadow: "crm",
};

/** Tailwind v4 `--spacing` base per density (stock is 0.25rem). */
export const DENSITY_SPACING: Record<Density, string> = {
  compact: "0.2rem",
  comfortable: "0.25rem",
  spacious: "0.3rem",
};

const hex = (c: string, fallback: string) => {
  const rgb = parseColor(c);
  if (rgb) return toHex(rgb);
  const ok = toOklch(c);
  return ok ? fromOklch(ok) : fallback;
};

/** Keeps a font name safe inside a CSS string. */
export const cssFontName = (s: string) => s.replace(/[^\w\s.-]/g, "").trim();

/** Keeps an override value safe inside a declaration (no `;`, braces, comments or newlines). */
export const cssValue = (s: string) =>
  s
    .replace(/[;{}]/g, "")
    .replace(/\/\*|\*\//g, "")
    .replace(/\s+/g, " ")
    .trim();

/** White when it reads at AA (4.5:1) on `bg`, otherwise whichever of white / near-black reads better. */
export function readableOn(bg: string): string {
  const rgb = parseColor(bg);
  if (!rgb) return "#ffffff";
  const white = contrast(rgb, parseColor("#ffffff")!);
  if (white >= 4.5) return "#ffffff";
  return white >= contrast(rgb, parseColor("#111111")!) ? "#ffffff" : "#111111";
}

/* -------------------------------------------------------------- normalise */

const isDensity = (d: unknown): d is Density => typeof d === "string" && d in DENSITY_SPACING;
const SHADOWS: ShadowLevel[] = ["none", "soft", "crm"];
const isShadow = (s: unknown): s is ShadowLevel => SHADOWS.includes(s as ShadowLevel);

function normalizeOverrides(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v !== "string" || !/^--[\w-]+$/.test(k)) continue;
    const value = cssValue(v);
    if (value) out[k] = value;
  }
  return out;
}

export function normalizePalette(input: Partial<ThemePalette>, base = DEFAULT_THEME): ThemePalette {
  const pick = (key: PaletteKey) => hex(input[key] ?? "", base[key]);
  return {
    primary: pick("primary"),
    accent: pick("accent"),
    bg: pick("bg"),
    surface: pick("surface"),
    text: pick("text"),
    muted: pick("muted"),
    border: pick("border"),
    success: pick("success"),
    warning: pick("warning"),
    danger: pick("danger"),
    overrides: normalizeOverrides(input.overrides),
  };
}

export function normalizeShape(input: Partial<ThemeShape>, base = DEFAULT_THEME): ThemeShape {
  const radius = Number(input.radius);
  return {
    radius:
      input.radius !== undefined && Number.isFinite(radius)
        ? Math.max(0, Math.min(32, Math.round(radius)))
        : base.radius,
    font: cssFontName(input.font ?? "") || base.font,
    density: isDensity(input.density) ? input.density : base.density,
    shadow: isShadow(input.shadow) ? input.shadow : base.shadow,
  };
}

/** The palette part of a full spec (drops radius, font, density, shadow). */
export function paletteOf(spec: ThemeSpec): ThemePalette {
  const palette = { overrides: spec.overrides } as ThemePalette;
  for (const key of PALETTE_KEYS) palette[key] = spec[key];
  return palette;
}

/** Normalises every field so the output is always valid CSS whatever the input. */
export function normalizeTheme(input: Partial<ThemeSpec>, base = DEFAULT_THEME): ThemeSpec {
  return { ...normalizePalette(input, base), ...normalizeShape(input, base) };
}

/* ------------------------------------------------------------- derivation */

/** Lightness each surface role sits at in a mode; hue and chroma are kept from the source. */
const ROLE_LIGHTNESS: Record<
  ThemeMode,
  Record<"bg" | "surface" | "border" | "text" | "muted", number>
> = {
  dark: { bg: 0.19, surface: 0.22, border: 0.27, text: 0.98, muted: 0.72 },
  light: { bg: 0.99, surface: 0.975, border: 0.9, text: 0.2, muted: 0.5 },
};

/**
 * Builds the other mode from a palette: surfaces flip to the target mode's lightness (hue and
 * tint kept), brand and semantic colours are nudged only as far as contrast requires.
 */
export function deriveMode(palette: ThemePalette, target: ThemeMode): ThemePalette {
  const roles = ROLE_LIGHTNESS[target];
  const bg = withOklch(palette.bg, { l: roles.bg });
  const nudge = (c: string, min: number) => fixContrast(c, bg, min);
  return {
    ...palette,
    bg,
    surface: withOklch(palette.surface, { l: roles.surface }),
    border: withOklch(palette.border, { l: roles.border }),
    text: withOklch(palette.text, { l: roles.text }),
    muted: withOklch(palette.muted, { l: roles.muted }),
    primary: nudge(palette.primary, 3),
    accent: nudge(palette.accent, 3),
    success: nudge(palette.success, 3),
    warning: nudge(palette.warning, 3),
    danger: nudge(palette.danger, 3),
    overrides: {},
  };
}

/** The dark palette that applies: derived from light when `autoDark`, else the stored one. */
export function resolveTheme(theme: Theme): Theme {
  return theme.autoDark ? { ...theme, dark: deriveMode(theme.light, "dark") } : theme;
}

/** One renderable spec for a mode of the theme (defaults to the mode being edited). */
export function modeSpec(theme: Theme, mode: ThemeMode = theme.mode): ThemeSpec {
  const t = resolveTheme(theme);
  return { ...t[mode], ...t.shape };
}

/** A full theme from a single palette; the other mode is derived. */
export function themeFromSpec(spec: ThemeSpec, mode: ThemeMode, name = "Custom"): Theme {
  const palette = normalizePalette(spec);
  const other = deriveMode(palette, mode === "light" ? "dark" : "light");
  return {
    name,
    mode,
    autoDark: false,
    light: mode === "light" ? palette : other,
    dark: mode === "dark" ? palette : other,
    shape: normalizeShape(spec),
  };
}

export const DEFAULT_THEME_DOC: Theme = themeFromSpec(DEFAULT_THEME, "dark", "CRM default");

/** Validates an untrusted theme document (localStorage, share link); fields fall back. */
export function normalizeThemeDoc(input: unknown): Theme {
  const d = DEFAULT_THEME_DOC;
  if (!input || typeof input !== "object") return d;
  const t = input as Partial<Record<keyof Theme, unknown>>;
  const light = normalizePalette((t.light ?? {}) as Partial<ThemePalette>, {
    ...d.light,
    ...d.shape,
  });
  const dark = normalizePalette((t.dark ?? {}) as Partial<ThemePalette>, {
    ...d.dark,
    ...d.shape,
  });
  return {
    name: typeof t.name === "string" ? t.name.slice(0, 60).trim() || d.name : d.name,
    mode: t.mode === "light" ? "light" : "dark",
    autoDark: t.autoDark === true,
    light,
    dark,
    shape: normalizeShape((t.shape ?? {}) as Partial<ThemeShape>),
  };
}

/* ---------------------------------------------------------------- presets */

export interface ThemePreset {
  id: string;
  name: string;
  theme: Theme;
}

const preset = (
  id: string,
  name: string,
  mode: ThemeMode,
  colours: Partial<ThemePalette>,
  shape: Partial<ThemeShape> = {},
): ThemePreset => ({
  id,
  name,
  theme: themeFromSpec(normalizeTheme({ ...colours, ...shape }), mode, name),
});

/** CRM stock plus curated looks. Each defines one mode; the other is derived. */
export const THEME_PRESETS: ThemePreset[] = [
  { id: "crm", name: "CRM default", theme: DEFAULT_THEME_DOC },
  preset("midnight", "Midnight", "dark", {
    primary: "#7c6cff",
    accent: "#3b3f6b",
    bg: "#0b0d1a",
    surface: "#12152a",
    text: "#eef0ff",
    muted: "#9aa0c7",
    border: "#1f2342",
  }),
  preset("ocean", "Ocean", "dark", {
    primary: "#0ea5e9",
    accent: "#155e75",
    bg: "#061a24",
    surface: "#0a2431",
    text: "#e6f6fb",
    muted: "#8fb5c2",
    border: "#123241",
  }),
  preset("forest", "Forest", "dark", {
    primary: "#34d399",
    accent: "#2f6b4f",
    bg: "#0c1a12",
    surface: "#12241a",
    text: "#ecfdf3",
    muted: "#96b8a5",
    border: "#1d3527",
  }),
  preset("sunset", "Sunset", "dark", {
    primary: "#f97316",
    accent: "#9a3412",
    bg: "#1c1210",
    surface: "#261916",
    text: "#fff4ee",
    muted: "#c2a69b",
    border: "#3a2622",
    warning: "#fbbf24",
  }),
  preset(
    "mono",
    "Mono",
    "dark",
    {
      primary: "#f5f5f5",
      accent: "#525252",
      bg: "#0a0a0a",
      surface: "#141414",
      text: "#fafafa",
      muted: "#a3a3a3",
      border: "#262626",
    },
    { radius: 4, shadow: "soft" },
  ),
  preset(
    "light",
    "Light",
    "light",
    {
      primary: "#4124fb",
      accent: "#c7c9ff",
      bg: "#ffffff",
      surface: "#f7f7f9",
      text: "#111318",
      muted: "#5f6470",
      border: "#e4e5ea",
    },
    { shadow: "soft" },
  ),
];

/* -------------------------------------------------------------- randomise */

/**
 * A harmonious palette in the theme's current mode: random primary hue, accent from the
 * harmony scheme, surfaces tinted with the primary hue, text kept readable.
 * `random` is injectable so tests are deterministic.
 */
export function randomizeTheme(
  theme: Theme,
  scheme: HarmonyScheme,
  random: () => number = Math.random,
): Theme {
  const dark = theme.mode === "dark";
  const hue = random() * 360;
  const primary = fromOklch({
    l: dark ? 0.62 + random() * 0.12 : 0.5 + random() * 0.1,
    c: 0.17 + random() * 0.08,
    h: hue,
  });
  const { accent, tintHue } = harmonize(primary, scheme);
  const tint = 0.005 + random() * 0.015;
  const roles = ROLE_LIGHTNESS[theme.mode];
  const bg = fromOklch({ l: roles.bg, c: tint, h: tintHue });
  const palette: ThemePalette = {
    ...theme[theme.mode],
    primary,
    accent: fixContrast(accent, bg, 3),
    bg,
    surface: fromOklch({ l: roles.surface, c: tint, h: tintHue }),
    border: fromOklch({ l: roles.border, c: tint * 1.5, h: tintHue }),
    text: fromOklch({ l: roles.text, c: tint / 2, h: tintHue }),
    muted: fromOklch({ l: roles.muted, c: tint, h: tintHue }),
    overrides: {},
  };
  const next: Theme = { ...theme, name: `${scheme} ${Math.round(hue)}°`, [theme.mode]: palette };
  if (theme.mode === "light" && !theme.autoDark) next.dark = deriveMode(palette, "dark");
  if (theme.mode === "dark") next.light = deriveMode(palette, "light");
  return next;
}

/* --------------------------------------------------------------- variables */

/** Hue per tag colour name in crm-theme.css; neutral has no hue. */
const TAG_HUES: [string, number | null][] = [
  ["blue", 255],
  ["purple", 290],
  ["green", 150],
  ["moss", 135],
  ["red", 20],
  ["orange", 50],
  ["amber", 65],
  ["teal", 180],
  ["yellow", 95],
  ["neutral", null],
];

function tagVariables(light: boolean): [string, string][] {
  const out: [string, string][] = [];
  for (const [name, hue] of TAG_HUES) {
    const c = hue === null ? 0 : 1;
    const h = hue ?? 0;
    const bg = light ? { l: 0.95, c: 0.04 * c, h } : { l: 0.3, c: 0.06 * c, h };
    const border = light ? { l: 0.88, c: 0.06 * c, h } : { l: 0.37, c: 0.07 * c, h };
    const text = light ? { l: 0.42, c: 0.14 * c, h } : { l: 0.87, c: 0.1 * c, h };
    out.push(
      [`--color-tag-${name}-bg`, fromOklch(bg)],
      [`--color-tag-${name}-border`, fromOklch(border)],
      [`--color-tag-${name}-text`, fromOklch(text)],
    );
  }
  return out;
}

function shadowVariables(level: ShadowLevel, light: boolean): [string, string][] {
  if (level === "none")
    return [
      ["--shadow-crm-raised", "none"],
      ["--shadow-crm-primary", "none"],
      ["--shadow-crm-overlay", "none"],
    ];
  if (level === "soft")
    return [
      ["--shadow-crm-raised", `0 0 0 1px rgba(0, 0, 0, ${light ? 0.06 : 0.3})`],
      ["--shadow-crm-primary", `0 1px 2px rgba(0, 0, 0, ${light ? 0.12 : 0.3})`],
      ["--shadow-crm-overlay", `0 12px 32px rgba(0, 0, 0, ${light ? 0.16 : 0.45})`],
    ];
  return light
    ? [
        [
          "--shadow-crm-raised",
          "0 0 0 1px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
        ],
        [
          "--shadow-crm-primary",
          "0 4px 4px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.08), inset 0 4px 6px rgba(255, 255, 255, 0.25), inset 0 -8px 14px rgba(0, 0, 0, 0.1)",
        ],
        ["--shadow-crm-overlay", "0 16px 40px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.08)"],
      ]
    : [
        [
          "--shadow-crm-raised",
          "0 0 0 1px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
        ],
        [
          "--shadow-crm-primary",
          "0 4px 4px rgba(42, 42, 42, 0.32), 0 0 0 1px #0e0e0e, inset 0 4px 6px rgba(255, 255, 255, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.15), inset 0 -8px 14px rgba(0, 0, 0, 0.15)",
        ],
        ["--shadow-crm-overlay", "0 16px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px #0e0e0e"],
      ];
}

const scaleVariables = (prefix: string, scale: Scale): [string, string][] =>
  SCALE_STEPS.map((s) => [`--color-${prefix}-${s}`, scale[s]]);

/** crm-theme.css variable -> value, in output order (overrides applied last, in place). */
export function themeVariables(input: Partial<ThemeSpec>): [string, string][] {
  const t = normalizeTheme(input);
  const light = isLightColor(t.bg);
  const toward = (from: string, to: string, k: number) => mixOklch(from, to, k);
  const vars: [string, string][] = [
    ["--font-crm", `"${t.font}", ui-sans-serif, system-ui, sans-serif`],
    ["--color-crm-bg", t.bg],
    ["--color-crm-fg", t.text],
    ["--color-crm-card", t.surface],
    ["--color-crm-popover", t.bg],
    ["--color-crm-primary", t.primary],
    ["--color-crm-primary-fg", readableOn(t.primary)],
    ["--color-crm-raised", toward(t.surface, t.text, 0.02)],
    ["--color-crm-muted", toward(t.bg, t.text, 0.08)],
    ["--color-crm-muted-fg", toward(t.muted, t.bg, 0.25)],
    ["--color-crm-border", t.border],
    ["--color-crm-input", toward(t.border, t.text, 0.1)],
    ["--color-crm-ring", t.accent],
    ["--color-crm-sidebar", toward(t.bg, t.surface, 0.3)],
    ["--color-crm-subtle", toward(t.muted, t.bg, 0.45)],
    ["--color-crm-faint", toward(t.muted, t.bg, 0.65)],
    ["--color-crm-soft", t.muted],
    ["--color-crm-chip", toward(t.text, t.muted, 0.5)],
    ["--color-crm-icon", toward(t.text, t.muted, 0.45)],
    ["--color-crm-success", t.success],
    ["--color-crm-warning", t.warning],
    ["--color-crm-danger", t.danger],
    ["--color-crm-trend", t.success],
    ["--color-crm-trend-muted", toward(t.success, t.bg, 0.6)],
    ["--color-crm-track", toward(t.bg, t.text, 0.15)],
    ["--color-crm-status", t.accent],
    ...tagVariables(light),
    ...scaleVariables("primary", generateScale(t.primary)),
    ...scaleVariables("neutral", generateNeutralScale(t.bg)),
    ["--radius-crm", `${t.radius}px`],
    ...shadowVariables(t.shadow, light),
    ["--spacing", DENSITY_SPACING[t.density]],
  ];
  const known = new Set(vars.map(([k]) => k));
  for (const [k, v] of Object.entries(t.overrides)) {
    if (!known.has(k)) continue;
    const i = vars.findIndex(([key]) => key === k);
    vars[i] = [k, v];
  }
  return vars;
}

/** Drop-in `@theme` block for one mode; import it after crm-theme.css to override the stock look. */
export function generateThemeBlock(
  input: Partial<ThemeSpec>,
  comment = "Kitbase theme from Theme Studio",
): string {
  const vars = themeVariables(input).map(([k, v]) => `  ${k}: ${v};`);
  return [
    `/* ${comment.replaceAll("*/", "")}`,
    `   Import after crm-theme.css to override it. */`,
    "",
    "@theme {",
    ...vars,
    "}",
    "",
  ].join("\n");
}

/* --------------------------------------------------------------- contrast */

export type WcagLevel = "AAA" | "AA" | "AA-large" | "fail";

/** WCAG 2.x level for normal text (large text needs 3:1 for AA). */
export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA-large";
  return "fail";
}

export interface ContrastCheck {
  label: string;
  fg: string;
  bg: string;
  ratio: number;
  level: WcagLevel;
  /** Minimum ratio this pair needs (4.5 body text, 3 for UI / large text). */
  min: number;
  pass: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The text/surface pairs the components actually paint, with the ratio each must reach. */
const CHECK_PAIRS: [string, PaletteKey | "primaryFg", PaletteKey, number][] = [
  ["Text on background", "text", "bg", 4.5],
  ["Text on surface", "text", "surface", 4.5],
  ["Muted text on background", "muted", "bg", 4.5],
  ["Muted text on surface", "muted", "surface", 4.5],
  ["Button label on primary", "primaryFg", "primary", 4.5],
  ["Primary on background", "primary", "bg", 3],
  ["Focus ring on background", "accent", "bg", 3],
  ["Success on background", "success", "bg", 3],
  ["Warning on background", "warning", "bg", 3],
  ["Danger on background", "danger", "bg", 3],
];

export function contrastChecks(input: Partial<ThemeSpec>): ContrastCheck[] {
  const t = normalizeTheme(input);
  const colour = (k: PaletteKey | "primaryFg") =>
    k === "primaryFg" ? readableOn(t.primary) : t[k];
  return CHECK_PAIRS.map(([label, fgKey, bgKey, min]) => {
    const fg = colour(fgKey);
    const bg = t[bgKey];
    const ratio = round2(contrastOf(fg, bg));
    return { label, fg, bg, ratio, level: wcagLevel(ratio), min, pass: ratio >= min };
  });
}

export interface ContrastCell {
  fg: PaletteKey;
  bg: "bg" | "surface" | "primary";
  ratio: number;
  level: WcagLevel;
}

/** Every foreground role against every surface (for the AA/AAA matrix). */
export function contrastMatrix(input: Partial<ThemeSpec>): ContrastCell[] {
  const t = normalizeTheme(input);
  const fgs: PaletteKey[] = ["text", "muted", "primary", "accent", "success", "warning", "danger"];
  const bgs: ContrastCell["bg"][] = ["bg", "surface", "primary"];
  const cells: ContrastCell[] = [];
  for (const fg of fgs)
    for (const bg of bgs) {
      const ratio = round2(contrastOf(t[fg], t[bg]));
      cells.push({ fg, bg, ratio, level: wcagLevel(ratio) });
    }
  return cells;
}

/**
 * Nudges foreground lightness until every checked pair passes. Text and muted text are fixed
 * against the darker-contrast of background/surface; brand and semantic colours against the
 * background. Returns the same object when nothing needed fixing.
 */
export function fixThemeContrast(input: Partial<ThemeSpec>): ThemeSpec {
  const t = normalizeTheme(input);
  const worst = (fg: string, min: number) => {
    const onBg = fixContrast(fg, t.bg, min);
    const onSurface = fixContrast(onBg, t.surface, min);
    return fixContrast(onSurface, t.bg, min);
  };
  const next: ThemeSpec = {
    ...t,
    text: worst(t.text, 4.5),
    muted: worst(t.muted, 4.5),
    primary: fixContrast(t.primary, t.bg, 3),
    accent: fixContrast(t.accent, t.bg, 3),
    success: fixContrast(t.success, t.bg, 3),
    warning: fixContrast(t.warning, t.bg, 3),
    danger: fixContrast(t.danger, t.bg, 3),
  };
  return PALETTE_KEYS.every((k) => next[k] === t[k]) ? t : next;
}

/* ----------------------------------------------------------------- import */

interface CaptureLike {
  roles?: Partial<Record<"bg" | "surface" | "text" | "mutedText" | "border" | "accent", string>>;
  fonts?: { family: string }[];
  radii?: { value: number; count: number }[];
}

/**
 * Reads a Capture result (the API response `{ capture }`, the document with `tokens`, or the
 * tokens themselves) into a partial spec. Throws when there are no colour roles.
 */
export function themeFromCapture(json: unknown): Partial<ThemeSpec> {
  if (!json || typeof json !== "object") throw new Error("Paste a Capture result JSON object");
  const root = json as Record<string, unknown>;
  const inner = (root.capture ?? root) as Record<string, unknown>;
  const tokens = (inner.tokens ?? inner) as CaptureLike;
  if (!tokens.roles || typeof tokens.roles !== "object")
    throw new Error("No colour roles found; expected a Capture result with tokens.roles");
  const out: Partial<ThemeSpec> = {};
  const r = tokens.roles;
  const set = (key: "bg" | "surface" | "text" | "muted" | "border" | "primary", v?: string) => {
    const rgb = v ? parseColor(v) : null;
    if (rgb) out[key] = toHex(rgb);
  };
  set("bg", r.bg);
  set("surface", r.surface ?? r.bg);
  set("text", r.text);
  set("muted", r.mutedText);
  set("border", r.border);
  set("primary", r.accent);
  const font = tokens.fonts?.[0]?.family;
  if (font && cssFontName(font)) out.font = cssFontName(font);
  const radius = [...(tokens.radii ?? [])].sort((a, b) => b.count - a.count)[0];
  if (radius && Number.isFinite(radius.value))
    out.radius = Math.max(0, Math.min(32, Math.round(radius.value)));
  return out;
}
