// In-page script run by the capture browser. It only counts computed styles and matches
// components; all clustering/scale maths happens server-side in tokens.ts (unit-tested).

export type InventoryKind = "buttons" | "inputs" | "tables" | "cards" | "navs" | "badges";

export interface InventoryItem {
  kind: InventoryKind;
  count: number;
  examples: string[];
}

/** Evaluated with Runtime.evaluate; returns `{ raw: RawStyles, inventory: InventoryItem[] }`. */
export const EXTRACT_SCRIPT = String.raw`(() => {
  const MAX_EL = 5000;
  const add = (m, k, n = 1) => { if (k) m[k] = (m[k] || 0) + n; };
  const colors = new Map();
  const color = (value, use, weight) => {
    if (!value || value === "rgba(0, 0, 0, 0)" || value === "transparent") return;
    const k = use + "|" + value;
    colors.set(k, (colors.get(k) || 0) + weight);
  };
  const fonts = {}, fontSizes = {}, radii = {}, spacing = {}, shadows = {};
  const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const visible = (el, r, cs) =>
    r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05;
  const els = Array.from(document.body ? document.body.querySelectorAll("*") : []).slice(0, MAX_EL);
  const docArea = Math.max(1, document.documentElement.scrollWidth * Math.min(document.documentElement.scrollHeight, 6000));
  const rootBg = getComputedStyle(document.body).backgroundColor;
  const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
  color(rootBg !== "rgba(0, 0, 0, 0)" ? rootBg : htmlBg !== "rgba(0, 0, 0, 0)" ? htmlBg : "rgb(255, 255, 255)", "bg", 1000);
  const ownText = (el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
  for (const el of els) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!visible(el, r, cs)) continue;
    const area = Math.min(r.width * r.height, docArea);
    color(cs.backgroundColor, "bg", Math.max(1, Math.round((area / docArea) * 1000)));
    if (ownText(el)) {
      color(cs.color, "text", 1);
      add(fonts, cs.fontFamily);
      add(fontSizes, cs.fontSize);
    }
    const bw = px(cs.borderTopWidth) + px(cs.borderBottomWidth) + px(cs.borderLeftWidth) + px(cs.borderRightWidth);
    if (bw > 0 && cs.borderTopStyle !== "none") color(cs.borderTopColor, "border", 1);
    const rad = px(cs.borderTopLeftRadius);
    if (rad > 0 && rad < 200) add(radii, rad + "px");
    for (const p of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginBottom", "rowGap", "columnGap"]) {
      const v = px(cs[p]);
      if (v > 0 && v <= 128) add(spacing, v + "px");
    }
    if (cs.boxShadow && cs.boxShadow !== "none") {
      // Drop invisible layers (Tailwind stacks several transparent rings).
      const layers = cs.boxShadow.split(/,(?![^(]*\))/).map((x) => x.trim())
        .filter((x) => !/^(rgba\(0, 0, 0, 0\)|transparent)|rgba\([^)]*,\s*0\)|\/ 0\)/.test(x));
      if (layers.length) add(shadows, layers.join(", ").slice(0, 240));
    }
  }

  const sel = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id && /^[A-Za-z][\w-]{0,40}$/.test(el.id)) return s + "#" + el.id;
    const cls = Array.from(el.classList).filter((c) => /^[A-Za-z_-][\w-]{0,40}$/.test(c)).slice(0, 2);
    return s + cls.map((c) => "." + c).join("");
  };
  const inventory = [];
  const kind = (k, list) => {
    const vis = list.filter((el) => { const r = el.getBoundingClientRect(); return visible(el, r, getComputedStyle(el)); });
    const ex = Array.from(new Set(vis.map(sel))).slice(0, 5);
    inventory.push({ kind: k, count: vis.length, examples: ex });
  };
  const q = (s) => Array.from(document.querySelectorAll(s)).slice(0, MAX_EL);
  const buttons = q("button, [role=button], input[type=submit], input[type=button], a[class*=btn], a[class*=button]");
  kind("buttons", buttons);
  kind("inputs", q("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), textarea, select"));
  kind("tables", q("table, [role=table], [role=grid]"));
  kind("navs", q("nav, [role=navigation]"));
  const btnSet = new Set(buttons);
  const painted = (cs) => cs.backgroundColor !== "rgba(0, 0, 0, 0)" || px(cs.borderTopWidth) > 0;
  kind("cards", els.filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 140 || r.height < 90 || r.width > window.innerWidth * 0.9) return false;
    const cs = getComputedStyle(el);
    return px(cs.borderTopLeftRadius) >= 4 && (cs.boxShadow !== "none" || px(cs.borderTopWidth) > 0) && painted(cs) && el.children.length >= 2;
  }));
  kind("badges", els.filter((el) => {
    if (btnSet.has(el) || el.closest("button, a[class*=btn]")) return false;
    const r = el.getBoundingClientRect();
    if (r.height < 12 || r.height > 30 || r.width > 160 || r.width < 12) return false;
    const cs = getComputedStyle(el);
    const t = (el.textContent || "").trim();
    return t.length > 0 && t.length <= 24 && el.children.length === 0 && px(cs.borderTopLeftRadius) >= 3 && painted(cs);
  }));

  return {
    raw: {
      colors: Array.from(colors, ([k, weight]) => { const i = k.indexOf("|"); return { use: k.slice(0, i), value: k.slice(i + 1), weight }; }),
      fonts, fontSizes, radii, spacing, shadows,
    },
    inventory,
    title: document.title.slice(0, 200),
  };
})()`;
