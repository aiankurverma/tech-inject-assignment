import * as React from "react";
import {
  columnVisibilityFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight, Eye, Lock, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildRows,
  cellState,
  groupState,
  isOn,
  resolveAncestors,
  type GrantChange,
  type MatrixRow,
  type RbacGrants,
  type RbacPermission,
  type RbacRole,
} from "@/lib/rbac-matrix";
import { cellKey, useRbacState } from "@/hooks/use-rbac-state";
import { GroupCell, PermissionCell } from "@/components/crm/pro-rbac-matrix/matrix-cell";
import { DiffPanel } from "@/components/crm/pro-rbac-matrix/diff-panel";

export type { RbacGrants, RbacPermission, RbacRole, GrantChange } from "@/lib/rbac-matrix";

export interface ProRbacMatrixProps {
  roles: RbacRole[];
  permissions: RbacPermission[];
  /** Controlled explicit grants (role id -> permission ids). */
  value?: RbacGrants;
  defaultValue?: RbacGrants;
  onChange?: (next: RbacGrants) => void;
  /** Saved state the dirty diff compares against (defaults to the initial value). */
  baseline?: RbacGrants;
  /** Persist changes. Reject/throw to show an error; resolve to mark the diff as saved. */
  onSave?: (next: RbacGrants, changes: GrantChange[]) => Promise<void> | void;
  readOnly?: boolean;
  loading?: boolean;
  error?: React.ReactNode;
  /** Resources collapsed on mount. */
  defaultCollapsed?: string[];
  roleColumnWidth?: number;
  permissionColumnWidth?: number;
  rowHeight?: number;
  height?: number | string;
  label?: string;
  className?: string;
}

const features = tableFeatures({ columnVisibilityFeature });
const HEADER_H = 64;
const PERM_COL = "__perm";

type Focus = { row: number; col: number };

export function ProRbacMatrix(props: ProRbacMatrixProps) {
  const {
    roles,
    permissions,
    readOnly = false,
    roleColumnWidth = 104,
    permissionColumnWidth = 300,
    rowHeight = 40,
    height = 600,
    label = "Role permissions",
  } = props;

  const state = useRbacState({
    value: props.value,
    defaultValue: props.defaultValue,
    onChange: props.onChange,
    baseline: props.baseline,
  });
  const ancestors = React.useMemo(() => resolveAncestors(roles), [roles]);
  const permsById = React.useMemo(() => new Map(permissions.map((p) => [p.id, p])), [permissions]);

  // ---------- filtering / grouping ----------
  const [query, setQuery] = React.useState("");
  const [onlyChanged, setOnlyChanged] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(
    () => new Set(props.defaultCollapsed),
  );
  const deferredQuery = React.useDeferredValue(query.trim().toLowerCase());
  const changedPerms = React.useMemo(
    () => new Set(state.changes.map((c) => c.permId)),
    [state.changes],
  );
  const rows = React.useMemo(
    () =>
      buildRows(permissions, collapsed, (p) => {
        if (onlyChanged && !changedPerms.has(p.id)) return false;
        if (!deferredQuery) return true;
        return `${p.resource}:${p.action} ${p.description ?? ""}`
          .toLowerCase()
          .includes(deferredQuery);
      }),
    [permissions, collapsed, deferredQuery, onlyChanged, changedPerms],
  );

  // ---------- column model (TanStack Table) ----------
  const columns = React.useMemo<ColumnDef<typeof features, MatrixRow>[]>(
    () => [
      { id: PERM_COL, header: "Permission" },
      ...roles.map((r) => ({ id: r.id, header: r.name })),
    ],
    [roles],
  );
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({});
  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (r: MatrixRow) => r.id,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
  });
  const rolesById = React.useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const visibleRoles = table
    .getVisibleLeafColumns()
    .filter((c) => c.id !== PERM_COL)
    .map((c) => rolesById.get(c.id)!)
    .filter(Boolean);
  const editableRoles = visibleRoles.filter((r) => !r.locked);
  const colCount = visibleRoles.length + 1;
  const totalWidth = permissionColumnWidth + visibleRoles.length * roleColumnWidth;

  // ---------- mutations ----------
  const disabled = readOnly || props.loading;
  const toggleCell = (role: RbacRole, permId: string) => {
    if (disabled || role.locked) return;
    const explicit = !!state.index[role.id]?.[permId];
    // An inherited-only cell becomes explicit; an explicit cell is revoked.
    state.set([role.id], [permId], !explicit);
  };
  const toggleGroup = (roleList: RbacRole[], permIds: string[]) => {
    const targets = roleList.filter((r) => !r.locked);
    if (disabled || !targets.length) return;
    const allOn = targets.every((r) =>
      permIds.every((p) => isOn(cellState(state.index, ancestors, r.id, p))),
    );
    state.set(
      targets.map((r) => r.id),
      permIds,
      !allOn,
    );
  };
  const visiblePermIds = React.useMemo(
    () => rows.flatMap((r) => (r.kind === "group" ? r.permIds : [])),
    [rows],
  );
  const toggleColumn = (role: RbacRole) => toggleGroup([role], visiblePermIds);
  const toggleCollapse = (resource: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(resource)) n.delete(resource);
      else n.add(resource);
      return n;
    });

  // ---------- virtualisation + keyboard grid ----------
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i]?.kind === "group" ? rowHeight - 4 : rowHeight),
    overscan: 12,
    scrollMargin: HEADER_H,
  });
  const baseId = React.useId();
  const cellId = (row: number, col: number) => `${baseId}-${row}-${col}`;
  // Grid row 0 is the header; data rows are 1..rows.length.
  const [focus, setFocus] = React.useState<Focus>({ row: 1, col: 1 });
  const clamped: Focus = {
    row: Math.max(0, Math.min(rows.length, focus.row)),
    col: Math.max(0, Math.min(colCount - 1, focus.col)),
  };
  const focusWithin = React.useRef(false);
  React.useEffect(() => {
    if (!focusWithin.current) return;
    document.getElementById(cellId(clamped.row, clamped.col))?.focus({ preventScroll: true });
  });

  const moveTo = (row: number, col: number) => {
    const next = {
      row: Math.max(0, Math.min(rows.length, row)),
      col: Math.max(0, Math.min(colCount - 1, col)),
    };
    setFocus(next);
    if (next.row > 0) virtualizer.scrollToIndex(next.row - 1, { align: "auto" });
    const el = scrollRef.current;
    if (el) {
      const left = next.col === 0 ? 0 : permissionColumnWidth + (next.col - 1) * roleColumnWidth;
      const visibleLeft = el.scrollLeft + permissionColumnWidth;
      if (next.col > 0 && left < visibleLeft) el.scrollLeft = left - permissionColumnWidth;
      else if (left + roleColumnWidth > el.scrollLeft + el.clientWidth)
        el.scrollLeft = left + roleColumnWidth - el.clientWidth;
    }
  };

  const activate = (row: number, col: number) => {
    const role = col > 0 ? visibleRoles[col - 1] : undefined;
    if (row === 0) {
      if (role) toggleColumn(role);
      return;
    }
    const r = rows[row - 1];
    if (!r) return;
    if (r.kind === "group") {
      if (col === 0) toggleCollapse(r.resource);
      else if (role) toggleGroup([role], r.permIds);
    } else if (col === 0) toggleGroup(editableRoles, [r.perm.id]);
    else if (role) toggleCell(role, r.perm.id);
  };
  // Stable identities for memoised cells; the latest closures are read through a ref.
  const latest = React.useRef({ activate, moveTo });
  React.useLayoutEffect(() => {
    latest.current = { activate, moveTo };
  });
  const onActivate = React.useCallback((r: number, c: number) => latest.current.activate(r, c), []);
  const onFocusCell = React.useCallback((r: number, c: number) => setFocus({ row: r, col: c }), []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("[data-grid-skip]")) return;
    const { row, col } = clamped;
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / rowHeight) - 2);
    const r = rows[row - 1];
    switch (e.key) {
      case "ArrowDown":
        moveTo(row + 1, col);
        break;
      case "ArrowUp":
        moveTo(row - 1, col);
        break;
      case "ArrowRight":
        if (col === 0 && r?.kind === "group" && r.collapsed && e.altKey) toggleCollapse(r.resource);
        else moveTo(row, col + 1);
        break;
      case "ArrowLeft":
        moveTo(row, col - 1);
        break;
      case "PageDown":
        moveTo(row + page, col);
        break;
      case "PageUp":
        moveTo(row - page, col);
        break;
      case "Home":
        moveTo(e.ctrlKey ? 1 : row, 0);
        break;
      case "End":
        moveTo(e.ctrlKey ? rows.length : row, colCount - 1);
        break;
      case " ":
      case "Enter":
        activate(row, col);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  // ---------- save ----------
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const next: RbacGrants = {};
      for (const id of Object.keys(state.index))
        next[id] = Object.keys(state.index[id] ?? {}).sort();
      await props.onSave?.(next, state.changes);
      state.markSaved();
      setReviewOpen(false);
    } catch (err) {
      setSaveError((err as Error)?.message ?? "Could not save permissions.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- render ----------
  const shell = cn(
    "relative flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card text-crm-fg shadow-crm-raised",
    props.className,
  );
  if (props.error || (!props.loading && (!roles.length || !permissions.length))) {
    return (
      <div className={shell} style={{ height }}>
        <div className="grid flex-1 place-items-center p-8 text-center text-sm">
          {props.error ? (
            <p role="alert" className="flex items-center gap-2 text-crm-danger">
              <ShieldAlert className="size-4" aria-hidden />
              {props.error}
            </p>
          ) : (
            <p className="text-crm-muted-fg">
              {roles.length
                ? "No permissions defined yet."
                : "Create a role to start assigning permissions."}
            </p>
          )}
        </div>
      </div>
    );
  }

  const dirty = state.changes.length;
  return (
    <section className={shell} style={{ height }} aria-label={label}>
      <div
        className="flex flex-wrap items-center gap-2 border-b border-crm-border px-3 py-2"
        data-grid-skip
      >
        <label className="flex h-8 min-w-52 flex-1 items-center gap-2 rounded-crm border border-crm-input bg-crm-bg px-2 focus-within:border-crm-ring">
          <Search className="size-3.5 text-crm-subtle" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${permissions.length.toLocaleString()} permissions (e.g. invoices:delete)`}
            aria-label="Filter permissions"
            className="min-w-0 flex-1 bg-transparent text-xs text-crm-fg outline-none placeholder:text-crm-faint"
          />
        </label>
        <button
          type="button"
          aria-pressed={onlyChanged}
          onClick={() => setOnlyChanged((v) => !v)}
          className={cn(
            "h-8 rounded-crm border px-2.5 text-xs",
            onlyChanged
              ? "border-crm-warning/50 bg-crm-warning/10 text-crm-warning"
              : "border-crm-border text-crm-soft hover:bg-crm-raised",
          )}
        >
          Changed only
        </button>
        <details className="relative">
          <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-crm border border-crm-border px-2.5 text-xs text-crm-soft hover:bg-crm-raised">
            <Eye className="size-3.5" aria-hidden /> Roles {visibleRoles.length}/{roles.length}
          </summary>
          <div className="absolute right-0 z-40 mt-1 max-h-72 w-56 overflow-auto rounded-crm border border-crm-border bg-crm-popover p-1 shadow-crm-overlay">
            {table
              .getAllLeafColumns()
              .filter((c) => c.id !== PERM_COL)
              .map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-crm-fg hover:bg-crm-raised"
                >
                  <input
                    type="checkbox"
                    checked={c.getIsVisible()}
                    onChange={(e) => c.toggleVisibility(e.target.checked)}
                    className="accent-[var(--color-crm-primary)]"
                  />
                  {rolesById.get(c.id)?.name}
                </label>
              ))}
          </div>
        </details>
        <div className="ml-auto flex items-center gap-2">
          {dirty > 0 && (
            <>
              <span className="text-xs text-crm-warning tabular-nums" aria-live="polite">
                {dirty} unsaved
              </span>
              <button
                type="button"
                onClick={state.discard}
                className="flex h-8 items-center gap-1.5 rounded-crm border border-crm-border px-2.5 text-xs text-crm-soft hover:bg-crm-raised"
              >
                <RotateCcw className="size-3.5" aria-hidden /> Discard
              </button>
            </>
          )}
          <button
            type="button"
            disabled={!dirty || readOnly}
            onClick={() => setReviewOpen(true)}
            className="h-8 rounded-crm bg-crm-primary px-3 text-xs font-medium text-crm-primary-fg shadow-crm-primary disabled:opacity-40"
          >
            Review & save
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        role="grid"
        aria-label={label}
        aria-rowcount={rows.length + 1}
        aria-colcount={colCount}
        aria-readonly={readOnly || undefined}
        aria-busy={props.loading || undefined}
        onKeyDown={onKeyDown}
        onFocus={() => (focusWithin.current = true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) focusWithin.current = false;
        }}
        className="relative min-h-0 flex-1 overflow-auto"
      >
        <div style={{ width: totalWidth, minWidth: "100%" }}>
          {/* sticky header row */}
          <div
            role="row"
            aria-rowindex={1}
            className="sticky top-0 z-20 flex border-b border-crm-border bg-crm-raised"
            style={{ height: HEADER_H }}
          >
            {table
              .getHeaderGroups()[0]
              ?.headers.filter((h) => h.column.getIsVisible())
              .map((h, ci) => {
                if (h.column.id === PERM_COL)
                  return (
                    <div
                      key={h.id}
                      id={cellId(0, 0)}
                      role="columnheader"
                      aria-colindex={1}
                      tabIndex={clamped.row === 0 && clamped.col === 0 ? 0 : -1}
                      onClick={() => setFocus({ row: 0, col: 0 })}
                      style={{ width: permissionColumnWidth }}
                      className="sticky left-0 z-10 flex shrink-0 flex-col justify-end border-r border-crm-border bg-crm-raised px-3 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:ring-inset"
                    >
                      <span className="text-xs font-medium text-crm-soft">Permission</span>
                      <span className="text-[11px] text-crm-muted-fg">
                        {rows.filter((r) => r.kind === "perm").length.toLocaleString()} shown ·
                        click a header to toggle column
                      </span>
                    </div>
                  );
                const role = rolesById.get(h.column.id)!;
                const colState =
                  visiblePermIds.length > 5000
                    ? false
                    : groupState(state.index, ancestors, role.id, visiblePermIds);
                return (
                  <div
                    key={h.id}
                    id={cellId(0, ci)}
                    role="columnheader"
                    aria-colindex={ci + 1}
                    aria-disabled={role.locked || disabled || undefined}
                    tabIndex={clamped.row === 0 && clamped.col === ci ? 0 : -1}
                    title={`${role.description ?? role.name}${role.inherits?.length ? ` · inherits ${role.inherits.map((i) => rolesById.get(i)?.name ?? i).join(", ")}` : ""}\nClick or press Space to toggle every visible permission`}
                    onClick={() => {
                      setFocus({ row: 0, col: ci });
                      toggleColumn(role);
                    }}
                    style={{ width: roleColumnWidth }}
                    className={cn(
                      "flex shrink-0 cursor-pointer flex-col items-center justify-center gap-1 border-l border-crm-border px-1 text-center outline-none",
                      "hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:ring-inset",
                      role.locked && "cursor-not-allowed",
                    )}
                  >
                    <span className="flex max-w-full items-center gap-1 truncate text-xs font-medium text-crm-fg">
                      {role.locked && (
                        <Lock className="size-3 shrink-0 text-crm-subtle" aria-label="locked" />
                      )}
                      <span className="truncate">{role.name}</span>
                    </span>
                    <span className="text-[10px] text-crm-muted-fg">
                      {role.members !== undefined
                        ? `${role.members} members`
                        : role.inherits?.length
                          ? "inherits"
                          : "base"}
                      {colState === "mixed" ? " · some" : colState ? " · all" : ""}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* virtual body */}
          <div className="relative" style={{ height: virtualizer.getTotalSize() }} role="rowgroup">
            {virtualizer.getVirtualItems().map((vi) => {
              const r = rows[vi.index];
              if (!r) return null;
              const gridRow = vi.index + 1;
              const common = (col: number) => ({
                id: cellId(gridRow, col),
                rowIndex: gridRow,
                colIndex: col,
                focused: clamped.row === gridRow && clamped.col === col,
                width: roleColumnWidth,
                onActivate,
                onFocusCell,
              });
              const style = {
                height: vi.size,
                transform: `translateY(${vi.start - virtualizer.options.scrollMargin}px)`,
              };
              if (r.kind === "group") {
                const focused0 = clamped.row === gridRow && clamped.col === 0;
                return (
                  <div
                    key={r.id}
                    role="row"
                    aria-rowindex={gridRow + 1}
                    aria-expanded={!r.collapsed}
                    style={style}
                    className="absolute top-0 left-0 flex w-full border-b border-crm-border bg-crm-bg"
                  >
                    <div
                      id={cellId(gridRow, 0)}
                      role="rowheader"
                      aria-colindex={1}
                      tabIndex={focused0 ? 0 : -1}
                      onClick={() => {
                        setFocus({ row: gridRow, col: 0 });
                        toggleCollapse(r.resource);
                      }}
                      style={{ width: permissionColumnWidth }}
                      className="sticky left-0 z-10 flex shrink-0 cursor-pointer items-center gap-2 border-r border-crm-border bg-crm-bg px-3 text-xs font-medium text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:ring-inset"
                    >
                      <ChevronRight
                        className={cn(
                          "size-3.5 text-crm-subtle transition-transform",
                          !r.collapsed && "rotate-90",
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{r.resource}</span>
                      <span className="ml-auto text-[10px] font-normal text-crm-muted-fg">
                        {r.permIds.length}
                      </span>
                    </div>
                    {visibleRoles.map((role, i) => {
                      const gs = groupState(state.index, ancestors, role.id, r.permIds);
                      let n = 0;
                      if (gs === "mixed")
                        for (const p of r.permIds)
                          if (isOn(cellState(state.index, ancestors, role.id, p))) n++;
                      return (
                        <GroupCell
                          key={role.id}
                          {...common(i + 1)}
                          disabled={!!disabled || !!role.locked}
                          state={gs}
                          label={`${role.name} · all ${r.resource}`}
                          count={
                            gs === true
                              ? `${r.permIds.length}/${r.permIds.length}`
                              : gs
                                ? `${n}/${r.permIds.length}`
                                : `0/${r.permIds.length}`
                          }
                        />
                      );
                    })}
                  </div>
                );
              }
              const focused0 = clamped.row === gridRow && clamped.col === 0;
              return (
                <div
                  key={r.id}
                  role="row"
                  aria-rowindex={gridRow + 1}
                  style={style}
                  className="group absolute top-0 left-0 flex w-full border-b border-crm-border hover:bg-crm-raised/60"
                >
                  <div
                    id={cellId(gridRow, 0)}
                    role="rowheader"
                    aria-colindex={1}
                    tabIndex={focused0 ? 0 : -1}
                    title="Click or press Space to toggle this permission for every visible role"
                    onClick={() => {
                      setFocus({ row: gridRow, col: 0 });
                      toggleGroup(editableRoles, [r.perm.id]);
                    }}
                    style={{ width: permissionColumnWidth }}
                    className="sticky left-0 z-10 flex shrink-0 cursor-pointer flex-col justify-center border-r border-crm-border bg-crm-card py-1 pr-3 pl-9 outline-none group-hover:bg-crm-raised focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:ring-inset"
                  >
                    <span className="flex items-center gap-1.5 font-mono text-xs text-crm-fg">
                      <span className="truncate">{r.perm.action}</span>
                      {r.perm.risk === "high" && (
                        <span className="rounded border border-crm-danger/40 px-1 text-[9px] font-sans text-crm-danger uppercase">
                          high risk
                        </span>
                      )}
                    </span>
                    {r.perm.description && (
                      <span className="truncate text-[11px] text-crm-muted-fg">
                        {r.perm.description}
                      </span>
                    )}
                  </div>
                  {visibleRoles.map((role, i) => (
                    <PermissionCell
                      key={role.id}
                      {...common(i + 1)}
                      disabled={!!disabled || !!role.locked}
                      state={cellState(state.index, ancestors, role.id, r.perm.id)}
                      dirty={state.changedCells.has(cellKey(role.id, r.perm.id))}
                      label={`${role.name} · ${r.perm.resource}:${r.perm.action}`}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          {props.loading && (
            <div className="absolute inset-0 z-30 grid place-items-center bg-crm-bg/60 text-sm text-crm-muted-fg">
              Loading permissions…
            </div>
          )}
          {!props.loading && rows.length === 0 && (
            <p className="p-8 text-center text-sm text-crm-muted-fg">
              No permissions match the current filter.
            </p>
          )}
        </div>
      </div>

      <footer
        className="flex flex-wrap items-center gap-4 border-t border-crm-border px-3 py-1.5 text-[11px] text-crm-muted-fg"
        data-grid-skip
      >
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-crm-primary" aria-hidden /> Explicit
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-3 rounded-[3px] border border-dashed border-crm-soft bg-crm-raised"
            aria-hidden
          />{" "}
          Inherited
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-crm-warning" aria-hidden /> Unsaved
        </span>
        <span className="ml-auto hidden sm:inline">
          Arrows move · Space toggles · Home/End jump · header toggles a whole column
        </span>
      </footer>

      {reviewOpen && (
        <DiffPanel
          changes={state.changes}
          roles={roles}
          permsById={permsById}
          saving={saving}
          error={saveError}
          onClose={() => setReviewOpen(false)}
          onSave={save}
          onRevertOne={(c) => state.set([c.roleId], [c.permId], c.change === "revoked")}
        />
      )}
    </section>
  );
}
