import {
  BarChart3,
  Bot,
  CalendarClock,
  Inbox,
  KanbanSquare,
  Lock,
  Mail,
  PhoneCall,
  Workflow,
} from "lucide-react";
import { FeatureGrid, type Feature } from "@/components/crm/feature-grid";

const features: Feature[] = [
  {
    id: "pipeline",
    category: "Sell",
    title: "Visual pipelines",
    description: "Drag deals across stages with weighted forecasts that update instantly.",
    icon: <KanbanSquare />,
    plan: "Free",
    highlights: ["Unlimited pipelines", "Stage probabilities", "Rotting deal alerts"],
    href: "#pipelines",
  },
  {
    id: "email",
    category: "Engage",
    title: "Two-way email sync",
    description: "Gmail and Outlook threads are logged to the right contact and deal.",
    icon: <Mail />,
    plan: "Starter",
    highlights: ["Open and click tracking", "Shared templates"],
  },
  {
    id: "sequences",
    category: "Engage",
    title: "Sequences",
    description: "Multi-step email, call and LinkedIn cadences that stop when a lead replies.",
    icon: <Workflow />,
    plan: "Growth",
    status: "new",
  },
  {
    id: "dialer",
    category: "Engage",
    title: "Power dialer",
    description: "Call from the browser with local presence numbers and automatic call logging.",
    icon: <PhoneCall />,
    plan: "Growth",
    status: "beta",
  },
  {
    id: "scheduler",
    category: "Engage",
    title: "Meeting scheduler",
    description: "Round-robin booking links that respect every rep's calendar and time zone.",
    icon: <CalendarClock />,
    plan: "Starter",
  },
  {
    id: "inbox",
    category: "Support",
    title: "Shared inbox",
    description:
      "Assign customer emails, set SLAs and see the full account history beside each ticket.",
    icon: <Inbox />,
    plan: "Growth",
  },
  {
    id: "reports",
    category: "Analyze",
    title: "Forecast and reports",
    description: "Commit, best case and pipeline roll-ups by rep, team and quarter.",
    icon: <BarChart3 />,
    plan: "Growth",
    highlights: ["Scheduled PDF reports", "Quota attainment"],
  },
  {
    id: "ai",
    category: "Analyze",
    title: "AI deal insights",
    description: "Flags deals with no next step, single-threaded contacts or slipping close dates.",
    icon: <Bot />,
    plan: "Enterprise",
    status: "soon",
  },
  {
    id: "security",
    category: "Admin",
    title: "SSO and audit log",
    description: "SAML SSO, SCIM provisioning and a 1-year audit log for compliance reviews.",
    icon: <Lock />,
    plan: "Enterprise",
  },
];

export default function Example() {
  return (
    <FeatureGrid
      eyebrow="Platform"
      title="Everything your revenue team needs"
      description="One workspace for prospecting, selling and supporting customers."
      features={features}
    />
  );
}
