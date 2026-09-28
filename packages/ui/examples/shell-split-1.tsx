import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { ShellSplit } from "@/components/crm/shell-split";
import { SearchInput } from "@/components/crm/search-input";
import { Avatar } from "@/components/crm/avatar";
import { Tag, type TagColor } from "@/components/crm/tag";
import { Button } from "@/components/crm/button";
import { cn } from "@/lib/utils";

interface Ticket {
  id: string;
  subject: string;
  customer: string;
  company: string;
  priority: "Urgent" | "High" | "Normal";
  received: string;
  body: string;
  unread?: boolean;
}

const tickets: Ticket[] = [
  {
    id: "T-4821",
    subject: "SSO login loops back to sign-in",
    customer: "Dana Whitfield",
    company: "Northwind",
    priority: "Urgent",
    received: "8m",
    body: "Since this morning our Okta users get redirected back to the sign-in page after authenticating. About 40 reps are blocked.",
    unread: true,
  },
  {
    id: "T-4819",
    subject: "Invoice shows wrong VAT number",
    customer: "Luca Bianchi",
    company: "Contoso GmbH",
    priority: "High",
    received: "42m",
    body: "The September invoice lists our old VAT ID DE281…; finance can't book it until it's reissued.",
    unread: true,
  },
  {
    id: "T-4812",
    subject: "Export deals to CSV times out",
    customer: "Mei Lin",
    company: "Tailspin Toys",
    priority: "Normal",
    received: "3h",
    body: "Exporting ~18k deals fails after 30s with a gateway error. Smaller filters work.",
  },
  {
    id: "T-4807",
    subject: "Add a second pipeline for renewals",
    customer: "Omar Haddad",
    company: "Fabrikam",
    priority: "Normal",
    received: "1d",
    body: "We'd like renewals tracked separately from new business. Is that on our plan?",
  },
];

const tone: Record<Ticket["priority"], TagColor> = {
  Urgent: "red",
  High: "orange",
  Normal: "neutral",
};

export default function Example() {
  const [selected, setSelected] = useState<string | null>("T-4821");
  const [query, setQuery] = useState("");
  const [read, setRead] = useState<Set<string>>(new Set());
  const list = useMemo(
    () =>
      tickets.filter((t) =>
        `${t.subject} ${t.company} ${t.id}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );
  const current = tickets.find((t) => t.id === selected);
  const open = (id: string) => {
    setSelected(id);
    setRead((r) => new Set(r).add(id));
  };
  return (
    <div className="h-[560px] overflow-hidden rounded-crm border border-crm-border">
      <ShellSplit
        detailOpen={!!current}
        onCloseDetail={() => setSelected(null)}
        listHeader={
          <SearchInput
            size="sm"
            placeholder="Search tickets"
            value={query}
            onValueChange={setQuery}
          />
        }
        list={
          list.length ? (
            <ul role="listbox" aria-label="Tickets">
              {list.map((t) => (
                <li key={t.id} role="option" aria-selected={t.id === selected}>
                  <button
                    type="button"
                    onClick={() => open(t.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b border-crm-border px-3 py-2.5 text-left outline-none hover:bg-crm-muted/50 focus-visible:bg-crm-muted",
                      t.id === selected && "bg-crm-muted",
                    )}
                  >
                    <span className="flex items-center gap-2 text-xs text-crm-subtle">
                      {t.unread && !read.has(t.id) ? (
                        <span
                          className="size-1.5 rounded-full bg-crm-primary"
                          aria-label="Unread"
                        />
                      ) : null}
                      {t.id} · {t.company}
                      <span className="ml-auto">{t.received}</span>
                    </span>
                    <span className="truncate text-sm text-crm-fg">{t.subject}</span>
                    <Tag size="sm" color={tone[t.priority]} className="self-start">
                      {t.priority}
                    </Tag>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-xs text-crm-muted-fg">No tickets match.</p>
          )
        }
        emptyDetail={
          <span className="flex flex-col items-center gap-2">
            <Inbox className="size-5" /> Pick a ticket to start replying
          </span>
        }
        detailHeader={
          current ? (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{current.subject}</span>
              <Button variant="primary" size="sm">
                Resolve
              </Button>
            </div>
          ) : null
        }
        detail={
          current ? (
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <Avatar name={current.customer} size="sm" />
                <span className="text-sm">{current.customer}</span>
                <span className="text-xs text-crm-subtle">{current.company}</span>
              </div>
              <p className="text-sm leading-relaxed text-crm-soft">{current.body}</p>
            </div>
          ) : null
        }
      />
    </div>
  );
}
