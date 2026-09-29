import * as React from "react";
import type { Field } from "react-querybuilder";
import { Flag, History, Search, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { FlagList, EnvSwitch } from "@/components/crm/pro-feature-flag-console/flag-list";
import { FlagEditor } from "@/components/crm/pro-feature-flag-console/flag-editor";
import { AuditTrail } from "@/components/crm/pro-feature-flag-console/audit-trail";
import { FlagButton, FlagModal } from "@/components/crm/pro-feature-flag-console/modal";
import { VARIANT_COLORS } from "@/components/crm/pro-feature-flag-console/rollout-slider";
import type {
  FeatureFlag,
  FlagAuditEntry,
  FlagEnvironment,
  FlagEnvironmentConfig,
} from "@/components/crm/pro-feature-flag-console/types";

export type {
  FeatureFlag,
  FlagAuditEntry,
  FlagEnvironment,
  FlagEnvironmentConfig,
  FlagVariant,
  TargetingRule,
} from "@/components/crm/pro-feature-flag-console/types";

export interface ProFeatureFlagConsoleProps {
  environments: FlagEnvironment[];
  /** Controlled flags; or use `defaultFlags`. */
  flags?: FeatureFlag[];
  defaultFlags?: FeatureFlag[];
  onFlagsChange?: (flags: FeatureFlag[]) => void;
  audit?: FlagAuditEntry[];
  defaultAudit?: FlagAuditEntry[];
  onAuditChange?: (audit: FlagAuditEntry[]) => void;
  /** Context attributes available to targeting rules (react-querybuilder fields). */
  attributes: Field[];
  /** Persist a toggle. Throw to roll back the optimistic update. */
  onToggle?: (
    flag: FeatureFlag,
    env: FlagEnvironment,
    enabled: boolean,
    comment?: string,
  ) => Promise<void> | void;
  /** Persist an environment config after the diff review. Throw to keep the draft and show the error. */
  onSave?: (
    flag: FeatureFlag,
    env: FlagEnvironment,
    config: FlagEnvironmentConfig,
    meta: { comment: string; changes: string[] },
  ) => Promise<void> | void;
  selectedFlag?: string | null;
  defaultSelectedFlag?: string | null;
  onSelectedFlagChange?: (key: string) => void;
  currentUser?: string;
  readOnly?: boolean;
  loading?: boolean;
  error?: React.ReactNode;
  onRetry?: () => void;
  height?: number;
  portalContainer?: HTMLElement | null;
  className?: string;
}

export function ProFeatureFlagConsole({
  environments,
  flags: flagsProp,
  defaultFlags,
  onFlagsChange,
  audit: auditProp,
  defaultAudit,
  onAuditChange,
  attributes,
  onToggle,
  onSave,
  selectedFlag,
  defaultSelectedFlag,
  onSelectedFlagChange,
  currentUser = "you",
  readOnly,
  loading,
  error,
  onRetry,
  height = 640,
  portalContainer,
  className,
}: ProFeatureFlagConsoleProps) {
  const store = useFeatureFlags({
    flags: flagsProp,
    defaultFlags,
    onFlagsChange,
    audit: auditProp,
    defaultAudit,
    onAuditChange,
    onToggle,
    onSave,
    currentUser,
  });

  const [query, setQuery] = React.useState("");
  const q = React.useDeferredValue(query.trim().toLowerCase());
  const [tag, setTag] = React.useState<string>("all");
  const [showArchived, setShowArchived] = React.useState(false);
  const [innerSel, setInnerSel] = React.useState<string | null>(defaultSelectedFlag ?? null);
  const selKey = selectedFlag !== undefined ? selectedFlag : innerSel;
  const select = React.useCallback(
    (k: string) => {
      if (selectedFlag === undefined) setInnerSel(k);
      onSelectedFlagChange?.(k);
    },
    [selectedFlag, onSelectedFlagChange],
  );
  const [envKey, setEnvKey] = React.useState(() => environments[0]?.key ?? "");
  const [tab, setTab] = React.useState<"targeting" | "audit">("targeting");
  const [confirmToggle, setConfirmToggle] = React.useState<{
    flag: FeatureFlag;
    env: FlagEnvironment;
    enabled: boolean;
  } | null>(null);
  const [toggleReason, setToggleReason] = React.useState("");

  const tags = React.useMemo(() => {
    const s = new Set<string>();
    for (const f of store.flags) f.tags?.forEach((t) => s.add(t));
    return [...s].sort();
  }, [store.flags]);

  const visible = React.useMemo(
    () =>
      store.flags.filter(
        (f) =>
          (showArchived || !f.archived) &&
          (tag === "all" || f.tags?.includes(tag)) &&
          (!q || f.key.includes(q) || f.name.toLowerCase().includes(q)),
      ),
    [store.flags, q, tag, showArchived],
  );

  const flag = React.useMemo(
    () => store.flags.find((f) => f.key === selKey) ?? null,
    [store.flags, selKey],
  );
  const env = environments.find((e) => e.key === envKey) ?? environments[0];

  // Audit is newest-first; index once per audit change instead of filtering per render.
  const auditByFlag = React.useMemo(() => {
    const m = new Map<string, FlagAuditEntry[]>();
    for (const e of store.audit) {
      const list = m.get(e.flagKey);
      if (list) list.push(e);
      else m.set(e.flagKey, [e]);
    }
    return m;
  }, [store.audit]);

  React.useEffect(() => {
    if (!selKey && visible[0]) select(visible[0].key);
  }, [selKey, visible, select]);

  const requestToggle = (f: FeatureFlag, e: FlagEnvironment, enabled: boolean) => {
    if (e.critical) {
      setToggleReason("");
      setConfirmToggle({ flag: f, env: e, enabled });
    } else void store.toggle(f, e, enabled);
  };

  const shell = cn(
    "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
    className,
  );

  if (error || loading) {
    return (
      <section className={shell} style={{ height }} aria-busy={loading || undefined}>
        {error ? (
          <div
            role="alert"
            className="flex flex-1 flex-col items-center justify-center gap-3 text-[13px]"
          >
            <TriangleAlert className="size-6 text-crm-danger" aria-hidden />
            {error}
            {onRetry ? <FlagButton onClick={onRetry}>Retry</FlagButton> : null}
          </div>
        ) : (
          <div className="grid flex-1 grid-cols-[minmax(300px,380px)_1fr]">
            <div className="space-y-2 border-r border-crm-border p-3">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="h-11 animate-pulse rounded-md bg-crm-raised" />
              ))}
            </div>
            <div className="space-y-3 p-4">
              <div className="h-6 w-1/3 animate-pulse rounded bg-crm-raised" />
              <div className="h-40 animate-pulse rounded bg-crm-raised" />
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={shell} style={{ height }} aria-label="Feature flags">
      {store.error ? (
        <div
          role="alert"
          className="flex items-center gap-2 border-b border-crm-danger/40 bg-crm-danger/10 px-4 py-2 text-xs text-crm-danger"
        >
          <TriangleAlert className="size-3.5" aria-hidden />
          <span className="flex-1">{store.error}</span>
          <button
            type="button"
            onClick={store.dismissError}
            aria-label="Dismiss"
            className="rounded p-0.5 hover:bg-crm-danger/20"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(320px,400px)_1fr]">
        {/* Left: flag list */}
        <div className="flex min-h-0 flex-col border-b border-crm-border md:border-b-0 md:border-r">
          <div className="space-y-2 border-b border-crm-border p-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-crm-subtle"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${store.flags.length.toLocaleString()} flags`}
                aria-label="Search flags"
                className="h-8 w-full rounded-md border border-crm-input bg-crm-bg pl-8 pr-3 text-[13px] placeholder:text-crm-subtle focus:border-crm-ring focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                aria-label="Filter by tag"
                className="h-7 min-w-0 flex-1 rounded-md border border-crm-input bg-crm-bg px-2 text-xs focus:border-crm-ring focus:outline-none"
              >
                <option value="all">All tags</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-crm-muted-fg">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="size-3.5 accent-[var(--color-crm-primary)]"
                />
                Archived
              </label>
            </div>
          </div>
          <div className="flex items-center gap-3 border-b border-crm-border bg-crm-raised px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-crm-muted-fg">
            <span className="flex-1">
              {visible.length.toLocaleString()} flag{visible.length === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2.5">
              {environments.map((e) => (
                <span key={e.key} className="w-9 truncate text-center" title={e.name}>
                  {e.name.slice(0, 4)}
                </span>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1">
            {visible.length ? (
              <FlagList
                flags={visible}
                environments={environments}
                selectedKey={selKey}
                onSelect={select}
                onToggle={requestToggle}
                pending={store.pending}
                readOnly={readOnly}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-crm-muted-fg">
                <Flag className="size-5" aria-hidden />
                {store.flags.length ? "No flags match these filters." : "No feature flags yet."}
              </div>
            )}
          </div>
        </div>

        {/* Right: detail */}
        <div className="flex min-h-0 flex-col">
          {flag && env ? (
            <>
              <div className="space-y-2 border-b border-crm-border px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[15px] font-semibold">{flag.name}</h2>
                    <p className="font-mono text-[11px] text-crm-muted-fg">{flag.key}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {flag.variants.map((v, i) => (
                      <span
                        key={v.id}
                        className="inline-flex items-center gap-1 rounded border border-crm-border px-1.5 py-0.5 font-mono text-[11px]"
                        title={v.value}
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{ background: VARIANT_COLORS[i % VARIANT_COLORS.length] }}
                        />
                        {v.name}
                      </span>
                    ))}
                  </div>
                </div>
                {flag.description ? (
                  <p className="text-xs text-crm-soft">{flag.description}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    role="tablist"
                    aria-label="Environment"
                    className="flex rounded-md border border-crm-border bg-crm-raised p-0.5"
                  >
                    {environments.map((e) => {
                      const on = flag.environments[e.key]?.enabled;
                      return (
                        <button
                          key={e.key}
                          type="button"
                          role="tab"
                          aria-selected={e.key === env.key}
                          onClick={() => setEnvKey(e.key)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-crm-ring",
                            e.key === env.key
                              ? "bg-crm-muted text-crm-fg"
                              : "text-crm-muted-fg hover:text-crm-fg",
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              on ? "bg-crm-success" : "bg-crm-faint",
                            )}
                            aria-hidden
                          />
                          {e.name}
                        </button>
                      );
                    })}
                  </div>
                  {flag.environments[env.key] ? (
                    <label className="ml-auto flex items-center gap-2 text-xs text-crm-soft">
                      {flag.environments[env.key]!.enabled
                        ? "Serving targeting"
                        : "Serving off variant"}
                      <EnvSwitch
                        checked={flag.environments[env.key]!.enabled}
                        label={`${flag.name} in ${env.name}`}
                        disabled={readOnly || flag.archived}
                        pending={store.pending.has(`${flag.key}:${env.key}`)}
                        onChange={(v) => requestToggle(flag, env, v)}
                      />
                    </label>
                  ) : null}
                </div>
                <div role="tablist" aria-label="Section" className="-mb-3 flex gap-4 text-xs">
                  {(
                    [
                      ["targeting", "Targeting & rollout", SlidersHorizontal],
                      ["audit", `Audit trail (${auditByFlag.get(flag.key)?.length ?? 0})`, History],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={tab === id}
                      onClick={() => setTab(id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 border-b-2 pb-2 pt-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crm-ring",
                        tab === id
                          ? "border-crm-primary text-crm-fg"
                          : "border-transparent text-crm-muted-fg hover:text-crm-fg",
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div role="tabpanel" className="min-h-0 flex-1">
                {tab === "targeting" ? (
                  <FlagEditor
                    key={`${flag.key}:${env.key}`}
                    flag={flag}
                    environment={env}
                    attributes={attributes}
                    readOnly={readOnly || flag.archived}
                    portalContainer={portalContainer}
                    onSave={(config, meta) => store.save(flag, env, config, meta)}
                  />
                ) : (
                  <AuditTrail
                    entries={auditByFlag.get(flag.key) ?? []}
                    environments={environments}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-crm-muted-fg">
              Select a flag to edit its targeting.
            </div>
          )}
        </div>
      </div>

      <FlagModal
        open={!!confirmToggle}
        onOpenChange={(o) => !o && setConfirmToggle(null)}
        container={portalContainer}
        title={
          confirmToggle
            ? `${confirmToggle.enabled ? "Enable" : "Disable"} ${confirmToggle.flag.key} in ${confirmToggle.env.name}?`
            : ""
        }
        description="This environment is marked critical. The change is live for all SDKs within seconds."
        footer={
          <>
            <FlagButton onClick={() => setConfirmToggle(null)}>Cancel</FlagButton>
            <FlagButton
              variant={confirmToggle?.enabled ? "primary" : "danger"}
              disabled={!toggleReason.trim()}
              onClick={() => {
                if (!confirmToggle) return;
                void store.toggle(
                  confirmToggle.flag,
                  confirmToggle.env,
                  confirmToggle.enabled,
                  toggleReason.trim(),
                );
                setConfirmToggle(null);
              }}
            >
              {confirmToggle?.enabled ? "Enable" : "Disable"}
            </FlagButton>
          </>
        }
      >
        <label htmlFor="ff-toggle-reason" className="text-[13px] font-medium">
          Reason <span className="text-crm-danger">*</span>
        </label>
        <textarea
          id="ff-toggle-reason"
          autoFocus
          rows={2}
          value={toggleReason}
          onChange={(e) => setToggleReason(e.target.value)}
          placeholder="e.g. Kill switch: checkout errors above SLO"
          className="mt-1.5 w-full resize-none rounded-md border border-crm-input bg-crm-bg px-3 py-2 text-[13px] placeholder:text-crm-subtle focus:border-crm-ring focus:outline-none"
        />
      </FlagModal>
    </section>
  );
}
