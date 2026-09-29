// Eager core: the only packages uploaded code can import. Must match ALLOWED_IMPORTS in @ti/core.
import * as React from "react";
import * as JsxRuntime from "react/jsx-runtime";
import * as Lucide from "lucide-react";
import * as Clsx from "clsx";
import * as TailwindMerge from "tailwind-merge";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import * as Select from "@radix-ui/react-select";
import * as Slider from "@radix-ui/react-slider";
import * as Slot from "@radix-ui/react-slot";
import * as Tabs from "@radix-ui/react-tabs";
import * as ToggleGroup from "@radix-ui/react-toggle-group";

/** Resolved modules; lazy ones are added by loadModules() before the example runs. */
export const MODULES: Record<string, unknown> = {
  react: React,
  "react/jsx-runtime": JsxRuntime,
  "lucide-react": Lucide,
  clsx: Clsx,
  "tailwind-merge": TailwindMerge,
  "@radix-ui/react-checkbox": Checkbox,
  "@radix-ui/react-dialog": Dialog,
  "@radix-ui/react-dropdown-menu": DropdownMenu,
  "@radix-ui/react-popover": Popover,
  "@radix-ui/react-select": Select,
  "@radix-ui/react-slider": Slider,
  "@radix-ui/react-slot": Slot,
  "@radix-ui/react-tabs": Tabs,
  "@radix-ui/react-toggle-group": ToggleGroup,
};

/** Injects a library stylesheet once (inline <style> is allowed by the preview CSP). */
const css = (id: string, load: () => Promise<{ default: string }>) => async () => {
  const text = (await load()).default;
  if (!document.querySelector(`style[data-lib="${id}"]`)) {
    const el = document.createElement("style");
    el.dataset.lib = id;
    el.textContent = text;
    document.head.prepend(el);
  }
  return {};
};

/**
 * Pro libraries, code-split so a preview only downloads what its bundle imports.
 * Keys must match ALLOWED_IMPORTS in @ti/core (enforced by modules.test.ts).
 */
export const LAZY_MODULES: Record<string, () => Promise<unknown>> = {
  "@ai-sdk/react": () => import("@ai-sdk/react"),
  "@codemirror/lang-javascript": () => import("@codemirror/lang-javascript"),
  "@codemirror/lang-json": () => import("@codemirror/lang-json"),
  "@codemirror/lang-sql": () => import("@codemirror/lang-sql"),
  "@codemirror/state": () => import("@codemirror/state"),
  "@codemirror/view": () => import("@codemirror/view"),
  "@dagrejs/dagre": () => import("@dagrejs/dagre"),
  "@date-fns/tz": () => import("@date-fns/tz"),
  "@dnd-kit/core": () => import("@dnd-kit/core"),
  "@dnd-kit/sortable": () => import("@dnd-kit/sortable"),
  "@dnd-kit/utilities": () => import("@dnd-kit/utilities"),
  "@excalidraw/excalidraw": () => import("@excalidraw/excalidraw"),
  "@floating-ui/react": () => import("@floating-ui/react"),
  "@formulajs/formulajs": () => import("@formulajs/formulajs"),
  "@fullcalendar/core": () => import("@fullcalendar/core"),
  "@fullcalendar/daygrid": () => import("@fullcalendar/daygrid"),
  "@fullcalendar/interaction": () => import("@fullcalendar/interaction"),
  "@fullcalendar/list": () => import("@fullcalendar/list"),
  "@fullcalendar/react": () => import("@fullcalendar/react"),
  "@fullcalendar/timegrid": () => import("@fullcalendar/timegrid"),
  "@hookform/resolvers": () => import("@hookform/resolvers"),
  "@nivo/sankey": () => import("@nivo/sankey"),
  "@react-pdf/renderer": () => import("@react-pdf/renderer"),
  "@scalar/openapi-parser": () => import("@scalar/openapi-parser"),
  "@stripe/react-stripe-js": () => import("@stripe/react-stripe-js"),
  "@stripe/stripe-js": () => import("@stripe/stripe-js"),
  "@tanstack/react-table": () => import("@tanstack/react-table"),
  "@tanstack/react-virtual": () => import("@tanstack/react-virtual"),
  "@tiptap/extension-list": () => import("@tiptap/extension-list"),
  "@tiptap/extension-mention": () => import("@tiptap/extension-mention"),
  "@tiptap/extension-table": () => import("@tiptap/extension-table"),
  "@tiptap/extensions": () => import("@tiptap/extensions"),
  "@tiptap/react": () => import("@tiptap/react"),
  "@tiptap/react/menus": () => import("@tiptap/react/menus"),
  "@tiptap/starter-kit": () => import("@tiptap/starter-kit"),
  "@tiptap/suggestion": () => import("@tiptap/suggestion"),
  "@turf/turf": () => import("@turf/turf"),
  "@uiw/react-codemirror": () => import("@uiw/react-codemirror"),
  "@uppy/core": () => import("@uppy/core"),
  "@uppy/react": () => import("@uppy/react"),
  "@xyflow/react": () => import("@xyflow/react"),
  ai: () => import("ai"),
  anser: () => import("anser"),
  "big.js": () => import("big.js"),
  cmdk: () => import("cmdk"),
  "cron-parser": () => import("cron-parser"),
  cronstrue: () => import("cronstrue"),
  "date-fns": () => import("date-fns"),
  diff: () => import("diff"),
  "dinero.js": () => import("dinero.js"),
  echarts: () => import("echarts"),
  "echarts-for-react": () => import("echarts-for-react"),
  "fuse.js": () => import("fuse.js"),
  "html-to-image": () => import("html-to-image"),
  "httpsnippet-lite": () => import("httpsnippet-lite"),
  "jsonpath-plus": () => import("jsonpath-plus"),
  jstat: () => import("jstat"),
  "maplibre-gl": () => import("maplibre-gl"),
  papaparse: () => import("papaparse"),
  "pdf-lib": () => import("pdf-lib"),
  "pdfjs-dist": () => import("pdfjs-dist"),
  "react-arborist": () => import("react-arborist"),
  "react-dropzone": () => import("react-dropzone"),
  "react-grid-layout": () => import("react-grid-layout"),
  "react-hook-form": () => import("react-hook-form"),
  "react-hotkeys-hook": () => import("react-hotkeys-hook"),
  "react-map-gl/maplibre": () => import("react-map-gl/maplibre"),
  "react-markdown": () => import("react-markdown"),
  "react-pdf": () => import("react-pdf"),
  "react-querybuilder": () => import("react-querybuilder"),
  "react-resizable-panels": () => import("react-resizable-panels"),
  "react-virtuoso": () => import("react-virtuoso"),
  "read-excel-file/browser": () => import("read-excel-file/browser"),
  recharts: () => import("recharts"),
  "remark-gfm": () => import("remark-gfm"),
  rrule: () => import("rrule"),
  rrweb: () => import("rrweb"),
  "rrweb-player": () => import("rrweb-player"),
  shiki: () => import("shiki"),
  signature_pad: () => import("signature_pad"),
  "sql-formatter": () => import("sql-formatter"),
  supercluster: () => import("supercluster"),
  "y-websocket": () => import("y-websocket"),
  yjs: () => import("yjs"),
  zod: () => import("zod"),
  zustand: () => import("zustand"),
  "zustand/middleware": () => import("zustand/middleware"),
  "@hookform/resolvers/zod": () => import("@hookform/resolvers/zod"),
  "@codemirror/autocomplete": () => import("@codemirror/autocomplete"),
  "@codemirror/lint": () => import("@codemirror/lint"),
  "@tanstack/react-query": () => import("@tanstack/react-query"),
  "@xterm/addon-fit": () => import("@xterm/addon-fit"),
  "@xterm/xterm": () => import("@xterm/xterm"),
  ajv: () => import("ajv"),
  "deck.gl": () => import("deck.gl"),
  immer: () => import("immer"),
  jsondiffpatch: () => import("jsondiffpatch"),
  "libphonenumber-js": () => import("libphonenumber-js"),
  motion: () => import("motion"),
  "motion/react": () => import("motion/react"),
  nuqs: () => import("nuqs"),
  "nuqs/adapters/react": () => import("nuqs/adapters/react"),
  "react-day-picker": () => import("react-day-picker"),
  "react-zoom-pan-pinch": () => import("react-zoom-pan-pinch"),
  "@xterm/xterm/css/xterm.css": css(
    "@xterm/xterm/css/xterm.css",
    () => import("@xterm/xterm/css/xterm.css?inline"),
  ),
  "react-day-picker/style.css": css(
    "react-day-picker/style.css",
    () => import("react-day-picker/style.css?inline"),
  ),
  "@xyflow/react/dist/style.css": css(
    "@xyflow/react/dist/style.css",
    () => import("@xyflow/react/dist/style.css?inline"),
  ),
  "maplibre-gl/dist/maplibre-gl.css": css(
    "maplibre-gl/dist/maplibre-gl.css",
    () => import("maplibre-gl/dist/maplibre-gl.css?inline"),
  ),
  "react-grid-layout/css/styles.css": css(
    "react-grid-layout/css/styles.css",
    () => import("react-grid-layout/css/styles.css?inline"),
  ),
  "@excalidraw/excalidraw/index.css": css(
    "@excalidraw/excalidraw/index.css",
    () => import("@excalidraw/excalidraw/index.css?inline"),
  ),
  "rrweb-player/dist/style.css": css(
    "rrweb-player/dist/style.css",
    () => import("rrweb-player/dist/style.css?inline"),
  ),
};

const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']|require\s*\(\s*["']([^"']+)["']\s*\)/g;

/** Resolves every lazy module the given sources import so the synchronous require() finds it. */
export async function loadModules(sources: string[]): Promise<void> {
  const wanted = new Set<string>();
  for (const src of sources)
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
      if (spec && !(spec in MODULES) && spec in LAZY_MODULES) wanted.add(spec);
    }
  await Promise.all(
    [...wanted].map(async (spec) => {
      MODULES[spec] = await LAZY_MODULES[spec]!();
    }),
  );
}
