export type SpanAttributeValue = string | number | boolean | null;

export interface TraceSpan {
  spanId: string;
  /** Missing / unknown parents make the span a root (orphans are tolerated, as in real traces). */
  parentSpanId?: string | null;
  name: string;
  service: string;
  /** Start in milliseconds (epoch or trace-relative; only differences matter). Fractions allowed. */
  startTime: number;
  /** Duration in milliseconds. */
  duration: number;
  status?: "ok" | "error" | "unset";
  kind?: "server" | "client" | "producer" | "consumer" | "internal";
  attributes?: Record<string, SpanAttributeValue>;
  events?: { time: number; name: string; attributes?: Record<string, SpanAttributeValue> }[];
}

/** Internal node with precomputed tree facts, built once per spans array. */
export interface SpanNode {
  span: TraceSpan;
  index: number;
  depth: number;
  end: number;
  children: SpanNode[];
  parent: SpanNode | null;
  descendants: number;
  /** Error on this span or anywhere beneath it. */
  subtreeError: boolean;
}
