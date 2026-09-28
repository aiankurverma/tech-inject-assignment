import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronRight, Lock, Menu, X } from "lucide-react";
import { useSession, type ListItem } from "../context/session";
import { groupByCategory, type CategoryGroup } from "../lib/catalogue";
import { Search } from "./Search";
import { ThemeToggle } from "../context/theme";
import { btn, PlanBadge, Skeleton } from "./ui";

export type TocItem = { id: string; label: string };

function Logo() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 rounded-md font-semibold tracking-tight text-foreground"
    >
      <span className="grid size-7 place-items-center rounded-md bg-primary font-mono text-[11px] font-bold text-primary-foreground">
        K
      </span>
      <span className="whitespace-nowrap">Kitbase</span>
    </Link>
  );
}

const sideLink = ({ isActive }: { isActive: boolean }) =>
  `flex h-8 items-center justify-between gap-2 rounded-md px-2.5 text-sm transition-colors ${
    isActive
      ? "bg-muted font-medium text-foreground"
      : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"
  }`;

function SidebarHeading({ children }: { children: ReactNode }) {
  return <p className="mb-1 px-2.5 text-xs font-medium text-muted-foreground">{children}</p>;
}

const OPEN_KEY = "kitbase.sidebar.open";

function readOpen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function ProBadge({ locked }: { locked: boolean }) {
  return (
    <span className="inline-flex h-4.5 shrink-0 items-center gap-1 rounded border border-border bg-background px-1.5 text-[10px] font-medium text-muted-foreground">
      {locked ? <Lock className="size-2.5" aria-label="Locked" /> : null}Pro
    </span>
  );
}

/** One collapsible category. Collapsed groups render no links, so 300 items stay cheap. */
function SidebarGroup({
  group,
  open,
  onToggle,
  onNavigate,
}: {
  group: CategoryGroup<ListItem>;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const id = `side-${group.category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="flex h-7 w-full items-center gap-1.5 rounded-md px-2.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <ChevronRight
          className={`size-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">{group.category}</span>
        {group.premium ? (
          <span className="text-[10px] opacity-70" title={`${group.premium} Pro`}>
            {group.premium} Pro
          </span>
        ) : null}
        <span className="tabular-nums opacity-70">{group.items.length}</span>
      </button>
      {open ? (
        <div id={id} className="mt-0.5 mb-2 ml-3 border-l border-border pl-1.5">
          {group.items.map((c) => (
            <NavLink
              key={c.slug}
              to={`/components/${c.slug}`}
              className={sideLink}
              onClick={onNavigate}
            >
              <span className="truncate">{c.name}</span>
              {c.access === "premium" ? <ProBadge locked={!!c.locked} /> : null}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { components, componentsError } = useSession();
  const location = useLocation();
  const groups = useMemo(() => groupByCategory(components ?? []), [components]);
  const activeCategory = useMemo(() => {
    const slug = /^\/components\/([^/]+)/.exec(location.pathname)?.[1];
    return components?.find((c) => c.slug === slug)?.category ?? null;
  }, [components, location.pathname]);

  // Remembered open groups; first visit opens only the first group.
  const [open, setOpen] = useState<Set<string> | null>(readOpen);
  const openSet = useMemo(
    () => new Set(open ?? (groups[0] ? [groups[0].category] : [])),
    [open, groups],
  );
  // Open the current component's group on navigation, but let the user collapse it after.
  useEffect(() => {
    if (!activeCategory) return;
    setOpen((prev) => {
      const base = prev ?? new Set(groups[0] ? [groups[0].category] : []);
      return base.has(activeCategory) ? prev : new Set([...base, activeCategory]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run per active group only
  }, [activeCategory]);
  const save = (next: Set<string>) => {
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
    } catch {
      // Storage blocked: state still works for this session.
    }
  };
  const toggle = (category: string) => {
    const next = new Set(openSet);
    if (!next.delete(category)) next.add(category);
    save(next);
  };
  const allOpen = groups.length > 0 && groups.every((g) => openSet.has(g.category));
  const setAll = (value: boolean) => save(new Set(value ? groups.map((g) => g.category) : []));

  return (
    <nav aria-label="Documentation" className="flex flex-col gap-6 text-sm">
      <div>
        <SidebarHeading>Getting started</SidebarHeading>
        <NavLink to="/" end className={sideLink} onClick={onNavigate}>
          Introduction
        </NavLink>
        <NavLink to="/docs/get-started" className={sideLink} onClick={onNavigate}>
          Get started
        </NavLink>
        <NavLink to="/components" end className={sideLink} onClick={onNavigate}>
          <span>All components</span>
          {components ? (
            <span className="text-xs text-muted-foreground tabular-nums">{components.length}</span>
          ) : null}
        </NavLink>
      </div>
      {componentsError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Could not load components: {componentsError}
        </p>
      ) : null}
      {!components && !componentsError ? (
        <div className="space-y-2 px-2.5" aria-label="Loading components">
          <Skeleton className="h-3 w-20" />
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-5" />
          ))}
        </div>
      ) : null}
      {groups.length ? (
        <div>
          <div className="mb-1 flex items-center justify-between px-2.5">
            <p className="text-xs font-medium text-muted-foreground">Categories</p>
            <button
              type="button"
              onClick={() => setAll(!allOpen)}
              className="rounded text-[11px] text-muted-foreground hover:text-foreground"
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          </div>
          {groups.map((g) => (
            <SidebarGroup
              key={g.category}
              group={g}
              open={openSet.has(g.category)}
              onToggle={() => toggle(g.category)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </nav>
  );
}

/** Highlights the TOC entry whose section is nearest the top of the viewport. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join("|");
  useEffect(() => {
    const els = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (!els.length) return;
    const onScroll = () => {
      let current = els[0]?.id ?? null;
      for (const el of els) if (el.getBoundingClientRect().top < 120) current = el.id;
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4)
        current = els[els.length - 1]?.id ?? current;
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [key]);
  return active;
}

function Toc({ items }: { items: TocItem[] }) {
  const active = useActiveSection(items.map((t) => t.id));
  return (
    <aside className="sticky top-14 hidden h-fit w-52 shrink-0 py-10 text-sm xl:block">
      <p className="mb-3 text-xs font-medium text-muted-foreground">On this page</p>
      <ul className="space-y-0.5 border-l border-border">
        {items.map((t) => (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              aria-current={active === t.id ? "location" : undefined}
              className={`-ml-px block border-l py-1 pl-3 transition-colors ${
                active === t.id
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

const topLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2.5 py-1.5 font-medium transition-colors ${
    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
  }`;

/**
 * Site shell. `wide` drops the side rails for full-width pages (landing, sign in, 404);
 * `toc` adds the "On this page" rail.
 */
export function Layout({
  children,
  toc,
  wide = false,
}: {
  children: ReactNode;
  toc?: TocItem[];
  wide?: boolean;
}) {
  const { me, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [location.pathname]);

  // Header hairline only once the page scrolls.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Drawer: lock page scroll and close on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const trigger = menuButton.current;
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  const footer = (
    <footer className="mt-24 flex flex-wrap items-center justify-between gap-2 border-t border-border py-6 text-xs text-muted-foreground">
      <span>Kitbase. Components you copy, own and change.</span>
      <span>Independent project. Not affiliated with Meta, Astryx or shadcn/ui.</span>
    </footer>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header
        className={`sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md transition-colors ${
          scrolled ? "border-border" : "border-transparent"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
          <button
            ref={menuButton}
            type="button"
            className="-ml-1.5 inline-flex size-9 items-center justify-center rounded-md text-foreground/80 hover:bg-muted lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-expanded={open}
          >
            <Menu className="size-5" />
          </button>
          <Logo />
          <nav aria-label="Main" className="ml-3 hidden items-center gap-0.5 text-sm md:flex">
            <NavLink to="/docs/get-started" className={topLink}>
              Docs
            </NavLink>
            <NavLink to="/components" className={topLink}>
              Components
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-1 text-sm sm:gap-2">
            <Search />
            <ThemeToggle />
            {me ? (
              <>
                <Link
                  to="/account"
                  className="hidden items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground xl:inline-flex"
                >
                  <span className="max-w-48 truncate">{me.email}</span>
                  <PlanBadge plan={me.plan} />
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className={`${btn.secondary} h-8 px-3`}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/sign-in" className={`${btn.secondary} h-8 px-3`}>
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {open ? (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div
            className="absolute inset-0 bg-black/40 dark:bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="scroll-thin absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col overflow-y-auto border-r border-border bg-background shadow-2xl">
            <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="inline-flex size-9 items-center justify-center rounded-md text-foreground/80 hover:bg-muted"
                autoFocus
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-4">
              {me ? (
                <Link
                  to="/account"
                  className="mb-6 flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="truncate">{me.email}</span>
                  <PlanBadge plan={me.plan} />
                </Link>
              ) : null}
              <Sidebar onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}

      {wide ? (
        <main
          id="main"
          className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 sm:px-6"
        >
          <div className="flex-1">{children}</div>
          {footer}
        </main>
      ) : (
        <div className="mx-auto flex w-full max-w-screen-2xl flex-1 gap-12 px-4 sm:px-6">
          <aside className="scroll-thin sticky top-14 -ml-2.5 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto py-8 pr-2 lg:block">
            <Sidebar />
          </aside>
          <div className="flex min-w-0 flex-1 gap-12">
            <main id="main" className="flex min-w-0 flex-1 flex-col pt-8 sm:pt-10">
              <div className="flex-1">{children}</div>
              {footer}
            </main>
            {toc?.length ? <Toc items={toc} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}
