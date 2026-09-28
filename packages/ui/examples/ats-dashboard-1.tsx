import { AtsDashboard, type Requisition } from "@/components/crm/ats-dashboard";

const reqs: Requisition[] = [
  {
    id: "R-104",
    title: "Senior Backend Engineer",
    department: "Engineering",
    recruiter: "Nora Patel",
    openedAt: "2026-07-14",
    targetDays: 60,
    headcount: 2,
    funnel: { applied: 412, screen: 96, interview: 31, offer: 4, hired: 1 },
    sources: { LinkedIn: 220, Referral: 38, "Careers page": 120, Agency: 34 },
    offersExtended: 4,
    offersAccepted: 1,
    daysToHire: [52],
  },
  {
    id: "R-117",
    title: "Product Designer",
    department: "Design",
    recruiter: "Leo Grant",
    openedAt: "2026-08-20",
    targetDays: 45,
    headcount: 1,
    funnel: { applied: 188, screen: 40, interview: 12, offer: 1, hired: 0 },
    sources: { LinkedIn: 90, Dribbble: 60, Referral: 14, "Careers page": 24 },
    offersExtended: 1,
    offersAccepted: 0,
  },
  {
    id: "R-121",
    title: "Account Executive, Mid-Market",
    department: "Sales",
    recruiter: "Nora Patel",
    openedAt: "2026-06-02",
    targetDays: 50,
    headcount: 3,
    funnel: { applied: 305, screen: 88, interview: 26, offer: 5, hired: 2 },
    sources: { LinkedIn: 170, Referral: 55, Agency: 80 },
    offersExtended: 5,
    offersAccepted: 2,
    daysToHire: [41, 63],
  },
  {
    id: "R-126",
    title: "Customer Success Manager",
    department: "Sales",
    recruiter: "Leo Grant",
    openedAt: "2026-09-08",
    targetDays: 40,
    headcount: 1,
    funnel: { applied: 96, screen: 22, interview: 6, offer: 0, hired: 0 },
    sources: { LinkedIn: 50, "Careers page": 38, Referral: 8 },
  },
];

export default function Example() {
  return (
    <AtsDashboard
      className="w-[960px]"
      requisitions={reqs}
      now={new Date("2026-09-28")}
      onOpenRequisition={(r) => console.log("open", r.id)}
    />
  );
}
