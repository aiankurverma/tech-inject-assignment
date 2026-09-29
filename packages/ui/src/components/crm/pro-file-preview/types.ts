export type PreviewKind = "pdf" | "image" | "code" | "video" | "audio" | "unknown";

/** Binary or URL source. Strings are treated as URLs (http, blob: or data:). */
export type PreviewSource = string | ArrayBuffer | Uint8Array | Blob;

export interface PreviewFile {
  id: string;
  name: string;
  /** Overrides detection from mimeType / extension. */
  kind?: PreviewKind;
  mimeType?: string;
  /** URL or bytes. Code files may pass `content` instead. */
  src?: PreviewSource;
  /** Raw text for code / text files (skips fetching). */
  content?: string;
  /** Shiki language id; detected from the extension when omitted. */
  language?: string;
  /** Bytes, shown in the header. */
  size?: number;
  /** Poster / thumbnail URL for the gallery strip. */
  thumbnail?: string;
  /** Free-form caption such as "Uploaded by Priya, 2h ago". */
  meta?: string;
}

const EXT_KIND: Record<string, PreviewKind> = {
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  svg: "image",
  bmp: "image",
  mp4: "video",
  webm: "video",
  mov: "video",
  ogv: "video",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
  flac: "audio",
};

/** Extension -> shiki language id (only the common ones; anything else falls back to "text"). */
export const EXT_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  css: "css",
  scss: "scss",
  html: "html",
  md: "markdown",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  cs: "csharp",
  php: "php",
  sql: "sql",
  sh: "shellscript",
  bash: "shellscript",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  xml: "xml",
  graphql: "graphql",
  dockerfile: "dockerfile",
  txt: "text",
  log: "log",
  csv: "csv",
};

export function extensionOf(name: string): string {
  const base = name.toLowerCase().split("/").pop() ?? "";
  if (base === "dockerfile") return "dockerfile";
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1);
}

export function detectKind(file: PreviewFile): PreviewKind {
  if (file.kind) return file.kind;
  const mime = file.mimeType ?? "";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("text/") || mime.includes("json") || mime.includes("javascript"))
    return "code";
  const ext = extensionOf(file.name);
  if (EXT_KIND[ext]) return EXT_KIND[ext];
  if (ext in EXT_LANG || file.content !== undefined) return "code";
  return "unknown";
}

export function detectLanguage(file: PreviewFile): string {
  return file.language ?? EXT_LANG[extensionOf(file.name)] ?? "text";
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
