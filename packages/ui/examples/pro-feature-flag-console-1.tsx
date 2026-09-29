import * as React from "react";
import type { Field } from "react-querybuilder";
import {
  ProFeatureFlagConsole,
  type FeatureFlag,
  type FlagAuditEntry,
  type FlagEnvironment,
} from "@/components/crm/pro-feature-flag-console";

const environments: FlagEnvironment[] = [
  { key: "development", name: "Development" },
  { key: "staging", name: "Staging" },
  { key: "production", name: "Production", critical: true },
];

const attributes: Field[] = [
  { name: "user.email", label: "User email" },
  {
    name: "user.plan",
    label: "Plan",
    valueEditorType: "select",
    values: ["free", "starter", "pro", "enterprise"].map((v) => ({ name: v, label: v })),
  },
  {
    name: "user.country",
    label: "Country",
    valueEditorType: "select",
    values: ["US", "GB", "DE", "IN", "BR", "JP"].map((v) => ({ name: v, label: v })),
  },
  { name: "account.seats", label: "Seats", inputType: "number" },
  { name: "app.version", label: "App version" },
  {
    name: "device.platform",
    label: "Platform",
    valueEditorType: "select",
    values: ["web", "ios", "android"].map((v) => ({ name: v, label: v })),
  },
  {
    name: "user.beta",
    label: "Beta opt-in",
    valueEditorType: "checkbox",
    operators: [{ name: "=", label: "is" }],
    defaultValue: true,
  },
];

const areas = [
  "checkout",
  "billing",
  "search",
  "onboarding",
  "inbox",
  "reports",
  "mobile",
  "ai",
  "pipeline",
  "calendar",
];
const things = [
  "new-flow",
  "redesign",
  "v2-api",
  "smart-defaults",
  "bulk-actions",
  "dark-launch",
  "cache",
  "streaming",
  "summary",
  "kill-switch",
];
const people = ["priya", "marco", "lena", "sam", "deploy-bot"];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function build(count: number) {
  const r = rng(7);
  const now = Date.now();
  const flags: FeatureFlag[] = [];
  const audit: FlagAuditEntry[] = [];
  for (let i = 0; i < count; i++) {
    const key = `${areas[i % areas.length]}-${things[Math.floor(i / areas.length) % things.length]}${i >= 100 ? `-${Math.floor(i / 100)}` : ""}`;
    const multi = r() < 0.35;
    const variants = multi
      ? [
          { id: "control", name: "control", value: '"control"' },
          { id: "treatment-a", name: "treatment-a", value: '"a"' },
          { id: "treatment-b", name: "treatment-b", value: '"b"' },
        ]
      : [
          { id: "on", name: "on", value: "true" },
          { id: "off", name: "off", value: "false" },
        ];
    const envs: FeatureFlag["environments"] = {};
    for (const env of environments) {
      const rollout =
        env.key === "production" ? [0, 5, 10, 25, 50, 100][Math.floor(r() * 6)]! : 100;
      envs[env.key] = {
        enabled: env.key === "production" ? r() < 0.6 : r() < 0.9,
        rollout,
        split: multi ? { control: 34, "treatment-a": 33, "treatment-b": 33 } : { on: 100, off: 0 },
        offVariant: multi ? "control" : "off",
        rules:
          r() < 0.5
            ? [
                {
                  id: `r-${i}-${env.key}-1`,
                  name: "Internal staff",
                  serve: variants[multi ? 1 : 0]!.id,
                  query: {
                    combinator: "and",
                    rules: [{ field: "user.email", operator: "endsWith", value: "@acme.io" }],
                  },
                },
                {
                  id: `r-${i}-${env.key}-2`,
                  name: "Enterprise EU",
                  serve: variants[0]!.id,
                  query: {
                    combinator: "and",
                    rules: [
                      { field: "user.plan", operator: "=", value: "enterprise" },
                      { field: "user.country", operator: "in", value: "DE,GB" },
                    ],
                  },
                },
              ]
            : [],
      };
    }
    const updated = now - Math.floor(r() * 90 * 864e5);
    flags.push({
      key,
      name: key.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      description: `Controls the ${things[Math.floor(i / areas.length) % things.length]} experience in ${areas[i % areas.length]}.`,
      tags: [areas[i % areas.length]!, multi ? "experiment" : "release"],
      kind: multi ? "multivariate" : "boolean",
      variants,
      environments: envs,
      updatedAt: new Date(updated).toISOString(),
      updatedBy: people[i % people.length],
      archived: r() < 0.04,
    });
    const events = 1 + Math.floor(r() * 5);
    for (let e = 0; e < events; e++) {
      const env = environments[Math.floor(r() * environments.length)]!;
      const kind = r();
      audit.push({
        id: `a-${i}-${e}`,
        flagKey: key,
        environment: env.key,
        actor: people[Math.floor(r() * people.length)]!,
        at: new Date(updated - e * Math.floor(r() * 5 * 864e5)).toISOString(),
        action:
          kind < 0.3 ? "enabled" : kind < 0.45 ? "disabled" : kind < 0.95 ? "updated" : "created",
        comment: kind > 0.45 && kind < 0.7 ? "Ramp after error budget review" : undefined,
        changes: kind >= 0.45 && kind < 0.95 ? [`rollout: ${e * 10} → ${e * 10 + 15}`] : undefined,
      });
    }
  }
  audit.sort((a, b) => b.at.localeCompare(a.at));
  return { flags, audit };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Example() {
  const seed = React.useMemo(() => build(2_500), []);
  return (
    <div className="bg-crm-bg p-4 font-crm text-crm-fg">
      <ProFeatureFlagConsole
        environments={environments}
        defaultFlags={seed.flags}
        defaultAudit={seed.audit}
        attributes={attributes}
        defaultSelectedFlag={seed.flags[1]?.key}
        currentUser="priya"
        height={700}
        onToggle={async () => {
          await sleep(350);
        }}
        onSave={async () => {
          await sleep(600);
        }}
      />
    </div>
  );
}
