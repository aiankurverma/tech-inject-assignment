import * as React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useErd } from "@/hooks/use-erd-store";
import type { Cardinality } from "@/components/crm/pro-schema-erd/types";

export type RelationEdgeType = Edge<
  { cardinality: Cardinality; optional: boolean; label: string },
  "relation"
>;

/**
 * Crow's-foot marker path at (x, y). `dir` is +1 when the line leaves to the right.
 * many = three-prong foot, one = bar; optional adds a circle, mandatory a second bar.
 */
export function markerPath(
  kind: "one" | "many",
  optional: boolean,
  x: number,
  y: number,
  dir: 1 | -1,
) {
  let d = "";
  if (kind === "many")
    d += `M${x + 12 * dir},${y}L${x},${y - 6}M${x + 12 * dir},${y}L${x},${y + 6}`;
  else d += `M${x + 8 * dir},${y - 6}L${x + 8 * dir},${y + 6}`;
  if (!optional) d += `M${x + 16 * dir},${y - 6}L${x + 16 * dir},${y + 6}`;
  return d;
}

export function ends(c: Cardinality): ["one" | "many", "one" | "many"] {
  if (c === "one-to-one") return ["one", "one"];
  if (c === "one-to-many") return ["one", "many"];
  if (c === "many-to-many") return ["many", "many"];
  return ["many", "one"];
}

export const RelationEdge = React.memo(function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<RelationEdgeType>) {
  const status = useErd((s) => (s.edges ? (s.edges.has(id) ? "on" : "off") : "none"));
  const [path, lx, ly] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 10,
    offset: 22,
  });
  const [a, b] = ends(data?.cardinality ?? "many-to-one");
  const sDir = sourcePosition === Position.Left ? -1 : 1;
  const tDir = targetPosition === Position.Right ? 1 : -1;
  const markers =
    markerPath(a, !!data?.optional, sourceX, sourceY, sDir) +
    markerPath(b, false, targetX, targetY, tDir);
  const stroke = status === "on" ? "var(--color-crm-primary)" : "var(--color-crm-muted-fg)";

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke,
          strokeWidth: status === "on" ? 2 : 1.25,
          opacity: status === "off" ? 0.12 : status === "on" ? 1 : 0.55,
        }}
      />
      <path
        d={markers}
        fill="none"
        stroke={stroke}
        strokeWidth={status === "on" ? 2 : 1.25}
        opacity={status === "off" ? 0.12 : 1}
        pointerEvents="none"
      />
      {status === "on" && data?.label && (
        <EdgeLabelRenderer>
          <div
            className={cn(
              "nodrag nopan pointer-events-none absolute rounded-full border border-crm-border bg-crm-popover px-2 py-0.5 font-mono text-[10px] text-crm-fg shadow-crm-raised",
            )}
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
