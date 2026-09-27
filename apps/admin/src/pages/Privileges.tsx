import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Ban,
  Boxes,
  Crown,
  ExternalLink,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Rocket,
  SearchX,
  Trash2,
  UserCheck,
  Users,
  EyeOff,
} from "lucide-react";
import { api } from "@ti/client";
import type { Customer, Summary } from "../types";
import { errorMessage } from "../types";
import { useLoad } from "../hooks/useLoad";
import { Thumb } from "../components/Thumb";
import {
  AccessBadge,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  RowMenu,
  SearchInput,
  Segmented,
  StatusBadge,
  Table,
  TableSkeleton,
  Td,
  Th,
  THead,
  buttonClass,
  cn,
  focusRing,
  useToast,
} from "../components/ui";

type Tab = "components" | "customers";
type CustomerFilter = "all" | "premium" | "free" | "disabled";

/** One place for every admin permission: component CRUD + publishing, and customer access. */
export function Privileges() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(pathname === "/customers" ? "customers" : "components");
  const comps = useLoad(() => api<Summary[]>("/api/admin/components"));
  const custs = useLoad(() => api<Customer[]>("/api/admin/customers"));
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Summary | null>(null);
  const [compQuery, setCompQuery] = useState("");
  const [custQuery, setCustQuery] = useState("");
  const [custFilter, setCustFilter] = useState<CustomerFilter>("all");
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    components: null,
    customers: null,
  });

  /** Runs one admin action, reloads the affected list, and reports the outcome. */
  const act = async (
    key: string,
    path: string,
    init: Parameters<typeof api>[1],
    success: string,
    reload: () => Promise<void>,
  ) => {
    setBusy(key);
    try {
      await api(path, init);
      await reload();
      toast.success(success);
      return true;
    } catch (e) {
      toast.error("Action failed", errorMessage(e, "Action failed"));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const ok = await act(
      toDelete.slug,
      `/api/admin/components/${toDelete.slug}`,
      { method: "DELETE" },
      `Deleted "${toDelete.name}"`,
      comps.reload,
    );
    if (ok) setToDelete(null);
  };

  /** One inline publish toggle; Edit, View and Delete live in the row menu. */
  const renderComponentActions = (c: Summary, className: string) => {
    const published = c.status === "published";
    const action = published ? "unpublish" : "publish";
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Button
          size="sm"
          variant={published ? "secondary" : "success"}
          icon={published ? EyeOff : Rocket}
          loading={busy === c.slug}
          disabled={!!busy}
          aria-label={`${published ? "Unpublish" : "Publish"} ${c.name}`}
          onClick={() =>
            void act(
              c.slug,
              `/api/admin/components/${c.slug}/${action}`,
              { method: "POST" },
              `${published ? "Unpublished" : "Published"} "${c.name}"`,
              comps.reload,
            )
          }
        >
          {published ? "Unpublish" : "Publish"}
        </Button>
        <RowMenu
          label={`More actions for ${c.name}`}
          items={[
            { label: "Edit", icon: Pencil, onSelect: () => navigate(`/components/${c.slug}`) },
            {
              label: c.access === "premium" ? "Make free" : "Make premium",
              icon: c.access === "premium" ? LockOpen : Lock,
              onSelect: () =>
                void act(
                  c.slug,
                  `/api/admin/components/${c.slug}/access`,
                  { method: "POST", json: { access: c.access === "premium" ? "free" : "premium" } },
                  `"${c.name}" is now ${c.access === "premium" ? "free" : "premium"}`,
                  comps.reload,
                ),
            },
            ...(published
              ? [{ label: "View in catalogue", icon: ExternalLink, href: `/components/${c.slug}` }]
              : []),
            { label: "Delete", icon: Trash2, danger: true, onSelect: () => setToDelete(c) },
          ]}
        />
      </div>
    );
  };

  const filteredComps = useMemo(() => {
    const n = compQuery.trim().toLowerCase();
    return (comps.data ?? []).filter(
      (c) => !n || c.name.toLowerCase().includes(n) || c.slug.toLowerCase().includes(n),
    );
  }, [comps.data, compQuery]);

  const filteredCusts = useMemo(() => {
    const n = custQuery.trim().toLowerCase();
    return (custs.data ?? [])
      .filter((c) =>
        custFilter === "all"
          ? true
          : custFilter === "disabled"
            ? c.disabled
            : c.plan === custFilter,
      )
      .filter((c) => !n || c.email.toLowerCase().includes(n) || c.name.toLowerCase().includes(n));
  }, [custs.data, custQuery, custFilter]);

  const tabs: { id: Tab; label: string; icon: typeof Boxes; count: number | undefined }[] = [
    { id: "components", label: "Components", icon: Boxes, count: comps.data?.length },
    { id: "customers", label: "Customers", icon: Users, count: custs.data?.length },
  ];
  const onTabKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next: Tab = tab === "components" ? "customers" : "components";
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const custCounts = {
    all: custs.data?.length,
    premium: custs.data?.filter((c) => c.plan === "premium").length,
    free: custs.data?.filter((c) => c.plan === "free").length,
    disabled: custs.data?.filter((c) => c.disabled).length,
  };

  return (
    <>
      <PageHeader
        title="Privileges"
        description="Manage components (create, edit, publish, delete) and customer access (block/unblock, premium)."
        actions={
          tab === "components" ? (
            <Link to="/new" className={buttonClass("primary")}>
              <Plus className="size-4" aria-hidden />
              New component
            </Link>
          ) : null
        }
      />

      <div
        role="tablist"
        aria-label="Privilege areas"
        className="mb-4 flex gap-1 border-b border-border"
        onKeyDown={onTabKey}
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={`panel-${t.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative -mb-px flex items-center gap-2 rounded-t-md border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                focusRing,
                "focus-visible:ring-offset-0",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-4" aria-hidden />
              {t.label}
              {t.count !== undefined ? (
                <span
                  className={cn(
                    "rounded-md px-1.5 text-xs tabular-nums",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/70",
                  )}
                >
                  {t.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "components" ? (
        <section id="panel-components" role="tabpanel" aria-labelledby="tab-components">
          <Card>
            <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:px-5">
              <SearchInput
                value={compQuery}
                onChange={setCompQuery}
                placeholder="Search components"
                label="Search components"
                className="sm:w-72"
              />
              <p className="text-xs text-muted-foreground sm:ml-auto">
                Deleting removes the component from the catalogue. Installed copies are not
                affected.
              </p>
            </div>
            {comps.error ? (
              <ErrorState message={comps.error} onRetry={() => void comps.reload()} />
            ) : !comps.data ? (
              <TableSkeleton rows={5} cols={4} />
            ) : comps.data.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title="No components yet"
                description="Create a component to manage its publishing here."
                action={
                  <Button variant="primary" icon={Plus} onClick={() => navigate("/new")}>
                    New component
                  </Button>
                }
              />
            ) : filteredComps.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No matching components"
                description="Try another search."
              />
            ) : (
              <Table label="Component privileges" className="md:min-w-[720px]">
                <THead>
                  <tr>
                    <Th>Component</Th>
                    <Th className="hidden sm:table-cell">Status</Th>
                    <Th className="hidden md:table-cell">Access</Th>
                    <Th className="hidden text-right md:table-cell">Actions</Th>
                  </tr>
                </THead>
                <tbody className="divide-y divide-border/60">
                  {filteredComps.map((c) => (
                    <tr key={c.slug} className="transition-colors hover:bg-muted/40">
                      <Td>
                        <div className="flex items-center gap-3">
                          <Thumb slug={c.slug} name={c.name} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{c.name}</p>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {c.slug}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-col gap-2.5 md:hidden">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="sm:hidden">
                              <StatusBadge status={c.status} />
                            </span>
                            <AccessBadge access={c.access} />
                          </div>
                          {renderComponentActions(c, "justify-start")}
                        </div>
                      </Td>
                      <Td className="hidden sm:table-cell">
                        <StatusBadge status={c.status} />
                      </Td>
                      <Td className="hidden md:table-cell">
                        <AccessBadge access={c.access} />
                      </Td>
                      <Td className="hidden md:table-cell">
                        {renderComponentActions(c, "justify-end")}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </section>
      ) : (
        <section id="panel-customers" role="tabpanel" aria-labelledby="tab-customers">
          <Card>
            <div className="flex flex-col gap-3 border-b border-border p-3 sm:px-5 md:flex-row md:items-center">
              <SearchInput
                value={custQuery}
                onChange={setCustQuery}
                placeholder="Search by email or name"
                label="Search customers"
                className="md:w-72"
              />
              <div className="md:ml-auto">
                <Segmented
                  label="Filter customers"
                  value={custFilter}
                  onChange={setCustFilter}
                  options={[
                    { value: "all", label: "All", count: custCounts.all },
                    { value: "premium", label: "Premium", count: custCounts.premium },
                    { value: "free", label: "Free", count: custCounts.free },
                    { value: "disabled", label: "Blocked", count: custCounts.disabled },
                  ]}
                />
              </div>
            </div>
            {custs.error ? (
              <ErrorState message={custs.error} onRetry={() => void custs.reload()} />
            ) : !custs.data ? (
              <TableSkeleton rows={4} cols={4} />
            ) : custs.data.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No customers"
                description="Run the seed script to create test accounts."
              />
            ) : filteredCusts.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No matching customers"
                description="Try another search or filter."
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {filteredCusts.map((c) => {
                  const rowBusy = busy === c.id;
                  return (
                    <li
                      key={c.id}
                      className={cn(
                        "flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5",
                        c.disabled && "bg-subtle/70",
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase ring-1",
                            c.disabled
                              ? "bg-muted text-muted-foreground/70 ring-border"
                              : "bg-background text-foreground/80 ring-border",
                          )}
                        >
                          {(c.name || c.email).slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "truncate text-sm font-medium",
                              c.disabled ? "text-muted-foreground" : "text-foreground",
                            )}
                          >
                            {c.email}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.name || "No name"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.disabled ? (
                          <Badge variant="danger" dot>
                            Blocked
                          </Badge>
                        ) : (
                          <Badge variant="success" dot>
                            Active
                          </Badge>
                        )}
                        {c.plan === "premium" ? (
                          <Badge variant="dark">Premium</Badge>
                        ) : (
                          <Badge variant="outline">Free</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 sm:w-[300px] sm:justify-end">
                        <Button
                          size="sm"
                          variant={c.plan === "premium" ? "secondary" : "primary"}
                          icon={Crown}
                          loading={rowBusy}
                          disabled={!!busy}
                          aria-label={`${c.plan === "premium" ? "Revoke premium from" : "Grant premium to"} ${c.email}`}
                          onClick={() =>
                            void act(
                              c.id,
                              `/api/admin/customers/${c.id}/plan`,
                              {
                                method: "POST",
                                json: { plan: c.plan === "premium" ? "free" : "premium" },
                              },
                              c.plan === "premium"
                                ? `Premium revoked for ${c.email}`
                                : `Premium granted to ${c.email}`,
                              custs.reload,
                            )
                          }
                        >
                          {c.plan === "premium" ? "Revoke premium" : "Grant premium"}
                        </Button>
                        <Button
                          size="sm"
                          variant={c.disabled ? "secondary" : "ghost"}
                          icon={c.disabled ? UserCheck : Ban}
                          disabled={!!busy}
                          aria-pressed={!c.disabled}
                          aria-label={`${c.disabled ? "Unblock" : "Block"} ${c.email}`}
                          className={
                            c.disabled
                              ? undefined
                              : "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
                          }
                          onClick={() =>
                            void act(
                              c.id,
                              `/api/admin/customers/${c.id}/status`,
                              { method: "POST", json: { disabled: !c.disabled } },
                              c.disabled ? `Unblocked ${c.email}` : `Blocked ${c.email}`,
                              custs.reload,
                            )
                          }
                        >
                          {c.disabled ? "Unblock" : "Block"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.name ?? ""}"?`}
        description={
          <>
            This permanently removes <span className="font-mono">{toDelete?.slug}</span> and its
            drafts from the catalogue. Installed copies in customer projects are not affected. This
            cannot be undone.
          </>
        }
        confirmLabel="Delete component"
        destructive
        loading={toDelete !== null && busy === toDelete.slug}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
