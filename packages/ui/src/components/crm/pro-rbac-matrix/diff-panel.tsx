import * as React from "react";
import { Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GrantChange, RbacPermission, RbacRole } from "@/lib/rbac-matrix";

export interface DiffPanelProps {
  changes: GrantChange[];
  roles: RbacRole[];
  permsById: ReadonlyMap<string, RbacPermission>;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
  onRevertOne: (change: GrantChange) => void;
}

/** Review-before-save panel: changes grouped per role, each individually revertible. */
export function DiffPanel(p: DiffPanelProps) {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => closeRef.current?.focus(), []);
  const byRole = React.useMemo(() => {
    const m = new Map<string, GrantChange[]>();
    for (const c of p.changes) m.set(c.roleId, [...(m.get(c.roleId) ?? []), c]);
    return m;
  }, [p.changes]);
  const granted = p.changes.filter((c) => c.change === "granted").length;
  const risky = p.changes.filter(
    (c) => c.change === "granted" && p.permsById.get(c.permId)?.risk === "high",
  );

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label="Review permission changes"
      onKeyDown={(e) => e.key === "Escape" && p.onClose()}
      className="absolute inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l border-crm-border bg-crm-popover shadow-crm-overlay"
    >
      <header className="flex items-center justify-between border-b border-crm-border px-4 py-3">
        <div>
          <h3 className="text-sm font-medium text-crm-fg">Review changes</h3>
          <p className="text-xs text-crm-muted-fg">
            <span className="text-crm-success">+{granted}</span> granted ·{" "}
            <span className="text-crm-danger">−{p.changes.length - granted}</span> revoked
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label="Close review"
          onClick={p.onClose}
          className="grid size-7 place-items-center rounded-crm text-crm-subtle hover:bg-crm-raised hover:text-crm-fg"
        >
          <X className="size-4" />
        </button>
      </header>
      {risky.length > 0 && (
        <p className="border-b border-crm-border bg-crm-warning/10 px-4 py-2 text-xs text-crm-warning">
          {risky.length} high-risk permission{risky.length > 1 ? "s" : ""} will be granted.
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {p.changes.length === 0 && (
          <p className="p-6 text-center text-sm text-crm-muted-fg">No unsaved changes.</p>
        )}
        {p.roles
          .filter((r) => byRole.has(r.id))
          .map((role) => (
            <section key={role.id} className="mb-3">
              <h4 className="px-2 py-1 text-xs font-medium text-crm-soft">
                {role.name} <span className="text-crm-faint">({byRole.get(role.id)!.length})</span>
              </h4>
              <ul>
                {byRole.get(role.id)!.map((c) => {
                  const perm = p.permsById.get(c.permId);
                  return (
                    <li
                      key={c.permId}
                      className="group flex items-center gap-2 rounded-crm px-2 py-1 text-xs hover:bg-crm-raised"
                    >
                      {c.change === "granted" ? (
                        <Plus className="size-3.5 shrink-0 text-crm-success" aria-label="granted" />
                      ) : (
                        <Minus className="size-3.5 shrink-0 text-crm-danger" aria-label="revoked" />
                      )}
                      <span className="min-w-0 flex-1 truncate font-mono text-crm-fg">
                        {perm ? `${perm.resource}:${perm.action}` : c.permId}
                      </span>
                      {perm?.risk === "high" && (
                        <span className="text-[10px] text-crm-warning">high risk</span>
                      )}
                      <button
                        type="button"
                        onClick={() => p.onRevertOne(c)}
                        className="text-crm-subtle opacity-0 group-hover:opacity-100 hover:text-crm-fg focus-visible:opacity-100"
                      >
                        Undo
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
      </div>
      <footer className="space-y-2 border-t border-crm-border p-3">
        {p.error && (
          <p role="alert" className="text-xs text-crm-danger">
            {p.error}
          </p>
        )}
        <button
          type="button"
          disabled={p.saving || p.changes.length === 0}
          onClick={p.onSave}
          className={cn(
            "h-9 w-full rounded-crm bg-crm-primary text-sm font-medium text-crm-primary-fg shadow-crm-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {p.saving
            ? "Saving…"
            : `Save ${p.changes.length} change${p.changes.length === 1 ? "" : "s"}`}
        </button>
      </footer>
    </aside>
  );
}
