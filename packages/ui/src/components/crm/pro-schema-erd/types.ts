export interface ErdColumn {
  name: string;
  /** SQL type as displayed, e.g. "uuid", "varchar(255)". */
  type: string;
  pk?: boolean;
  /** Foreign key target. */
  fk?: { table: string; column: string };
  nullable?: boolean;
  unique?: boolean;
  note?: string;
}

export interface ErdTable {
  /** Unique id, usually "schema.table" or the table name. */
  id: string;
  name: string;
  schema?: string;
  columns: ErdColumn[];
  note?: string;
  /** Optional accent colour for the header stripe (e.g. per schema/domain). */
  color?: string;
}

export type Cardinality = "one-to-one" | "many-to-one" | "one-to-many" | "many-to-many";

export interface ErdRelation {
  id?: string;
  from: { table: string; column: string };
  to: { table: string; column: string };
  cardinality?: Cardinality;
  /** Source side may be null (FK nullable). */
  optional?: boolean;
  label?: string;
}

export type LineageMode = "both" | "upstream" | "downstream";

export interface ResolvedRelation extends Required<Omit<ErdRelation, "label">> {
  id: string;
  label?: string;
}

export const NODE_WIDTH = 260;
export const HEADER_HEIGHT = 40;
export const ROW_HEIGHT = 24;
export const NODE_PADDING = 6;

export const nodeHeight = (t: ErdTable) =>
  HEADER_HEIGHT + t.columns.length * ROW_HEIGHT + NODE_PADDING;
