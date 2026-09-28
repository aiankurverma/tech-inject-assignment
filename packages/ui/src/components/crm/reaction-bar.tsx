import * as React from "react";
import { SmilePlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/crm/popover";
import { cn } from "@/lib/utils";

export interface Reaction {
  emoji: string;
  /** Names of the people who reacted. Used for the count and the tooltip. */
  users: string[];
}

export interface ReactionBarProps {
  /** Controlled reactions. */
  reactions?: Reaction[];
  /** Initial reactions when uncontrolled. */
  defaultReactions?: Reaction[];
  onReactionsChange?: (reactions: Reaction[]) => void;
  /** Name of the viewer; their reactions are highlighted and toggle on click. */
  currentUser: string;
  /** Emoji offered in the picker. */
  palette?: string[];
  /** Maximum distinct emoji on one item (Slack-style cap). */
  maxDistinct?: number;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_PALETTE = ["👍", "🎉", "❤️", "🔥", "👀", "✅", "😂", "🙏", "🚀", "💯", "😮", "👎"];

function toggle(reactions: Reaction[], emoji: string, user: string): Reaction[] {
  const existing = reactions.find((r) => r.emoji === emoji);
  if (!existing) return [...reactions, { emoji, users: [user] }];
  const has = existing.users.includes(user);
  return reactions
    .map((r) =>
      r.emoji !== emoji
        ? r
        : { ...r, users: has ? r.users.filter((u) => u !== user) : [...r.users, user] },
    )
    .filter((r) => r.users.length > 0);
}

/** "You, Priya and 3 others" style summary used for the tooltip and screen readers. */
export function describeReactors(users: string[], currentUser: string): string {
  const names = users.map((u) => (u === currentUser ? "You" : u));
  names.sort((a, b) => (a === "You" ? -1 : b === "You" ? 1 : 0));
  if (names.length <= 3) {
    return names.length > 1
      ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
      : names.join("");
  }
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} others`;
}

/**
 * Emoji reaction pills with counts, a "you reacted" highlight and an emoji picker. Arrow keys
 * move between pills; the picker is a grid navigable with arrows.
 */
export function ReactionBar({
  reactions: controlled,
  defaultReactions = [],
  onReactionsChange,
  currentUser,
  palette = DEFAULT_PALETTE,
  maxDistinct = 12,
  disabled,
  className,
}: ReactionBarProps) {
  const [inner, setInner] = React.useState(defaultReactions);
  const reactions = controlled ?? inner;
  const [open, setOpen] = React.useState(false);
  const barRef = React.useRef<HTMLDivElement>(null);
  const [live, setLive] = React.useState("");

  const commit = (emoji: string) => {
    const reacted = reactions.find((r) => r.emoji === emoji)?.users.includes(currentUser);
    const next = toggle(reactions, emoji, currentUser);
    if (controlled === undefined) setInner(next);
    onReactionsChange?.(next);
    setLive(`${reacted ? "Removed" : "Added"} ${emoji} reaction`);
  };

  const atCap = reactions.length >= maxDistinct;

  const onBarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const items = Array.from(barRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const n = (i + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    items[n]?.focus();
  };

  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const cols = 6;
    const delta: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: cols,
      ArrowUp: -cols,
    };
    const d = delta[e.key];
    if (d === undefined) return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const n = Math.min(items.length - 1, Math.max(0, i + d));
    e.preventDefault();
    items[n]?.focus();
  };

  return (
    <div
      ref={barRef}
      role="group"
      aria-label="Reactions"
      onKeyDown={onBarKeyDown}
      className={cn("flex flex-wrap items-center gap-1 font-crm", className)}
    >
      {reactions.map((r) => {
        const mine = r.users.includes(currentUser);
        const who = describeReactors(r.users, currentUser);
        return (
          <button
            key={r.emoji}
            type="button"
            disabled={disabled}
            aria-pressed={mine}
            aria-label={`${r.emoji} ${r.users.length}: ${who}`}
            title={`${who} reacted with ${r.emoji}`}
            onClick={() => commit(r.emoji)}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs tabular-nums outline-none",
              "transition-colors duration-150 ease-crm focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-50",
              mine
                ? "border-crm-primary/60 bg-crm-primary/15 text-crm-fg"
                : "border-crm-border bg-crm-raised text-crm-soft hover:bg-crm-muted hover:text-crm-fg",
            )}
          >
            <span aria-hidden>{r.emoji}</span>
            <span aria-hidden>{r.users.length}</span>
          </button>
        );
      })}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled || atCap}
            aria-label={atCap ? `Reaction limit of ${maxDistinct} reached` : "Add reaction"}
            title={atCap ? `Limit of ${maxDistinct} reactions` : "Add reaction"}
            className="inline-flex h-6 items-center rounded-full border border-dashed border-crm-input px-1.5 text-crm-soft outline-none hover:border-crm-ring hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-40 [&_svg]:size-3.5"
          >
            <SmilePlus aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <div
            role="group"
            aria-label="Pick a reaction"
            onKeyDown={onGridKeyDown}
            className="grid grid-cols-6 gap-1"
          >
            {palette.map((emoji) => {
              const mine = reactions.find((r) => r.emoji === emoji)?.users.includes(currentUser);
              return (
                <button
                  key={emoji}
                  type="button"
                  aria-pressed={!!mine}
                  aria-label={`React with ${emoji}`}
                  onClick={() => {
                    commit(emoji);
                    setOpen(false);
                  }}
                  className={cn(
                    "grid size-8 place-items-center rounded-md text-base outline-none hover:bg-crm-muted focus-visible:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                    mine && "bg-crm-primary/20",
                  )}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <span className="sr-only" aria-live="polite">
        {live}
      </span>
    </div>
  );
}
