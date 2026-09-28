import { CallLog, type CallRecord } from "@/components/crm/call-log";

const maya = { name: "Maya Chen" };
const leo = { name: "Leo Park" };

const calls: CallRecord[] = [
  {
    id: "c1",
    direction: "outbound",
    outcome: "connected",
    duration: 1265,
    at: "2026-09-28T15:12:00Z",
    contact: { name: "Dana Whitfield", company: "Northwind", phone: "+1 415 555 0132" },
    rep: maya,
    notes:
      "Walked through renewal options. Wants 2-year term; procurement joins Thursday.\nNext: revised quote by Tuesday.",
  },
  {
    id: "c2",
    direction: "outbound",
    outcome: "voicemail",
    duration: 0,
    at: "2026-09-28T14:40:00Z",
    contact: { name: "Rahul Iyer", company: "Northwind", phone: "+1 415 555 0190" },
    rep: maya,
    notes: "Left VM re: PO timeline.",
  },
  {
    id: "c3",
    direction: "inbound",
    outcome: "connected",
    duration: 312,
    at: "2026-09-28T13:05:00Z",
    contact: { name: "Priya Nair", company: "Globex", phone: "+44 20 7946 0958" },
    rep: leo,
  },
  {
    id: "c4",
    direction: "outbound",
    outcome: "no_answer",
    duration: 0,
    at: "2026-09-27T17:22:00Z",
    contact: { name: "Tom Becker", company: "Initech", phone: "+1 212 555 0147" },
    rep: leo,
  },
  {
    id: "c5",
    direction: "inbound",
    outcome: "no_answer",
    duration: 0,
    at: "2026-09-27T16:10:00Z",
    contact: { name: "Unknown caller", phone: "+1 646 555 0100" },
    rep: maya,
  },
  {
    id: "c6",
    direction: "outbound",
    outcome: "connected",
    duration: 4020,
    at: "2026-09-27T10:00:00Z",
    contact: { name: "Sofia Alvarez", company: "Umbrella", phone: "+34 91 555 0199" },
    rep: maya,
    notes: "Deep-dive on integrations. Needs Snowflake sync and SCIM.",
  },
  {
    id: "c7",
    direction: "outbound",
    outcome: "busy",
    duration: 0,
    at: "2026-09-26T09:30:00Z",
    contact: { name: "Ken Watanabe", company: "Hooli", phone: "+81 3 5555 0123" },
    rep: leo,
  },
];

export default function Example() {
  return (
    <div className="w-full max-w-[820px]">
      <CallLog defaultCalls={calls} currentRep={maya} />
    </div>
  );
}
