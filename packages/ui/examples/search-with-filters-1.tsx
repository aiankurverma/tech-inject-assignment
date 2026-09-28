import { Highlight, SearchWithFilters } from "@/components/crm/search-with-filters";

interface Ticket {
  id: string;
  subject: string;
  customer: string;
  priority: "urgent" | "high" | "normal";
  status: "open" | "pending" | "solved";
  assignee: string | null;
  slaBreached: boolean;
}

const tickets: Ticket[] = [
  {
    id: "T-4812",
    subject: "SSO login loop after Okta update",
    customer: "Northwind Logistics",
    priority: "urgent",
    status: "open",
    assignee: null,
    slaBreached: true,
  },
  {
    id: "T-4809",
    subject: "Invoice shows wrong VAT rate",
    customer: "Brightline Health",
    priority: "high",
    status: "pending",
    assignee: "Aiko",
    slaBreached: false,
  },
  {
    id: "T-4801",
    subject: "CSV export missing custom fields",
    customer: "Kestrel Robotics",
    priority: "normal",
    status: "open",
    assignee: "Tomás",
    slaBreached: false,
  },
  {
    id: "T-4797",
    subject: "Webhook retries flooding endpoint",
    customer: "Café Müller GmbH",
    priority: "high",
    status: "open",
    assignee: "Aiko",
    slaBreached: true,
  },
  {
    id: "T-4790",
    subject: "Add seats to annual plan",
    customer: "Northwind Logistics",
    priority: "normal",
    status: "solved",
    assignee: "Lena",
    slaBreached: false,
  },
  {
    id: "T-4788",
    subject: "Dashboard timezone off by one hour",
    customer: "Oakridge Capital",
    priority: "normal",
    status: "pending",
    assignee: null,
    slaBreached: false,
  },
];

const searchText = (t: Ticket) => `${t.id} ${t.subject} ${t.customer} ${t.assignee ?? ""}`;

export default function Example() {
  return (
    <SearchWithFilters
      items={tickets}
      getSearchText={searchText}
      placeholder="Search tickets, customers, IDs"
      shortcut="k"
      noun={{ one: "ticket", many: "tickets" }}
      quickFilters={[
        { id: "unassigned", label: "Unassigned", predicate: (t) => !t.assignee },
        { id: "breached", label: "SLA breached", predicate: (t) => t.slaBreached },
        {
          id: "urgent",
          label: "Urgent",
          group: "priority",
          predicate: (t) => t.priority === "urgent",
        },
        { id: "high", label: "High", group: "priority", predicate: (t) => t.priority === "high" },
        { id: "open", label: "Open", group: "status", predicate: (t) => t.status === "open" },
        {
          id: "pending",
          label: "Pending",
          group: "status",
          predicate: (t) => t.status === "pending",
        },
      ]}
    >
      {(results, q) => (
        <ul className="divide-y divide-crm-border rounded-crm border border-crm-border font-crm text-xs">
          {results.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-14 shrink-0 text-crm-subtle tabular-nums">
                <Highlight text={t.id} query={q} />
              </span>
              <span className="min-w-0 flex-1 truncate text-crm-fg">
                <Highlight text={t.subject} query={q} />
              </span>
              <span className="hidden w-40 shrink-0 truncate text-crm-soft sm:block">
                <Highlight text={t.customer} query={q} />
              </span>
              <span className="w-24 shrink-0 text-right">
                {t.slaBreached ? (
                  <span className="rounded-full border border-crm-danger/40 bg-crm-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-crm-danger">
                    SLA breached
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SearchWithFilters>
  );
}
