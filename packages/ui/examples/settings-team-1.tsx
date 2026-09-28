import { SettingsTeam, type TeamMember } from "@/components/crm/settings-team";

const d = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const members: TeamMember[] = [
  {
    id: "u1",
    name: "Ananya Rao",
    email: "ananya@northwind.io",
    role: "owner",
    status: "active",
    team: "Leadership",
    lastActive: d(0.02),
  },
  {
    id: "u2",
    name: "Marcus Lee",
    email: "marcus@northwind.io",
    role: "admin",
    status: "active",
    team: "RevOps",
    lastActive: d(0.3),
  },
  {
    id: "u3",
    name: "Sofia Martinez",
    email: "sofia@northwind.io",
    role: "manager",
    status: "active",
    team: "Mid-market sales",
    lastActive: d(1),
  },
  {
    id: "u4",
    name: "Kenji Watanabe",
    email: "kenji@northwind.io",
    role: "member",
    status: "active",
    team: "Mid-market sales",
    lastActive: d(3),
  },
  {
    id: "u5",
    name: "Priya Shah",
    email: "priya@northwind.io",
    role: "member",
    status: "suspended",
    team: "Support",
    lastActive: d(40),
  },
  {
    id: "u6",
    name: "Leo Fischer",
    email: "leo@northwind.io",
    role: "viewer",
    status: "active",
    team: "Finance",
    lastActive: d(6),
  },
  {
    id: "u7",
    name: "dana.k",
    email: "dana.k@northwind.io",
    role: "member",
    status: "invited",
    lastActive: d(2),
  },
];

export default function Example() {
  return (
    <SettingsTeam
      className="max-w-4xl"
      defaultMembers={members}
      seatLimit={6}
      currentUserId="u2"
      onInvite={() => new Promise((r) => setTimeout(r, 600))}
    />
  );
}
