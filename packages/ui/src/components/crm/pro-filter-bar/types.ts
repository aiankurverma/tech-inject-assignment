import type { ReactNode } from "react";

/** The value shape a field filters on. Decides the operators and the value editor. */
export type FilterFieldType = "enum" | "text" | "number" | "date" | "boolean";

export type FilterOperator =
  // enum
  | "is"
  | "is_not"
  // text
  | "contains"
  | "not_contains"
  | "equals"
  | "starts_with"
  // number
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  // date
  | "on"
  | "before"
  | "after"
  | "within"
  | "last_days"
  // any
  | "empty"
  | "not_empty";

export interface FilterOption {
  value: string;
  label: string;
  /** Leading node in lists and chips (avatar, dot, icon). */
  icon?: ReactNode;
  /** Extra text the typeahead matches, e.g. an email. */
  keywords?: string;
}

export interface FilterField<TRow = unknown> {
  /** Stable id, also used in the URL. Lowercase letters, digits, "-" and "_" keep URLs readable. */
  id: string;
  label: string;
  type: FilterFieldType;
  icon?: ReactNode;
  /** Options for "enum" fields. Omit to derive them from the rows (sorted by count). */
  options?: FilterOption[];
  /** Reads the raw value from a row. Enum fields may return a string or string[] (tags). */
  accessor?: (row: TRow) => unknown;
  /** Unit shown after numbers, e.g. "$" prefix or "days" suffix. */
  format?: (value: number) => string;
  /** Hide from the add-filter menu (still honoured when present in the URL). */
  hidden?: boolean;
}

/**
 * One chip. `values` is always a string list so it round-trips through the URL:
 * enum: selected option values; text: [query]; number: [n] or [min, max];
 * date: ISO days (yyyy-MM-dd) — [day] or [from, to] — or [n] for "last n days"; boolean: ["true" | "false"].
 */
export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  values: string[];
}

export interface SavedView {
  id: string;
  name: string;
  filters: FilterCondition[];
  /** Views flagged as built-in cannot be deleted from the UI. */
  locked?: boolean;
}

/** facetCounts[fieldId][optionValue] = rows matching every *other* filter plus this option. */
export type FacetCounts = Record<string, Map<string, number>>;
