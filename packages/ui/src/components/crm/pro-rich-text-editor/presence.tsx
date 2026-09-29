import * as React from "react";
import type { Editor } from "@tiptap/react";
import { positionFromCursor } from "@/components/crm/pro-rich-text-editor/collab";
import type { RemotePeer } from "@/hooks/use-editor-collaboration";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Stacked avatars of everyone in the document. */
export function PresenceAvatars({
  peers,
  self,
}: {
  peers: RemotePeer[];
  self?: { name: string; color: string };
}) {
  const all = self ? [{ clientId: -1, user: self, cursor: null }, ...peers] : peers;
  if (!all.length) return null;
  return (
    <ul className="flex -space-x-1.5" aria-label={`${all.length} people editing`}>
      {all.slice(0, 5).map((p) => (
        <li
          key={p.clientId}
          title={p.clientId === -1 ? `${p.user.name} (you)` : p.user.name}
          className="flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-crm-card"
          style={{ background: p.user.color }}
        >
          {initials(p.user.name)}
          <span className="sr-only">{p.user.name}</span>
        </li>
      ))}
      {all.length > 5 ? (
        <li className="flex size-6 items-center justify-center rounded-full bg-crm-muted text-[10px] text-crm-fg ring-2 ring-crm-card">
          +{all.length - 5}
        </li>
      ) : null}
    </ul>
  );
}

interface Caret {
  id: number;
  name: string;
  color: string;
  left: number;
  top: number;
  height: number;
}

/** Remote carets drawn over the editor surface, relative to `container`. */
export function RemoteCarets({
  editor,
  peers,
  container,
}: {
  editor: Editor;
  peers: RemotePeer[];
  container: React.RefObject<HTMLElement | null>;
}) {
  const [carets, setCarets] = React.useState<Caret[]>([]);
  React.useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = container.current?.getBoundingClientRect();
        if (!box || editor.isDestroyed) return;
        const next: Caret[] = [];
        for (const p of peers) {
          if (!p.cursor) continue;
          const pos = positionFromCursor(editor, p.cursor);
          if (pos == null) continue;
          try {
            const c = editor.view.coordsAtPos(pos);
            next.push({
              id: p.clientId,
              name: p.user.name,
              color: p.user.color,
              left: c.left - box.left + (container.current?.scrollLeft ?? 0),
              top: c.top - box.top + (container.current?.scrollTop ?? 0),
              height: Math.max(14, c.bottom - c.top),
            });
          } catch {
            /* position not rendered */
          }
        }
        setCarets(next);
      });
    };
    measure();
    editor.on("transaction", measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      editor.off("transaction", measure);
      window.removeEventListener("resize", measure);
    };
  }, [editor, peers, container]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {carets.map((c) => (
        <span
          key={c.id}
          className="absolute w-0.5 transition-[left,top] duration-100"
          style={{ left: c.left, top: c.top, height: c.height, background: c.color }}
        >
          <span
            className="absolute -top-4 left-0 whitespace-nowrap rounded px-1 text-[10px] font-medium leading-4 text-white"
            style={{ background: c.color }}
          >
            {c.name}
          </span>
        </span>
      ))}
    </div>
  );
}
