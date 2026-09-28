import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Lock, Search as SearchIcon } from "lucide-react";
import { ComingSoonNotice } from "@ti/feature-radar/client";
import { useSession } from "../context/session";
import { searchGroups } from "../lib/catalogue";

/** Visible Ctrl+K results; the rest is one click away on the index page. */
const MAX_RESULTS = 40;
const groupId = (category: string) =>
  `search-group-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/** Header search: a trigger button plus a Ctrl/Cmd+K (or "/") command dialog over the components. */
export function Search() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search components"
        aria-haspopup="dialog"
        className="inline-flex size-8 items-center justify-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-8 md:w-60 md:justify-start md:border md:border-border md:bg-subtle md:pr-1.5 md:pl-2.5 md:hover:border-foreground/20"
      >
        <SearchIcon className="size-4 shrink-0" aria-hidden />
        <span className="hidden flex-1 text-left md:inline">Search components...</span>
        <kbd className="hidden h-5 items-center rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground md:inline-flex">
          Ctrl K
        </kbd>
      </button>
      {open ? <SearchDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const { components, componentsError } = useSession();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Same ranking as the index page; capped so 300 items never render at once.
  const {
    groups,
    flat: results,
    total,
  } = useMemo(() => searchGroups(components ?? [], query, MAX_RESULTS), [components, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const go = (slug: string) => {
    onClose();
    navigate(`/components/${slug}`);
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] dark:bg-black/60"
        onClick={onClose}
      />
      <div className="relative mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              }
              const hit = results[active];
              if (e.key === "Enter" && hit) go(hit.slug);
            }}
            placeholder="Search components..."
            aria-label="Search components"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={results[active] ? `search-${results[active].slug}` : undefined}
            className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:outline-none"
          />
          <kbd className="rounded border border-border px-1.5 font-mono text-[10px] leading-5 text-muted-foreground">
            Esc
          </kbd>
        </div>
        <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
          {componentsError ? (
            <p className="px-3 py-6 text-center text-sm text-red-700 dark:text-red-400">
              Could not load components: {componentsError}
            </p>
          ) : !components ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading...</p>
          ) : results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No components match <span className="font-medium text-foreground">"{query}"</span>.
              <div className="radar-notice">
                <ComingSoonNotice query={query} noResults />
              </div>
            </div>
          ) : (
            <div id="search-results" role="listbox" ref={listRef} aria-label="Components">
              {groups.map((g) => (
                <div key={g.category} role="group" aria-labelledby={groupId(g.category)}>
                  <p
                    id={groupId(g.category)}
                    className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground"
                  >
                    {g.category}
                  </p>
                  {g.items.map((c) => {
                    const i = results.indexOf(c);
                    return (
                      <div
                        key={c.slug}
                        id={`search-${c.slug}`}
                        role="option"
                        aria-selected={i === active}
                        data-index={i}
                        onMouseMove={() => setActive(i)}
                        onClick={() => go(c.slug)}
                        className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm ${
                          i === active ? "bg-muted text-foreground" : "text-foreground/80"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                        {c.access === "premium" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                            {c.locked ? <Lock className="size-2.5" aria-label="Locked" /> : null}
                            Pro
                          </span>
                        ) : null}
                        {i === active ? (
                          <CornerDownLeft
                            className="size-3.5 text-muted-foreground/70"
                            aria-hidden
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
              {total > results.length ? (
                <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground">
                  Showing {results.length} of {total}. Keep typing to narrow down, or{" "}
                  <button
                    type="button"
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                    onClick={() => {
                      onClose();
                      navigate(
                        `/components${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`,
                      );
                    }}
                  >
                    see all results
                  </button>
                  .
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
