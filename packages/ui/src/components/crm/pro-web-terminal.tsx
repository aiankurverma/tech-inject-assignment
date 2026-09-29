import * as React from "react";
import { useStore } from "zustand";
import { useHotkeys } from "react-hotkeys-hook";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { ITheme } from "@xterm/xterm";
import {
  ChevronDown,
  ChevronUp,
  Columns2,
  Film,
  History,
  Plus,
  Rows2,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createTerminalStore } from "@/components/crm/pro-web-terminal/store";
import {
  TerminalPane,
  type TerminalPaneHandle,
} from "@/components/crm/pro-web-terminal/terminal-pane";
import { HistoryPalette } from "@/components/crm/pro-web-terminal/history-palette";
import { SessionReplay } from "@/components/crm/pro-web-terminal/replay";
import { createDemoShell } from "@/components/crm/pro-web-terminal/demo-shell";
import type { CommandEntry, ShellFactory } from "@/components/crm/pro-web-terminal/types";

export type {
  CommandEntry,
  RecordedEvent,
  Recording,
  ShellFactory,
  ShellSession,
} from "@/components/crm/pro-web-terminal/types";
export { createDemoShell } from "@/components/crm/pro-web-terminal/demo-shell";

export interface ProWebTerminalProps {
  /** Creates a shell per pane. Defaults to the in-browser demo shell. Keep the reference stable. */
  shell?: ShellFactory;
  initialTabs?: number;
  maxTabs?: number;
  fontSize?: number;
  scrollback?: number;
  /** xterm theme override; defaults to the CRM tokens. */
  theme?: ITheme;
  /** Fires for every command entered in any pane (for audit logs / analytics). */
  onCommand?: (entry: CommandEntry) => void;
  className?: string;
  /** Height of the console. */
  height?: number | string;
}

const CRM_THEME: ITheme = {
  background: "#161616",
  foreground: "#f9fbff",
  cursor: "#f9fbff",
  cursorAccent: "#161616",
  selectionBackground: "#4124fb88",
  black: "#1b1d20",
  red: "#f97373",
  green: "#22c55e",
  yellow: "#fbbf24",
  blue: "#7c6cff",
  magenta: "#d38cff",
  cyan: "#5fd4e8",
  white: "#d0d4dd",
  brightBlack: "#676767",
  brightWhite: "#f9fbff",
};

function readTheme(el: HTMLElement | null): ITheme {
  if (!el || typeof getComputedStyle === "undefined") return CRM_THEME;
  const cs = getComputedStyle(el);
  const v = (name: string, fb: string | undefined) => cs.getPropertyValue(name).trim() || fb;
  return {
    ...CRM_THEME,
    background: v("--color-crm-bg", CRM_THEME.background),
    foreground: v("--color-crm-fg", CRM_THEME.foreground),
    cursor: v("--color-crm-fg", CRM_THEME.cursor),
    cursorAccent: v("--color-crm-bg", CRM_THEME.cursorAccent),
    red: v("--color-crm-danger", CRM_THEME.red),
    green: v("--color-crm-success", CRM_THEME.green),
    yellow: v("--color-crm-warning", CRM_THEME.yellow),
  };
}

const tool =
  "inline-flex size-7 items-center justify-center rounded text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg focus-visible:outline-2 focus-visible:outline-crm-ring disabled:opacity-40";
const HOTKEYS = { enableOnFormTags: true, preventDefault: true } as const;

/**
 * Multi-tab, split-pane web terminal on xterm.js + @xterm/addon-fit with fit-on-resize, buffer
 * search, a fuzzy command-history palette, session recording with a replay timeline (asciicast
 * export) and hotkeys (react-hotkeys-hook). Bring your own PTY via the `shell` factory.
 */
export function ProWebTerminal({
  shell,
  initialTabs = 1,
  maxTabs = 12,
  fontSize = 13,
  scrollback = 5000,
  theme: themeProp,
  onCommand,
  className,
  height = 460,
}: ProWebTerminalProps) {
  const [store] = React.useState(() => createTerminalStore(initialTabs, maxTabs));
  const [demo] = React.useState(() => createDemoShell());
  const factory = shell ?? demo;
  const tabs = useStore(store, (s) => s.tabs);
  const activeTab = useStore(store, (s) => s.activeTab);
  const activePane = useStore(store, (s) => s.activePane);
  const history = useStore(store, (s) => s.history);
  const recordings = useStore(store, (s) => s.recordings);
  const s = store.getState();
  const panes = React.useRef(new Map<string, TerminalPaneHandle>());
  const rootEl = React.useRef<HTMLDivElement | null>(null);
  const [cssTheme, setCssTheme] = React.useState<ITheme>(CRM_THEME);
  const theme = themeProp ?? cssTheme;
  const [overlay, setOverlay] = React.useState<null | "palette" | "replay">(null);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [caseSensitive, setCaseSensitive] = React.useState(false);
  const [result, setResult] = React.useState<[number, number] | null>(null);
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const searchInput = React.useRef<HTMLInputElement>(null);
  const onCommandRef = React.useRef(onCommand);
  onCommandRef.current = onCommand;

  React.useLayoutEffect(() => setCssTheme(readTheme(rootEl.current)), []);

  const pane = () => panes.current.get(store.getState().activePane);
  const handleCommand = React.useCallback(
    (e: CommandEntry) => {
      store.getState().pushCommand(e);
      onCommandRef.current?.(e);
    },
    [store],
  );

  const hotkeyRef = useHotkeys<HTMLDivElement>(
    [
      "mod+shift+t",
      "mod+shift+w",
      "mod+shift+d",
      "mod+shift+e",
      "mod+shift+p",
      "mod+shift+f",
      "mod+shift+r",
      "alt+1",
      "alt+2",
      "alt+3",
      "alt+4",
      "alt+5",
      "alt+6",
      "alt+7",
      "alt+8",
      "alt+9",
      "mod+shift+bracketright",
      "mod+shift+bracketleft",
    ],
    (_e, h) => {
      const st = store.getState();
      const k = h.keys?.join("") ?? "";
      if (h.alt && /^[1-9]$/.test(k)) {
        const t = st.tabs[Number(k) - 1];
        if (t) st.focus(t.id);
        return;
      }
      const i = st.tabs.findIndex((t) => t.id === st.activeTab);
      switch (k) {
        case "t":
          return void st.addTab();
        case "w":
          return st.closePane(st.activePane);
        case "d":
          return st.split("horizontal");
        case "e":
          return st.split("vertical");
        case "p":
          return setOverlay("palette");
        case "r":
          return setOverlay("replay");
        case "f":
          setSearchOpen(true);
          return requestAnimationFrame(() => searchInput.current?.select());
        case "bracketright":
        case "]":
          return st.focus(st.tabs[(i + 1) % st.tabs.length]!.id);
        case "bracketleft":
        case "[":
          return st.focus(st.tabs[(i - 1 + st.tabs.length) % st.tabs.length]!.id);
      }
    },
    HOTKEYS,
  );
  const setRoot = React.useCallback(
    (el: HTMLDivElement | null) => {
      rootEl.current = el;
      hotkeyRef(el);
    },
    [hotkeyRef],
  );

  const runSearch = (dir: 1 | -1, q = query) => {
    setResult(pane()?.find(q, dir, { caseSensitive }) ?? null);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    pane()?.clearSearch();
    setResult(null);
    pane()?.focus();
  };
  const closeOverlay = () => {
    setOverlay(null);
    requestAnimationFrame(() => pane()?.focus());
  };

  const active = tabs.find((t) => t.id === activeTab) ?? tabs[0]!;
  const activeTitle = active.title;
  const recording = recordings.get(activePane);
  const paneCommands = React.useMemo(
    () => history.filter((h) => h.sessionId === activePane),
    [history, activePane],
  );

  return (
    <div
      ref={setRoot}
      tabIndex={-1}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card text-crm-fg shadow-crm-raised outline-none",
        className,
      )}
      style={{ height }}
    >
      <div className="flex items-center gap-1 border-b border-crm-border px-1.5">
        <div
          role="tablist"
          aria-label="Terminal sessions"
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto py-1"
          onKeyDown={(e) => {
            const i = tabs.findIndex((t) => t.id === activeTab);
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              const d = e.key === "ArrowRight" ? 1 : -1;
              if (e.altKey) return s.moveTab(activeTab, d);
              const next = tabs[(i + d + tabs.length) % tabs.length]!;
              s.focus(next.id);
              (
                e.currentTarget.querySelector(`[data-tab="${next.id}"]`) as HTMLElement | null
              )?.focus();
            }
          }}
        >
          {tabs.map((t, i) => {
            const selected = t.id === activeTab;
            return (
              <div
                key={t.id}
                className={cn(
                  "group flex shrink-0 items-center rounded-crm pr-0.5 text-xs",
                  selected ? "bg-crm-muted text-crm-fg" : "text-crm-muted-fg hover:bg-crm-muted/50",
                )}
              >
                {renaming === t.id ? (
                  <input
                    autoFocus
                    aria-label="Tab name"
                    defaultValue={t.title}
                    onBlur={(e) => {
                      s.renameTab(t.id, e.target.value.trim());
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    className="h-7 w-24 bg-transparent px-2 outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    role="tab"
                    data-tab={t.id}
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => s.focus(t.id)}
                    onDoubleClick={() => setRenaming(t.id)}
                    onKeyDown={(e) => e.key === "F2" && setRenaming(t.id)}
                    title={`${t.title} (Alt+${i + 1}) · double-click or F2 to rename`}
                    className="h-7 max-w-40 truncate px-2.5 font-mono focus-visible:outline-2 focus-visible:outline-crm-ring"
                  >
                    {t.title}
                    {t.panes.length > 1 && <span className="ml-1 text-crm-muted-fg">⧉</span>}
                  </button>
                )}
                {tabs.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Close ${t.title}`}
                    onClick={() => s.closeTab(t.id)}
                    className="inline-flex size-5 items-center justify-center rounded opacity-0 hover:bg-crm-border group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            className={tool}
            aria-label="New tab (Ctrl+Shift+T)"
            title="New tab (Ctrl+Shift+T)"
            onClick={() => s.addTab()}
            disabled={tabs.length >= maxTabs}
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
        </div>
        <div role="toolbar" aria-label="Terminal actions" className="flex items-center">
          <button
            type="button"
            className={tool}
            aria-label="Split right (Ctrl+Shift+D)"
            title="Split right (Ctrl+Shift+D)"
            onClick={() => s.split("horizontal")}
          >
            <Columns2 className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            className={tool}
            aria-label="Split down (Ctrl+Shift+E)"
            title="Split down (Ctrl+Shift+E)"
            onClick={() => s.split("vertical")}
          >
            <Rows2 className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            className={tool}
            aria-label="Search (Ctrl+Shift+F)"
            title="Search (Ctrl+Shift+F)"
            aria-pressed={searchOpen}
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          >
            <Search className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            className={tool}
            aria-label="Command history (Ctrl+Shift+P)"
            title="Command history (Ctrl+Shift+P)"
            onClick={() => setOverlay("palette")}
          >
            <History className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            className={tool}
            aria-label="Replay session (Ctrl+Shift+R)"
            title="Replay session (Ctrl+Shift+R)"
            onClick={() => setOverlay("replay")}
          >
            <Film className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div
          role="search"
          className="flex items-center gap-1 border-b border-crm-border bg-crm-card px-2 py-1"
        >
          <input
            ref={searchInput}
            autoFocus
            aria-label="Search terminal output"
            placeholder="Find in scrollback"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              pane()?.clearSearch();
              if (e.target.value)
                setResult(pane()?.find(e.target.value, 1, { caseSensitive }) ?? null);
              else setResult(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch(e.shiftKey ? -1 : 1);
              if (e.key === "Escape") closeSearch();
            }}
            className="h-7 w-56 rounded-crm border border-crm-border bg-crm-input px-2 text-xs text-crm-fg outline-none focus-visible:border-crm-ring"
          />
          <button
            type="button"
            aria-pressed={caseSensitive}
            aria-label="Match case"
            title="Match case"
            onClick={() => {
              setCaseSensitive((c) => !c);
              pane()?.clearSearch();
              setResult(null);
            }}
            className={cn(tool, "w-8 font-mono text-[11px]", caseSensitive && "text-crm-primary")}
          >
            Aa
          </button>
          <span
            aria-live="polite"
            className="min-w-16 text-center text-[11px] tabular-nums text-crm-muted-fg"
          >
            {query ? (result ? `${result[0]} of ${result[1]}` : "No results") : ""}
          </span>
          <button
            type="button"
            className={tool}
            aria-label="Previous match"
            onClick={() => runSearch(-1)}
          >
            <ChevronUp className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            className={tool}
            aria-label="Next match"
            onClick={() => runSearch(1)}
          >
            <ChevronDown className="size-3.5" aria-hidden />
          </button>
          <button type="button" className={tool} aria-label="Close search" onClick={closeSearch}>
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {tabs.map((t) => {
          const visible = t.id === activeTab && overlay !== "replay";
          return (
            <div
              key={t.id}
              role="tabpanel"
              aria-label={t.title}
              hidden={!visible}
              className="absolute inset-0"
            >
              <Group orientation={t.orientation} className="h-full">
                {t.panes.map((p, i) => (
                  <React.Fragment key={p}>
                    {i > 0 && (
                      <Separator
                        className={cn(
                          "bg-crm-border outline-none transition-colors hover:bg-crm-primary focus-visible:bg-crm-primary",
                          t.orientation === "horizontal" ? "w-1" : "h-1",
                        )}
                      />
                    )}
                    <Panel id={p} minSize={15}>
                      <TerminalPane
                        ref={(h) => {
                          if (h) panes.current.set(p, h);
                          else panes.current.delete(p);
                        }}
                        sessionId={p}
                        shell={factory}
                        label={`${t.title} terminal ${i + 1}`}
                        active={p === activePane && t.id === activeTab}
                        visible={visible}
                        recordings={recordings}
                        theme={theme}
                        fontSize={fontSize}
                        scrollback={scrollback}
                        onCommand={handleCommand}
                        onFocus={() => s.focus(t.id, p)}
                        onTitle={(x) => s.renameTab(t.id, x)}
                      />
                    </Panel>
                  </React.Fragment>
                ))}
              </Group>
              {t.panes.length > 1 && t.id === activeTab && (
                <button
                  type="button"
                  className={cn(tool, "absolute top-1 right-1 z-10 bg-crm-card/80")}
                  aria-label="Close focused pane (Ctrl+Shift+W)"
                  title="Close focused pane (Ctrl+Shift+W)"
                  onClick={() => s.closePane(activePane)}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </div>
          );
        })}
        {overlay === "replay" && (
          <div className="absolute inset-0 z-10">
            {recording && recording.events.length ? (
              <SessionReplay
                recording={recording}
                commands={paneCommands}
                theme={theme}
                fontSize={fontSize}
                title={activeTitle}
                onClose={closeOverlay}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-crm-muted-fg">
                Nothing recorded in this pane yet.
                <button type="button" className="text-crm-primary underline" onClick={closeOverlay}>
                  Back to terminal
                </button>
              </div>
            )}
          </div>
        )}
        {overlay === "palette" && (
          <HistoryPalette
            history={history}
            onClose={closeOverlay}
            onRun={(cmd, execute) => {
              const p = pane();
              p?.send("\x15" + cmd + (execute ? "\r" : ""));
              closeOverlay();
            }}
          />
        )}
      </div>
      <div className="flex items-center justify-between border-t border-crm-border px-3 py-1 text-[10px] text-crm-muted-fg">
        <span className="font-mono">
          {tabs.length} tab{tabs.length === 1 ? "" : "s"} · {history.length} command
          {history.length === 1 ? "" : "s"} recorded
        </span>
        <span className="hidden sm:inline">
          ⌃⇧T new · ⌃⇧D split · ⌃⇧F find · ⌃⇧P history · ⌃⇧R replay · Alt+1-9 switch
        </span>
      </div>
    </div>
  );
}
