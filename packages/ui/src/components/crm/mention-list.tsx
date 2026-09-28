import * as React from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";

export interface MentionItem {
  id: string;
  name: string;
  /** Handle without "@", e.g. "priya.s". Also matched. */
  handle?: string;
  avatar?: string;
  /** Role or email shown under the name. */
  subtitle?: string;
  kind?: "user" | "team";
  /** Member count for teams. */
  members?: number;
  presence?: "online" | "away" | "offline";
  /** Not allowed (e.g. no access to this record); shown but not selectable. */
  disabledReason?: string;
}

export interface MentionListHandle {
  /** Forward the textarea's keydown here. Returns true when the key was consumed. */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

export interface MentionListProps {
  items: MentionItem[];
  /** Text typed after "@". */
  query: string;
  onSelect: (item: MentionItem) => void;
  onClose?: () => void;
  /** Recently mentioned ids, ranked first when the query is empty. */
  recentIds?: string[];
  limit?: number;
  loading?: boolean;
  /** id used for aria-controls / aria-activedescendant on the input. */
  id?: string;
  onActiveChange?: (optionId: string | undefined) => void;
  className?: string;
}

/** Score an item for a query: prefix of name > word prefix > handle prefix > subsequence. -1 = no match. */
export function scoreMention(item: MentionItem, query: string): number {
  const q = query.toLowerCase();
  if (!q) return 1;
  const name = item.name.toLowerCase();
  const handle = (item.handle ?? "").toLowerCase();
  if (name.startsWith(q)) return 100 - name.length / 100;
  if (name.split(/\s+/).some((w) => w.startsWith(q))) return 80;
  if (handle.startsWith(q)) return 70;
  if (name.includes(q) || handle.includes(q)) return 50;
  let i = 0;
  for (const ch of name) if (ch === q[i]) i++;
  return i === q.length ? 20 : -1;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-semibold text-crm-fg">
        {text.slice(i, i + query.length)}
      </mark>
      {text.slice(i + query.length)}
    </>
  );
}

const presenceTone = {
  online: "bg-crm-success",
  away: "bg-crm-warning",
  offline: "bg-crm-faint",
} as const;

/**
 * @mention suggestion popover for any text input: ranks people and teams by prefix/word/handle/fuzzy
 * match, boosts recent mentions, groups People and Teams, highlights the match, shows presence and
 * blocks people without access. Drive it from the input with the ref's handleKeyDown.
 */
export const MentionList = React.forwardRef<MentionListHandle, MentionListProps>(
  function MentionList(
    {
      items,
      query,
      onSelect,
      onClose,
      recentIds = [],
      limit = 8,
      loading,
      id,
      onActiveChange,
      className,
    },
    ref,
  ) {
    const autoId = React.useId();
    const listId = id ?? autoId;
    const ranked = React.useMemo(() => {
      const recent = new Map(recentIds.map((r, i) => [r, recentIds.length - i]));
      return items
        .map((it) => ({
          it,
          s: scoreMention(it, query) + (recent.get(it.id) ?? 0) * (query ? 1 : 10),
        }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s || a.it.name.localeCompare(b.it.name))
        .slice(0, limit)
        .map((x) => x.it);
    }, [items, query, recentIds, limit]);
    const people = ranked.filter((i) => i.kind !== "team");
    const teams = ranked.filter((i) => i.kind === "team");
    const ordered = [...people, ...teams];
    const enabled = ordered.filter((i) => !i.disabledReason);

    const [active, setActive] = React.useState(0);
    React.useEffect(() => setActive(0), [query]);
    const activeItem = enabled[Math.min(active, enabled.length - 1)];
    const optId = (it: MentionItem) => `${listId}-${it.id}`;
    React.useEffect(() => {
      onActiveChange?.(activeItem ? optId(activeItem) : undefined);
      if (activeItem)
        document.getElementById(optId(activeItem))?.scrollIntoView({ block: "nearest" });
      // optId is derived from listId
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeItem?.id, listId]);

    React.useImperativeHandle(
      ref,
      () => ({
        handleKeyDown: (e) => {
          if (e.key === "Escape") {
            onClose?.();
            return true;
          }
          if (!enabled.length) return false;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const d = e.key === "ArrowDown" ? 1 : -1;
            setActive((a) => (a + d + enabled.length) % enabled.length);
            return true;
          }
          if ((e.key === "Enter" || e.key === "Tab") && activeItem) {
            e.preventDefault();
            onSelect(activeItem);
            return true;
          }
          return false;
        },
      }),
      [enabled, activeItem, onSelect, onClose],
    );

    const renderItem = (it: MentionItem) => {
      const isActive = activeItem?.id === it.id;
      return (
        <li
          key={it.id}
          id={optId(it)}
          role="option"
          aria-selected={isActive}
          aria-disabled={!!it.disabledReason || undefined}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!it.disabledReason) onSelect(it);
          }}
          onMouseEnter={() => {
            const i = enabled.indexOf(it);
            if (i >= 0) setActive(i);
          }}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5",
            isActive && "bg-crm-muted",
            it.disabledReason && "cursor-not-allowed opacity-50",
          )}
        >
          {it.kind === "team" ? (
            <span
              className="grid size-6 place-items-center rounded-full bg-tag-blue-bg text-tag-blue-text"
              aria-hidden
            >
              <Users className="size-3.5" />
            </span>
          ) : (
            <span className="relative">
              <Avatar name={it.name} src={it.avatar} size="sm" className="size-6" />
              {it.presence ? (
                <span
                  className={cn(
                    "absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-crm-popover",
                    presenceTone[it.presence],
                  )}
                  aria-label={it.presence}
                />
              ) : null}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-crm-chip">
              <Highlight text={it.name} query={query} />
              {it.handle ? (
                <span className="ml-1 text-xs text-crm-muted-fg">
                  @<Highlight text={it.handle} query={query} />
                </span>
              ) : null}
            </span>
            <span className="block truncate text-[11px] text-crm-muted-fg">
              {it.disabledReason ??
                (it.kind === "team"
                  ? `${it.members ?? 0} members · notifies everyone`
                  : it.subtitle)}
            </span>
          </span>
        </li>
      );
    };

    return (
      <div
        className={cn(
          "w-72 max-w-[calc(100vw-32px)] rounded-xl border border-crm-border bg-crm-popover p-1 font-crm shadow-crm-overlay",
          className,
        )}
      >
        {loading ? (
          <p className="px-2 py-3 text-xs text-crm-muted-fg" aria-live="polite">
            Searching people…
          </p>
        ) : ordered.length === 0 ? (
          <p className="px-2 py-3 text-xs text-crm-muted-fg" aria-live="polite">
            No one matches “@{query}”
          </p>
        ) : (
          <ul
            id={listId}
            role="listbox"
            aria-label="Mention suggestions"
            className="max-h-72 overflow-y-auto"
          >
            {people.length && teams.length ? (
              <li
                role="presentation"
                className="crm-eyebrow px-2 pt-1.5 pb-1 text-[10px] text-crm-muted-fg"
              >
                People
              </li>
            ) : null}
            {people.map(renderItem)}
            {teams.length ? (
              <li
                role="presentation"
                className="crm-eyebrow px-2 pt-2 pb-1 text-[10px] text-crm-muted-fg"
              >
                Teams
              </li>
            ) : null}
            {teams.map(renderItem)}
          </ul>
        )}
        <p
          className="border-t border-crm-border px-2 pt-1 pb-0.5 text-[10px] text-crm-muted-fg"
          aria-hidden
        >
          ↑↓ navigate · Enter select · Esc close
        </p>
      </div>
    );
  },
);
