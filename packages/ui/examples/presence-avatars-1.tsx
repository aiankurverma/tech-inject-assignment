import { PresenceAvatars, type PresenceViewer } from "@/components/crm/presence-avatars";

const now = new Date();
const ago = (min: number) => new Date(now.getTime() - min * 60_000);

const viewers: PresenceViewer[] = [
  { id: "u1", name: "Alex Santos", status: "online", lastActiveAt: ago(0) },
  {
    id: "u2",
    name: "Priya Nair",
    status: "online",
    activity: "Editing Amount",
    lastActiveAt: ago(0),
    color: "#4124fb",
  },
  { id: "u3", name: "Tom Becker", status: "busy", activity: "On a call", lastActiveAt: ago(2) },
  {
    id: "u4",
    name: "Lena Park",
    status: "online",
    activity: "Viewing Notes",
    lastActiveAt: ago(9),
  },
  { id: "u5", name: "Jensen Ackles", status: "online", lastActiveAt: ago(1), color: "#16c89e" },
  { id: "u6", name: "Grace Miller", status: "offline" },
];

export default function Example() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-crm-border bg-crm-card px-4 py-3 font-crm">
      <div>
        <p className="text-sm font-medium text-crm-fg">Acme Corp · Q4 renewal</p>
        <p className="crm-caption text-crm-soft">Deal · $86,400</p>
      </div>
      <PresenceAvatars viewers={viewers} currentUserId="u1" now={now} max={3} />
    </div>
  );
}
