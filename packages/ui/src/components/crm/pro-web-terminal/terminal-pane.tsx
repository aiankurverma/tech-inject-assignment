import * as React from "react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { ensureXtermStyles } from "@/components/crm/pro-web-terminal/xterm-styles";
import { cn } from "@/lib/utils";
import type {
  CommandEntry,
  Recording,
  ShellFactory,
  ShellSession,
} from "@/components/crm/pro-web-terminal/types";

export interface TerminalPaneHandle {
  /** Find `query` from the current match; returns [index, total] or null when no match. */
  find: (query: string, dir: 1 | -1, opts?: { caseSensitive?: boolean }) => [number, number] | null;
  clearSearch: () => void;
  focus: () => void;
  /** Send text as if typed. */
  send: (text: string) => void;
  fit: () => void;
}

export interface TerminalPaneProps {
  sessionId: string;
  shell: ShellFactory;
  active: boolean;
  visible: boolean;
  recordings: Map<string, Recording>;
  theme: ITheme;
  fontSize: number;
  scrollback: number;
  onCommand: (entry: CommandEntry) => void;
  onFocus: () => void;
  onTitle?: (title: string) => void;
  label: string;
}

const PROMPT_RE = /^.*?[$#>%]\s/;

export const TerminalPane = React.forwardRef<TerminalPaneHandle, TerminalPaneProps>(
  function TerminalPane(
    {
      sessionId,
      shell,
      active,
      visible,
      recordings,
      theme,
      fontSize,
      scrollback,
      onCommand,
      onFocus,
      onTitle,
      label,
    },
    ref,
  ) {
    const host = React.useRef<HTMLDivElement>(null);
    const term = React.useRef<Terminal | null>(null);
    const fitAddon = React.useRef<FitAddon | null>(null);
    const session = React.useRef<ShellSession | null>(null);
    const search = React.useRef<{ q: string; hits: [number, number][]; i: number }>({
      q: "",
      hits: [],
      i: -1,
    });
    const cb = React.useRef({ onCommand, onFocus, onTitle });
    cb.current = { onCommand, onFocus, onTitle };

    const fit = React.useCallback(() => {
      const t = term.current;
      const f = fitAddon.current;
      if (!t || !f || !host.current?.offsetWidth) return;
      const dims = f.proposeDimensions();
      if (!dims || !Number.isFinite(dims.cols) || (dims.cols === t.cols && dims.rows === t.rows))
        return;
      f.fit();
      session.current?.resize?.(t.cols, t.rows);
      const rec = recordings.get(sessionId);
      rec?.events.push({ t: Date.now() - rec.startedAt, kind: "r", cols: t.cols, rows: t.rows });
    }, [recordings, sessionId]);

    const fitRef = React.useRef(fit);
    fitRef.current = fit;

    // Mount the terminal + shell once per session id.
    React.useEffect(() => {
      const el = host.current;
      if (!el) return;
      ensureXtermStyles(el.ownerDocument);
      const t = new Terminal({
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize,
        scrollback,
        cursorBlink: true,
        allowProposedApi: false,
        theme,
      });
      const f = new FitAddon();
      t.loadAddon(f);
      t.open(el);
      term.current = t;
      fitAddon.current = f;
      try {
        f.fit();
      } catch {
        /* container not measured yet; ResizeObserver will retry */
      }
      const rec: Recording = recordings.get(sessionId) ?? {
        startedAt: Date.now(),
        cols: t.cols,
        rows: t.rows,
        events: [],
      };
      recordings.set(sessionId, rec);
      const s = shell({ id: sessionId, cols: t.cols, rows: t.rows });
      session.current = s;
      const off = s.onOutput((d) => {
        t.write(d);
        rec.events.push({ t: Date.now() - rec.startedAt, kind: "o", data: d });
      });
      const input = t.onData((d) => {
        if (d === "\r") {
          const b = t.buffer.active;
          const text = b.getLine(b.baseY + b.cursorY)?.translateToString(true) ?? "";
          const command = text.replace(PROMPT_RE, "").trim();
          if (command && PROMPT_RE.test(text))
            cb.current.onCommand({
              command,
              sessionId,
              at: Date.now(),
              t: Date.now() - rec.startedAt,
            });
        }
        s.write(d);
      });
      const title = t.onTitleChange((x) => cb.current.onTitle?.(x));
      const focus = () => cb.current.onFocus();
      t.textarea?.addEventListener("focus", focus);
      let raf = 0;
      const ro = new ResizeObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => fitRef.current());
      });
      ro.observe(el);
      return () => {
        ro.disconnect();
        cancelAnimationFrame(raf);
        t.textarea?.removeEventListener("focus", focus);
        off();
        input.dispose();
        title.dispose();
        s.dispose();
        t.dispose();
        term.current = null;
        session.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, shell]);

    React.useEffect(() => {
      if (term.current) term.current.options.theme = theme;
    }, [theme]);
    React.useEffect(() => {
      if (!term.current) return;
      term.current.options.fontSize = fontSize;
      fit();
    }, [fontSize, fit]);
    React.useEffect(() => {
      if (!visible) return;
      const id = requestAnimationFrame(() => {
        fit();
        if (active) term.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }, [visible, active, fit]);

    React.useImperativeHandle(
      ref,
      () => ({
        focus: () => term.current?.focus(),
        send: (text) => session.current?.write(text),
        fit,
        clearSearch: () => {
          search.current = { q: "", hits: [], i: -1 };
          term.current?.clearSelection();
        },
        find(query, dir, opts) {
          const t = term.current;
          if (!t || !query) return null;
          const s = search.current;
          const key = `${opts?.caseSensitive ? 1 : 0}${query}`;
          if (s.q !== key) {
            const b = t.buffer.active;
            const needle = opts?.caseSensitive ? query : query.toLowerCase();
            const hits: [number, number][] = [];
            for (let y = 0; y < b.length && hits.length < 5000; y++) {
              let text = b.getLine(y)?.translateToString(true) ?? "";
              if (!opts?.caseSensitive) text = text.toLowerCase();
              let x = text.indexOf(needle);
              while (x >= 0) {
                hits.push([y, x]);
                x = text.indexOf(needle, x + needle.length);
              }
            }
            search.current = { q: key, hits, i: dir > 0 ? -1 : hits.length };
          }
          const cur = search.current;
          if (!cur.hits.length) {
            t.clearSelection();
            return null;
          }
          cur.i = (cur.i + dir + cur.hits.length) % cur.hits.length;
          const [row, col] = cur.hits[cur.i]!;
          t.select(col, row, query.length);
          t.scrollToLine(Math.max(0, row - Math.floor(t.rows / 2)));
          return [cur.i + 1, cur.hits.length];
        },
      }),
      [fit],
    );

    return (
      <div
        className={cn(
          "relative h-full w-full bg-crm-bg p-2",
          active && "ring-1 ring-inset ring-crm-primary/60",
        )}
        onMouseDown={() => cb.current.onFocus()}
      >
        <div
          ref={host}
          role="application"
          aria-label={label}
          className="h-full w-full overflow-hidden"
        />
      </div>
    );
  },
);
