import * as React from "react";
import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Built in-house: emoji-mart (MIT) is not on the Kitbase allow-list and ships ~400KB of data.
 * This picker covers the ~180 emoji teams actually use at work, with keyword search, a
 * "frequently used" row and a WAI-ARIA grid (arrow keys, Home/End, Enter).
 */
const CATEGORIES: { id: string; label: string; items: [string, string][] }[] = [
  {
    id: "people",
    label: "Smileys & people",
    items: [
      ["😀", "grin smile happy"],
      ["😃", "smile happy joy"],
      ["😄", "laugh smile"],
      ["😁", "beam grin"],
      ["😅", "sweat relief"],
      ["😂", "joy tears lol"],
      ["🤣", "rofl laugh"],
      ["🙂", "slight smile"],
      ["😉", "wink"],
      ["😊", "blush"],
      ["😍", "love heart eyes"],
      ["🤩", "star struck wow"],
      ["😘", "kiss"],
      ["😎", "cool sunglasses"],
      ["🤓", "nerd"],
      ["🧐", "monocle inspect"],
      ["🤔", "thinking hmm"],
      ["🤨", "raised eyebrow skeptic"],
      ["😐", "neutral"],
      ["😑", "expressionless"],
      ["🙄", "eye roll"],
      ["😏", "smirk"],
      ["😬", "grimace awkward"],
      ["😌", "relieved"],
      ["😴", "sleep tired"],
      ["🤯", "mind blown"],
      ["🥳", "party celebrate"],
      ["😢", "cry sad"],
      ["😭", "sob"],
      ["😤", "triumph huff"],
      ["😡", "angry rage"],
      ["😱", "scream shock"],
      ["😳", "flushed"],
      ["🥺", "pleading"],
      ["🤗", "hug"],
      ["🤐", "zipper secret"],
      ["🤫", "shush quiet"],
      ["😷", "mask sick"],
      ["🤒", "ill fever"],
      ["🥶", "cold freeze"],
      ["🥵", "hot"],
      ["😇", "angel innocent"],
      ["🤠", "cowboy"],
      ["🤡", "clown"],
      ["👻", "ghost"],
      ["💀", "skull dead"],
      ["🤖", "robot bot"],
    ],
  },
  {
    id: "gestures",
    label: "Gestures",
    items: [
      ["👍", "thumbs up +1 yes approve"],
      ["👎", "thumbs down -1 no"],
      ["👏", "clap applause"],
      ["🙌", "raised hands hooray"],
      ["🙏", "pray thanks please"],
      ["🤝", "handshake deal"],
      ["👋", "wave hello bye"],
      ["✌️", "peace victory"],
      ["🤞", "fingers crossed luck"],
      ["👌", "ok perfect"],
      ["🤌", "pinched"],
      ["👀", "eyes look watching"],
      ["💪", "muscle strong"],
      ["🫡", "salute"],
      ["🤷", "shrug"],
      ["🤦", "facepalm"],
      ["🙋", "raise hand"],
      ["🙅", "no gesture"],
      ["👉", "point right"],
      ["👈", "point left"],
      ["👆", "point up"],
      ["👇", "point down"],
      ["✋", "hand stop"],
      ["🫶", "heart hands"],
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    items: [
      ["❤️", "heart love red"],
      ["🧡", "orange heart"],
      ["💛", "yellow heart"],
      ["💚", "green heart"],
      ["💙", "blue heart"],
      ["💜", "purple heart"],
      ["🖤", "black heart"],
      ["💔", "broken heart"],
      ["✅", "check done yes"],
      ["☑️", "checkbox"],
      ["❌", "cross no"],
      ["⚠️", "warning"],
      ["❗", "exclamation important"],
      ["❓", "question"],
      ["💯", "hundred"],
      ["🔥", "fire hot lit"],
      ["✨", "sparkles new"],
      ["⭐", "star"],
      ["🌟", "glowing star"],
      ["⚡", "lightning zap fast"],
      ["💡", "idea bulb"],
      ["🔔", "bell notify"],
      ["🔕", "mute"],
      ["➕", "plus add"],
      ["➖", "minus"],
      ["🔴", "red circle"],
      ["🟢", "green circle"],
      ["🟡", "yellow circle"],
      ["🔵", "blue circle"],
      ["⬆️", "up arrow"],
      ["⬇️", "down arrow"],
      ["🔁", "repeat loop"],
      ["🆗", "ok button"],
      ["🆕", "new"],
      ["🚫", "prohibited blocked"],
    ],
  },
  {
    id: "work",
    label: "Work",
    items: [
      ["🚀", "rocket launch ship"],
      ["🎉", "tada party congrats"],
      ["🎯", "target goal"],
      ["📈", "chart up growth"],
      ["📉", "chart down"],
      ["📊", "bar chart stats"],
      ["💰", "money bag revenue"],
      ["💸", "money wings spend"],
      ["💳", "card payment"],
      ["🧾", "receipt invoice"],
      ["📅", "calendar date"],
      ["⏰", "alarm clock"],
      ["⏳", "hourglass waiting"],
      ["📌", "pin"],
      ["📎", "paperclip attach"],
      ["📝", "memo note"],
      ["📄", "document page"],
      ["📁", "folder"],
      ["🗂️", "dividers files"],
      ["📦", "package box"],
      ["📧", "email mail"],
      ["📞", "phone call"],
      ["💬", "speech chat"],
      ["🗓️", "schedule"],
      ["🔒", "lock secure"],
      ["🔑", "key"],
      ["🛠️", "tools fix"],
      ["🐛", "bug"],
      ["🧪", "test experiment"],
      ["🧠", "brain smart"],
      ["🏆", "trophy win"],
      ["🥇", "gold first"],
      ["☕", "coffee break"],
      ["🍕", "pizza lunch"],
      ["🎂", "cake birthday"],
      ["🌍", "world global"],
    ],
  },
];

const ALL = CATEGORIES.flatMap((c) => c.items);
const COLS = 8;

export interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  /** Emoji shown first under "Frequently used". */
  recent?: string[];
  /** The trigger element. Receives ref + props via render prop. */
  children: (
    props: Record<string, unknown> & { ref: (node: HTMLElement | null) => void },
    open: boolean,
  ) => React.ReactNode;
  placement?: "top-start" | "top-end" | "bottom-start" | "bottom-end";
  label?: string;
}

export function EmojiPicker({
  onPick,
  recent = [],
  children,
  placement = "top-end",
  label = "Pick an emoji",
}: EmojiPickerProps) {
  const [open, setOpen] = React.useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: "dialog" }),
  ]);

  return (
    <>
      {children({ ref: refs.setReference, ...getReferenceProps() }, open)}
      {open ? (
        <FloatingPortal>
          <FloatingFocusManager context={context} initialFocus={0}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              aria-label={label}
              className="z-50 w-[296px] rounded-crm border border-crm-border bg-crm-popover text-crm-fg shadow-crm-overlay"
              {...getFloatingProps()}
            >
              <EmojiPanel
                recent={recent}
                onPick={(e) => {
                  onPick(e);
                  setOpen(false);
                }}
              />
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      ) : null}
    </>
  );
}

function EmojiPanel({ onPick, recent }: { onPick: (e: string) => void; recent: string[] }) {
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const gridRef = React.useRef<HTMLDivElement>(null);

  const sections = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      const hits = ALL.filter(([, k]) => k.includes(q));
      return [{ id: "search", label: `Results for "${query.trim()}"`, items: hits }];
    }
    const rec = recent
      .slice(0, COLS)
      .map((e) => ALL.find(([x]) => x === e) ?? ([e, e] as [string, string]));
    return rec.length
      ? [{ id: "recent", label: "Frequently used", items: rec }, ...CATEGORIES]
      : CATEGORIES;
  }, [query, recent]);

  const flat = React.useMemo(() => sections.flatMap((s) => s.items.map(([e]) => e)), [sections]);

  React.useEffect(() => setActive(0), [query]);

  const focusCell = (i: number) => {
    const next = Math.max(0, Math.min(flat.length - 1, i));
    setActive(next);
    gridRef.current?.querySelector<HTMLElement>(`[data-idx="${next}"]`)?.focus();
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLS,
      ArrowUp: -COLS,
    };
    if (e.key in map) {
      e.preventDefault();
      focusCell(active + map[e.key]!);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusCell(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusCell(flat.length - 1);
    }
  };

  let idx = -1;
  return (
    <div className="flex flex-col">
      <label className="m-2 flex items-center gap-2 rounded-crm border border-crm-input bg-crm-bg px-2 py-1.5 text-sm">
        <Search className="size-3.5 text-crm-muted-fg" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              focusCell(0);
            } else if (e.key === "Enter" && flat[0]) {
              e.preventDefault();
              onPick(flat[0]);
            }
          }}
          placeholder="Search emoji"
          aria-label="Search emoji"
          className="min-w-0 flex-1 bg-transparent text-crm-fg outline-none placeholder:text-crm-subtle"
        />
      </label>
      <div
        ref={gridRef}
        role="grid"
        aria-label="Emoji"
        onKeyDown={onGridKey}
        className="max-h-64 overflow-y-auto px-2 pb-2"
      >
        {flat.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-crm-muted-fg">No emoji match.</p>
        ) : (
          sections.map((s) =>
            s.items.length ? (
              <div key={s.id} role="rowgroup" aria-label={s.label}>
                <div className="sticky top-0 bg-crm-popover py-1 text-[11px] font-medium text-crm-muted-fg">
                  {s.label}
                </div>
                <div role="row" className="grid grid-cols-8 gap-0.5">
                  {s.items.map(([emoji, keywords]) => {
                    idx += 1;
                    const i = idx;
                    return (
                      <button
                        key={`${s.id}-${emoji}`}
                        type="button"
                        role="gridcell"
                        data-idx={i}
                        tabIndex={i === active ? 0 : -1}
                        title={keywords.split(" ")[0]}
                        aria-label={keywords.split(" ")[0]}
                        onClick={() => onPick(emoji)}
                        onFocus={() => setActive(i)}
                        className={cn(
                          "grid size-8 place-items-center rounded-md text-lg outline-none hover:bg-crm-muted",
                          "focus-visible:bg-crm-muted focus-visible:ring-1 focus-visible:ring-crm-ring",
                        )}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null,
          )
        )}
      </div>
    </div>
  );
}
