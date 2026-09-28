import * as React from "react";
import { cn } from "@/lib/utils";

export interface AnchorNavSection {
  /** id of the target element in the document (or inside `scrollContainer`). */
  id: string;
  label: string;
  /** Nesting level: 0 = section, 1 = subsection. */
  level?: 0 | 1;
  /** Optional count shown on the right (e.g. 3 open tasks). */
  count?: number;
  /** Mark a section that has validation errors. */
  invalid?: boolean;
}

export interface AnchorNavProps {
  sections: AnchorNavSection[];
  /** Scrollable ancestor that holds the sections. Defaults to the window. */
  scrollContainer?: React.RefObject<HTMLElement | null>;
  /** Pixels of sticky header above the content; used for scroll offset and spy line. */
  offset?: number;
  /** Controlled active id (e.g. from the URL hash). */
  activeId?: string;
  onActiveChange?: (id: string) => void;
  /** Update location.hash on click without adding history entries. */
  updateHash?: boolean;
  title?: string;
  /** Show a reading-progress bar for the whole container. */
  showProgress?: boolean;
  className?: string;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Scroll-spy table of contents. Highlights the last section whose top has passed the spy
 * line, smooth-scrolls on click (respecting reduced motion), moves focus to the target for
 * screen readers, and shows optional per-section counts, error markers and a progress bar.
 */
export function AnchorNav({
  sections,
  scrollContainer,
  offset = 72,
  activeId,
  onActiveChange,
  updateHash = true,
  title = "On this page",
  showProgress = true,
  className,
}: AnchorNavProps) {
  const [spyId, setSpyId] = React.useState<string | undefined>(sections[0]?.id);
  const [progress, setProgress] = React.useState(0);
  const lockRef = React.useRef<number | null>(null);
  const current = activeId ?? spyId;
  const onChangeRef = React.useRef(onActiveChange);
  onChangeRef.current = onActiveChange;

  React.useEffect(() => {
    const root = scrollContainer?.current ?? null;
    const target: HTMLElement | Window = root ?? window;
    let frame = 0;
    const compute = () => {
      frame = 0;
      const rootTop = root ? root.getBoundingClientRect().top : 0;
      const scrollTop = root ? root.scrollTop : window.scrollY;
      const scrollHeight = root ? root.scrollHeight : document.documentElement.scrollHeight;
      const clientHeight = root ? root.clientHeight : window.innerHeight;
      const max = Math.max(1, scrollHeight - clientHeight);
      setProgress(Math.min(1, scrollTop / max));
      if (lockRef.current !== null) return; // clicked jump in progress
      let found: string | undefined = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - rootTop - offset <= 8) found = s.id;
      }
      // At the very bottom, the last section wins even if short.
      if (scrollTop >= max - 2 && sections.length) found = sections[sections.length - 1]?.id;
      setSpyId((prev) => {
        if (prev !== found && found) onChangeRef.current?.(found);
        return found;
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(compute);
    };
    compute();
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections, scrollContainer, offset]);

  const jump = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const root = scrollContainer?.current ?? null;
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
    if (root) {
      const top =
        el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - offset;
      root.scrollTo({ top, behavior });
    } else {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior });
    }
    setSpyId(id);
    onActiveChange?.(id);
    if (lockRef.current !== null) window.clearTimeout(lockRef.current);
    lockRef.current = window.setTimeout(() => (lockRef.current = null), 600);
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    if (updateHash) history.replaceState(null, "", `#${id}`);
  };

  const activeIndex = sections.findIndex((s) => s.id === current);

  if (!sections.length) {
    return (
      <p className={cn("font-crm text-xs text-crm-subtle", className)}>No sections on this page.</p>
    );
  }

  return (
    <nav aria-label={title} className={cn("flex w-full flex-col gap-2 font-crm", className)}>
      <div className="flex items-center justify-between">
        <p className="crm-eyebrow text-[11px] text-crm-faint">{title}</p>
        {showProgress ? (
          <span className="text-[11px] text-crm-subtle tabular-nums" aria-hidden>
            {Math.round(progress * 100)}%
          </span>
        ) : null}
      </div>
      {showProgress ? (
        <div
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-0.5 w-full overflow-hidden rounded-full bg-crm-track"
        >
          <div
            className="h-full bg-crm-primary transition-[width] duration-150"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      ) : null}
      <ol className="relative flex flex-col border-l border-crm-border">
        {sections.map((s, i) => {
          const on = s.id === current;
          const passed = i < activeIndex;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={on ? "location" : undefined}
                onClick={(e) => jump(e, s.id)}
                className={cn(
                  "-ml-px flex min-h-7 items-center gap-2 border-l-2 py-1 pr-2 text-sm outline-none transition-colors duration-150",
                  "focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                  s.level === 1 ? "pl-6 text-[13px]" : "pl-3",
                  on
                    ? "border-crm-primary font-medium text-crm-fg"
                    : cn(
                        "border-transparent hover:text-crm-fg",
                        passed ? "text-crm-soft" : "text-crm-muted-fg",
                      ),
                )}
              >
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                {s.invalid ? (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-crm-danger"
                    aria-label="has errors"
                  />
                ) : null}
                {s.count !== undefined ? (
                  <span className="crm-caption shrink-0 text-crm-subtle tabular-nums">
                    {s.count}
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
