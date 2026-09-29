import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { useHotkeys } from "react-hotkeys-hook";
import { CheckCircle2, Keyboard, Search, Trash2, Undo2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/crm/button";
import { applyPatch, createSafeStorage } from "@/components/crm/pro-ticket-console/apply-patch";
import {
  addBusinessMinutes,
  resolveBusinessHours,
} from "@/components/crm/pro-ticket-console/business-hours";
import { TicketDetails } from "@/components/crm/pro-ticket-console/ticket-details";
import { TicketQueue } from "@/components/crm/pro-ticket-console/ticket-queue";
import { TicketThread } from "@/components/crm/pro-ticket-console/ticket-thread";
import {
  DEFAULT_SLA_POLICY,
  type BusinessHours,
  type SlaPolicy,
  type Ticket,
  type TicketBulkAction,
  type TicketMacro,
  type TicketMessage,
  type TicketPatch,
  type TicketView,
} from "@/components/crm/pro-ticket-console/types";
import { useRangeSelection } from "@/hooks/use-range-selection";
import { cn } from "@/lib/utils";

export * from "@/components/crm/pro-ticket-console/types";

export interface ProTicketConsoleProps {
  /** Controlled tickets. Pair with `onTicketsChange`. */
  tickets?: Ticket[];
  /** Uncontrolled initial tickets. */
  defaultTickets?: Ticket[];
  onTicketsChange?: (next: Ticket[]) => void;
  /** Fired for every bulk / keyboard / macro action, after local state updates. */
  onAction?: (action: TicketBulkAction, ids: string[]) => void;
  /** Loads a ticket conversation (cached with TanStack Query). */
  loadThread?: (ticket: Ticket) => Promise<TicketMessage[]>;
  /** Sends a reply; reject to roll back the optimistic message. */
  onReply?: (ticketId: string, body: string, internal: boolean) => void | Promise<void>;
  currentUser: string;
  agents?: string[];
  macros?: TicketMacro[];
  businessHours?: BusinessHours;
  slaPolicy?: Partial<SlaPolicy>;
  view?: TicketView;
  defaultView?: TicketView;
  onViewChange?: (view: TicketView) => void;
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  /** Show skeleton rows while the queue loads. */
  loading?: boolean;
  /** Blocks all mutations (e.g. viewer role). */
  readOnly?: boolean;
  /** Storage key for the persisted pane layout. */
  layoutId?: string;
  /** Freeze the SLA clock (tests, screenshots). */
  now?: Date;
  /** Bring your own QueryClient to share cache with the host app. */
  queryClient?: QueryClient;
  className?: string;
}

const VIEWS: { id: TicketView; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "mine", label: "Mine" },
  { id: "unassigned", label: "Unassigned" },
  { id: "breaching", label: "Breaching" },
  { id: "solved", label: "Solved" },
  { id: "all", label: "All" },
];

const SHORTCUTS: [string, string][] = [
  ["j / k", "Next / previous ticket"],
  ["shift + j / k", "Extend selection"],
  ["x", "Toggle select"],
  ["e", "Solve (selection or current)"],
  ["#", "Delete"],
  ["a", "Assign to me"],
  ["r", "Reply"],
  ["mod + a", "Select all in view"],
  ["esc", "Clear selection"],
];

export function ProTicketConsole({ queryClient, ...props }: ProTicketConsoleProps) {
  const [fallback] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={queryClient ?? fallback}>
      <ConsoleInner {...props} />
    </QueryClientProvider>
  );
}

function ConsoleInner({
  tickets: controlledTickets,
  defaultTickets = [],
  onTicketsChange,
  onAction,
  loadThread,
  onReply,
  currentUser,
  agents = [],
  macros = [],
  businessHours,
  slaPolicy,
  view: controlledView,
  defaultView = "open",
  onViewChange,
  activeId: controlledActive,
  onActiveChange,
  loading,
  readOnly,
  layoutId = "pro-ticket-console",
  now,
  className,
}: Omit<ProTicketConsoleProps, "queryClient">) {
  const [innerTickets, setInnerTickets] = React.useState(defaultTickets);
  const tickets = controlledTickets ?? innerTickets;
  const [innerView, setInnerView] = React.useState(defaultView);
  const view = controlledView ?? innerView;
  const [innerActive, setInnerActive] = React.useState<string | null>(null);
  const activeId = controlledActive !== undefined ? controlledActive : innerActive;
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query.trim().toLowerCase());
  const [undo, setUndo] = React.useState<{ label: string; prev: Ticket[] } | null>(null);
  const [help, setHelp] = React.useState(false);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  const listId = React.useId().replace(/:/g, "");

  const hours = React.useMemo(() => resolveBusinessHours(businessHours), [businessHours]);
  const policy = React.useMemo(() => ({ ...DEFAULT_SLA_POLICY, ...slaPolicy }), [slaPolicy]);

  // Due dates are pure per (ticket object, policy, hours): cache so 20k tickets compute once.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberate: a fresh cache per policy/hours change
  const dueCache = React.useMemo(() => new WeakMap<Ticket, number>(), [hours, policy]);
  const getSla = React.useCallback(
    (t: Ticket) => {
      const target = t.slaMinutes ?? policy[t.priority];
      const paused = t.status !== "open";
      let dueAt = dueCache.get(t);
      if (dueAt === undefined) {
        dueAt = addBusinessMinutes(
          new Date(t.slaStartedAt ?? t.createdAt),
          target,
          hours,
        ).getTime();
        dueCache.set(t, dueAt);
      }
      return { dueAt: t.status === "solved" ? null : dueAt, target, paused };
    },
    [dueCache, hours, policy],
  );

  const setTickets = React.useCallback(
    (next: Ticket[]) => {
      if (controlledTickets === undefined) setInnerTickets(next);
      onTicketsChange?.(next);
    },
    [controlledTickets, onTicketsChange],
  );
  const setActive = React.useCallback(
    (id: string | null) => {
      if (controlledActive === undefined) setInnerActive(id);
      onActiveChange?.(id);
    },
    [controlledActive, onActiveChange],
  );
  const setView = (v: TicketView) => {
    if (controlledView === undefined) setInnerView(v);
    onViewChange?.(v);
  };

  const nowMs = now ? +now : Date.now();
  const matchesView = React.useCallback(
    (t: Ticket, v: TicketView) => {
      switch (v) {
        case "open":
          return t.status !== "solved";
        case "mine":
          return t.status !== "solved" && t.assignee === currentUser;
        case "unassigned":
          return t.status !== "solved" && !t.assignee;
        case "breaching": {
          const s = getSla(t);
          return !s.paused && s.dueAt !== null && s.dueAt <= nowMs + 3_600_000;
        }
        case "solved":
          return t.status === "solved";
        default:
          return true;
      }
    },
    // nowMs is intentionally bucketed by render; views refresh on every data change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, getSla],
  );

  const counts = React.useMemo(() => {
    const c = Object.fromEntries(VIEWS.map((v) => [v.id, 0])) as Record<TicketView, number>;
    for (const t of tickets) for (const v of VIEWS) if (matchesView(t, v.id)) c[v.id]++;
    return c;
  }, [tickets, matchesView]);

  const visible = React.useMemo(() => {
    const q = deferredQuery;
    return tickets
      .filter(
        (t) =>
          matchesView(t, view) &&
          (!q ||
            t.subject.toLowerCase().includes(q) ||
            t.id.toLowerCase().includes(q) ||
            t.requester.name.toLowerCase().includes(q) ||
            t.requester.email.toLowerCase().includes(q) ||
            t.tags.some((g) => g.includes(q))),
      )
      .sort((a, b) => {
        const pa = a.status === "open" ? (getSla(a).dueAt ?? Infinity) : Infinity;
        const pb = b.status === "open" ? (getSla(b).dueAt ?? Infinity) : Infinity;
        return pa - pb || b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [tickets, view, deferredQuery, matchesView, getSla]);

  const ids = React.useMemo(() => visible.map((t) => t.id), [visible]);
  const selection = useRangeSelection({ ids });
  const byId = React.useMemo(() => new Map(tickets.map((t) => [t.id, t])), [tickets]);
  const active = activeId ? (byId.get(activeId) ?? null) : null;

  const targetIds = React.useCallback((): string[] => {
    const sel = ids.filter((id) => selection.selected.has(id));
    return sel.length ? sel : activeId ? [activeId] : [];
  }, [activeId, ids, selection.selected]);

  /** Moves focus past tickets that are about to leave the view. */
  const advancePast = (leaving: Set<string>) => {
    if (!activeId || !leaving.has(activeId)) return;
    const i = ids.indexOf(activeId);
    const next =
      ids.slice(i + 1).find((id) => !leaving.has(id)) ??
      ids
        .slice(0, i)
        .reverse()
        .find((id) => !leaving.has(id)) ??
      null;
    setActive(next);
  };

  const run = (action: TicketBulkAction, targets = targetIds()) => {
    if (readOnly || !targets.length) return;
    const set = new Set(targets);
    const prev = tickets;
    let next: Ticket[];
    let label: string;
    if (action.type === "delete") {
      next = tickets.filter((t) => !set.has(t.id));
      label = `Deleted ${set.size} ticket${set.size > 1 ? "s" : ""}`;
    } else {
      const patch = action.type === "macro" ? action.macro.patch : action.patch;
      next = applyPatch(tickets, set, patch);
      label =
        action.type === "macro"
          ? `Applied "${action.macro.name}" to ${set.size}`
          : `Updated ${set.size} ticket${set.size > 1 ? "s" : ""}`;
    }
    const nextById = new Map(next.map((t) => [t.id, t]));
    const leaving = new Set(
      targets.filter((id) => {
        const t = nextById.get(id);
        return !t || !matchesView(t, view);
      }),
    );
    advancePast(leaving);
    setTickets(next);
    selection.clear();
    setUndo({ label, prev });
    onAction?.(action, targets);
  };

  const patchActive = (patch: TicketPatch) => active && run({ type: "patch", patch }, [active.id]);

  const move = (dir: 1 | -1, extend = false) => {
    if (!ids.length) return;
    const i = activeId ? ids.indexOf(activeId) : -1;
    const n = Math.min(ids.length - 1, Math.max(0, i === -1 ? 0 : i + dir));
    const id = ids[n]!;
    if (extend) {
      if (activeId && !selection.selected.has(activeId)) selection.toggle(activeId);
      selection.toggle(id, { shift: true });
    }
    open(id, extend);
  };

  const open = (id: string, keepAnchor = false) => {
    setActive(id);
    if (!keepAnchor) selection.setAnchor(id);
    const t = byId.get(id);
    if (t?.unread && !readOnly) setTickets(applyPatch(tickets, new Set([id]), { unread: false }));
  };

  const hotkeyOpts = { preventDefault: true };
  const refA = useHotkeys<HTMLDivElement>(
    "j,down,k,up,shift+j,shift+k,x,e,a,r,escape,mod+a,shift+slash",
    (e) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "a") return selection.setAll(true);
      switch (k) {
        case "j":
        case "arrowdown":
          return move(1, e.shiftKey);
        case "k":
        case "arrowup":
          return move(-1, e.shiftKey);
        case "x":
          return activeId ? selection.toggle(activeId) : undefined;
        case "e":
          return run({ type: "patch", patch: { status: "solved" } });
        case "a":
          return run({ type: "patch", patch: { assignee: currentUser } });
        case "r":
          return composerRef.current?.focus();
        case "escape":
          return help ? setHelp(false) : selection.clear();
        case "?":
        case "/":
          return setHelp((v) => !v);
      }
    },
    hotkeyOpts,
  );
  const refB = useHotkeys<HTMLDivElement>("#", () => run({ type: "delete" }), {
    useKey: true,
    preventDefault: true,
  });
  const rootRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      refA(el);
      refB(el);
    },
    [refA, refB],
  );

  const storage = React.useMemo(createSafeStorage, []);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: layoutId, storage });

  const selCount = selection.visibleSelected;
  const allChecked = selCount > 0 && selCount === ids.length;

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex h-[680px] w-full flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border px-3 py-2">
        <div role="tablist" aria-label="Views" className="flex flex-wrap gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
                view === v.id
                  ? "bg-crm-raised text-crm-fg shadow-crm-raised"
                  : "text-crm-muted-fg hover:text-crm-fg",
              )}
            >
              {v.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  v.id === "breaching" && counts.breaching
                    ? "bg-crm-danger/20 text-crm-danger"
                    : "bg-crm-muted",
                )}
              >
                {counts[v.id].toLocaleString()}
              </span>
            </button>
          ))}
        </div>
        <label className="relative ml-auto flex items-center">
          <Search className="pointer-events-none absolute left-2 size-3.5 text-crm-muted-fg" />
          <span className="sr-only">Search tickets</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search id, subject, requester, tag"
            className="h-7 w-64 rounded-full border border-crm-border bg-crm-raised pr-2 pl-7 text-xs outline-none focus:ring-2 focus:ring-crm-ring"
          />
        </label>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Keyboard shortcuts"
          aria-expanded={help}
          onClick={() => setHelp((v) => !v)}
        >
          <Keyboard className="size-3.5" />
        </Button>
      </div>

      <div
        className={cn(
          "flex items-center gap-2 border-b border-crm-border px-3 py-1.5 text-xs",
          selCount ? "bg-crm-primary/10" : "bg-crm-card",
        )}
      >
        <input
          type="checkbox"
          aria-label="Select all tickets in view"
          checked={allChecked}
          ref={(el) => {
            if (el) el.indeterminate = selCount > 0 && !allChecked;
          }}
          onChange={(e) => selection.setAll(e.target.checked)}
          className="size-3.5 accent-[var(--color-crm-primary)]"
        />
        <span className="text-crm-muted-fg tabular-nums" aria-live="polite">
          {selCount
            ? `${selCount.toLocaleString()} selected`
            : `${visible.length.toLocaleString()} tickets`}
        </span>
        {selCount > 0 && !readOnly && (
          <div className="flex flex-wrap items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => run({ type: "patch", patch: { status: "solved" } })}
            >
              <CheckCircle2 className="size-3" /> Solve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => run({ type: "patch", patch: { assignee: currentUser } })}
            >
              <UserPlus className="size-3" /> Assign to me
            </Button>
            <select
              aria-label="Set priority"
              value=""
              onChange={(e) =>
                e.target.value &&
                run({ type: "patch", patch: { priority: e.target.value as Ticket["priority"] } })
              }
              className="h-7 rounded-full border border-crm-border bg-crm-raised px-2 text-xs"
            >
              <option value="">Priority…</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            {macros.length > 0 && (
              <select
                aria-label="Apply macro to selection"
                value=""
                onChange={(e) => {
                  const m = macros.find((x) => x.id === e.target.value);
                  if (m) run({ type: "macro", macro: m });
                }}
                className="h-7 rounded-full border border-crm-border bg-crm-raised px-2 text-xs"
              >
                <option value="">Macro…</option>
                {macros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            <Button size="sm" variant="danger" onClick={() => run({ type: "delete" })}>
              <Trash2 className="size-3" /> Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Clear selection"
              onClick={selection.clear}
            >
              <X className="size-3" />
            </Button>
          </div>
        )}
      </div>

      <Group
        orientation="horizontal"
        id={layoutId}
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="min-h-0 flex-1"
      >
        <Panel id="queue" defaultSize="34%" minSize="22%" className="min-w-0">
          <TicketQueue
            listId={listId}
            tickets={visible}
            selected={selection.selected}
            activeId={activeId}
            currentUser={currentUser}
            hours={hours}
            getSla={getSla}
            loading={loading}
            now={now}
            onActivate={(id) => open(id)}
            onToggle={(id, e) => selection.toggle(id, { shift: e.shiftKey })}
            emptyLabel={deferredQuery ? `No tickets match "${deferredQuery}".` : undefined}
          />
        </Panel>
        <Separator className="w-px bg-crm-border outline-none data-[separator=active]:bg-crm-primary data-[separator=hover]:bg-crm-ring focus-visible:bg-crm-primary" />
        <Panel id="thread" defaultSize="44%" minSize="28%" className="min-w-0">
          <TicketThread
            ticket={active}
            currentUser={currentUser}
            loadThread={loadThread}
            onReply={onReply}
            macros={macros}
            composerRef={composerRef}
            onApplyMacro={(m) => active && run({ type: "macro", macro: m }, [active.id])}
          />
        </Panel>
        <Separator className="w-px bg-crm-border outline-none data-[separator=active]:bg-crm-primary data-[separator=hover]:bg-crm-ring focus-visible:bg-crm-primary" />
        <Panel
          id="details"
          defaultSize="22%"
          minSize="16%"
          collapsible
          collapsedSize="0%"
          className="min-w-0 bg-crm-card"
        >
          <TicketDetails
            ticket={active}
            agents={agents}
            hours={hours}
            sla={active ? getSla(active) : null}
            onPatch={patchActive}
            now={now}
            readOnly={readOnly}
          />
        </Panel>
      </Group>

      {undo && (
        <div
          role="status"
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 animate-crm-in items-center gap-3 rounded-full bg-crm-raised px-3 py-1.5 text-xs shadow-crm-raised"
        >
          {undo.label}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setTickets(undo.prev);
              setUndo(null);
            }}
          >
            <Undo2 className="size-3" /> Undo
          </Button>
          <button aria-label="Dismiss" onClick={() => setUndo(null)} className="text-crm-muted-fg">
            <X className="size-3" />
          </button>
        </div>
      )}

      {help && (
        <div
          role="dialog"
          aria-label="Keyboard shortcuts"
          className="absolute top-12 right-3 z-10 w-64 animate-crm-in rounded-crm border border-crm-border bg-crm-popover p-3 text-xs shadow-crm-raised"
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            {SHORTCUTS.map(([k, d]) => (
              <React.Fragment key={k}>
                <dt>
                  <kbd className="rounded bg-crm-muted px-1 font-mono">{k}</kbd>
                </dt>
                <dd className="text-crm-soft">{d}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
