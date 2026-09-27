import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Boxes,
  CircleCheck,
  CreditCard,
  Crown,
  FilePen,
  Plus,
  Radar,
  ShieldCheck,
  UserX,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "@ti/client";
import type { Customer, FeatureRow, Summary } from "./types";
import { absoluteTime, relativeTime } from "./types";
import { useLoad } from "./useLoad";
import { Thumb } from "./Thumb";
import {
  AccessBadge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
  buttonClass,
  cn,
  focusRing,
} from "./ui";

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  to,
  accent = "neutral",
}: {
  label: string;
  value: number | null;
  icon: LucideIcon;
  hint?: string;
  to?: string;
  accent?: "neutral" | "green" | "amber" | "red";
}) {
  const accentCls = {
    neutral: "bg-muted text-foreground/70 ring-border",
    green:
      "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-100 dark:ring-emerald-500/20",
    amber:
      "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-100 dark:ring-amber-500/20",
    red: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 ring-red-100 dark:ring-red-500/20",
  }[accent];
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className={cn("flex size-7 items-center justify-center rounded-md ring-1", accentCls)}
          aria-hidden
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      {value === null ? (
        <Skeleton className="mt-3 h-8 w-14" />
      ) : (
        <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
      )}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  const cls = "block rounded-lg border border-border bg-background p-4 shadow-xs";
  return to ? (
    <Link
      to={to}
      className={cn(
        cls,
        "transition-colors hover:border-foreground/20 hover:bg-muted/40",
        focusRing,
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Overview() {
  const navigate = useNavigate();
  const comps = useLoad(() => api<Summary[]>("/api/admin/components"));
  const custs = useLoad(() => api<Customer[]>("/api/admin/customers"));
  const feats = useLoad(() => api<FeatureRow[]>("/api/admin/features"));

  const c = comps.data;
  const u = custs.data;
  const f = feats.data;
  const count = <T,>(list: T[] | null, pred: (x: T) => boolean) =>
    list ? list.filter(pred).length : null;

  const recent = c
    ? [...c].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6)
    : null;
  const pendingChanges = count(c, (x) => x.hasUnpublishedChanges);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Catalogue health, customer access and incoming feature requests at a glance."
        actions={
          <>
            <Link to="/privileges" className={buttonClass("secondary")}>
              <ShieldCheck className="size-4" aria-hidden />
              Manage privileges
            </Link>
            <Link to="/new" className={buttonClass("primary")}>
              <Plus className="size-4" aria-hidden />
              New component
            </Link>
          </>
        }
      />

      <section aria-labelledby="stats-components" className="space-y-3">
        <h2
          id="stats-components"
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          Components
        </h2>
        {comps.error ? (
          <Card>
            <ErrorState message={comps.error} onRetry={() => void comps.reload()} />
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Total"
              value={c?.length ?? null}
              icon={Boxes}
              to="/components"
              hint="In the catalogue"
            />
            <StatCard
              label="Published"
              value={count(c, (x) => x.status === "published")}
              icon={CircleCheck}
              accent="green"
              to="/components?status=published"
              hint="Live for customers"
            />
            <StatCard
              label="Drafts"
              value={count(c, (x) => x.status === "draft")}
              icon={FilePen}
              accent="amber"
              to="/components?status=draft"
              hint={pendingChanges ? `${pendingChanges} with unpublished changes` : "Not yet live"}
            />
            <StatCard
              label="Premium components"
              value={count(c, (x) => x.access === "premium")}
              icon={Crown}
              to="/components?access=premium"
              hint="Paid access only"
            />
          </div>
        )}
      </section>

      <section aria-labelledby="stats-customers" className="mt-8 space-y-3">
        <h2
          id="stats-customers"
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          Customers &amp; requests
        </h2>
        {custs.error ? (
          <Card>
            <ErrorState message={custs.error} onRetry={() => void custs.reload()} />
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Customers"
              value={u?.length ?? null}
              icon={Users}
              to="/privileges"
              hint="Registered accounts"
            />
            <StatCard
              label="Paid customers"
              value={count(u, (x) => x.plan === "premium")}
              icon={CreditCard}
              accent="green"
              to="/privileges"
              hint="On a paid plan"
            />
            <StatCard
              label="Blocked"
              value={count(u, (x) => x.disabled)}
              icon={UserX}
              accent="red"
              to="/privileges"
              hint="Cannot sign in"
            />
            <StatCard
              label="Open requests"
              value={feats.error ? 0 : count(f, (x) => x.status !== "rejected")}
              icon={Radar}
              to="/feature-radar"
              hint={feats.error ? "Feature radar unavailable" : "From catalogue searches"}
            />
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recently updated"
            description="Latest edits across all components"
            actions={
              <Link to="/components" className={buttonClass("ghost", "sm")}>
                View all
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          {comps.error ? (
            <ErrorState message={comps.error} onRetry={() => void comps.reload()} />
          ) : !recent ? (
            <div className="divide-y divide-border/60" role="status" aria-label="Loading">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <Skeleton className="size-9 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No components yet"
              description="Create your first component from a JSON bundle."
              action={
                <Button variant="primary" icon={Plus} onClick={() => navigate("/new")}>
                  New component
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {recent.map((x) => (
                <li key={x.slug}>
                  <Link
                    to={`/components/${x.slug}`}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-5",
                      focusRing,
                      "focus-visible:ring-inset focus-visible:ring-offset-0",
                    )}
                  >
                    <Thumb slug={x.slug} name={x.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{x.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {x.category} · <span className="font-mono">{x.slug}</span>
                      </p>
                    </div>
                    <div className="hidden items-center gap-1.5 sm:flex">
                      <AccessBadge access={x.access} />
                      <StatusBadge status={x.status} />
                    </div>
                    <time
                      dateTime={x.updatedAt}
                      title={absoluteTime(x.updatedAt)}
                      className="w-24 shrink-0 text-right text-xs text-muted-foreground"
                    >
                      {relativeTime(x.updatedAt)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Quick actions" description="Common admin tasks" />
          <div className="space-y-1 p-2">
            {[
              {
                to: "/new",
                icon: Plus,
                title: "New component",
                desc: "Upload or paste a JSON bundle",
              },
              {
                to: "/components",
                icon: Boxes,
                title: "Browse components",
                desc: "Search, filter and edit",
              },
              {
                to: "/privileges",
                icon: ShieldCheck,
                title: "Manage privileges",
                desc: "Publishing and customer access",
              },
              {
                to: "/feature-radar",
                icon: Radar,
                title: "Feature radar",
                desc: "What customers search for",
              },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted/50",
                  focusRing,
                  "focus-visible:ring-offset-0",
                )}
              >
                <span className="flex size-8 items-center justify-center rounded-md border border-border bg-background shadow-xs">
                  <a.icon className="size-4 text-foreground/70" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{a.title}</span>
                  <span className="block text-xs text-muted-foreground">{a.desc}</span>
                </span>
                <ArrowRight
                  className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
