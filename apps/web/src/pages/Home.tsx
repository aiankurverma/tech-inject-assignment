import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, Copy, PackageOpen, SearchX, Terminal, TriangleAlert } from "lucide-react";
import { CopyButton } from "@ti/client";
import { Layout } from "../components/Layout";
import { useSession, type ListItem } from "../context/session";
import { AccessBadge, btn, EmptyState, PageHeader, Skeleton } from "../components/ui";

/** Thumbnails whose component is tiny in the capture get extra zoom. */
/** Wide captures that should not be zoomed or centre-cropped in grid cards. */
const WIDE_THUMBS = new Set(["data-table"]);
const SMALL = new Set(["account-list-item", "data-cells", "segmented-meter", "sparkline"]);

/** Dark CRM thumbnail with a pulse placeholder until it loads; `zoom` enlarges centred content. */
function Thumb({
  slug,
  zoom = true,
  eager = false,
}: {
  slug: string;
  zoom?: boolean;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const scale = !zoom
    ? "group-hover:scale-[1.03]"
    : SMALL.has(slug)
      ? "scale-150 group-hover:scale-[1.55]"
      : "scale-125 group-hover:scale-[1.3]";
  return (
    <span className="relative block size-full">
      {loaded ? null : (
        <span aria-hidden className="absolute inset-0 animate-pulse bg-white/[0.04]" />
      )}
      <img
        src={`/api/components/${slug}/thumbnail`}
        alt=""
        loading={eager ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`size-full object-cover transition-[opacity,scale] duration-150 [transition-duration:150ms,500ms] ${zoom ? "" : "object-left-top"} ${loaded ? "opacity-100" : "opacity-0"} ${scale}`}
      />
    </span>
  );
}

function ComponentCard({ c, eager }: { c: ListItem; eager: boolean }) {
  return (
    <Link
      to={`/components/${c.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background transition-colors hover:border-foreground/20"
    >
      <div className="h-48 overflow-hidden border-b border-border bg-[#161616]">
        <Thumb slug={c.slug} zoom={!WIDE_THUMBS.has(c.slug)} eager={eager} />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{c.name}</span>
          <AccessBadge access={c.access} locked={!!c.locked} />
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {c.description}
        </p>
        <p className="mt-auto flex items-center justify-between pt-3 text-xs text-muted-foreground">
          <span>{c.category}</span>
          <ArrowRight
            className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
            aria-hidden
          />
        </p>
      </div>
    </Link>
  );
}

function GridSkeleton() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading components">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-xl border border-border">
          <Skeleton className="h-48 rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Loading / error / empty handling shared by the landing page and the index. */
function ComponentsState({
  children,
  loading = <GridSkeleton />,
}: {
  children: (items: ListItem[]) => ReactNode;
  loading?: ReactNode;
}) {
  const { components, componentsError, refresh } = useSession();
  if (componentsError)
    return (
      <EmptyState
        icon={<TriangleAlert className="size-5" />}
        title="Could not load components"
        action={
          <button type="button" onClick={refresh} className={btn.secondary}>
            Try again
          </button>
        }
      >
        {componentsError}
      </EmptyState>
    );
  if (!components) return <>{loading}</>;
  if (!components.length)
    return (
      <EmptyState icon={<PackageOpen className="size-5" />} title="No components published yet">
        Published components will show up here.
      </EmptyState>
    );
  return <>{children(components)}</>;
}

/** Landing showcase order; anything missing is filled from the rest of the catalogue. */
const FEATURED = [
  "data-table",
  "stat-card",
  "button",
  "score-card",
  "account-list-item",
  "input",
  "sparkline",
  "notifications",
  "tabs",
  "tag",
];
const WIDE = new Set([0, 4]);

function Showcase({ items }: { items: ListItem[] }) {
  const picked = [
    ...FEATURED.flatMap((slug) => items.filter((c) => c.slug === slug)),
    ...items.filter((c) => !FEATURED.includes(c.slug)),
  ].slice(0, FEATURED.length);
  return (
    <ul className="grid auto-rows-[260px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {picked.map((c, i) => (
        <li key={c.slug} className={WIDE.has(i) ? "sm:col-span-2" : ""}>
          <Link
            to={`/components/${c.slug}`}
            className="group flex size-full flex-col overflow-hidden rounded-2xl border border-border bg-background ring-foreground/10 transition-shadow hover:ring-4"
          >
            <span className="min-h-0 flex-1 overflow-hidden bg-[#161616]">
              <Thumb slug={c.slug} zoom={!WIDE.has(i)} eager={i < 4} />
            </span>
            <span className="flex h-11 shrink-0 items-center justify-between gap-2 border-t border-border px-4">
              <span className="truncate text-sm font-medium">{c.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{c.category}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ShowcaseSkeleton() {
  return (
    <div className="grid auto-rows-[260px] gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className={`rounded-2xl ${WIDE.has(i) ? "sm:col-span-2" : ""}`} />
      ))}
    </div>
  );
}

const features = [
  {
    icon: Copy,
    title: "Copy the code",
    text: "Plain React + TypeScript files. You own them and can change anything.",
  },
  {
    icon: Terminal,
    title: "Install with npx",
    text: "One command writes the files into src/ and prints the dependencies.",
  },
  {
    icon: Bot,
    title: "Hand it to an agent",
    text: "A ready prompt explains install, theme and checks. Tokens never leave your shell.",
  },
];

export function Home() {
  const { components } = useSession();
  const install = `npx --yes ${window.location.origin}/cli/kitbase.tgz add button`;

  return (
    <Layout wide>
      <section className="mx-auto flex max-w-3xl flex-col items-center pt-16 pb-14 text-center sm:pt-24">
        <Link
          to="/components"
          className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium transition-colors hover:bg-muted/70"
        >
          {components
            ? `${components.length} CRM components, free and premium`
            : "CRM component library"}
          <ArrowRight className="size-3" aria-hidden />
        </Link>
        <h1 className="mt-6 text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-6xl">
          Build dense CRM screens without starting from zero
        </h1>
        <p className="mt-5 max-w-[640px] text-lg leading-8 text-pretty text-muted-foreground sm:text-xl">
          Dark, data-heavy React components with live previews. Copy the source, install with one
          command, or hand a ready prompt to your AI agent.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/docs/get-started" className={`${btn.primary} h-10 rounded-full px-5`}>
            Get started
          </Link>
          <Link to="/components" className={`${btn.secondary} h-10 rounded-full px-5`}>
            Browse components
          </Link>
        </div>
        <div className="mt-8 flex w-full max-w-xl items-center gap-2 rounded-lg border border-border bg-subtle py-1 pr-1 pl-3.5 text-left font-mono text-[13px] text-foreground/80">
          <span className="text-muted-foreground select-none" aria-hidden>
            $
          </span>
          <code className="min-w-0 flex-1 overflow-x-auto py-1.5 whitespace-nowrap [mask-image:linear-gradient(to_right,black_85%,transparent)]">
            {install}
          </code>
          <CopyButton getText={() => install} label="Copy install command" variant="ghost" />
        </div>
      </section>

      <section aria-label="Component showcase" className="mx-auto max-w-[1400px]">
        <ComponentsState loading={<ShowcaseSkeleton />}>
          {(items) => <Showcase items={items} />}
        </ComponentsState>
        {components && components.length > FEATURED.length ? (
          <div className="mt-6 text-center">
            <Link
              to="/components"
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View all {components.length} components{" "}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        ) : null}
      </section>

      <ul className="mx-auto mt-20 grid max-w-[1400px] gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
        {features.map((f) => (
          <li key={f.title} className="bg-background p-6">
            <f.icon className="size-5" aria-hidden />
            <p className="mt-4 text-sm font-medium">{f.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{f.text}</p>
          </li>
        ))}
      </ul>
    </Layout>
  );
}

export function ComponentsIndex() {
  const [category, setCategory] = useState<string | null>(null);
  const { components } = useSession();
  const categories = useMemo(
    () => [...new Set((components ?? []).map((c) => c.category))],
    [components],
  );

  const chip = (value: string | null, label: string, count: number) => (
    <button
      key={label}
      type="button"
      aria-pressed={category === value}
      onClick={() => setCategory(value)}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
        category === value
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground"
      }`}
    >
      {label}
      <span className="text-xs tabular-nums opacity-60">{count}</span>
    </button>
  );

  return (
    <Layout>
      <PageHeader title="Components">
        Every component ships as source you copy into your project. Premium components need a
        premium account.
      </PageHeader>
      <ComponentsState>
        {(items) => {
          const shown = category ? items.filter((c) => c.category === category) : items;
          return (
            <>
              {categories.length > 1 ? (
                <div
                  className="mb-6 flex flex-wrap gap-2"
                  role="group"
                  aria-label="Filter by category"
                >
                  {chip(null, "All", items.length)}
                  {categories.map((cat) =>
                    chip(cat, cat, items.filter((c) => c.category === cat).length),
                  )}
                </div>
              ) : null}
              {shown.length ? (
                <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {shown.map((c, i) => (
                    <li key={c.slug}>
                      <ComponentCard c={c} eager={i < 6} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<SearchX className="size-5" />}
                  title="Nothing in this category"
                />
              )}
            </>
          );
        }}
      </ComponentsState>
    </Layout>
  );
}
