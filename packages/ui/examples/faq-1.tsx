import { Button } from "@/components/crm/button";
import { Faq, type FaqItem } from "@/components/crm/faq";

const items: FaqItem[] = [
  {
    id: "trial",
    category: "Billing",
    question: "How does the 14-day trial work?",
    answer:
      "You get every Pro feature for 14 days with no card required.\n\nOn day 15 your workspace switches to the Free plan unless you pick a paid plan. No data is deleted.",
  },
  {
    id: "seats",
    category: "Billing",
    question: "Are seats prorated when I add teammates mid-cycle?",
    answer:
      "Yes. New seats are charged for the remaining days of the current billing period and appear as a separate line on your next invoice.",
  },
  {
    id: "invoice",
    category: "Billing",
    question: "Can I pay by invoice or bank transfer?",
    answer:
      "Annual plans of $5,000 or more can be paid by ACH, SEPA or wire with net-30 terms. Contact sales to switch.",
  },
  {
    id: "import",
    category: "Data",
    question: "How do I import contacts from HubSpot or Salesforce?",
    answer:
      "Go to Settings → Data import and connect your source. We map standard fields automatically and let you review custom fields before anything is written.",
  },
  {
    id: "export",
    category: "Data",
    question: "Can I export all my data?",
    answer:
      "Workspace admins can export every object as CSV or JSON at any time from Settings → Data export. Large exports are emailed as a zip.",
  },
  {
    id: "soc2",
    category: "Security",
    question: "Are you SOC 2 Type II compliant?",
    answer:
      "Yes. Our latest SOC 2 Type II report and pen-test summary are available under NDA from the Trust Center.",
  },
  {
    id: "sso",
    category: "Security",
    question: "Do you support SAML SSO and SCIM?",
    answer:
      "SAML SSO (Okta, Azure AD, Google) and SCIM provisioning are included on the Enterprise plan.",
  },
];

export default function Example() {
  return (
    <div className="w-full max-w-2xl">
      <Faq
        items={items}
        defaultOpenIds={["trial"]}
        onFeedback={(id, helpful) => console.log("faq feedback", id, helpful)}
        emptyAction={<Button variant="primary">Ask our team</Button>}
      />
    </div>
  );
}
