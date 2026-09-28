import * as React from "react";
import { ChevronDown, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/crm/search-input";

export interface FaqItem {
  id: string;
  question: string;
  /** Plain text answer; blank lines become paragraphs. */
  answer: string;
  category?: string;
}

export interface FaqProps {
  items: FaqItem[];
  title?: string;
  /** Show the search box and category tabs. */
  searchable?: boolean;
  /** Only one answer open at a time. */
  single?: boolean;
  /** Controlled open ids. */
  openIds?: string[];
  defaultOpenIds?: string[];
  onOpenChange?: (ids: string[]) => void;
  /** Adds "Was this helpful?" to each answer. */
  onFeedback?: (id: string, helpful: boolean) => void;
  /** Rendered when a search finds nothing, e.g. a "Contact support" button. */
  emptyAction?: React.ReactNode;
  className?: string;
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const esc = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${esc})`, "ig"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="rounded-[3px] bg-crm-primary/30 text-crm-fg">
            {p}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

/** Searchable, categorised FAQ accordion with keyboard navigation, highlight and feedback. */
export function Faq({
  items,
  title = "Frequently asked questions",
  searchable = true,
  single = false,
  openIds,
  defaultOpenIds = [],
  onOpenChange,
  onFeedback,
  emptyAction,
  className,
}: FaqProps) {
  const uid = React.useId();
  const [inner, setInner] = React.useState<string[]>(defaultOpenIds);
  const open = openIds ?? inner;
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [voted, setVoted] = React.useState<Record<string, boolean>>({});
  const headers = React.useRef<(HTMLButtonElement | null)[]>([]);

  const categories = React.useMemo(
    () => [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))],
    [items],
  );

  const q = query.trim().toLowerCase();
  const visible = items.filter(
    (i) =>
      (category === "all" || i.category === category) &&
      (!q || i.question.toLowerCase().includes(q) || i.answer.toLowerCase().includes(q)),
  );

  const setOpen = (next: string[]) => {
    if (openIds === undefined) setInner(next);
    onOpenChange?.(next);
  };
  const toggle = (id: string) => {
    const isOpen = open.includes(id);
    setOpen(isOpen ? open.filter((x) => x !== id) : single ? [id] : [...open, id]);
  };
  const allOpen = visible.length > 0 && visible.every((i) => open.includes(i.id));

  const onKey = (e: React.KeyboardEvent, index: number) => {
    const last = visible.length - 1;
    const to =
      e.key === "ArrowDown"
        ? Math.min(index + 1, last)
        : e.key === "ArrowUp"
          ? Math.max(index - 1, 0)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (to < 0) return;
    e.preventDefault();
    headers.current[to]?.focus();
  };

  return (
    <section aria-labelledby={`${uid}-t`} className={cn("flex flex-col gap-4 font-crm", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`${uid}-t`} className="text-lg font-semibold text-crm-fg">
            {title}
          </h2>
          <p className="crm-caption text-crm-subtle" aria-live="polite">
            {visible.length} of {items.length} questions
          </p>
        </div>
        {!single ? (
          <button
            type="button"
            onClick={() =>
              setOpen(
                allOpen
                  ? open.filter((id) => !visible.some((v) => v.id === id))
                  : [...new Set([...open, ...visible.map((v) => v.id)])],
              )
            }
            className="rounded-full px-2 py-1 text-xs text-crm-muted-fg outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        ) : null}
      </div>

      {searchable ? (
        <div className="flex flex-col gap-2">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search questions and answers"
            aria-label="Search FAQ"
          />
          {categories.length > 1 ? (
            <div role="tablist" aria-label="Categories" className="flex flex-wrap gap-1">
              {["all", ...categories].map((c) => {
                const count =
                  c === "all" ? items.length : items.filter((i) => i.category === c).length;
                return (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={category === c}
                    onClick={() => setCategory(c)}
                    className={cn(
                      "h-7 rounded-full px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                      category === c
                        ? "bg-crm-raised text-crm-fg shadow-crm-raised"
                        : "text-crm-muted-fg hover:text-crm-fg",
                    )}
                  >
                    {c === "all" ? "All" : c} <span className="text-crm-subtle">{count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-crm border border-dashed border-crm-border p-8 text-center">
          <p className="text-sm text-crm-soft">No answers match &ldquo;{query}&rdquo;.</p>
          {emptyAction}
        </div>
      ) : (
        <ul className="divide-y divide-crm-border rounded-crm border border-crm-border bg-crm-card">
          {visible.map((item, i) => {
            const isOpen = open.includes(item.id);
            const hid = `${uid}-h-${item.id}`;
            const pid = `${uid}-p-${item.id}`;
            return (
              <li key={item.id}>
                <h3>
                  <button
                    ref={(el) => {
                      headers.current[i] = el;
                    }}
                    id={hid}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={pid}
                    onClick={() => toggle(item.id)}
                    onKeyDown={(e) => onKey(e, i)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-medium text-crm-fg outline-none hover:bg-crm-raised/50 focus-visible:bg-crm-raised focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:ring-inset"
                  >
                    <span>
                      <Highlight text={item.question} query={query.trim()} />
                    </span>
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        "size-4 shrink-0 text-crm-subtle transition-transform duration-150",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </h3>
                <div
                  id={pid}
                  role="region"
                  aria-labelledby={hid}
                  hidden={!isOpen}
                  className="flex flex-col gap-2 px-4 pb-4 text-sm leading-relaxed text-crm-soft"
                >
                  {item.answer.split(/\n\s*\n/).map((para, k) => (
                    <p key={k}>
                      <Highlight text={para} query={query.trim()} />
                    </p>
                  ))}
                  {onFeedback ? (
                    <div className="mt-1 flex items-center gap-2 crm-caption text-crm-subtle">
                      {voted[item.id] === undefined ? (
                        <>
                          <span>Was this helpful?</span>
                          {[true, false].map((yes) => (
                            <button
                              key={String(yes)}
                              type="button"
                              aria-label={yes ? "Yes, helpful" : "No, not helpful"}
                              onClick={() => {
                                setVoted((v) => ({ ...v, [item.id]: yes }));
                                onFeedback(item.id, yes);
                              }}
                              className="rounded-full p-1 outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3.5"
                            >
                              {yes ? <ThumbsUp /> : <ThumbsDown />}
                            </button>
                          ))}
                        </>
                      ) : (
                        <span role="status">Thanks for the feedback.</span>
                      )}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
