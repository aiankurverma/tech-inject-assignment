import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { SearchInput } from "@/components/crm/search-input";
import { Select } from "@/components/crm/select";

export interface SettingsPage {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Group heading in the nav, e.g. "Account", "Workspace", "Billing". */
  group: string;
  description?: string;
  /** Extra search terms (e.g. "sso saml okta"). */
  keywords?: string[];
  /** Small badge like "Beta" or "Admin". */
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface ShellSettingsProps {
  pages: SettingsPage[];
  activeId?: string;
  defaultActiveId?: string;
  onNavigate?: (id: string) => void;
  /** Content of the active page. */
  children: React.ReactNode;
  title?: string;
  /** Unsaved changes on the current page: shows the save bar and guards navigation. */
  dirty?: boolean;
  saving?: boolean;
  saveError?: string;
  onSave?: () => void;
  onDiscard?: () => void;
  /** Asked before leaving a dirty page. Return false to stay. Defaults to window.confirm. */
  confirmLeave?: () => boolean;
  className?: string;
}

/**
 * Settings layout: searchable, grouped left nav (a select on mobile), page header and a
 * sticky unsaved-changes bar with save/discard, Ctrl/Cmd+S and a guard when leaving a dirty page.
 */
export function ShellSettings({
  pages,
  activeId,
  defaultActiveId,
  onNavigate,
  children,
  title = "Settings",
  dirty,
  saving,
  saveError,
  onSave,
  onDiscard,
  confirmLeave,
  className,
}: ShellSettingsProps) {
  const [inner, setInner] = React.useState(defaultActiveId ?? pages[0]?.id);
  const [query, setQuery] = React.useState("");
  const active = activeId ?? inner;
  const page = pages.find((p) => p.id === active);
  const headingId = React.useId();

  const q = query.trim().toLowerCase();
  const filtered = pages.filter(
    (p) =>
      !q ||
      [p.label, p.group, p.description ?? "", ...(p.keywords ?? [])].some((s) =>
        s.toLowerCase().includes(q),
      ),
  );
  const groups = filtered.reduce<Record<string, SettingsPage[]>>((acc, p) => {
    (acc[p.group] ??= []).push(p);
    return acc;
  }, {});

  const go = (id: string) => {
    if (id === active) return;
    if (dirty) {
      const ok = confirmLeave
        ? confirmLeave()
        : window.confirm("You have unsaved changes. Leave without saving?");
      if (!ok) return;
      onDiscard?.();
    }
    if (activeId === undefined) setInner(id);
    onNavigate?.(id);
  };

  React.useEffect(() => {
    if (!dirty || !onSave) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) onSave();
      }
    };
    const beforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [dirty, saving, onSave]);

  return (
    <div className={cn("flex h-full min-h-0 w-full bg-crm-bg font-crm text-crm-fg", className)}>
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-crm-border bg-crm-sidebar md:flex">
        <div className="border-b border-crm-border p-3">
          <p className="mb-2 text-sm font-medium">{title}</p>
          <SearchInput
            size="sm"
            placeholder="Find a setting"
            value={query}
            onValueChange={setQuery}
          />
        </div>
        <nav aria-label={title} className="flex-1 overflow-y-auto p-2">
          {Object.keys(groups).length === 0 ? (
            <p className="px-2 py-4 text-xs text-crm-subtle">No settings match “{query}”.</p>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group} className="mb-3">
                <p className="crm-eyebrow mb-1 px-2 text-[11px] text-crm-faint">{group}</p>
                {items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={p.disabled}
                    aria-current={p.id === active ? "page" : undefined}
                    onClick={() => go(p.id)}
                    className={cn(
                      "flex h-8 w-full items-center gap-2 rounded-crm px-2 text-sm text-crm-muted-fg outline-none [&_svg]:size-3.5",
                      "transition-colors duration-150 ease-crm hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-40",
                      p.id === active && "bg-crm-muted text-crm-fg shadow-crm-raised",
                    )}
                  >
                    <span className="text-crm-subtle">{p.icon}</span>
                    <span className="flex-1 truncate text-left">{p.label}</span>
                    {p.badge}
                    {p.id === active && dirty ? (
                      <span
                        aria-label="Unsaved changes"
                        className="size-1.5 rounded-full bg-crm-warning"
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-crm-border p-3 md:hidden">
          <Select
            aria-label="Settings page"
            value={active}
            onValueChange={go}
            options={pages
              .filter((p) => !p.disabled)
              .map((p) => ({ value: p.id, label: `${p.group} · ${p.label}` }))}
          />
        </div>
        <main aria-labelledby={headingId} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-5 p-5 md:p-8">
            {page ? (
              <header className="flex flex-col gap-1">
                <p className="crm-eyebrow text-crm-faint">{page.group}</p>
                <h1 id={headingId} className="text-xl font-medium">
                  {page.label}
                </h1>
                {page.description ? (
                  <p className="text-sm text-crm-muted-fg">{page.description}</p>
                ) : null}
              </header>
            ) : null}
            {children}
          </div>
        </main>
        {dirty ? (
          <div
            role="region"
            aria-label="Unsaved changes"
            className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-crm-border bg-crm-sidebar px-5 py-3 animate-crm-in"
          >
            <span
              className={cn("text-xs", saveError ? "text-crm-danger" : "text-crm-soft")}
              role={saveError ? "alert" : "status"}
            >
              {saveError ?? "You have unsaved changes"}
            </span>
            <span className="flex gap-2">
              <Button variant="ghost" onClick={onDiscard} disabled={saving}>
                Discard
              </Button>
              <Button variant="primary" onClick={onSave} loading={saving}>
                Save changes
              </Button>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
