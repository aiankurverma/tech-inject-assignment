import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Boxes, ChevronRight, Plus, SearchX } from "lucide-react";
import { api } from "@ti/client";
import type { Access, ComponentStatus, Summary } from "../types";
import { absoluteTime, relativeTime } from "../types";
import { useLoad } from "../hooks/useLoad";
import { Thumb } from "../components/Thumb";
import {
  AccessBadge,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
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
  selectClass,
} from "../components/ui";

type StatusFilter = "all" | ComponentStatus;
type AccessFilter = "all" | Access;

const STATUSES: StatusFilter[] = ["all", "published", "draft", "unpublished"];
const ACCESSES: AccessFilter[] = ["all", "free", "premium"];

export function ComponentList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: items, error, reload } = useLoad(() => api<Summary[]>("/api/admin/components"));

  const q = params.get("q") ?? "";
  const rawStatus = params.get("status") ?? "all";
  const status: StatusFilter = (STATUSES as string[]).includes(rawStatus)
    ? (rawStatus as StatusFilter)
    : "all";
  const rawAccess = params.get("access") ?? "all";
  const access: AccessFilter = (ACCESSES as string[]).includes(rawAccess)
    ? (rawAccess as AccessFilter)
    : "all";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const counts = useMemo(() => {
    const base = (items ?? []).filter((c) => access === "all" || c.access === access);
    return {
      all: base.length,
      published: base.filter((c) => c.status === "published").length,
      draft: base.filter((c) => c.status === "draft").length,
      unpublished: base.filter((c) => c.status === "unpublished").length,
    };
  }, [items, access]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? [])
      .filter((c) => status === "all" || c.status === status)
      .filter((c) => access === "all" || c.access === access)
      .filter(
        (c) =>
          !needle ||
          c.name.toLowerCase().includes(needle) ||
          c.slug.toLowerCase().includes(needle) ||
          c.category.toLowerCase().includes(needle),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [items, q, status, access]);

  const filtered = q !== "" || status !== "all" || access !== "all";

  return (
    <>
      <PageHeader
        title="Components"
        description="Every component in the catalogue. Select a row to edit its bundle, preview and publish."
        actions={
          <Link to="/new" className={buttonClass("primary")}>
            <Plus className="size-4" aria-hidden />
            New component
          </Link>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:px-5 lg:flex-row lg:items-center">
          <SearchInput
            value={q}
            onChange={(v) => setParam("q", v)}
            placeholder="Search by name, slug or category"
            label="Search components"
            className="lg:w-72"
          />
          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:ml-auto">
            <Segmented
              label="Filter by status"
              value={status}
              onChange={(v) => setParam("status", v)}
              options={[
                { value: "all", label: "All", count: items ? counts.all : undefined },
                {
                  value: "published",
                  label: "Published",
                  count: items ? counts.published : undefined,
                },
                { value: "draft", label: "Draft", count: items ? counts.draft : undefined },
                {
                  value: "unpublished",
                  label: "Unpublished",
                  count: items ? counts.unpublished : undefined,
                },
              ]}
            />
            <label className="sr-only" htmlFor="access-filter">
              Filter by access
            </label>
            <select
              id="access-filter"
              value={access}
              onChange={(e) => setParam("access", e.target.value)}
              className={cn(selectClass, "w-full sm:w-auto")}
            >
              <option value="all">All access</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : !items ? (
          <TableSkeleton rows={6} cols={5} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No components yet"
            description="Upload a JSON bundle to create your first component."
            action={
              <Button variant="primary" icon={Plus} onClick={() => navigate("/new")}>
                New component
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No matching components"
            description="Try a different search term or clear the filters."
            action={
              <Button onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <Table label="Components" className="md:min-w-[640px]">
              <THead>
                <tr>
                  <Th>Component</Th>
                  <Th className="hidden sm:table-cell">Status</Th>
                  <Th className="hidden md:table-cell">Access</Th>
                  <Th className="hidden md:table-cell">Version</Th>
                  <Th className="hidden md:table-cell">Updated</Th>
                  <Th className="w-8">
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </THead>
              <tbody className="divide-y divide-border/60">
                {visible.map((c) => (
                  <tr
                    key={c.slug}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a")) return;
                      navigate(`/components/${c.slug}`);
                    }}
                    className="group cursor-pointer transition-colors hover:bg-muted/50"
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <Thumb slug={c.slug} name={c.name} />
                        <div className="min-w-0">
                          <Link
                            to={`/components/${c.slug}`}
                            className={cn(
                              "block truncate rounded font-medium text-foreground group-hover:underline group-hover:underline-offset-2",
                              focusRing,
                            )}
                          >
                            {c.name}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            <span className="font-mono">{c.slug}</span>
                            <span className="hidden sm:inline"> · {c.category}</span>
                          </p>
                          <div className="mt-1.5 sm:hidden">
                            <StatusBadge status={c.status} />
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td className="hidden sm:table-cell">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={c.status} />
                        {c.hasUnpublishedChanges ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                            <span className="size-1 rounded-full bg-amber-500" aria-hidden />
                            Unpublished changes
                          </span>
                        ) : null}
                      </div>
                    </Td>
                    <Td className="hidden md:table-cell">
                      <AccessBadge access={c.access} />
                    </Td>
                    <Td className="hidden md:table-cell">
                      <VersionCell draft={c.draftVersion} live={c.publishedVersion} />
                    </Td>
                    <Td className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                      <time dateTime={c.updatedAt} title={absoluteTime(c.updatedAt)}>
                        {relativeTime(c.updatedAt)}
                      </time>
                    </Td>
                    <Td>
                      <ChevronRight
                        className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                        aria-hidden
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
              {filtered
                ? `Showing ${visible.length} of ${items.length} components`
                : `${items.length} components`}
            </div>
          </>
        )}
      </Card>
    </>
  );
}

/** One chip when draft and live match; "draft → live" plus a changes dot when they differ. */
function VersionCell({ draft, live }: { draft: string; live: string | null }) {
  if (draft === live)
    return (
      <Badge variant="outline" className="font-mono">
        v{draft}
      </Badge>
    );
  return (
    <div
      className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground"
      title={live ? `Draft v${draft}, live v${live}` : `Draft v${draft}, not live yet`}
    >
      <Badge variant="outline" className="font-mono">
        v{draft}
      </Badge>
      <span aria-hidden>→</span>
      <span className="sr-only">live:</span>
      {live ? (
        <>
          <span>v{live}</span>
          <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
          <span className="sr-only">(unpublished changes)</span>
        </>
      ) : (
        <span className="font-sans">not live</span>
      )}
    </div>
  );
}
