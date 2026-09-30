import * as React from "react";
import {
  Briefcase,
  Building2,
  Download,
  LayoutDashboard,
  LineChart as LineChartIcon,
  Plus,
} from "lucide-react";
import { Button } from "@/components/crm/button";
import { TrialCard } from "@/components/crm/app-sidebar";
import { ProPipelineBoard, type ProPipelineBoardProps } from "@/components/crm/pro-pipeline-board";
import { TemplateShell, type Kpi } from "@/components/crm/template-shell";

export interface CrmDashboardTemplateProps {
  /** KPI tiles; pass `trend` for an inline sparkline. */
  kpis: Kpi[];
  /** Forwarded to ProPipelineBoard. */
  pipeline: ProPipelineBoardProps;
  /** Shows the trial card in the sidebar footer. */
  trialDays?: number;
  onAddBilling?: () => void;
  onNewDeal?: () => void;
  onExport?: () => void;
  className?: string;
}

const nav = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard /> },
  { id: "companies", label: "Companies", icon: <Building2 /> },
  { id: "deals", label: "Deals", icon: <Briefcase /> },
  { id: "forecast", label: "Forecast", icon: <LineChartIcon /> },
];

/** Full-page CRM dashboard: sidebar with trial card, KPI row with trends and the pro pipeline board. */
export function CrmDashboardTemplate({
  kpis,
  pipeline,
  trialDays,
  onAddBilling,
  onNewDeal,
  onExport,
  className,
}: CrmDashboardTemplateProps) {
  return (
    <TemplateShell
      className={className}
      brand={{ logo: <Briefcase />, title: "Sales CRM", subtitle: "Workspace" }}
      nav={nav}
      title="Company pipeline"
      description="Deals, conversion and pipeline value across the team."
      kpis={kpis}
      sidebarFooter={
        trialDays !== undefined ? (
          <TrialCard
            days={trialDays}
            action={
              <Button size="sm" onClick={onAddBilling}>
                Add billing
              </Button>
            }
          />
        ) : undefined
      }
      actions={
        <>
          <Button onClick={onExport}>
            <Download /> Export
          </Button>
          <Button variant="primary" onClick={onNewDeal}>
            <Plus /> New deal
          </Button>
        </>
      }
    >
      <ProPipelineBoard height={560} laneHeight={260} {...pipeline} />
    </TemplateShell>
  );
}
