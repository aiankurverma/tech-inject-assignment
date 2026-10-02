// Theme Studio exports and imports: dual-mode CSS, plain CSS variables, a Tailwind config,
// W3C Design Tokens (DTCG) JSON, share links (theme in the URL hash) and CSS-variable import.

import { toHexColor } from "./oklch";
import {
  modeSpec,
  normalizeThemeDoc,
  resolveTheme,
  themeVariables,
  type PaletteKey,
  type Theme,
  type ThemeMode,
  type ThemeSpec,
} from "./theme";

const HEADER = (title: string) => `/* ${title.replaceAll("*/", "")} - Kitbase Theme Studio */`;

/* -------------------------------------------------------------------- CSS */

/**
 * Both modes in one file: `@theme` carries the light values, `.dark` (or `data-theme="dark"`)
 * and `prefers-color-scheme` override them. Tailwind v4 utilities read the variables at
 * runtime, so overriding them on an ancestor is enough.
 */
export function generateThemeCss(theme: Theme): string {
  const t = resolveTheme(theme);
  const light = themeVariables(modeSpec(t, "light"));
  const dark = themeVariables(modeSpec(t, "dark"));
  const decl = (vars: [string, string][], indent: string) =>
    vars.map(([k, v]) => `${indent}${k}: ${v};`);
  const darkOverrides = dark.filter(([k, v]) => light.find(([lk]) => lk === k)?.[1] !== v);
  return [
    HEADER(t.name),
    "/* Import after crm-theme.css. Light values live in @theme; dark ones apply with the",
    '   .dark class, [data-theme="dark"], or the OS preference when no data-theme is set. */',
    "",
    "@theme {",
    ...decl(light, "  "),
    "}",
    "",
    '.dark, [data-theme="dark"] {',
    ...decl(darkOverrides, "  "),
    "}",
    "",
    "@media (prefers-color-scheme: dark) {",
    '  :root:not([data-theme="light"]) {',
    ...decl(darkOverrides, "    "),
    "  }",
    "}",
    "",
  ].join("\n");
}

/** Plain custom properties (no Tailwind): `:root` for light, `.dark` for dark. */
export function generateCssVariables(theme: Theme): string {
  const t = resolveTheme(theme);
  const block = (selector: string, mode: ThemeMode) => [
    `${selector} {`,
    ...themeVariables(modeSpec(t, mode)).map(([k, v]) => `  ${k}: ${v};`),
    "}",
  ];
  return [
    HEADER(t.name),
    ...block(":root", "light"),
    "",
    ...block('.dark, [data-theme="dark"]', "dark"),
    "",
  ].join("\n");
}

/* --------------------------------------------------------------- Tailwind */

/** `--color-crm-primary-fg` -> ["crm", "primary-fg"]; scales -> ["primary", "500"]. */
function tokenName(variable: string): [group: string, name: string] | null {
  const m = /^--color-(crm|tag|primary|neutral)-(.+)$/.exec(variable);
  return m ? [m[1]!, m[2]!] : null;
}

/**
 * `tailwind.config.ts` for projects that keep a JS config (`@config` in Tailwind v4 or v3).
 * Colours reference the CSS variables so light/dark switching keeps working; pair it with the
 * CSS variables export.
 */
export function generateTailwindConfig(theme: Theme): string {
  const t = resolveTheme(theme);
  const vars = themeVariables(modeSpec(t, "light"));
  const colours: Record<string, Record<string, string>> = {};
  for (const [k] of vars) {
    const named = tokenName(k);
    if (!named) continue;
    const [group, name] = named;
    (colours[group] ??= {})[name] = `var(${k})`;
  }
  const json = (v: unknown) => JSON.stringify(v, null, 2).replace(/\n/g, "\n      ");
  return [
    `// ${t.name} - Kitbase Theme Studio`,
    "// Colours read the CSS variables from the exported variables file (light in :root, dark in .dark).",
    'import type { Config } from "tailwindcss";',
    "",
    "export default {",
    "  theme: {",
    "    extend: {",
    `      colors: ${json(colours)},`,
    `      fontFamily: { crm: ["${t.shape.font}", "ui-sans-serif", "system-ui", "sans-serif"] },`,
    `      borderRadius: { crm: "${t.shape.radius}px" },`,
    "      boxShadow: {",
    '        "crm-raised": "var(--shadow-crm-raised)",',
    '        "crm-primary": "var(--shadow-crm-primary)",',
    '        "crm-overlay": "var(--shadow-crm-overlay)",',
    "      },",
    "    },",
    "  },",
    "} satisfies Config;",
    "",
  ].join("\n");
}

/* ------------------------------------------------------------------- DTCG */

type DtcgToken = { $type: string; $value: unknown; $extensions?: Record<string, unknown> };
type DtcgGroup = { [key: string]: DtcgToken | DtcgGroup };

const MODES_EXT = "com.kitbase.modes";

/**
 * W3C Design Tokens Community Group format. `$value` is the mode being edited; both modes sit
 * in `$extensions["com.kitbase.modes"]`. Shadows are omitted (they are composite strings).
 */
export function generateDesignTokens(theme: Theme): Record<string, unknown> {
  const t = resolveTheme(theme);
  const light = new Map(themeVariables(modeSpec(t, "light")));
  const dark = new Map(themeVariables(modeSpec(t, "dark")));
  const active = t.mode === "light" ? light : dark;
  const color: DtcgGroup = {};
  for (const [variable] of active) {
    const named = tokenName(variable);
    if (!named) continue;
    const [group, name] = named;
    const g = (color[group] ??= {}) as DtcgGroup;
    g[name] = {
      $type: "color",
      $value: active.get(variable),
      $extensions: { [MODES_EXT]: { light: light.get(variable), dark: dark.get(variable) } },
    };
  }
  return {
    $schema: "https://tr.designtokens.org/format/",
    kitbase: {
      $extensions: { [MODES_EXT]: { active: t.mode, name: t.name } },
      color,
      radius: { crm: { $type: "dimension", $value: `${t.shape.radius}px` } },
      spacing: { base: { $type: "dimension", $value: active.get("--spacing") } },
      font: {
        crm: {
          $type: "fontFamily",
          $value: [t.shape.font, "ui-sans-serif", "system-ui", "sans-serif"],
        },
      },
    },
  };
}

/* ------------------------------------------------------------- share link */

const b64url = {
  encode: (s: string) => {
    const bytes = new TextEncoder().encode(s);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode: (s: string) => {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  },
};

export const SHARE_HASH_KEY = "t";

/** `t=<base64url JSON>` for a URL hash. Nothing is stored server-side. */
export function encodeShareHash(theme: Theme): string {
  const t = normalizeThemeDoc(theme);
  const compact = { ...t, dark: t.autoDark ? undefined : t.dark };
  return `${SHARE_HASH_KEY}=${b64url.encode(JSON.stringify(compact))}`;
}

/** Full share URL for a page. */
export function shareUrl(theme: Theme, pageUrl: string): string {
  const base = pageUrl.split("#")[0]!;
  return `${base}#${encodeShareHash(theme)}`;
}

/** Reads a theme from a hash, hash fragment, or full URL; null when there is none. Throws on corrupt data. */
export function decodeShareHash(input: string): Theme | null {
  const hash = input.includes("#") ? input.slice(input.indexOf("#") + 1) : input.replace(/^#/, "");
  const value = new URLSearchParams(hash).get(SHARE_HASH_KEY);
  if (!value) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(b64url.decode(value));
  } catch {
    throw new Error("This share link is not a valid Kitbase theme.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("This share link holds no theme.");
  return normalizeThemeDoc(parsed);
}

/* --------------------------------------------------------- CSS variables in */

/** crm-theme.css names and common shadcn-style aliases -> palette role. */
const CSS_ROLE_ALIASES: Record<string, PaletteKey> = {
  "--color-crm-primary": "primary",
  "--primary": "primary",
  "--color-primary": "primary",
  "--color-crm-ring": "accent",
  "--ring": "accent",
  "--accent": "accent",
  "--color-crm-bg": "bg",
  "--background": "bg",
  "--color-background": "bg",
  "--color-crm-card": "surface",
  "--card": "surface",
  "--color-card": "surface",
  "--color-crm-fg": "text",
  "--foreground": "text",
  "--color-foreground": "text",
  "--color-crm-soft": "muted",
  "--muted-foreground": "muted",
  "--color-muted-foreground": "muted",
  "--color-crm-border": "border",
  "--border": "border",
  "--color-border": "border",
  "--color-crm-success": "success",
  "--success": "success",
  "--color-crm-warning": "warning",
  "--warning": "warning",
  "--color-crm-danger": "danger",
  "--destructive": "danger",
  "--color-destructive": "danger",
};

/**
 * Reads pasted CSS (`:root { --color-crm-bg: #111; }`, a Tailwind `@theme` block, or bare
 * declarations) into a partial spec. Colours must parse; shorthand `--radius` and `--font-crm`
 * are read too. Throws when nothing usable is found.
 */
export function themeFromCssVariables(css: string): Partial<ThemeSpec> {
  const out: Partial<ThemeSpec> = {};
  const overrides: Record<string, string> = {};
  const re = /(--[\w-]+)\s*:\s*([^;{}]+)[;}\n]/g;
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let m: RegExpExecArray | null;
  let found = 0;
  while ((m = re.exec(`${stripped}\n`))) {
    const [, name, raw] = m as unknown as [string, string, string];
    const value = raw.trim();
    const role = CSS_ROLE_ALIASES[name];
    if (role) {
      const hex = toHexColor(value);
      if (hex) {
        out[role] = hex;
        found++;
        continue;
      }
    }
    if (name === "--radius-crm" || name === "--radius") {
      const n = parseFloat(value);
      if (Number.isFinite(n)) {
        out.radius = /rem$/.test(value) ? Math.round(n * 16) : Math.round(n);
        found++;
      }
    } else if (name === "--font-crm" || name === "--font-sans") {
      const family = value.split(",")[0]!.replace(/["']/g, "").trim();
      if (family) {
        out.font = family;
        found++;
      }
    } else if (name.startsWith("--color-crm-") || name.startsWith("--color-tag-")) {
      const hex = toHexColor(value);
      if (hex) {
        overrides[name] = hex;
        found++;
      }
    }
  }
  if (!found)
    throw new Error("No theme variables found. Paste CSS with --color-crm-* declarations.");
  if (Object.keys(overrides).length) out.overrides = overrides;
  return out;
}
