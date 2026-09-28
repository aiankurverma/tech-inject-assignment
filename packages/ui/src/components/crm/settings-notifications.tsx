import * as React from "react";
import { BellOff, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { Select } from "@/components/crm/select";
import { SettingsGroup, SettingsRow } from "@/components/crm/settings-row";
import { Switch } from "@/components/crm/switch";

export type NotificationChannel = "email" | "inApp" | "push" | "slack";

export interface NotificationEvent {
  key: string;
  label: string;
  group: string;
  description?: string;
  /** Channels that cannot be turned off (e.g. security alerts by email). */
  required?: NotificationChannel[];
}

export interface NotificationPrefs {
  matrix: Record<string, NotificationChannel[]>;
  digest: "off" | "daily" | "weekly";
  quietHours: { enabled: boolean; start: string; end: string; timezone: string };
  pausedAll: boolean;
}

export interface SettingsNotificationsProps {
  events: NotificationEvent[];
  value?: NotificationPrefs;
  defaultValue?: NotificationPrefs;
  onChange?: (prefs: NotificationPrefs) => void;
  /** Channels the workspace has enabled (e.g. hide Slack when not connected). */
  channels?: NotificationChannel[];
  onSave?: (prefs: NotificationPrefs) => Promise<void> | void;
  className?: string;
}

const CH_LABEL: Record<NotificationChannel, string> = {
  email: "Email",
  inApp: "In-app",
  push: "Mobile push",
  slack: "Slack",
};

const toMin = (t: string) => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Length of the quiet window in minutes, handling windows that cross midnight. */
export function quietWindowMinutes(start: string, end: string) {
  const d = toMin(end) - toMin(start);
  return d <= 0 ? d + 1440 : d;
}

const EMPTY: NotificationPrefs = {
  matrix: {},
  digest: "daily",
  quietHours: { enabled: false, start: "20:00", end: "08:00", timezone: "UTC" },
  pausedAll: false,
};

/** Notification preferences: grouped event x channel matrix with row/column toggles, required channels, digest, quiet hours across midnight, pause-all, dirty save. */
export function SettingsNotifications({
  events,
  value,
  defaultValue = EMPTY,
  onChange,
  channels = ["email", "inApp", "push", "slack"],
  onSave,
  className,
}: SettingsNotificationsProps) {
  const [inner, setInner] = React.useState(defaultValue);
  const prefs = value ?? inner;
  const [saved, setSaved] = React.useState(prefs);
  const [saving, setSaving] = React.useState(false);
  const set = (next: NotificationPrefs) => {
    if (value === undefined) setInner(next);
    onChange?.(next);
  };

  const isOn = (ev: NotificationEvent, ch: NotificationChannel) =>
    (ev.required ?? []).includes(ch) || (prefs.matrix[ev.key] ?? []).includes(ch);

  const setCell = (
    m: NotificationPrefs["matrix"],
    key: string,
    ch: NotificationChannel,
    on: boolean,
  ) => {
    const cur = new Set(m[key] ?? []);
    if (on) cur.add(ch);
    else cur.delete(ch);
    return { ...m, [key]: channels.filter((c) => cur.has(c)) };
  };

  function toggleColumn(ch: NotificationChannel, subset: NotificationEvent[]) {
    const editable = subset.filter((e) => !(e.required ?? []).includes(ch));
    const allOn = editable.every((e) => isOn(e, ch));
    set({
      ...prefs,
      matrix: editable.reduce((m, e) => setCell(m, e.key, ch, !allOn), prefs.matrix),
    });
  }

  const groups = Array.from(new Set(events.map((e) => e.group)));
  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);
  const qh = prefs.quietHours;
  const qhInvalid = qh.enabled && qh.start === qh.end;
  const qhHours = (quietWindowMinutes(qh.start, qh.end) / 60).toFixed(1).replace(/\.0$/, "");
  const activeCount = events.reduce((n, e) => n + channels.filter((c) => isOn(e, c)).length, 0);

  async function save() {
    setSaving(true);
    try {
      await onSave?.(prefs);
      setSaved(prefs);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cn("flex flex-col gap-5 font-crm", className)} aria-labelledby="notif-h">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Settings</p>
          <h2 id="notif-h" className="text-lg font-semibold text-crm-fg">
            Notifications
          </h2>
          <p className="text-xs text-crm-soft">
            {activeCount} active alerts across {channels.length} channels
          </p>
        </div>
        <div className="flex gap-2">
          <Button disabled={!dirty} onClick={() => set(saved)}>
            Reset
          </Button>
          <Button variant="primary" disabled={!dirty || qhInvalid} loading={saving} onClick={save}>
            Save preferences
          </Button>
        </div>
      </header>

      <SettingsGroup>
        <SettingsRow
          icon={<BellOff />}
          label="Pause all notifications"
          htmlFor="notif-pause"
          description="Required security alerts still get through."
          control={
            <Switch
              id="notif-pause"
              checked={prefs.pausedAll}
              onCheckedChange={(v) => set({ ...prefs, pausedAll: v })}
            />
          }
        />
        <SettingsRow
          label="Email digest"
          description="Bundle low-priority updates into one email."
          control={
            <Select
              aria-label="Email digest"
              className="w-32"
              value={prefs.digest}
              onValueChange={(v) => set({ ...prefs, digest: v as NotificationPrefs["digest"] })}
              options={[
                { value: "off", label: "Off" },
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
              ]}
            />
          }
        />
        <SettingsRow
          icon={<Moon />}
          label="Quiet hours"
          htmlFor="notif-qh"
          description={
            qh.enabled
              ? qhInvalid
                ? "Start and end cannot be the same."
                : `Push and Slack are held for ${qhHours}h (${qh.timezone}).`
              : "Hold push and Slack alerts overnight."
          }
          control={
            <div className="flex items-center gap-2">
              {qh.enabled ? (
                <>
                  <input
                    type="time"
                    aria-label="Quiet hours start"
                    value={qh.start}
                    onChange={(e) =>
                      set({ ...prefs, quietHours: { ...qh, start: e.target.value } })
                    }
                    className="h-8 rounded-crm border border-crm-input/60 bg-crm-raised px-2 text-xs text-crm-fg [color-scheme:dark]"
                  />
                  <span className="text-xs text-crm-subtle">to</span>
                  <input
                    type="time"
                    aria-label="Quiet hours end"
                    aria-invalid={qhInvalid || undefined}
                    value={qh.end}
                    onChange={(e) => set({ ...prefs, quietHours: { ...qh, end: e.target.value } })}
                    className="h-8 rounded-crm border border-crm-input/60 bg-crm-raised px-2 text-xs text-crm-fg [color-scheme:dark] aria-[invalid=true]:border-crm-danger"
                  />
                </>
              ) : null}
              <Switch
                id="notif-qh"
                checked={qh.enabled}
                onCheckedChange={(v) => set({ ...prefs, quietHours: { ...qh, enabled: v } })}
              />
            </div>
          }
        />
      </SettingsGroup>

      <div
        className={cn(
          "overflow-x-auto rounded-xl border border-crm-border bg-crm-card shadow-crm-raised",
          prefs.pausedAll && "opacity-50",
        )}
      >
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Notification channels per event</caption>
          <thead>
            <tr className="border-b border-crm-border text-xs text-crm-subtle">
              <th scope="col" className="px-4 py-2.5 text-left font-medium">
                Event
              </th>
              {channels.map((c) => (
                <th key={c} scope="col" className="px-2 py-2.5 font-medium">
                  <button
                    type="button"
                    disabled={prefs.pausedAll}
                    onClick={() => toggleColumn(c, events)}
                    className="hover:text-crm-fg"
                    aria-label={`Toggle ${CH_LABEL[c]} for all events`}
                  >
                    {CH_LABEL[c]}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => {
            const rows = events.filter((e) => e.group === g);
            return (
              <tbody
                key={g}
                className="divide-y divide-crm-border border-b border-crm-border last:border-0"
              >
                <tr>
                  <th
                    colSpan={channels.length + 1}
                    scope="colgroup"
                    className="bg-crm-raised/40 px-4 py-1.5 text-left"
                  >
                    <span className="crm-eyebrow text-crm-subtle">{g}</span>
                  </th>
                </tr>
                {rows.map((ev) => (
                  <tr key={ev.key}>
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">
                      <span className="block text-crm-fg">{ev.label}</span>
                      {ev.description ? (
                        <span className="text-xs text-crm-subtle">{ev.description}</span>
                      ) : null}
                    </th>
                    {channels.map((c) => {
                      const req = (ev.required ?? []).includes(c);
                      return (
                        <td key={c} className="px-2 py-2.5 text-center">
                          <Checkbox
                            aria-label={`${ev.label} via ${CH_LABEL[c]}${req ? " (required)" : ""}`}
                            checked={isOn(ev, c)}
                            disabled={req || prefs.pausedAll}
                            onCheckedChange={(v) =>
                              set({
                                ...prefs,
                                matrix: setCell(prefs.matrix, ev.key, c, v === true),
                              })
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
    </section>
  );
}
