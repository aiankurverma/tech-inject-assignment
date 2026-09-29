import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useVirtualizer } from "@tanstack/react-virtual";
import { History, Redo2, RotateCw, Undo2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useRecordHistory } from "@/hooks/use-record-history";
import { BulkEdit } from "@/components/crm/pro-record-merge/bulk-edit";
import { MergeAuditView, recordTitle } from "@/components/crm/pro-record-merge/merge-audit";
import { MergeCompare } from "@/components/crm/pro-record-merge/merge-compare";
import {
  applyBulkOp,
  display,
  findDuplicateGroups,
  normalize,
  type BulkOp,
  type DuplicateGroup,
  type MergeAudit,
  type MergeField,
  type MergeRecord,
  type MergeResult,
} from "@/components/crm/pro-record-merge/model";

export type {
  BulkOp,
  DuplicateGroup,
  FieldValue,
  MergeAudit,
  MergeField,
  MergeRecord,
  MergeResult,
} from "@/components/crm/pro-record-merge/model";

export interface MatchRule {
  label: string;
  key: (r: MergeRecord) => string;
}

export interface ProRecordMergeProps {
  fields: MergeField[];
  /** Controlled records. Pair with onRecordsChange. */
  records?: MergeRecord[];
  defaultRecords?: MergeRecord[];
  onRecordsChange?: (records: MergeRecord[]) => void;
  /** Field used as the record's display name. */
  titleKey: string;
  /** Extra columns in the bulk-edit list. */
  listColumns?: string[];
  /** Duplicate match rules. Default: same email, same phone, same title + company-ish field. */
  matchRules?: MatchRule[];
  /** Precomputed groups (e.g. from your dedupe service). Overrides matchRules. */
  duplicateGroups?: DuplicateGroup[];
  /** Persist a merge. Reject to keep the records unmerged (the error is shown). */
  onMerge?: (result: MergeResult) => void | Promise<void>;
  onBulkUpdate?: (op: BulkOp, ids: string[]) => void;
  defaultTab?: "merge" | "bulk";
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  readOnly?: boolean;
  locale?: string;
  className?: string;
}

const MAX_COMPARE = 4;

/** Dedupe + merge (2-4 records, per-field winners, word diff, audit) and bulk edit with undo. */
export function ProRecordMerge({
  fields,
  records: recordsProp,
  defaultRecords,
  onRecordsChange,
  titleKey,
  listColumns,
  matchRules,
  duplicateGroups,
  onMerge,
  onBulkUpdate,
  defaultTab = "merge",
  loading = false,
  error = null,
  onRetry,
  readOnly = false,
  locale = "en-US",
  className,
}: ProRecordMergeProps) {
  const [records, setRecords] = useControllableState<MergeRecord[]>({
    value: recordsProp,
    defaultValue: defaultRecords ?? [],
    onChange: onRecordsChange,
  });
  const history = useRecordHistory(records, setRecords);
  const [tab, setTab] = React.useState<string>(defaultTab);
  const [lastAudit, setLastAudit] = React.useState<MergeAudit | null>(null);
  const [notice, setNotice] = React.useState("");

  const byId = React.useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);
  const fieldTypes = React.useMemo(() => new Map(fields.map((f) => [f.key, f.type])), [fields]);
  const rules = React.useMemo<MatchRule[]>(() => {
    if (matchRules) return matchRules;
    const email = fields.find((f) => f.type === "email");
    const phone = fields.find((f) => f.type === "phone");
    const out: MatchRule[] = [];
    if (email)
      out.push({ label: "Same email", key: (r) => normalize(r.values[email.key], "email") });
    if (phone)
      out.push({
        label: "Same phone",
        key: (r) => {
          const n = normalize(r.values[phone.key], "phone");
          return n.length >= 7 ? n : "";
        },
      });
    return out;
  }, [matchRules, fields]);
  const groups = React.useMemo(
    () => duplicateGroups ?? findDuplicateGroups(records, rules),
    [duplicateGroups, records, rules],
  );
  const liveGroups = React.useMemo(
    () =>
      groups
        .map((g) => ({ ...g, recordIds: g.recordIds.filter((id) => byId.has(id)) }))
        .filter((g) => g.recordIds.length > 1),
    [groups, byId],
  );

  const [groupId, setGroupId] = React.useState<string | null>(null);
  const group = liveGroups.find((g) => g.id === groupId) ?? liveGroups[0];
  const [picked, setPicked] = React.useState<Record<string, string[]>>({});
  const compareIds = (group && (picked[group.id] ?? group.recordIds.slice(0, MAX_COMPARE))) || [];
  const compareRecords = compareIds.map((id) => byId.get(id)).filter(Boolean) as MergeRecord[];

  const label = React.useCallback(
    (id: string) => recordTitle(byId.get(id), titleKey),
    [byId, titleKey],
  );
  const auditLabel = React.useMemo(() => {
    // Removed records are gone from `byId`; resolve them from the audit's candidates.
    const names = new Map<string, string>();
    for (const f of lastAudit?.fields ?? [])
      if (f.key === titleKey)
        for (const [id, v] of Object.entries(f.candidates)) names.set(id, `${display(v)} (${id})`);
    return (id: string) => names.get(id) ?? label(id);
  }, [lastAudit, titleKey, label]);

  const merge = async (result: MergeResult) => {
    await onMerge?.(result);
    const removed = new Set(result.removedIds);
    history.commit(
      `Merged ${result.removedIds.length + 1} records into ${label(result.survivor.id)}`,
      (draft) => {
        for (let i = draft.length - 1; i >= 0; i--) {
          const r = draft[i]!;
          if (r.id === result.survivor.id) draft[i] = result.survivor;
          else if (removed.has(r.id)) draft.splice(i, 1);
        }
      },
    );
    setLastAudit(result.audit);
    setNotice(`Merged into ${label(result.survivor.id)}.`);
  };

  const bulkApply = (op: BulkOp, ids: string[], text: string) => {
    const set = new Set(ids);
    const type = fieldTypes.get(op.field);
    history.commit(text, (draft) => {
      for (const r of draft) {
        if (!set.has(r.id)) continue;
        r.values[op.field] = applyBulkOp(r.values[op.field], op, type) as never;
      }
    });
    onBulkUpdate?.(op, ids);
    setNotice(`${text}.`);
  };

  const undo = React.useCallback(() => {
    const e = history.undo();
    if (e) {
      setNotice(`Undid: ${e.label}.`);
      setLastAudit(null);
    }
  }, [history]);
  const redo = React.useCallback(() => {
    const e = history.redo();
    if (e) setNotice(`Redid: ${e.label}.`);
  }, [history]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select, [contenteditable=true]")) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
  };

  return (
    <section
      aria-label="Bulk edit and merge"
      onKeyDown={onKeyDown}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-crm border border-crm-border bg-crm-bg p-3 font-crm text-crm-fg",
        className,
      )}
    >
      <TabsPrimitive.Root
        value={tab}
        onValueChange={setTab}
        className="flex min-w-0 flex-col gap-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <TabsPrimitive.List
            aria-label="Mode"
            className="flex gap-1 rounded-crm bg-crm-raised p-0.5 shadow-crm-raised"
          >
            {(
              [
                ["merge", `Duplicates (${liveGroups.length})`],
                ["bulk", "Bulk edit"],
              ] as const
            ).map(([v, t]) => (
              <TabsPrimitive.Trigger
                key={v}
                value={v}
                className="rounded-[6px] px-2.5 py-1 text-xs text-crm-muted-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring data-[state=active]:bg-crm-muted data-[state=active]:text-crm-fg"
              >
                {t}
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>
          <span className="text-xs text-crm-muted-fg tabular-nums">
            {records.length.toLocaleString(locale)} records
          </span>
          <div className="ml-auto flex items-center gap-1">
            <span className="sr-only" role="status" aria-live="polite">
              {notice}
            </span>
            {history.past.length > 0 && (
              <span className="hidden max-w-[320px] items-center gap-1 truncate text-[11px] text-crm-muted-fg sm:inline-flex">
                <History className="size-3" aria-hidden />
                {history.past[history.past.length - 1]?.label}
              </span>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={undo}
              disabled={!history.canUndo || readOnly}
              aria-keyshortcuts="Control+Z Meta+Z"
            >
              <Undo2 className="size-3.5" aria-hidden /> Undo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={redo}
              disabled={!history.canRedo || readOnly}
              aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
            >
              <Redo2 className="size-3.5" aria-hidden /> Redo
            </Button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-crm border border-crm-danger/40 bg-crm-danger/10 px-3 py-2 text-xs"
          >
            <span>{error}</span>
            {onRetry && (
              <Button size="sm" onClick={onRetry}>
                <RotateCw className="size-3.5" aria-hidden /> Retry
              </Button>
            )}
          </div>
        )}

        {loading ? (
          <div className="grid gap-2" aria-busy>
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="h-9 animate-pulse rounded-crm bg-crm-raised"
                style={{ opacity: 1 - i * 0.12 }}
              />
            ))}
          </div>
        ) : (
          <>
            <TabsPrimitive.Content value="merge" className="outline-none">
              {lastAudit ? (
                <div className="flex flex-col gap-2">
                  <MergeAuditView audit={lastAudit} recordLabel={auditLabel} status="done" />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={undo} disabled={readOnly}>
                      <Undo2 className="size-3.5" aria-hidden /> Undo merge
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => setLastAudit(null)}>
                      Next duplicate group
                    </Button>
                  </div>
                </div>
              ) : liveGroups.length === 0 ? (
                <p className="rounded-crm border border-dashed border-crm-border p-8 text-center text-xs text-crm-muted-fg">
                  No duplicates found. Every record is unique by the current match rules.
                </p>
              ) : (
                <div className="grid min-w-0 gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
                  <GroupList
                    groups={liveGroups}
                    activeId={group?.id ?? null}
                    onSelect={setGroupId}
                    label={label}
                  />
                  <div className="flex min-w-0 flex-col gap-2">
                    {group && (
                      <fieldset className="flex flex-wrap items-center gap-1.5">
                        <legend className="sr-only">Records to compare (2 to 4)</legend>
                        <span className="text-[11px] text-crm-muted-fg">
                          {group.reason} · compare {compareIds.length} of {group.recordIds.length}:
                        </span>
                        {group.recordIds.map((id) => {
                          const on = compareIds.includes(id);
                          const blocked = !on && compareIds.length >= MAX_COMPARE;
                          const minimum = on && compareIds.length <= 2;
                          return (
                            <label
                              key={id}
                              className={cn(
                                "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                                on
                                  ? "border-crm-primary/50 bg-crm-primary/10 text-crm-fg"
                                  : "border-crm-border text-crm-soft",
                                (blocked || minimum) && "cursor-not-allowed opacity-60",
                              )}
                            >
                              <input
                                type="checkbox"
                                className="size-3 accent-crm-primary"
                                checked={on}
                                disabled={blocked || minimum || readOnly}
                                onChange={() =>
                                  setPicked((p) => ({
                                    ...p,
                                    [group.id]: on
                                      ? compareIds.filter((x) => x !== id)
                                      : [...compareIds, id],
                                  }))
                                }
                              />
                              {label(id)}
                            </label>
                          );
                        })}
                      </fieldset>
                    )}
                    {readOnly ? (
                      <p className="text-xs text-crm-muted-fg">
                        Merging is disabled in read-only mode.
                      </p>
                    ) : (
                      <MergeCompare
                        key={`${group?.id}:${compareIds.join(",")}`}
                        records={compareRecords}
                        fields={fields}
                        recordLabel={label}
                        onConfirm={merge}
                        locale={locale}
                      />
                    )}
                  </div>
                </div>
              )}
            </TabsPrimitive.Content>
            <TabsPrimitive.Content value="bulk" className="outline-none">
              <BulkEdit
                records={records}
                fields={fields}
                titleKey={titleKey}
                columns={listColumns}
                onApply={bulkApply}
                disabled={readOnly}
              />
            </TabsPrimitive.Content>
          </>
        )}
      </TabsPrimitive.Root>
    </section>
  );
}

function GroupList({
  groups,
  activeId,
  onSelect,
  label,
}: {
  groups: DuplicateGroup[];
  activeId: string | null;
  onSelect: (id: string) => void;
  label: (id: string) => string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: groups.length,
    getScrollElement: () => ref.current,
    estimateSize: () => 52,
    overscan: 8,
    getItemKey: (i) => groups[i]?.id ?? i,
  });
  const activeIndex = Math.max(
    0,
    groups.findIndex((g) => g.id === activeId),
  );
  const onKeyDown = (e: React.KeyboardEvent) => {
    let next = -1;
    if (e.key === "ArrowDown") next = Math.min(groups.length - 1, activeIndex + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, activeIndex - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = groups.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const g = groups[next];
    if (g) {
      onSelect(g.id);
      v.scrollToIndex(next);
    }
  };
  const active = groups[activeIndex];
  return (
    <div
      ref={ref}
      role="listbox"
      tabIndex={0}
      aria-label="Duplicate groups"
      aria-activedescendant={active ? `dup-${active.id}` : undefined}
      onKeyDown={onKeyDown}
      className="h-[420px] overflow-auto rounded-crm border border-crm-border bg-crm-card outline-none focus-visible:ring-2 focus-visible:ring-crm-ring [scrollbar-width:thin]"
    >
      <div className="relative" style={{ height: v.getTotalSize() }}>
        {v.getVirtualItems().map((item) => {
          const g = groups[item.index] as DuplicateGroup;
          const selected = g.id === active?.id;
          return (
            <div
              key={item.key}
              id={`dup-${g.id}`}
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(g.id)}
              className={cn(
                "absolute inset-x-0 top-0 flex h-[52px] cursor-pointer flex-col justify-center gap-0.5 border-b border-crm-border/50 px-2.5 text-xs",
                selected ? "bg-crm-primary/10" : "hover:bg-crm-raised",
              )}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <span className="truncate text-crm-fg">
                {label(g.recordIds[0] as string).replace(/ \(.*\)$/, "")}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-crm-muted-fg">
                <Users className="size-3" aria-hidden /> {g.recordIds.length} records · {g.reason}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
