import { ends, markerPath } from "@/components/crm/pro-schema-erd/relation-edge";
import {
  HEADER_HEIGHT,
  NODE_PADDING,
  NODE_WIDTH,
  ROW_HEIGHT,
  nodeHeight,
  type ErdTable,
  type ResolvedRelation,
} from "@/components/crm/pro-schema-erd/types";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface SvgTheme {
  bg: string;
  card: string;
  header: string;
  border: string;
  fg: string;
  muted: string;
  edge: string;
  accent: string;
}

const LIGHT: SvgTheme = {
  bg: "#ffffff",
  card: "#ffffff",
  header: "#f4f4f6",
  border: "#dcdce2",
  fg: "#18181b",
  muted: "#71717a",
  edge: "#8b8b95",
  accent: "#7c6bff",
};

/**
 * Builds a standalone, font-safe SVG of the diagram from table positions. Generated from data
 * rather than by cloning the DOM, so it is crisp at any zoom and independent of the viewport.
 */
export function erdToSvg(
  tables: ErdTable[],
  positions: Map<string, { x: number; y: number }>,
  relations: ResolvedRelation[],
  theme: SvgTheme = LIGHT,
): string {
  const pad = 40;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of tables) {
    const p = positions.get(t.id);
    if (!p) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + NODE_WIDTH);
    maxY = Math.max(maxY, p.y + nodeHeight(t));
  }
  if (!Number.isFinite(minX))
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>`;
  const W = maxX - minX + pad * 2;
  const H = maxY - minY + pad * 2;
  const ox = pad - minX;
  const oy = pad - minY;
  const byId = new Map(tables.map((t) => [t.id, t]));
  const rowY = (t: ErdTable, col: string) => {
    const i = Math.max(
      0,
      t.columns.findIndex((c) => c.name === col),
    );
    return HEADER_HEIGHT + NODE_PADDING / 2 + i * ROW_HEIGHT + ROW_HEIGHT / 2;
  };

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, system-ui, sans-serif">`,
    `<rect width="100%" height="100%" fill="${theme.bg}"/>`,
  );
  for (const r of relations) {
    const a = byId.get(r.from.table);
    const b = byId.get(r.to.table);
    const pa = positions.get(r.from.table);
    const pb = positions.get(r.to.table);
    if (!a || !b || !pa || !pb) continue;
    const sx = pa.x + ox + NODE_WIDTH;
    const sy = pa.y + oy + rowY(a, r.from.column);
    const tx = pb.x + ox;
    const ty = pb.y + oy + rowY(b, r.to.column);
    const dx = Math.max(40, Math.abs(tx - sx) / 2);
    const [ka, kb] = ends(r.cardinality);
    parts.push(
      `<path d="M${sx},${sy}C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}" fill="none" stroke="${theme.edge}" stroke-width="1.25"/>`,
      `<path d="${markerPath(ka, r.optional, sx, sy, 1)}${markerPath(kb, false, tx, ty, -1)}" fill="none" stroke="${theme.edge}" stroke-width="1.25"/>`,
    );
  }
  for (const t of tables) {
    const p = positions.get(t.id);
    if (!p) continue;
    const x = p.x + ox;
    const y = p.y + oy;
    const h = nodeHeight(t);
    parts.push(
      `<g transform="translate(${x},${y})">`,
      `<rect width="${NODE_WIDTH}" height="${h}" rx="8" fill="${theme.card}" stroke="${theme.border}"/>`,
      `<path d="M0,8a8,8 0 0 1 8,-8h${NODE_WIDTH - 16}a8,8 0 0 1 8,8v${HEADER_HEIGHT - 8}h-${NODE_WIDTH}z" fill="${theme.header}"/>`,
      t.color ? `<rect width="3" height="${HEADER_HEIGHT}" fill="${t.color}"/>` : "",
      `<text x="12" y="25" font-size="13" font-weight="600" fill="${theme.fg}">${esc(t.name)}</text>`,
      t.schema
        ? `<text x="${NODE_WIDTH - 12}" y="25" font-size="10" text-anchor="end" fill="${theme.muted}">${esc(t.schema)}</text>`
        : "",
    );
    t.columns.forEach((c, i) => {
      const cy = HEADER_HEIGHT + NODE_PADDING / 2 + i * ROW_HEIGHT + ROW_HEIGHT / 2 + 4;
      const key = c.pk ? "PK" : c.fk ? "FK" : c.unique ? "UQ" : "";
      if (key)
        parts.push(
          `<text x="12" y="${cy}" font-size="9" font-weight="700" fill="${c.pk ? "#d97706" : theme.accent}">${key}</text>`,
        );
      parts.push(
        `<text x="40" y="${cy}" font-size="11.5" ${c.pk ? 'font-weight="600" ' : ""}fill="${theme.fg}">${esc(c.name)}</text>`,
        `<text x="${NODE_WIDTH - 12}" y="${cy}" font-size="10.5" font-family="ui-monospace, monospace" text-anchor="end" fill="${theme.muted}">${esc(c.type)}${c.nullable ? "?" : ""}</text>`,
      );
    });
    parts.push(`</g>`);
  }
  parts.push(`</svg>`);
  return parts.join("");
}

export function downloadText(text: string, fileName: string, type = "image/svg+xml") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
