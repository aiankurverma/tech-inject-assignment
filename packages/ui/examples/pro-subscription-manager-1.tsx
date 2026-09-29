import {
  ProSubscriptionManager,
  previewChange,
  type Plan,
  type RetentionOffer,
  type Subscription,
  type SubscriptionApi,
  type TimelineEvent,
} from "@/components/crm/pro-subscription-manager";

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    rank: 1,
    prices: { month: 1200, year: 12000 },
    features: ["Pipeline & contacts", "Email sync", "5 GB storage"],
    maxSeats: 10,
  },
  {
    id: "growth",
    name: "Growth",
    rank: 2,
    prices: { month: 2900, year: 29000 },
    features: ["Everything in Starter", "Sequences & automations", "Forecasting", "Custom fields"],
    minSeats: 3,
  },
  {
    id: "scale",
    name: "Scale",
    rank: 3,
    prices: { month: 5900, year: 59000 },
    features: ["Everything in Growth", "SSO & SCIM", "Audit log", "Sandbox"],
    minSeats: 10,
  },
  {
    id: "legacy-pro",
    name: "Pro (2022)",
    rank: 2,
    prices: { month: 2500, year: 25000 },
    features: ["Grandfathered"],
    legacy: true,
  },
];

const offers: RetentionOffer[] = [
  {
    id: "save-30",
    title: "30% off for 3 months",
    description: "Stay on Growth and we'll take 30% off your next three invoices.",
    discountBp: 3000,
    months: 3,
  },
  {
    id: "save-15",
    title: "15% off for 2 months",
    description: "Give us two more months at 15% off while we ship what you need.",
    discountBp: 1500,
    months: 2,
  },
];

const DAY = 86_400_000;
const now = Date.now();

// Two years of realistic billing history (monthly invoices, seat changes, an upgrade).
function history(): TimelineEvent[] {
  const ev: TimelineEvent[] = [
    {
      id: "e0",
      at: new Date(now - 730 * DAY).toISOString(),
      kind: "created",
      title: "Subscribed to Starter",
      detail: "5 seats · monthly",
    },
    {
      id: "e1",
      at: new Date(now - 400 * DAY).toISOString(),
      kind: "upgrade",
      title: "Upgraded to Growth",
      detail: "Prorated $412.18 charged",
    },
  ];
  for (let m = 24; m >= 1; m--) {
    ev.push({
      id: `inv${m}`,
      at: new Date(now - m * 30 * DAY).toISOString(),
      kind: "invoice",
      title: `Invoice INV-${String(4120 + 24 - m)} paid`,
      detail: `$${(m > 13 ? 60 : 29 * (18 + ((24 - m) % 7))).toLocaleString()}.00 · Visa`,
    });
    if (m % 5 === 0)
      ev.push({
        id: `seat${m}`,
        at: new Date(now - m * 30 * DAY + DAY).toISOString(),
        kind: "seats",
        title: `Seats changed to ${18 + (m % 4)}`,
        detail: "Added by ops@northwind.example",
      });
  }
  return ev;
}

let db: Subscription = {
  id: "sub_1Q84",
  customer: "Northwind Logistics",
  planId: "growth",
  interval: "month",
  seats: 22,
  currency: "USD",
  status: "active",
  currentPeriodStart: new Date(now - 11 * DAY).toISOString(),
  currentPeriodEnd: new Date(now + 19 * DAY).toISOString(),
  creditBalance: 1850,
  taxRateBp: 825,
  events: history(),
};

const planMap = new Map(plans.map((p) => [p.id, p]));
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 450));
let n = 0;
const log = (kind: TimelineEvent["kind"], title: string, detail?: string) => {
  db = {
    ...db,
    events: [...db.events, { id: `x${n++}`, at: new Date().toISOString(), kind, title, detail }],
  };
};

// In-memory stand-in for your billing backend.
const api: SubscriptionApi = {
  getSubscription: () => wait(db),
  changePlan: async (_id, input) => {
    const p = previewChange(db, planMap, input);
    const name = planMap.get(input.planId)!.name;
    if (input.timing === "period_end") {
      db = {
        ...db,
        scheduledChange: { planId: input.planId, interval: input.interval, seats: input.seats },
      };
      log("downgrade", `Scheduled switch to ${name}`, `${input.seats} seats at renewal`);
    } else {
      db = {
        ...db,
        planId: input.planId,
        interval: input.interval,
        seats: input.seats,
        currentPeriodEnd: p.nextBillingDate,
        creditBalance: Math.max(0, db.creditBalance - Math.min(0, p.dueNow)),
      };
      log(
        p.direction === "downgrade" ? "downgrade" : "upgrade",
        `Changed to ${name}`,
        `${input.seats} seats · ${input.interval}ly`,
      );
    }
    return wait(db);
  },
  updateSeats: async (_id, seats) => {
    db = { ...db, seats };
    log("seats", `Seats changed to ${seats}`);
    return wait(db);
  },
  pause: async (_id, { resumesAt }) => {
    db = { ...db, status: "paused", resumesAt };
    log("paused", "Subscription paused");
    return wait(db);
  },
  resume: async () => {
    db = { ...db, status: "active", resumesAt: null };
    log("resumed", "Subscription resumed");
    return wait(db);
  },
  cancel: async (_id, { reason, atPeriodEnd }) => {
    db = { ...db, status: "canceling", resumesAt: atPeriodEnd ? null : db.resumesAt };
    log("cancel", "Cancellation requested", `Reason: ${reason}`);
    return wait(db);
  },
  acceptOffer: async (_id, offerId) => {
    const o = offers.find((x) => x.id === offerId)!;
    db = {
      ...db,
      discountBp: o.discountBp,
      discountEndsAt: new Date(now + o.months * 30 * DAY).toISOString(),
    };
    log("offer", `Accepted "${o.title}"`);
    return wait(db);
  },
  reactivate: async () => {
    db = { ...db, status: "active", scheduledChange: null };
    log("resumed", "Pending change removed");
    return wait(db);
  },
};

export default function Example() {
  return (
    <div className="w-full max-w-[880px] p-4">
      <ProSubscriptionManager
        api={api}
        subscriptionId="sub_1Q84"
        plans={plans}
        retentionOffers={offers}
        usedSeats={19}
      />
    </div>
  );
}
