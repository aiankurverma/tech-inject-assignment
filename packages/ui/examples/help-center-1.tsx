import { CreditCard, Plug, Rocket, ShieldCheck, Upload, Users } from "lucide-react";
import { HelpCenter, type HelpArticle, type HelpCategory } from "@/components/crm/help-center";

const categories: HelpCategory[] = [
  {
    id: "start",
    name: "Getting started",
    description: "Set up your workspace and first pipeline.",
    icon: <Rocket />,
  },
  {
    id: "import",
    name: "Import & export",
    description: "Move data in and out safely.",
    icon: <Upload />,
  },
  {
    id: "team",
    name: "Users & permissions",
    description: "Roles, teams and seat management.",
    icon: <Users />,
  },
  {
    id: "billing",
    name: "Billing",
    description: "Plans, invoices and payment methods.",
    icon: <CreditCard />,
  },
  {
    id: "int",
    name: "Integrations",
    description: "Gmail, Outlook, Slack and the API.",
    icon: <Plug />,
  },
  { id: "sec", name: "Security", description: "SSO, 2FA and audit logs.", icon: <ShieldCheck /> },
];

const articles: HelpArticle[] = [
  {
    id: "a1",
    categoryId: "import",
    title: "Import contacts from a CSV file",
    excerpt: "Map columns, dedupe by email and preview before importing.",
    body: "## Before you start\n\nExport your file as UTF-8 CSV. The first row must contain column headers.\n\n## Map your columns\n\nWe match headers like Email, First name and Company automatically. Unmatched columns can be mapped to custom fields or skipped.\n\n## Duplicates\n\nRows with an email that already exists update the existing contact instead of creating a new one. You can switch this to skip in the preview step.",
    updatedAt: "2026-09-12",
    views: 18420,
    tags: ["csv", "contacts", "dedupe"],
  },
  {
    id: "a2",
    categoryId: "import",
    title: "Migrate from HubSpot",
    excerpt: "Bring over contacts, companies, deals and notes in one run.",
    body: "Connect HubSpot from Settings → Data import. We copy owners, pipelines and stages, then let you review custom properties.\n\nLarge portals take up to two hours; you'll get an email when it's done.",
    updatedAt: "2026-08-30",
    views: 9120,
    tags: ["hubspot", "migration"],
  },
  {
    id: "a3",
    categoryId: "team",
    title: "Invite teammates and assign roles",
    excerpt: "Admins, managers and reps each see different data.",
    body: "Go to Settings → Members and click Invite. Pick a role: Admin (everything), Manager (their team's records) or Rep (own records).\n\nInvites expire after 7 days.",
    updatedAt: "2026-07-18",
    views: 7300,
    tags: ["roles", "seats"],
  },
  {
    id: "a4",
    categoryId: "billing",
    title: "Download invoices and update billing details",
    excerpt: "Change the billing email, VAT ID or card on file.",
    body: "Invoices live under Settings → Billing → History. Updating your VAT ID applies to the next invoice only.\n\nNeed a past invoice reissued? Contact support with the invoice number.",
    updatedAt: "2026-09-02",
    views: 5210,
    tags: ["invoice", "vat"],
  },
  {
    id: "a5",
    categoryId: "int",
    title: "Connect Gmail or Outlook",
    excerpt: "Two-way email sync and automatic activity logging.",
    body: "Open Settings → Integrations → Email and sign in with Google or Microsoft. Only emails with known contacts are logged.\n\nYou can exclude domains such as your own company.",
    updatedAt: "2026-09-20",
    views: 12650,
    tags: ["gmail", "outlook", "sync"],
  },
  {
    id: "a6",
    categoryId: "sec",
    title: "Enforce SAML single sign-on",
    excerpt: "Require Okta, Azure AD or Google SSO for every member.",
    body: "SSO is available on Enterprise. Upload your IdP metadata, test with one admin, then enforce.\n\nKeep one break-glass admin with password login in case your IdP is down.",
    updatedAt: "2026-06-11",
    views: 2440,
    tags: ["sso", "okta", "saml"],
  },
  {
    id: "a7",
    categoryId: "start",
    title: "Create your first pipeline",
    excerpt: "Stages, probabilities and required fields.",
    body: "Pipelines live under Settings → Pipelines. Add stages in the order deals move, set a win probability for forecasting, and mark fields as required per stage.",
    updatedAt: "2026-09-01",
    views: 15010,
    tags: ["pipeline", "stages"],
  },
];

export default function Example() {
  return (
    <div className="w-full max-w-3xl">
      <HelpCenter
        categories={categories}
        articles={articles}
        onVote={(id, helpful) => console.log("vote", id, helpful)}
        onContactSupport={() => console.log("open support chat")}
      />
    </div>
  );
}
