/**
 * Turns the free-text `props` metadata of a registry entry into form fields.
 * Anything it cannot express (callbacks, objects, dates...) falls back to the JSON editor.
 */
import type { LayoutType, PropDoc } from "./types";

export type FieldKind = "text" | "number" | "boolean" | "select" | "list";

export interface Field {
  name: string;
  kind: FieldKind;
  /** Select choices. */
  options?: string[];
  description: string;
  default?: unknown;
  required: boolean;
}

/** `"a" | "b"` (optionally with `undefined`) -> ["a", "b"]; null when not a literal union. */
export function literalOptions(type: string): string[] | null {
  const parts = type
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p && p !== "undefined");
  if (!parts.length) return null;
  const out: string[] = [];
  for (const p of parts) {
    const m = /^(["'])(.*)\1$/.exec(p);
    if (!m) return null;
    out.push(m[2] ?? "");
  }
  return out;
}

/** Picks a field kind for a TypeScript-ish type string; null means "JSON only". */
export function kindOf(type: string): { kind: FieldKind; options?: string[] } | null {
  const t = type
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*\|\s*undefined$/, "");
  if (t.includes("=>")) return null; // callbacks cannot be edited in a form
  if (/^boolean$/i.test(t) || /^(true|false)(\s*\|\s*(true|false))*$/.test(t))
    return { kind: "boolean" };
  if (/^number$/.test(t) || /^\d+(\s*\|\s*\d+)*$/.test(t)) return { kind: "number" };
  if (/^string\[\]$/.test(t) || /^Array<string>$/.test(t) || /^readonly string\[\]$/.test(t))
    return { kind: "list" };
  const options = literalOptions(t);
  if (options && options.length > 1) return { kind: "select", options };
  if (options?.length === 1) return { kind: "text" };
  if (
    /^(string|ReactNode|React\.ReactNode|number \| string|string \| number|string \| null)$/.test(t)
  )
    return { kind: "text" };
  return null;
}

/** Parses a documented default such as `"md"`, `false`, `3` or `["a"]` into a value. */
export function parseDefault(raw: string | undefined, kind: FieldKind): unknown {
  if (raw === undefined || raw === "" || raw === "undefined") return undefined;
  try {
    const v: unknown = JSON.parse(raw);
    if (kind === "boolean" && typeof v === "boolean") return v;
    if (kind === "number" && typeof v === "number") return v;
    if (kind === "list" && Array.isArray(v)) return v;
    if ((kind === "text" || kind === "select") && typeof v === "string") return v;
    if (kind === "text" && typeof v === "number") return String(v);
    return undefined; // documented default does not match the field type
  } catch {
    // Not JSON: strip quotes and keep it as text.
    return kind === "text" || kind === "select" ? raw.replace(/^["'`](.*)["'`]$/, "$1") : undefined;
  }
}

/**
 * Fields for the props panel. Skips sub-component props documented as `name (SubComponent)`,
 * `className` (styling belongs in the theme) and anything without a form widget.
 */
export function fieldsFromProps(props: readonly PropDoc[] | undefined): Field[] {
  const out: Field[] = [];
  for (const p of props ?? []) {
    if (/[()]/.test(p.name) || !/^[A-Za-z_$][\w$]*$/.test(p.name)) continue;
    if (p.name === "className" || p.name === "style" || p.name === "ref") continue;
    const k = kindOf(p.type);
    if (!k) continue;
    out.push({
      name: p.name,
      kind: k.kind,
      ...(k.options ? { options: k.options } : {}),
      description: p.description,
      default: parseDefault(p.default, k.kind),
      required: p.required,
    });
  }
  return out;
}

/** Converts a raw input string to the field's value type. Empty text clears the prop. */
export function coerce(field: Field, raw: string): unknown {
  switch (field.kind) {
    case "number": {
      if (raw.trim() === "") return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    case "boolean":
      return raw === "true";
    case "list":
      return raw
        .split(/\r?\n|,/)
        .map((s) => s.trim())
        .filter(Boolean);
    default:
      return raw === "" ? undefined : raw;
  }
}

const GAP: Omit<Field, "description"> = {
  name: "gap",
  kind: "select",
  options: ["2", "4", "6", "8"],
  default: "4",
  required: false,
};

/** Props of the built-in layout nodes; they map straight to Tailwind classes in codegen. */
export const LAYOUT_FIELDS: Record<LayoutType, Field[]> = {
  section: [
    {
      name: "title",
      kind: "text",
      description: "Optional heading above the section",
      required: false,
    },
    { ...GAP, description: "Space between children (Tailwind gap scale)" },
  ],
  row: [
    { ...GAP, description: "Space between children" },
    {
      name: "align",
      kind: "select",
      options: ["start", "center", "end", "stretch"],
      default: "start",
      description: "Vertical alignment of children",
      required: false,
    },
  ],
  column: [
    { ...GAP, description: "Space between children" },
    {
      name: "basis",
      kind: "select",
      options: ["auto", "1/4", "1/3", "1/2", "2/3", "3/4"],
      default: "auto",
      description: "Width inside its row",
      required: false,
    },
  ],
};
