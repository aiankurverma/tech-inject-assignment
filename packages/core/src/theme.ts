// Pure theme generation shared by the Theme Studio (apps/web) and the Capture Engine (apps/api):
// a small editable spec -> an `@theme` block using the crm-theme.css variable names, plus WCAG
// contrast checks for every text/surface pair the Kitbase components actually paint.

import { contrast, parseColor, toHex } from "./color";

export type Density = "compact" | "comfortable" | "spacious";

export interface ThemeSpec {
  primary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  /** Component radius in px. */
  radius: number;
  /** Primary font family name (fallback stack is appended). */
  font: string;
  density: Density;
}

/** The stock dark CRM theme (packages/ui/src/styles/crm-theme.css). */
export const DEFAULT_THEME: ThemeSpec = {
  primary: "#4124fb",
  accent: "#676767",
  bg: "#161616",
  surface: "#1b1d20",
  text: "#f9fbff",
  muted: "#a4a4a4",
  border: "#232323",
  radius: 8,
  font: "Geist",
  density: "comfortable",
};

/** Tailwind v4 `--spacing` base per density (stock is 0.25rem). */
export const DENSITY_SPACING: Record<Density, string> = {
  compact: "0.2rem",
  comfortable: "0.25rem",
  spacious: "0.3rem",
};

const hex = (c: string, fallback: string) => {
  const rgb = parseColor(c);
  return rgb ? toHex(rgb) : fallback;
};

/** Keeps a font name safe inside a CSS string. */
export const cssFontName = (s: string) => s.replace(/[^\w\s.-]/g, "").trim();

/** White or near-black, whichever reads better on `bg` (3:1 is enough for button labels). */
export function readableOn(bg: string): string {
  const rgb = parseColor(bg);
  if (!rgb) return "#ffffff";
  return contrast(rgb, parseColor("#ffffff")!) >= 3 ? "#ffffff" : "#111111";
}

/** Normalises every field so the output is always valid CSS whatever the input. */
export function normalizeTheme(input: Partial<ThemeSpec>): ThemeSpec {
  const d = DEFAULT_THEME;
  const radius = Number(input.radius);
  return {
    primary: hex(input.primary ?? "", d.primary),
    accent: hex(input.accent ?? "", d.accent),
    bg: hex(input.bg ?? "", d.bg),
    surface: hex(input.surface ?? "", d.surface),
    text: hex(input.text ?? "", d.text),
    muted: hex(input.muted ?? "", d.muted),
    border: hex(input.border ?? "", d.border),
    radius:
      input.radius !== undefined && Number.isFinite(radius)
        ? Math.max(0, Math.min(32, Math.round(radius)))
        : d.radius,
    font: cssFontName(input.font ?? "") || d.font,
    density: input.density && input.density in DENSITY_SPACING ? input.density : d.density,
  };
}

/** crm-theme.css variable -> value, in output order. */
export function themeVariables(input: Partial<ThemeSpec>): [string, string][] {
  const t = normalizeTheme(input);
  return [
    ["--font-crm", `"${t.font}", ui-sans-serif, system-ui, sans-serif`],
    ["--color-crm-bg", t.bg],
    ["--color-crm-popover", t.bg],
    ["--color-crm-sidebar", t.bg],
    ["--color-crm-card", t.surface],
    ["--color-crm-raised", t.surface],
    ["--color-crm-fg", t.text],
    ["--color-crm-soft", t.muted],
    ["--color-crm-muted-fg", t.muted],
    ["--color-crm-border", t.border],
    ["--color-crm-input", t.border],
    ["--color-crm-primary", t.primary],
    ["--color-crm-primary-fg", readableOn(t.primary)],
    ["--color-crm-ring", t.accent],
    ["--color-crm-status", t.accent],
    ["--radius-crm", `${t.radius}px`],
    ["--spacing", DENSITY_SPACING[t.density]],
  ];
}

/** Drop-in `@theme` block; import it after crm-theme.css to override the stock look. */
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

export function contrastChecks(input: Partial<ThemeSpec>): ContrastCheck[] {
  const t = normalizeTheme(input);
  const pairs: [string, string, string, number][] = [
    ["Text on background", t.text, t.bg, 4.5],
    ["Text on surface", t.text, t.surface, 4.5],
    ["Muted text on background", t.muted, t.bg, 4.5],
    ["Muted text on surface", t.muted, t.surface, 4.5],
    ["Button label on primary", readableOn(t.primary), t.primary, 4.5],
    ["Primary on background", t.primary, t.bg, 3],
    ["Focus ring on background", t.accent, t.bg, 3],
  ];
  return pairs.map(([label, fg, bg, min]) => {
    const ratio = Math.round(contrast(parseColor(fg)!, parseColor(bg)!) * 100) / 100;
    return { label, fg, bg, ratio, level: wcagLevel(ratio), min, pass: ratio >= min };
  });
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
