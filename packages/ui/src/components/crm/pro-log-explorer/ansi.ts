/**
 * Minimal ANSI SGR parser, written in-house because no approved library covers it (anser is not on
 * the allow-list). Supports reset, bold, dim, italic, underline, inverse, 16 foreground/background
 * colours (normal + bright), 256-colour (38;5;n) and truecolour (38;2;r;g;b). Non-SGR escape
 * sequences (cursor movement, OSC titles, ...) are stripped.
 */
export interface AnsiStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface AnsiSpan {
  text: string;
  style: AnsiStyle;
}

// Palette tuned for dark CRM surfaces (readable on #161616).
const BASE = [
  "#6b7280",
  "#f87171",
  "#4ade80",
  "#facc15",
  "#60a5fa",
  "#c084fc",
  "#22d3ee",
  "#e5e7eb",
];
const BRIGHT = [
  "#9ca3af",
  "#fca5a5",
  "#86efac",
  "#fde68a",
  "#93c5fd",
  "#d8b4fe",
  "#67e8f9",
  "#ffffff",
];

function xterm256(n: number): string | undefined {
  if (n < 0 || n > 255) return undefined;
  if (n < 8) return BASE[n];
  if (n < 16) return BRIGHT[n - 8];
  if (n < 232) {
    const i = n - 16;
    const c = (v: number) => (v === 0 ? 0 : 55 + v * 40);
    return `rgb(${c(Math.floor(i / 36))},${c(Math.floor(i / 6) % 6)},${c(i % 6)})`;
  }
  const g = 8 + (n - 232) * 10;
  return `rgb(${g},${g},${g})`;
}

// CSI (ESC [ ... final byte) or OSC (ESC ] ... BEL/ST) or a lone two-char escape.
// eslint-disable-next-line no-control-regex
const ESC_RE = /\u001b\[([0-9;?]*)([@-~])|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-_]/g;

export function hasAnsi(s: string): boolean {
  return s.includes("\u001b");
}

export function stripAnsi(s: string): string {
  return hasAnsi(s) ? s.replace(ESC_RE, "") : s;
}

function applySgr(style: AnsiStyle, params: number[]): AnsiStyle {
  const next = { ...style };
  if (params.length === 0) params = [0];
  for (let i = 0; i < params.length; i++) {
    const p = params[i]!;
    if (p === 0) {
      for (const k of Object.keys(next) as (keyof AnsiStyle)[]) delete next[k];
    } else if (p === 1) next.bold = true;
    else if (p === 2) next.dim = true;
    else if (p === 3) next.italic = true;
    else if (p === 4) next.underline = true;
    else if (p === 22) next.bold = next.dim = false;
    else if (p === 23) next.italic = false;
    else if (p === 24) next.underline = false;
    else if (p >= 30 && p <= 37) next.fg = BASE[p - 30];
    else if (p >= 90 && p <= 97) next.fg = BRIGHT[p - 90];
    else if (p === 39) delete next.fg;
    else if (p >= 40 && p <= 47) next.bg = BASE[p - 40];
    else if (p >= 100 && p <= 107) next.bg = BRIGHT[p - 100];
    else if (p === 49) delete next.bg;
    else if (p === 38 || p === 48) {
      const key = p === 38 ? "fg" : "bg";
      if (params[i + 1] === 5) {
        const c = xterm256(params[i + 2]!);
        if (c) next[key] = c;
        i += 2;
      } else if (params[i + 1] === 2) {
        const [r, g, b] = params.slice(i + 2, i + 5);
        next[key] = `rgb(${r ?? 0},${g ?? 0},${b ?? 0})`;
        i += 4;
      }
    }
  }
  return next;
}

/** Splits a line into styled spans. Linear in the input length. */
export function parseAnsi(input: string): AnsiSpan[] {
  if (!hasAnsi(input)) return [{ text: input, style: {} }];
  const spans: AnsiSpan[] = [];
  let style: AnsiStyle = {};
  let last = 0;
  ESC_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ESC_RE.exec(input))) {
    if (m.index > last) spans.push({ text: input.slice(last, m.index), style });
    last = ESC_RE.lastIndex;
    if (m[2] === "m") {
      const params = (m[1] ?? "")
        .split(";")
        .filter((x) => x !== "")
        .map(Number);
      style = applySgr(style, params);
    }
  }
  if (last < input.length) spans.push({ text: input.slice(last), style });
  return spans;
}
