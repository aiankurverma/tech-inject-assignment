import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Boxes,
  ChevronRight,
  ExternalLink,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  Radar,
  ScanSearch,
  ShieldCheck,
  Wand2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ThemeToggle } from "../context/theme";
import { Badge, Button, cn, focusRing, useFocusTrap } from "./ui";

/** The public catalogue's page builder. Same origin in production; the web dev server locally. */
const BUILDER_URL = `${
  import.meta.env.VITE_WEB_ORIGIN ?? (import.meta.env.DEV ? "http://localhost:5183" : "")
}/builder`;

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that should also mark this item active. */
  match?: string[];
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/components", label: "Components", icon: Boxes, match: ["/new"] },
  { to: "/privileges", label: "Privileges", icon: ShieldCheck, match: ["/customers"] },
  { to: "/capture", label: "Capture", icon: ScanSearch },
  { to: "/feature-radar", label: "Feature radar", icon: Radar },
  { to: "/screens", label: "Screens", icon: Wand2 },
];

function Logo() {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5 rounded-md", focusRing)}>
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-[11px] font-bold tracking-tight text-primary-foreground">
        K
      </span>
      <span className="text-sm font-semibold tracking-tight text-foreground">Kitbase</span>
      <Badge variant="outline" className="px-1.5 py-0 text-[10px] tracking-wide uppercase">
        Admin
      </Badge>
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      <p className="px-2.5 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
        Workspace
      </p>
      {NAV.map((item) => {
        const extra = item.match?.some((p) => pathname === p || pathname.startsWith(`${p}/`));
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                focusRing,
                "focus-visible:ring-offset-0",
                isActive || extra
                  ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                  : "text-foreground/70 hover:bg-muted hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "size-4",
                    isActive || extra
                      ? "text-foreground"
                      : "text-muted-foreground/70 group-hover:text-foreground/70",
                  )}
                  aria-hidden
                />
                {item.label}
              </>
            )}
          </NavLink>
        );
      })}
      <p className="px-2.5 pt-4 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
        Catalogue
      </p>
      <a
        href={BUILDER_URL}
        target="_blank"
        rel="noreferrer"
        onClick={onNavigate}
        className={cn(
          "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground",
          focusRing,
          "focus-visible:ring-offset-0",
        )}
      >
        <LayoutTemplate
          className="size-4 text-muted-foreground/70 group-hover:text-foreground/70"
          aria-hidden
        />
        Page builder
        <ExternalLink className="ml-auto size-3 text-muted-foreground/60" aria-hidden />
      </a>
    </nav>
  );
}

function UserBlock({ username, onLogout }: { username: string; onLogout: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background p-2 shadow-xs">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground/80 uppercase ring-1 ring-border"
        aria-hidden
      >
        {username.slice(0, 2)}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{username}</p>
      <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Sign out" title="Sign out">
        <LogOut className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

/** Breadcrumb trail derived from the current route. */
function useCrumbs(): string[] {
  const { pathname } = useLocation();
  if (pathname === "/" || pathname === "") return ["Overview"];
  if (pathname === "/components") return ["Components"];
  if (pathname === "/new") return ["Components", "New component"];
  if (pathname.startsWith("/components/"))
    return ["Components", decodeURIComponent(pathname.slice("/components/".length))];
  if (pathname === "/privileges" || pathname === "/customers") return ["Privileges"];
  if (pathname === "/feature-radar") return ["Feature radar"];
  if (pathname === "/screens") return ["Prompt to screen"];
  return ["Admin"];
}

export function Layout({
  children,
  username,
  onLogout,
}: {
  children: ReactNode;
  username: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const crumbs = useCrumbs();
  useFocusTrap(open, drawer, () => setOpen(false));

  const pageTitle = crumbs[crumbs.length - 1] ?? "Admin";
  useEffect(() => {
    document.title = `${pageTitle} · Kitbase Admin`;
  }, [pageTitle]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen lg:pl-60">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-muted/60 lg:flex">
        <div className="flex h-14 items-center px-4">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <SidebarNav />
        </div>
        <div className="p-3">
          <UserBlock username={username} onLogout={onLogout} />
        </div>
      </aside>

      {/* Mobile slide-over */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-neutral-950/40 dark:bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            ref={drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="slide-in absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-subtle shadow-xl"
          >
            <div className="flex h-14 items-center justify-between px-4">
              <Logo />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <SidebarNav onNavigate={() => setOpen(false)} />
            </div>
            <div className="p-3">
              <UserBlock username={username} onLogout={onLogout} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 lg:hidden"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
        >
          <Menu className="size-5" aria-hidden />
        </Button>
        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1.5 text-sm">
            <li className="hidden text-muted-foreground/70 sm:block">Admin</li>
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <li key={`${c}-${i}`} className="flex min-w-0 items-center gap-1.5">
                  <ChevronRight
                    className={cn(
                      "size-3.5 shrink-0 text-muted-foreground/50",
                      i === 0 && "hidden sm:block",
                    )}
                    aria-hidden
                  />
                  {!last && c === "Components" ? (
                    <Link
                      to="/components"
                      className={cn(
                        "rounded text-muted-foreground hover:text-foreground",
                        focusRing,
                      )}
                    >
                      {c}
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        "truncate",
                        last ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                      aria-current={last ? "page" : undefined}
                    >
                      {c}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 lg:hidden"
          onClick={onLogout}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" aria-hidden />
        </Button>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
