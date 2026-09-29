import * as React from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useErd } from "@/hooks/use-erd-store";
import {
  HEADER_HEIGHT,
  NODE_WIDTH,
  ROW_HEIGHT,
  type ErdTable,
} from "@/components/crm/pro-schema-erd/types";

export type TableNodeType = Node<{ table: ErdTable }, "table">;

const hidden = "!h-2 !w-2 !min-h-0 !min-w-0 !border-0 !bg-transparent";

function KeyBadge({ kind }: { kind: "PK" | "FK" | "UQ" }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 w-6 shrink-0 items-center justify-center rounded-[4px] text-[9px] font-semibold",
        kind === "PK" && "bg-crm-warning/20 text-crm-warning",
        kind === "FK" && "bg-crm-primary/15 text-crm-primary",
        kind === "UQ" && "bg-crm-chip text-crm-muted-fg",
      )}
    >
      {kind}
    </span>
  );
}

export const TableNode = React.memo(function TableNode({ id, data }: NodeProps<TableNodeType>) {
  const { table } = data;
  // Each node subscribes only to its own highlight state, so focusing re-renders O(changed).
  const status = useErd((s) =>
    s.focusedId === id ? "focus" : s.nodes ? (s.nodes.has(id) ? "on" : "off") : "none",
  );
  const matched = useErd((s) => s.matches.has(id));

  return (
    <div
      className={cn(
        "overflow-hidden rounded-crm border bg-crm-card text-crm-fg shadow-crm-raised transition-opacity",
        status === "focus"
          ? "border-crm-primary ring-2 ring-crm-primary/40"
          : status === "on"
            ? "border-crm-primary/60"
            : "border-crm-border",
        status === "off" && "opacity-25",
        matched && status !== "focus" && "ring-2 ring-crm-warning/60",
      )}
      style={{ width: NODE_WIDTH }}
      aria-label={`Table ${table.schema ? `${table.schema}.` : ""}${table.name}, ${table.columns.length} columns`}
    >
      <div
        className="flex items-center gap-2 border-b border-crm-border bg-crm-soft px-3"
        style={{
          height: HEADER_HEIGHT,
          boxShadow: table.color ? `inset 3px 0 0 ${table.color}` : undefined,
        }}
        title={table.note}
      >
        <span className="truncate text-[13px] font-semibold">{table.name}</span>
        {table.schema && (
          <span className="truncate text-[10px] text-crm-muted-fg">{table.schema}</span>
        )}
        <span className="ml-auto text-[10px] tabular-nums text-crm-muted-fg">
          {table.columns.length}
        </span>
      </div>
      <ul className="py-[3px]">
        {table.columns.map((c) => (
          <li
            key={c.name}
            className="relative flex items-center gap-2 px-3 text-[11.5px]"
            style={{ height: ROW_HEIGHT }}
            title={c.note}
          >
            <Handle
              type="target"
              position={Position.Left}
              id={`${c.name}:t`}
              isConnectable={false}
              className={hidden}
            />
            <span className="flex w-6 shrink-0">
              {c.pk ? (
                <KeyBadge kind="PK" />
              ) : c.fk ? (
                <KeyBadge kind="FK" />
              ) : c.unique ? (
                <KeyBadge kind="UQ" />
              ) : null}
            </span>
            <span className={cn("truncate", c.pk && "font-semibold")}>{c.name}</span>
            <span className="ml-auto truncate font-mono text-[10.5px] text-crm-muted-fg">
              {c.type}
              {c.nullable ? "?" : ""}
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id={`${c.name}:s`}
              isConnectable={false}
              className={hidden}
            />
          </li>
        ))}
      </ul>
    </div>
  );
});
