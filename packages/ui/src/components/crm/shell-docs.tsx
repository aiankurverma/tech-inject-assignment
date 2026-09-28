import * as React from "react";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/crm/search-input";

export interface DocsPage {
  id: string;
  title: string;
  /** Section headings for the "On this page" rail; ids must exist in the rendered content. */
  headings?: { id: string; label: string; level?: 2 | 3 }[];
  content: React.ReactNode;
  updatedAt?: string;
}

export interface DocsGroup {
  label: string;
  pages: DocsPage[];
}

export interface ShellDocsProps {
  groups: DocsGroup[];
  pageId?: string;
  defaultPageId?: string;
  onPageChange?: (id: string) => void;
  title?: string;
  className?: string;
}

/** Documentation layout: searchable nav, article, scroll-spy table of contents, prev/next. */
export function ShellDocs({
  groups,
  pageId,
  defaultPageId,
  onPageChange,
  title = "Docs",
  className,
}: ShellDocsProps) {
  const flat = React.useMemo(() => groups.flatMap((g) => g.pages), [groups]);
  const [inner, setInner] = React.useState(defaultPageId ?? flat[0]?.id ?? "");
  const [query, setQuery] = React.useState("");
  const [navOpen, setNavOpen] = React.useState(false);
  const [activeHeading, setActiveHeading] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const current = pageId ?? inner;
  const idx = flat.findIndex((p) => p.id === current);
  const page = flat[idx];
  const prev = idx > 0 ? flat[idx - 1] : undefined;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : undefined;

  const go = (id: string) => {
    if (pageId === undefined) setInner(id);
    onPageChange?.(id);
    setNavOpen(false);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const q = query.trim().toLowerCase();
  const filtered = groups
    .map((g) => ({
      ...g,
      pages: g.pages.filter(
        (p) =>
          !q ||
          p.title.toLowerCase().includes(q) ||
          p.headings?.some((h) => h.label.toLowerCase().includes(q)),
      ),
    }))
    .filter((g) => g.pages.length);

  React.useEffect(() => {
    const root = scrollRef.current;
    const heads = page?.headings ?? [];
    setActiveHeading(heads[0]?.id ?? null);
    if (!root || !heads.length || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActiveHeading(hit.target.id);
      },
      { root, rootMargin: "0px 0px -70% 0px" },
    );
    for (const h of heads) {
      const el = root.querySelector(`#${CSS.escape(h.id)}`);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [page]);

  const jump = (id: string) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveHeading(id);
  };

  const nav = (
    <div className="flex flex-col gap-4">
      <SearchInput size="sm" value={query} onValueChange={setQuery} placeholder="Search docs" />
      {filtered.length === 0 ? (
        <p className="px-2 text-xs text-crm-soft">No pages match “{query}”.</p>
      ) : (
        filtered.map((g) => (
          <div key={g.label} className="flex flex-col gap-0.5">
            <p className="crm-eyebrow px-2 pb-1">{g.label}</p>
            {g.pages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => go(p.id)}
                aria-current={p.id === current ? "page" : undefined}
                className={cn(
                  "rounded-md px-2 py-1.5 text-left text-[13px] focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none",
                  p.id === current
                    ? "bg-crm-muted font-medium text-crm-fg"
                    : "text-crm-muted-fg hover:bg-crm-muted/60 hover:text-crm-fg",
                )}
              >
                {p.title}
              </button>
            ))}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "relative flex h-[620px] flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg font-crm text-crm-fg",
        className,
      )}
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-crm-border px-3">
        <button
          type="button"
          aria-label={navOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
          className="grid size-7 place-items-center rounded-md text-crm-soft hover:bg-crm-muted lg:hidden"
        >
          {navOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
        <span className="text-sm font-semibold">{title}</span>
        {page ? <span className="truncate text-sm text-crm-soft">/ {page.title}</span> : null}
      </header>
      <div className="relative flex min-h-0 flex-1">
        <nav
          aria-label="Documentation"
          className={cn(
            "w-60 shrink-0 overflow-y-auto border-r border-crm-border bg-crm-card p-3",
            navOpen ? "absolute inset-y-0 left-0 z-10 shadow-crm-raised" : "hidden lg:block",
          )}
        >
          {nav}
        </nav>
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto">
          {page ? (
            <article className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-8 text-sm leading-6 text-crm-muted-fg">
              <h1 className="text-2xl font-semibold tracking-tight text-crm-fg">{page.title}</h1>
              {page.updatedAt ? (
                <p className="crm-caption -mt-2">Last updated {page.updatedAt}</p>
              ) : null}
              {page.content}
              <nav
                aria-label="Pagination"
                className="mt-6 grid grid-cols-2 gap-2 border-t border-crm-border pt-4"
              >
                {prev ? (
                  <button
                    type="button"
                    onClick={() => go(prev.id)}
                    className="flex flex-col items-start gap-0.5 rounded-crm border border-crm-border p-3 text-left hover:bg-crm-muted/50"
                  >
                    <span className="flex items-center gap-1 text-xs text-crm-soft">
                      <ChevronLeft className="size-3" /> Previous
                    </span>
                    <span className="font-medium text-crm-fg">{prev.title}</span>
                  </button>
                ) : (
                  <span />
                )}
                {next ? (
                  <button
                    type="button"
                    onClick={() => go(next.id)}
                    className="flex flex-col items-end gap-0.5 rounded-crm border border-crm-border p-3 text-right hover:bg-crm-muted/50"
                  >
                    <span className="flex items-center gap-1 text-xs text-crm-soft">
                      Next <ChevronRight className="size-3" />
                    </span>
                    <span className="font-medium text-crm-fg">{next.title}</span>
                  </button>
                ) : null}
              </nav>
            </article>
          ) : (
            <p className="p-8 text-sm text-crm-soft">Page not found.</p>
          )}
        </div>
        {page?.headings?.length ? (
          <aside aria-label="On this page" className="hidden w-52 shrink-0 p-4 xl:block">
            <p className="crm-eyebrow pb-2">On this page</p>
            <ul className="flex flex-col gap-1 border-l border-crm-border">
              {page.headings.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => jump(h.id)}
                    aria-current={activeHeading === h.id ? "location" : undefined}
                    className={cn(
                      "-ml-px border-l py-0.5 text-left text-xs",
                      h.level === 3 ? "pl-6" : "pl-3",
                      activeHeading === h.id
                        ? "border-crm-primary text-crm-fg"
                        : "border-transparent text-crm-soft hover:text-crm-fg",
                    )}
                  >
                    {h.label}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
