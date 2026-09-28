import * as React from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Input } from "@/components/crm/input";
import { Select } from "@/components/crm/select";
import { Tag } from "@/components/crm/tag";

export interface PipelineStage {
  id: string;
  name: string;
  /** Win probability 0-100 used for weighted forecast. */
  probability: number;
  /** Days without activity before a deal is marked rotting. 0 = off. */
  rotDays: number;
  /** Open deals currently in the stage. */
  dealCount: number;
  /** Sum of open deal amounts in the stage. */
  dealValue: number;
  kind?: "open" | "won" | "lost";
}

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

export interface SettingsPipelinesProps {
  pipelines?: Pipeline[];
  defaultPipelines?: Pipeline[];
  onPipelinesChange?: (p: Pipeline[]) => void;
  currency?: string;
  locale?: string;
  onSave?: (p: Pipeline[]) => Promise<void> | void;
  className?: string;
}

/** Moves item at `from` to `to`, returning a new array. */
export function moveItem<T>(arr: T[], from: number, to: number) {
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  if (it !== undefined) next.splice(Math.max(0, Math.min(next.length, to)), 0, it);
  return next;
}

/** Stage-level problems: duplicate names, probabilities that go down as deals progress. */
export function stageWarnings(stages: PipelineStage[]) {
  const w: Record<string, string> = {};
  const seen = new Map<string, string>();
  let prev = -1;
  for (const s of stages) {
    const key = s.name.trim().toLowerCase();
    if (!key) w[s.id] = "Name is required";
    else if (seen.has(key)) w[s.id] = "Duplicate stage name";
    seen.set(key, s.id);
    if ((s.kind ?? "open") === "open") {
      if (s.probability < prev && !w[s.id])
        w[s.id] = "Probability is lower than the previous stage";
      prev = s.probability;
    }
  }
  return w;
}

/** Pipeline & stage editor: pipeline switcher, drag or keyboard reordering, win probability, rotting days, delete-with-reassign guard, weighted forecast preview. */
export function SettingsPipelines({
  pipelines,
  defaultPipelines = [],
  onPipelinesChange,
  currency = "USD",
  locale = "en-US",
  onSave,
  className,
}: SettingsPipelinesProps) {
  const [inner, setInner] = React.useState(defaultPipelines);
  const list = pipelines ?? inner;
  const [saved, setSaved] = React.useState(list);
  const commit = (next: Pipeline[]) => {
    if (pipelines === undefined) setInner(next);
    onPipelinesChange?.(next);
  };
  const [pid, setPid] = React.useState(list[0]?.id ?? "");
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);
  const [reassign, setReassign] = React.useState<{ id: string; to: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [live, setLive] = React.useState("");

  const pipe = list.find((p) => p.id === pid) ?? list[0];
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(
      n,
    );
  if (!pipe)
    return (
      <p className="p-8 text-center font-crm text-sm text-crm-soft">No pipelines configured.</p>
    );

  const stages = pipe.stages;
  const setStages = (s: PipelineStage[]) =>
    commit(list.map((p) => (p.id === pipe.id ? { ...p, stages: s } : p)));
  const patch = (id: string, p: Partial<PipelineStage>) =>
    setStages(stages.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const warnings = stageWarnings(stages);
  const open = stages.filter((s) => (s.kind ?? "open") === "open");
  const totalValue = open.reduce((n, s) => n + s.dealValue, 0);
  const weighted = open.reduce((n, s) => n + (s.dealValue * s.probability) / 100, 0);
  const dirty = JSON.stringify(list) !== JSON.stringify(saved);

  function move(from: number, to: number) {
    const s = stages[from];
    if (!s || to < 0 || to >= stages.length) return;
    setStages(moveItem(stages, from, to));
    setLive(`${s.name} moved to position ${to + 1} of ${stages.length}.`);
  }

  function addStage() {
    const firstClosed = stages.findIndex((s) => (s.kind ?? "open") !== "open");
    const at = firstClosed === -1 ? stages.length : firstClosed;
    const lastProb = open[open.length - 1]?.probability ?? 10;
    const st: PipelineStage = {
      id: `st-${Date.now()}`,
      name: "",
      probability: Math.min(95, lastProb + 10),
      rotDays: 14,
      dealCount: 0,
      dealValue: 0,
    };
    setStages([...stages.slice(0, at), st, ...stages.slice(at)]);
  }

  function confirmDelete() {
    if (!reassign) return;
    const from = stages.find((s) => s.id === reassign.id);
    const to = stages.find((s) => s.id === reassign.to);
    if (!from) return;
    setStages(
      stages
        .filter((s) => s.id !== from.id)
        .map((s) =>
          to && s.id === to.id
            ? {
                ...s,
                dealCount: s.dealCount + from.dealCount,
                dealValue: s.dealValue + from.dealValue,
              }
            : s,
        ),
    );
    setReassign(null);
  }

  async function save() {
    if (
      Object.keys(warnings).some(
        (k) => warnings[k] !== "Probability is lower than the previous stage",
      )
    )
      return;
    setSaving(true);
    try {
      await onSave?.(list);
      setSaved(list);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cn("flex flex-col gap-4 font-crm", className)} aria-labelledby="pipe-h">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Settings</p>
          <h2 id="pipe-h" className="text-lg font-semibold text-crm-fg">
            Pipelines
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Pipeline"
            className="w-48"
            value={pipe.id}
            onValueChange={setPid}
            options={list.map((p) => ({ value: p.id, label: p.name }))}
          />
          <Button disabled={!dirty} onClick={() => commit(saved)}>
            Discard
          </Button>
          <Button variant="primary" disabled={!dirty} loading={saving} onClick={save}>
            Save
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {[
          ["Open deals", open.reduce((n, s) => n + s.dealCount, 0).toLocaleString(locale)],
          ["Pipeline value", money(totalValue)],
          ["Weighted forecast", money(weighted)],
        ].map(([l, v]) => (
          <div
            key={l}
            className="rounded-xl border border-crm-border bg-crm-card p-3 shadow-crm-raised"
          >
            <p className="text-xs text-crm-soft">{l}</p>
            <p className="text-base font-semibold text-crm-fg tabular-nums sm:text-lg">{v}</p>
          </div>
        ))}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>

      <div className="overflow-x-auto rounded-xl border border-crm-border bg-crm-card shadow-crm-raised">
        <div className="grid min-w-[640px] grid-cols-[28px_1fr_110px_110px_150px_76px] gap-2 border-b border-crm-border px-3 py-2 text-xs text-crm-subtle">
          <span />
          <span>Stage</span>
          <span>Win %</span>
          <span>Rot after</span>
          <span>Deals</span>
          <span className="sr-only">Actions</span>
        </div>
        <ol
          aria-label={`Stages of ${pipe.name}`}
          className="min-w-[640px] divide-y divide-crm-border"
        >
          {stages.map((s, i) => {
            const closed = (s.kind ?? "open") !== "open";
            return (
              <li
                key={s.id}
                draggable={!closed}
                onDragStart={(e) => {
                  setDragId(s.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (dragId && !closed) {
                    e.preventDefault();
                    setOverId(s.id);
                  }
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = stages.findIndex((x) => x.id === dragId);
                  if (from !== -1) move(from, i);
                  setDragId(null);
                  setOverId(null);
                }}
                className={cn(
                  "grid grid-cols-[28px_1fr_110px_110px_150px_76px] items-center gap-2 px-3 py-2",
                  dragId === s.id && "opacity-40",
                  overId === s.id && dragId !== s.id && "bg-crm-primary/10",
                )}
              >
                <span
                  className={cn("text-crm-subtle", closed ? "opacity-30" : "cursor-grab")}
                  aria-hidden
                >
                  <GripVertical className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <Input
                      aria-label={`Stage ${i + 1} name`}
                      value={s.name}
                      invalid={
                        !!warnings[s.id] &&
                        warnings[s.id] !== "Probability is lower than the previous stage"
                      }
                      placeholder="Stage name"
                      onChange={(e) => patch(s.id, { name: e.target.value })}
                      className="h-8"
                    />
                    {closed ? (
                      <Tag size="sm" color={s.kind === "won" ? "green" : "red"}>
                        {s.kind}
                      </Tag>
                    ) : null}
                  </span>
                  {warnings[s.id] ? (
                    <span className="text-[11px] text-crm-warning">{warnings[s.id]}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-1">
                  <input
                    aria-label={`${s.name || "Stage"} win probability`}
                    type="number"
                    min={0}
                    max={100}
                    disabled={closed}
                    value={s.probability}
                    onChange={(e) =>
                      patch(s.id, {
                        probability: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                      })
                    }
                    className="h-8 w-16 rounded-crm border border-crm-input/60 bg-crm-raised px-2 text-sm text-crm-fg tabular-nums disabled:opacity-50"
                  />
                  <span className="text-xs text-crm-subtle">%</span>
                </span>
                <span className="flex items-center gap-1">
                  <input
                    aria-label={`${s.name || "Stage"} rotting days`}
                    type="number"
                    min={0}
                    max={365}
                    disabled={closed}
                    value={s.rotDays}
                    onChange={(e) =>
                      patch(s.id, {
                        rotDays: Math.max(0, Math.min(365, Number(e.target.value) || 0)),
                      })
                    }
                    className="h-8 w-16 rounded-crm border border-crm-input/60 bg-crm-raised px-2 text-sm text-crm-fg tabular-nums disabled:opacity-50"
                  />
                  <span className="text-xs text-crm-subtle">days</span>
                </span>
                <span className="text-xs text-crm-soft tabular-nums">
                  {s.dealCount} · {money(s.dealValue)}
                </span>
                <span className="flex justify-end gap-0.5">
                  {!closed ? (
                    <>
                      <button
                        type="button"
                        aria-label={`Move ${s.name} up`}
                        disabled={i === 0}
                        onClick={() => move(i, i - 1)}
                        className="rounded p-1 text-crm-subtle hover:text-crm-fg disabled:opacity-30"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${s.name} down`}
                        disabled={
                          i === stages.length - 1 || (stages[i + 1]?.kind ?? "open") !== "open"
                        }
                        onClick={() => move(i, i + 1)}
                        className="rounded p-1 text-crm-subtle hover:text-crm-fg disabled:opacity-30"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${s.name}`}
                        disabled={open.length <= 1}
                        onClick={() =>
                          s.dealCount
                            ? setReassign({
                                id: s.id,
                                to: open.find((o) => o.id !== s.id)?.id ?? "",
                              })
                            : setStages(stages.filter((x) => x.id !== s.id))
                        }
                        className="rounded p-1 text-crm-subtle hover:text-crm-danger disabled:opacity-30"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="border-t border-crm-border p-2">
          <Button size="sm" variant="ghost" onClick={addStage}>
            <Plus /> Add stage
          </Button>
        </div>
      </div>

      {reassign ? (
        <div
          role="alertdialog"
          aria-labelledby="pipe-re-h"
          className="flex flex-col gap-3 rounded-xl border border-crm-danger/40 bg-crm-card p-4 shadow-crm-raised"
        >
          <p id="pipe-re-h" className="text-sm text-crm-fg">
            “{stages.find((s) => s.id === reassign.id)?.name}” has{" "}
            {stages.find((s) => s.id === reassign.id)?.dealCount} open deals. Move them to:
          </p>
          <div className="flex flex-wrap gap-2">
            <Select
              aria-label="Move deals to"
              className="w-48"
              value={reassign.to}
              onValueChange={(to) => setReassign({ ...reassign, to })}
              options={open
                .filter((o) => o.id !== reassign.id)
                .map((o) => ({ value: o.id, label: o.name || "Untitled" }))}
            />
            <Button variant="danger" onClick={confirmDelete}>
              Move deals & delete
            </Button>
            <Button variant="ghost" onClick={() => setReassign(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
