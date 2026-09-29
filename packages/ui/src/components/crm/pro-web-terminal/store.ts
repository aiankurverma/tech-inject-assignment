import { createStore, type StoreApi } from "zustand";
import type { CommandEntry, Recording } from "@/components/crm/pro-web-terminal/types";

export interface TerminalTab {
  id: string;
  title: string;
  /** One or two pane session ids. */
  panes: string[];
  orientation: "horizontal" | "vertical";
}

export interface TerminalState {
  tabs: TerminalTab[];
  activeTab: string;
  activePane: string;
  history: CommandEntry[];
  /** Mutable per-session recordings; not reactive (appended at output rate). */
  recordings: Map<string, Recording>;
  /** Bumped whenever a recording gets a new command marker, so timelines refresh cheaply. */
  recordingRev: number;
  addTab: () => string;
  closeTab: (id: string) => void;
  renameTab: (id: string, title: string) => void;
  moveTab: (id: string, dir: -1 | 1) => void;
  split: (orientation: "horizontal" | "vertical") => void;
  closePane: (sessionId: string) => void;
  focus: (tabId: string, paneId?: string) => void;
  pushCommand: (entry: CommandEntry) => void;
}

let n = 0;
const sid = () => `s${Date.now().toString(36)}${(n++).toString(36)}`;
const HISTORY_LIMIT = 1000;

export function createTerminalStore(initialTabs = 1, maxTabs = 12): StoreApi<TerminalState> {
  const tabs: TerminalTab[] = Array.from({ length: Math.max(1, initialTabs) }, (_, i) => ({
    id: `t${i}`,
    title: i === 0 ? "zsh" : `zsh ${i + 1}`,
    panes: [sid()],
    orientation: "horizontal",
  }));
  return createStore<TerminalState>()((set, get) => ({
    tabs,
    activeTab: tabs[0]!.id,
    activePane: tabs[0]!.panes[0]!,
    history: [],
    recordings: new Map(),
    recordingRev: 0,
    addTab() {
      const s = get();
      if (s.tabs.length >= maxTabs) return s.activeTab;
      const pane = sid();
      const id = `t${pane}`;
      set({
        tabs: [
          ...s.tabs,
          { id, title: `zsh ${s.tabs.length + 1}`, panes: [pane], orientation: "horizontal" },
        ],
        activeTab: id,
        activePane: pane,
      });
      return id;
    },
    closeTab(id) {
      const s = get();
      if (s.tabs.length === 1) return;
      const i = s.tabs.findIndex((t) => t.id === id);
      const tab = s.tabs[i];
      tab?.panes.forEach((p) => s.recordings.delete(p));
      const tabsLeft = s.tabs.filter((t) => t.id !== id);
      const next = s.activeTab === id ? tabsLeft[Math.max(0, i - 1)] : undefined;
      set({
        tabs: tabsLeft,
        ...(next ? { activeTab: next.id, activePane: next.panes[0] } : {}),
      });
    },
    renameTab: (id, title) =>
      set({
        tabs: get().tabs.map((t) =>
          t.id === id ? { ...t, title: title.slice(0, 40) || t.title } : t,
        ),
      }),
    moveTab(id, dir) {
      const tabs = [...get().tabs];
      const i = tabs.findIndex((t) => t.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= tabs.length) return;
      [tabs[i], tabs[j]] = [tabs[j]!, tabs[i]!];
      set({ tabs });
    },
    split(orientation) {
      const s = get();
      const pane = sid();
      set({
        tabs: s.tabs.map((t) =>
          t.id !== s.activeTab
            ? t
            : t.panes.length >= 2
              ? { ...t, orientation }
              : { ...t, orientation, panes: [...t.panes, pane] },
        ),
        activePane:
          s.tabs.find((t) => t.id === s.activeTab)!.panes.length >= 2 ? s.activePane : pane,
      });
    },
    closePane(sessionId) {
      const s = get();
      const tab = s.tabs.find((t) => t.panes.includes(sessionId));
      if (!tab) return;
      if (tab.panes.length === 1) return s.closeTab(tab.id);
      s.recordings.delete(sessionId);
      const panes = tab.panes.filter((p) => p !== sessionId);
      set({
        tabs: s.tabs.map((t) => (t.id === tab.id ? { ...t, panes } : t)),
        activePane: s.activePane === sessionId ? panes[0] : s.activePane,
      });
    },
    focus(tabId, paneId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab) return;
      set({
        activeTab: tabId,
        activePane:
          paneId ?? (tab.panes.includes(get().activePane) ? get().activePane : tab.panes[0]),
      });
    },
    pushCommand(entry) {
      const s = get();
      set({
        history: [...s.history, entry].slice(-HISTORY_LIMIT),
        recordingRev: s.recordingRev + 1,
      });
    },
  }));
}
