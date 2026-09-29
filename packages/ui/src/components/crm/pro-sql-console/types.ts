export type SqlColumnType =
  "text" | "integer" | "numeric" | "boolean" | "timestamp" | "date" | "uuid" | "json";

export interface SqlColumn {
  name: string;
  type: SqlColumnType | (string & {});
  /** Shown in autocomplete and the schema tree. */
  description?: string;
  primaryKey?: boolean;
  nullable?: boolean;
}

export interface SqlTable {
  name: string;
  /** Schema qualifier, e.g. "public". Completion offers both `t` and `schema.t`. */
  schema?: string;
  columns: SqlColumn[];
  description?: string;
  /** Approximate row count for the schema tree. */
  rowCount?: number;
}

export interface QueryResult {
  columns: { name: string; type?: string }[];
  /** Row-major values; index matches `columns`. */
  rows: unknown[][];
  /** Rows affected for DML; defaults to rows.length. */
  rowCount?: number;
  durationMs?: number;
  /** Non-fatal notices, e.g. "Result truncated to 10,000 rows". */
  notice?: string;
}

/** Thrown/rejected by `onRun` to show an error with an optional position in the query. */
export interface QueryError {
  message: string;
  /** 0-based character offset into the executed SQL. */
  position?: number;
}

export interface QueryTab {
  id: string;
  title: string;
  sql: string;
  status: "idle" | "running" | "success" | "error";
  result?: QueryResult;
  error?: QueryError;
  /** Offset of the executed text inside the tab, used to map error positions. */
  ranFrom?: number;
  startedAt?: number;
}

export interface HistoryEntry {
  id: string;
  sql: string;
  at: number;
  durationMs?: number;
  rowCount?: number;
  ok: boolean;
}

export type RunQuery = (sql: string, ctx: { signal: AbortSignal }) => Promise<QueryResult>;
