export interface FileNode {
  id: string;
  name: string;
  /** null for items at the root. */
  parentId: string | null;
  kind: "folder" | "file";
  /** Bytes (files only). */
  size?: number;
  mimeType?: string;
  /** Epoch milliseconds. */
  modifiedAt: number;
  owner?: string;
  /** Image thumbnail / preview source. */
  thumbnailUrl?: string;
  url?: string;
  /** Free-form record link, e.g. "Deal: Acme renewal". */
  linkedRecord?: string;
}

export type FileKindFilter = "all" | "folders" | "documents" | "images" | "spreadsheets" | "other";

export type FileSortKey = "name" | "modifiedAt" | "size" | "type";

export interface FileSort {
  key: FileSortKey;
  desc: boolean;
}

export const FILE_DRAG_MIME = "application/x-kitbase-file-ids";

export function fileCategory(n: FileNode): Exclude<FileKindFilter, "all"> {
  if (n.kind === "folder") return "folders";
  const t = n.mimeType ?? "";
  if (t.startsWith("image/")) return "images";
  if (t.includes("spreadsheet") || t.includes("csv") || t.includes("excel")) return "spreadsheets";
  if (t.includes("pdf") || t.includes("word") || t.includes("document") || t.startsWith("text/"))
    return "documents";
  return "other";
}

export function extension(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toUpperCase() : "";
}

export function formatSize(n?: number) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
