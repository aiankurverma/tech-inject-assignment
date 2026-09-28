import { PresenceIndicator } from "@/components/crm/presence-indicator";

const now = Date.now();
const min = 60_000;

const team = [
  {
    name: "Priya Shah",
    status: "online" as const,
    lastActiveAt: now - 1 * min,
    timeZone: "Asia/Kolkata",
  },
  {
    name: "Marcus Lee",
    status: "busy" as const,
    lastActiveAt: now - 3 * min,
    message: "Demo with Globex",
    emoji: "📞",
    until: now + 45 * min,
    timeZone: "America/New_York",
  },
  {
    name: "Dana Ortiz",
    status: "online" as const,
    lastActiveAt: now - 27 * min,
    timeZone: "Europe/Madrid",
  },
  {
    name: "Tom Becker",
    status: "away" as const,
    lastActiveAt: now - 8 * min,
    message: "Lunch",
    emoji: "🥪",
    until: now + 20 * min,
    timeZone: "Europe/Berlin",
  },
  {
    name: "Aiko Tanaka",
    status: "offline" as const,
    lastActiveAt: now - 5 * 60 * min,
    timeZone: "Asia/Tokyo",
  },
];

export default function Example() {
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-4 font-crm">
      <div className="flex items-center gap-3">
        <span className="text-xs text-crm-subtle">Viewing this deal</span>
        <div className="flex items-center gap-1.5">
          {team.slice(0, 3).map((m) => (
            <PresenceIndicator key={m.name} {...m} size="md" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-2">
        {team.map((m) => (
          <PresenceIndicator key={m.name} {...m} layout="card" />
        ))}
      </div>
      <div className="flex flex-col gap-2 rounded-crm border border-crm-border bg-crm-card p-3">
        <PresenceIndicator {...team[0]!} layout="inline" size="lg" />
        <PresenceIndicator {...team[4]!} layout="inline" />
      </div>
    </div>
  );
}
