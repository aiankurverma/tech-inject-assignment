import * as React from "react";
import { Archive, Copy, ExternalLink, Flag, Mail, Pencil, Trash2, UserPlus } from "lucide-react";
import { ContextMenu, type ContextMenuEntry } from "@/components/crm/context-menu";

interface Deal {
  id: string;
  name: string;
  amount: number;
  stage: string;
  owner: string;
  flagged: boolean;
}

const initial: Deal[] = [
  {
    id: "D-1042",
    name: "Acme Logistics – Fleet expansion",
    amount: 62500,
    stage: "Negotiation",
    owner: "Maya Chen",
    flagged: false,
  },
  {
    id: "D-1043",
    name: "Globex – Annual renewal",
    amount: 184000,
    stage: "Commit",
    owner: "Arjun Patel",
    flagged: true,
  },
  {
    id: "D-1047",
    name: "Initech – Pilot",
    amount: 12000,
    stage: "Discovery",
    owner: "Maya Chen",
    flagged: false,
  },
  {
    id: "D-1051",
    name: "Umbrella Health – Clinics rollout",
    amount: 96400,
    stage: "Proposal",
    owner: "Leo Grant",
    flagged: false,
  },
];
const owners = ["Maya Chen", "Arjun Patel", "Leo Grant"];
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function Example() {
  const [deals, setDeals] = React.useState(initial);
  const [log, setLog] = React.useState(
    "Right-click a row, long-press on touch, or focus a row and press Shift+F10.",
  );
  const update = (id: string, patch: Partial<Deal>) =>
    setDeals((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const menuFor = (target: HTMLElement): ContextMenuEntry[] => {
    const id = target.closest<HTMLElement>("[data-deal]")?.dataset.deal;
    const deal = deals.find((d) => d.id === id);
    if (!deal) return [];
    return [
      { type: "label", id: "l", label: `${deal.id} · ${deal.stage}` },
      {
        id: "open",
        label: "Open deal",
        icon: <ExternalLink />,
        shortcut: "↵",
        onSelect: () => setLog(`Opened ${deal.name}`),
      },
      {
        id: "edit",
        label: "Edit",
        icon: <Pencil />,
        shortcut: "E",
        onSelect: () => setLog(`Editing ${deal.id}`),
      },
      {
        id: "copy",
        label: "Copy link",
        icon: <Copy />,
        onSelect: () => setLog(`Copied link to ${deal.id}`),
      },
      {
        id: "email",
        label: "Email owner",
        icon: <Mail />,
        onSelect: () => setLog(`Drafted email to ${deal.owner}`),
      },
      {
        type: "submenu",
        id: "assign",
        label: "Reassign",
        icon: <UserPlus />,
        items: owners.map((o) => ({
          id: o,
          label: o,
          disabled: o === deal.owner,
          onSelect: () => {
            update(deal.id, { owner: o });
            setLog(`${deal.id} reassigned to ${o}`);
          },
        })),
      },
      {
        type: "checkbox",
        id: "flag",
        label: "Flag for review",
        checked: deal.flagged,
        onCheckedChange: (v) => update(deal.id, { flagged: v }),
      },
      { type: "separator", id: "s" },
      {
        id: "archive",
        label: "Archive",
        icon: <Archive />,
        onSelect: () => setLog(`${deal.id} archived`),
      },
      {
        id: "delete",
        label: deal.stage === "Commit" ? "Delete (locked in Commit)" : "Delete",
        icon: <Trash2 />,
        destructive: true,
        disabled: deal.stage === "Commit",
        onSelect: () => {
          setDeals((d) => d.filter((x) => x.id !== deal.id));
          setLog(`${deal.id} deleted`);
        },
      },
    ];
  };

  const total = deals.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="w-full max-w-[720px] font-crm">
      <ContextMenu items={menuFor}>
        <ul className="divide-y divide-crm-border overflow-hidden rounded-xl border border-crm-border bg-crm-card">
          {deals.map((d) => (
            <li
              key={d.id}
              data-deal={d.id}
              tabIndex={0}
              className="flex items-center gap-3 px-4 py-3 text-sm outline-none select-none hover:bg-crm-raised focus-visible:bg-crm-raised"
            >
              {d.flagged ? (
                <Flag className="size-3.5 text-crm-warning" aria-label="Flagged" />
              ) : (
                <span className="w-3.5" />
              )}
              <span className="min-w-0 flex-1 truncate text-crm-fg">{d.name}</span>
              <span className="hidden text-xs text-crm-subtle sm:inline">{d.owner}</span>
              <span className="w-24 text-right text-crm-soft tabular-nums">
                {usd.format(d.amount)}
              </span>
            </li>
          ))}
          {deals.length === 0 ? (
            <li className="px-4 py-6 text-center text-xs text-crm-subtle">No deals left.</li>
          ) : null}
        </ul>
      </ContextMenu>
      <div className="mt-3 flex justify-between text-xs text-crm-subtle">
        <p aria-live="polite">{log}</p>
        <p className="tabular-nums">Pipeline {usd.format(total)}</p>
      </div>
    </div>
  );
}
