import type { ZodType } from "zod";

/** A destination field the CSV columns are mapped onto. */
export interface ImporterField {
  /** Key in the imported record. */
  key: string;
  label: string;
  /** Alternative header spellings that should map here (e.g. "E-mail", "Email address"). */
  aliases?: readonly string[];
  required?: boolean;
  /**
   * Validates and transforms the raw cell text (always a string, "" when blank).
   * Use z.coerce / z.preprocess for numbers and dates. Defaults to a trimmed string.
   */
  schema?: ZodType<unknown>;
  /** Example value shown in the mapping step. */
  example?: string;
  description?: string;
}

/** Messages posted by the parser (worker or main-thread fallback). */
export type ParserMessage =
  | { type: "rows"; rows: string[][] }
  | { type: "progress"; bytes: number; total: number; rows: number }
  | { type: "done"; rows: number; delimiter: string; truncated: boolean }
  | { type: "error"; message: string };

export interface ParseOptions {
  /** Bytes read per chunk (default 1 MiB). */
  chunkSize?: number;
  /** Stop after this many records (default 500k). */
  maxRows?: number;
  /** Force a delimiter; auto-detected from the first chunk otherwise. */
  delimiter?: string;
}

export type ImportStep = "upload" | "parsing" | "mapping" | "review";

/** columnIndex -> field key (or null when the column is ignored). */
export type ColumnMapping = (string | null)[];

export interface DuplicateInfo {
  /** Row indexes (into the parsed rows) that repeat an earlier row's key. */
  inFile: Set<number>;
  /** Row indexes whose key already exists in `existingKeys`. */
  existing: Set<number>;
}

export interface ImportSummary {
  fileName: string;
  totalRows: number;
  imported: number;
  skippedInvalid: number;
  skippedDuplicates: number;
}

export type CellErrors = Map<number, Record<string, string>>;
