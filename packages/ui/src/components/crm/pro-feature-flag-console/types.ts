import type { Field, RuleGroupType } from "react-querybuilder";

export interface FlagEnvironment {
  key: string;
  name: string;
  /** Production-like environments ask for a reason before toggling. */
  critical?: boolean;
}

export interface FlagVariant {
  id: string;
  name: string;
  /** Payload served to SDKs, JSON-encoded. */
  value: string;
}

export interface TargetingRule {
  id: string;
  name: string;
  query: RuleGroupType;
  /** Variant id served when the rule matches. */
  serve: string;
}

export interface FlagEnvironmentConfig {
  enabled: boolean;
  /** Share of remaining (non-targeted) traffic that enters the rollout, 0-100. */
  rollout: number;
  /** Variant weights for the rollout, keyed by variant id, summing to 100. */
  split: Record<string, number>;
  rules: TargetingRule[];
  /** Variant served when the flag is off or the user is outside the rollout. */
  offVariant: string;
}

export interface FeatureFlag {
  key: string;
  name: string;
  description?: string;
  tags?: string[];
  kind: "boolean" | "multivariate";
  variants: FlagVariant[];
  environments: Record<string, FlagEnvironmentConfig>;
  updatedAt: string;
  updatedBy?: string;
  archived?: boolean;
}

export type AuditAction = "enabled" | "disabled" | "updated" | "created";

export interface FlagAuditEntry {
  id: string;
  flagKey: string;
  environment: string;
  actor: string;
  at: string;
  action: AuditAction;
  comment?: string;
  /** Human readable change lines ("rollout: 20 → 50"). */
  changes?: string[];
}

export type TargetingAttribute = Field;
