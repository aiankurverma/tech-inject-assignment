import * as React from "react";
import type {
  FeatureFlag,
  FlagAuditEntry,
  FlagEnvironment,
  FlagEnvironmentConfig,
} from "@/components/crm/pro-feature-flag-console/types";

interface Options {
  flags?: FeatureFlag[];
  defaultFlags?: FeatureFlag[];
  onFlagsChange?: (flags: FeatureFlag[]) => void;
  audit?: FlagAuditEntry[];
  defaultAudit?: FlagAuditEntry[];
  onAuditChange?: (audit: FlagAuditEntry[]) => void;
  onToggle?: (
    flag: FeatureFlag,
    env: FlagEnvironment,
    enabled: boolean,
    comment?: string,
  ) => Promise<void> | void;
  onSave?: (
    flag: FeatureFlag,
    env: FlagEnvironment,
    config: FlagEnvironmentConfig,
    meta: { comment: string; changes: string[] },
  ) => Promise<void> | void;
  currentUser: string;
}

const EMPTY_FLAGS: FeatureFlag[] = [];
const EMPTY_AUDIT: FlagAuditEntry[] = [];
let n = 0;
const auditId = () => `audit_${Date.now().toString(36)}_${(n++).toString(36)}`;

/**
 * Flag + audit store (controlled or uncontrolled). Toggles are optimistic and roll back on
 * failure; config saves are pessimistic (the editor keeps its draft until the backend confirms).
 */
export function useFeatureFlags(o: Options) {
  const [innerFlags, setInnerFlags] = React.useState(o.defaultFlags ?? EMPTY_FLAGS);
  const [innerAudit, setInnerAudit] = React.useState(o.defaultAudit ?? EMPTY_AUDIT);
  const flags = o.flags ?? innerFlags;
  const audit = o.audit ?? innerAudit;
  const ref = React.useRef({ flags, audit, o });
  ref.current = { flags, audit, o };
  const [pending, setPending] = React.useState<Set<string>>(() => new Set());
  const [error, setError] = React.useState<string | null>(null);

  const setFlags = React.useCallback((next: FeatureFlag[]) => {
    if (!ref.current.o.flags) setInnerFlags(next);
    ref.current.o.onFlagsChange?.(next);
  }, []);
  const pushAudit = React.useCallback((entry: FlagAuditEntry) => {
    const next = [entry, ...ref.current.audit];
    if (!ref.current.o.audit) setInnerAudit(next);
    ref.current.o.onAuditChange?.(next);
  }, []);

  const patchEnv = (
    list: FeatureFlag[],
    key: string,
    env: string,
    patch: Partial<FlagEnvironmentConfig>,
    user: string,
  ) =>
    list.map((f) =>
      f.key === key && f.environments[env]
        ? {
            ...f,
            updatedAt: new Date().toISOString(),
            updatedBy: user,
            environments: { ...f.environments, [env]: { ...f.environments[env]!, ...patch } },
          }
        : f,
    );

  const toggle = React.useCallback(
    async (flag: FeatureFlag, env: FlagEnvironment, enabled: boolean, comment?: string) => {
      const id = `${flag.key}:${env.key}`;
      const { o: opts } = ref.current;
      const before = ref.current.flags;
      setError(null);
      setPending((p) => new Set(p).add(id));
      setFlags(patchEnv(before, flag.key, env.key, { enabled }, opts.currentUser));
      try {
        await opts.onToggle?.(flag, env, enabled, comment);
        pushAudit({
          id: auditId(),
          flagKey: flag.key,
          environment: env.key,
          actor: opts.currentUser,
          at: new Date().toISOString(),
          action: enabled ? "enabled" : "disabled",
          comment,
        });
      } catch (e) {
        // Roll back only this flag/env, keeping any other edits made meanwhile.
        const prev =
          before.find((f) => f.key === flag.key)?.environments[env.key]?.enabled ?? !enabled;
        setFlags(
          patchEnv(ref.current.flags, flag.key, env.key, { enabled: prev }, opts.currentUser),
        );
        setError(
          `Could not update ${flag.key} in ${env.name}: ${e instanceof Error ? e.message : "request failed"}`,
        );
      } finally {
        setPending((p) => {
          const next = new Set(p);
          next.delete(id);
          return next;
        });
      }
    },
    [setFlags, pushAudit],
  );

  const save = React.useCallback(
    async (
      flag: FeatureFlag,
      env: FlagEnvironment,
      config: FlagEnvironmentConfig,
      meta: { comment: string; changes: string[] },
    ) => {
      const { o: opts } = ref.current;
      await opts.onSave?.(flag, env, config, meta);
      const rest: Partial<FlagEnvironmentConfig> = { ...config };
      delete rest.enabled;
      setFlags(patchEnv(ref.current.flags, flag.key, env.key, rest, opts.currentUser));
      pushAudit({
        id: auditId(),
        flagKey: flag.key,
        environment: env.key,
        actor: opts.currentUser,
        at: new Date().toISOString(),
        action: "updated",
        comment: meta.comment || undefined,
        changes: meta.changes,
      });
    },
    [setFlags, pushAudit],
  );

  return { flags, audit, pending, error, dismissError: () => setError(null), toggle, save };
}
