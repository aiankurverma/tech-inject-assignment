import * as React from "react";
import { Copy, Lock, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { Input } from "@/components/crm/input";
import { Tag } from "@/components/crm/tag";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "export";

export interface PermissionResource {
  key: string;
  label: string;
  /** Actions that make sense for this resource; others render as n/a. */
  actions: PermissionAction[];
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  /** Built-in roles cannot be edited or deleted, only duplicated. */
  system?: boolean;
  memberCount: number;
  /** resourceKey -> granted actions */
  permissions: Record<string, PermissionAction[]>;
}

export interface SettingsRolesProps {
  resources: PermissionResource[];
  roles?: Role[];
  defaultRoles?: Role[];
  /** Fires on Save with the full role list. */
  onSave?: (roles: Role[]) => Promise<void> | void;
  className?: string;
}

const ACTIONS: PermissionAction[] = ["view", "create", "edit", "delete", "export"];

const has = (r: Role, res: string, a: PermissionAction) => (r.permissions[res] ?? []).includes(a);

/** Grant/revoke with implied rules: any write implies view; removing view removes everything. */
export function togglePermission(
  role: Role,
  res: string,
  action: PermissionAction,
  on: boolean,
): Role {
  let set = new Set(role.permissions[res] ?? []);
  if (on) {
    set.add(action);
    if (action !== "view") set.add("view");
  } else if (action === "view") {
    set = new Set();
  } else set.delete(action);
  return {
    ...role,
    permissions: { ...role.permissions, [res]: ACTIONS.filter((a) => set.has(a)) },
  };
}

const countGrants = (r: Role) => Object.values(r.permissions).reduce((n, a) => n + a.length, 0);

/** Roles & permissions editor: role list, resource x action matrix with implied grants, column toggles, dirty tracking, duplicate/create/delete. */
export function SettingsRoles({
  resources,
  roles,
  defaultRoles = [],
  onSave,
  className,
}: SettingsRolesProps) {
  const initial = roles ?? defaultRoles;
  const [saved, setSaved] = React.useState(initial);
  const [draft, setDraft] = React.useState(initial);
  const [activeId, setActiveId] = React.useState(initial[0]?.id ?? "");
  const [newName, setNewName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const active = draft.find((r) => r.id === activeId) ?? draft[0];
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const total = resources.reduce((n, r) => n + r.actions.length, 0);

  const update = (next: Role) => setDraft((d) => d.map((r) => (r.id === next.id ? next : r)));

  function toggleColumn(action: PermissionAction) {
    if (!active || active.system) return;
    const applicable = resources.filter((r) => r.actions.includes(action));
    const allOn = applicable.every((r) => has(active, r.key, action));
    update(applicable.reduce((acc, r) => togglePermission(acc, r.key, action, !allOn), active));
  }

  function addRole(from?: Role) {
    const name = (from ? `${from.name} copy` : newName).trim();
    if (!name) return setError("Give the role a name.");
    if (draft.some((r) => r.name.toLowerCase() === name.toLowerCase()))
      return setError(`A role called "${name}" already exists.`);
    const role: Role = {
      id: `role-${Date.now()}`,
      name,
      description: from ? `Based on ${from.name}` : "Custom role",
      memberCount: 0,
      permissions: from ? structuredClone(from.permissions) : {},
    };
    setDraft((d) => [...d, role]);
    setActiveId(role.id);
    setNewName("");
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave?.(draft);
      setSaved(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cn("flex flex-col gap-4 font-crm", className)} aria-labelledby="roles-h">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Settings</p>
          <h2 id="roles-h" className="text-lg font-semibold text-crm-fg">
            Roles & permissions
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {dirty ? <span className="text-xs text-crm-warning">Unsaved changes</span> : null}
          <Button disabled={!dirty || saving} onClick={() => setDraft(saved)}>
            Discard
          </Button>
          <Button variant="primary" disabled={!dirty} loading={saving} onClick={save}>
            Save roles
          </Button>
        </div>
      </header>
      {error ? (
        <p role="alert" className="text-xs text-crm-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="flex flex-col gap-2">
          <ul role="listbox" aria-label="Roles" className="flex flex-col gap-1">
            {draft.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={r.id === active?.id}
                  onClick={() => setActiveId(r.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-crm px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                    r.id === active?.id
                      ? "bg-crm-raised text-crm-fg shadow-crm-raised"
                      : "text-crm-soft hover:bg-crm-muted",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2 truncate">
                    {r.system ? <Lock className="size-3 shrink-0" aria-label="Built-in" /> : null}
                    {r.name}
                  </span>
                  <span className="text-xs text-crm-subtle tabular-nums">{r.memberCount}</span>
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              addRole();
            }}
          >
            <Input
              aria-label="New role name"
              placeholder="New role"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button type="submit" aria-label="Create role" size="lg">
              <Plus />
            </Button>
          </form>
        </aside>

        {active ? (
          <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-crm-border bg-crm-card p-4 shadow-crm-raised">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-medium text-crm-fg">
                  <ShieldCheck className="size-4 text-crm-soft" aria-hidden />
                  {active.name}
                  {active.system ? <Tag size="sm">Built-in</Tag> : null}
                </h3>
                <p className="text-xs text-crm-soft">
                  {active.description} · {countGrants(active)} of {total} permissions ·{" "}
                  {active.memberCount} member(s)
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => addRole(active)}>
                  <Copy /> Duplicate
                </Button>
                {!active.system ? (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={active.memberCount > 0}
                    title={active.memberCount > 0 ? "Reassign members before deleting" : undefined}
                    onClick={() => {
                      setDraft((d) => d.filter((r) => r.id !== active.id));
                      setActiveId(draft[0]?.id ?? "");
                    }}
                  >
                    <Trash2 /> Delete
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">Permissions for {active.name}</caption>
                <thead>
                  <tr className="border-b border-crm-border text-xs text-crm-subtle">
                    <th scope="col" className="py-2 text-left font-medium">
                      Object
                    </th>
                    {ACTIONS.map((a) => (
                      <th key={a} scope="col" className="py-2 font-medium capitalize">
                        <button
                          type="button"
                          disabled={active.system}
                          onClick={() => toggleColumn(a)}
                          className="capitalize hover:text-crm-fg disabled:cursor-default disabled:hover:text-crm-subtle"
                          aria-label={`Toggle ${a} for all objects`}
                        >
                          {a}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-crm-border">
                  {resources.map((res) => (
                    <tr key={res.key}>
                      <th scope="row" className="py-2.5 text-left font-medium text-crm-fg">
                        {res.label}
                      </th>
                      {ACTIONS.map((a) => (
                        <td key={a} className="py-2.5 text-center">
                          {res.actions.includes(a) ? (
                            <Checkbox
                              aria-label={`${res.label}: ${a}`}
                              checked={has(active, res.key, a)}
                              disabled={active.system}
                              onCheckedChange={(v) =>
                                update(togglePermission(active, res.key, a, v === true))
                              }
                            />
                          ) : (
                            <span className="text-xs text-crm-subtle" aria-label="Not applicable">
                              —
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {active.system ? (
              <p className="text-xs text-crm-subtle">
                Built-in roles are read-only. Duplicate to customise.
              </p>
            ) : (
              <p className="text-xs text-crm-subtle">
                Granting create, edit, delete or export also grants view.
              </p>
            )}
          </div>
        ) : (
          <p className="p-8 text-center text-sm text-crm-soft">Create a role to get started.</p>
        )}
      </div>
    </section>
  );
}
