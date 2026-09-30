import * as React from "react";
import { BookOpen, Headphones, Inbox, Plus, Timer, UserCheck } from "lucide-react";
import { Button } from "@/components/crm/button";
import { ProTicketConsole, type ProTicketConsoleProps } from "@/components/crm/pro-ticket-console";
import { TemplateShell, type Kpi } from "@/components/crm/template-shell";

export interface SupportDeskTemplateProps {
  kpis?: Kpi[];
  /** Forwarded to ProTicketConsole. */
  console: ProTicketConsoleProps;
  onNewTicket?: () => void;
  className?: string;
}

/** Full-page support desk: SLA/queue KPIs above the pro ticket console (queue, thread, details). */
export function SupportDeskTemplate({
  kpis,
  console: consoleProps,
  onNewTicket,
  className,
}: SupportDeskTemplateProps) {
  const tickets = consoleProps.tickets ?? consoleProps.defaultTickets ?? [];
  const open = tickets.filter((t) => t.status === "open").length;
  const mine = tickets.filter((t) => t.assignee === consoleProps.currentUser).length;
  const nav = [
    { id: "inbox", label: "All open", icon: <Inbox />, count: open },
    { id: "mine", label: "Assigned to me", icon: <UserCheck />, count: mine },
    { id: "sla", label: "SLA at risk", icon: <Timer /> },
    { id: "kb", label: "Knowledge base", icon: <BookOpen /> },
  ];
  return (
    <TemplateShell
      className={className}
      brand={{ logo: <Headphones />, title: "Support", subtitle: "Help desk" }}
      nav={nav}
      title="Support desk"
      description="Triage, reply and track SLAs across every queue."
      kpis={kpis}
      actions={
        <Button variant="primary" onClick={onNewTicket}>
          <Plus /> New ticket
        </Button>
      }
    >
      <div className="h-[560px] min-h-0">
        <ProTicketConsole {...consoleProps} />
      </div>
    </TemplateShell>
  );
}
