import { SettingsApiKeys, type ApiKey, type ApiScope } from "@/components/crm/settings-api-keys";

const day = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

const scopes: ApiScope[] = [
  { key: "contacts:read", label: "Read contacts" },
  { key: "contacts:write", label: "Create and update contacts", sensitive: true },
  { key: "deals:read", label: "Read deals" },
  { key: "deals:write", label: "Create and update deals", sensitive: true },
  { key: "reports:read", label: "Read reports" },
  { key: "webhooks:manage", label: "Manage webhooks", sensitive: true },
];

const keys: ApiKey[] = [
  {
    id: "k1",
    name: "Zapier production",
    prefix: "kb_live_3f9a",
    scopes: ["contacts:read", "contacts:write", "deals:read", "deals:write"],
    createdAt: iso(-120),
    createdBy: "Marcus Lee",
    lastUsedAt: iso(0),
    expiresAt: iso(245),
  },
  {
    id: "k2",
    name: "Data warehouse sync",
    prefix: "kb_live_8c21",
    scopes: ["contacts:read", "deals:read", "reports:read"],
    createdAt: iso(-80),
    createdBy: "Ananya Rao",
    lastUsedAt: iso(-1),
    expiresAt: iso(9),
  },
  {
    id: "k3",
    name: "Old website form",
    prefix: "kb_live_11de",
    scopes: ["contacts:write"],
    createdAt: iso(-400),
    createdBy: "Sofia Martinez",
    lastUsedAt: iso(-60),
    expiresAt: iso(-35),
  },
  {
    id: "k4",
    name: "Hackathon test",
    prefix: "kb_test_77aa",
    scopes: ["deals:read"],
    createdAt: iso(-30),
    createdBy: "Kenji Watanabe",
    revoked: true,
  },
];

export default function Example() {
  return (
    <SettingsApiKeys
      className="max-w-5xl"
      scopes={scopes}
      defaultKeys={keys}
      onCreate={async (input) => {
        await new Promise((r) => setTimeout(r, 600));
        const rand = Math.random().toString(36).slice(2, 14);
        return {
          secret: `kb_live_${rand}${Math.random().toString(36).slice(2, 22)}`,
          key: {
            id: rand,
            name: input.name,
            prefix: `kb_live_${rand.slice(0, 4)}`,
            scopes: input.scopes,
            createdAt: new Date().toISOString(),
            createdBy: "You",
            expiresAt: input.expiresInDays ? iso(input.expiresInDays) : undefined,
          },
        };
      }}
    />
  );
}
