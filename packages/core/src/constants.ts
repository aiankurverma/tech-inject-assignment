/** npm packages a component may depend on. Preview bundles exactly these. */
export const ALLOWED_DEPENDENCIES = [
  "react",
  "lucide-react",
  "clsx",
  "tailwind-merge",
  "@radix-ui/react-checkbox",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-popover",
  "@radix-ui/react-select",
  "@radix-ui/react-slider",
  "@radix-ui/react-slot",
  "@radix-ui/react-tabs",
  "@radix-ui/react-toggle-group",
  // Pro libraries (MIT / Apache-2.0 / BSD / ISC only; see THIRD_PARTY_NOTICES.md).
  "@ai-sdk/react",
  "@codemirror/autocomplete",
  "@codemirror/lang-javascript",
  "@codemirror/lang-json",
  "@codemirror/lang-sql",
  "@codemirror/lint",
  "@codemirror/state",
  "@codemirror/view",
  "@dagrejs/dagre",
  "@date-fns/tz",
  "@dnd-kit/core",
  "@dnd-kit/sortable",
  "@dnd-kit/utilities",
  "@excalidraw/excalidraw",
  "@floating-ui/react",
  "@formulajs/formulajs",
  "@fullcalendar/core",
  "@fullcalendar/daygrid",
  "@fullcalendar/interaction",
  "@fullcalendar/list",
  "@fullcalendar/react",
  "@fullcalendar/timegrid",
  "@hookform/resolvers",
  "@nivo/sankey",
  "@react-pdf/renderer",
  "@scalar/openapi-parser",
  "@stripe/react-stripe-js",
  "@stripe/stripe-js",
  "@tanstack/react-query",
  "@tanstack/react-table",
  "@tanstack/react-virtual",
  "@tiptap/extension-list",
  "@tiptap/extension-mention",
  "@tiptap/extension-table",
  "@tiptap/extensions",
  "@tiptap/react",
  "@tiptap/starter-kit",
  "@tiptap/suggestion",
  "@turf/turf",
  "@uiw/react-codemirror",
  "@uppy/core",
  "@uppy/react",
  "@xterm/addon-fit",
  "@xterm/xterm",
  "@xyflow/react",
  "ai",
  "ajv",
  "anser",
  "big.js",
  "cmdk",
  "cron-parser",
  "cronstrue",
  "date-fns",
  "deck.gl",
  "diff",
  "dinero.js",
  "echarts",
  "echarts-for-react",
  "fuse.js",
  "html-to-image",
  "httpsnippet-lite",
  "immer",
  "jsondiffpatch",
  "jsonpath-plus",
  "jstat",
  "libphonenumber-js",
  "maplibre-gl",
  "motion",
  "nuqs",
  "papaparse",
  "pdf-lib",
  "pdfjs-dist",
  "react-arborist",
  "react-day-picker",
  "react-dropzone",
  "react-grid-layout",
  "react-hook-form",
  "react-hotkeys-hook",
  "react-map-gl",
  "react-markdown",
  "react-pdf",
  "react-querybuilder",
  "react-resizable-panels",
  "react-virtuoso",
  "react-zoom-pan-pinch",
  "read-excel-file",
  "recharts",
  "remark-gfm",
  "rrule",
  "rrweb",
  "rrweb-player",
  "shiki",
  "signature_pad",
  "sql-formatter",
  "supercluster",
  "y-websocket",
  "yjs",
  "zod",
  "zustand",
] as const;

export type AllowedDependency = (typeof ALLOWED_DEPENDENCIES)[number];

/**
 * Sub-path entry points a library legitimately needs (no bare "." export, moved APIs, or the
 * library's own stylesheet). Kept deliberately short: each one maps back to its package.
 */
export const ALLOWED_SUBPATH_IMPORTS = [
  "react-map-gl/maplibre",
  "read-excel-file/browser",
  "@tiptap/react/menus",
  "zustand/middleware",
  "@hookform/resolvers/zod",
  "motion/react",
  "nuqs/adapters/react",
  "@xterm/xterm/css/xterm.css",
  "react-day-picker/style.css",
  "@xyflow/react/dist/style.css",
  "maplibre-gl/dist/maplibre-gl.css",
  "react-grid-layout/css/styles.css",
  "@excalidraw/excalidraw/index.css",
  "rrweb-player/dist/style.css",
] as const;

/** Packages with no root entry point: only their sub-paths above can be imported. */
const SUBPATH_ONLY_DEPENDENCIES: readonly string[] = ["react-map-gl", "read-excel-file"];

/** Bare imports allowed in component source (deps + react internals + vetted sub-paths). */
export const ALLOWED_IMPORTS: readonly string[] = [
  ...ALLOWED_DEPENDENCIES.filter((d) => !SUBPATH_ONLY_DEPENDENCIES.includes(d)),
  "react/jsx-runtime",
  ...ALLOWED_SUBPATH_IMPORTS,
];

/** The allowed dependency an import specifier belongs to ("react-map-gl/maplibre" -> "react-map-gl"). */
export function dependencyOf(spec: string): AllowedDependency | undefined {
  return (ALLOWED_DEPENDENCIES as readonly string[]).find(
    (d) => spec === d || spec.startsWith(`${d}/`),
  ) as AllowedDependency | undefined;
}

/** Files every component needs; always shipped with copy/install/prompt. */
export const THEME_FILE_PATH = "styles/crm-theme.css";
export const UTILS_FILE_PATH = "lib/utils.ts";

export const LIMITS = {
  maxFiles: 20,
  maxFileBytes: 100_000,
  maxTotalBytes: 500_000,
  maxThumbnailBytes: 300_000,
  maxExamples: 12,
} as const;

/** Main CSS setup for consumers. The font @import must come first: CSS ignores @import after other rules. */
export const CSS_SETUP = [
  '@import url("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap");',
  '@import "tailwindcss";',
  '@import "./styles/crm-theme.css";',
].join("\n");
