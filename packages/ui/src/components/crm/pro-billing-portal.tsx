import * as React from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/crm/tabs";
import { billingKeys, type BillingApi } from "@/components/crm/pro-billing-portal/billing-types";
import { PlanPanel } from "@/components/crm/pro-billing-portal/plan-panel";
import { PaymentMethodsPanel } from "@/components/crm/pro-billing-portal/payment-methods-panel";
import { InvoicesPanel } from "@/components/crm/pro-billing-portal/invoices-panel";
import { DetailsPanel } from "@/components/crm/pro-billing-portal/details-panel";
import { UsagePanel } from "@/components/crm/pro-billing-portal/usage-panel";

export type {
  BillingApi,
  BillingDetails,
  BillingInterval,
  BillingOverview,
  BillingPlan,
  Invoice,
  PaymentMethod,
  Subscription,
  UsageMeter,
} from "@/components/crm/pro-billing-portal/billing-types";
export { billingDetailsSchema } from "@/components/crm/pro-billing-portal/details-panel";

export type BillingTab = "plan" | "payment" | "invoices" | "details" | "usage";

export interface ProBillingPortalProps {
  api: BillingApi;
  currency?: string;
  locale?: string;
  tab?: BillingTab;
  defaultTab?: BillingTab;
  onTabChange?: (tab: BillingTab) => void;
  /** Open your provider's hosted card / bank element (Stripe Elements, Paddle, …). */
  onAddPaymentMethod?: () => void;
  /** Read-only mode (e.g. non-admin members). */
  readOnly?: boolean;
  /** Supply your app's QueryClient; otherwise the portal creates an isolated one. */
  queryClient?: QueryClient;
  title?: string;
  className?: string;
}

const TABS: { value: BillingTab; label: string }[] = [
  { value: "plan", label: "Plan" },
  { value: "payment", label: "Payment methods" },
  { value: "invoices", label: "Invoices" },
  { value: "details", label: "Billing details" },
  { value: "usage", label: "Usage & credits" },
];

/**
 * White-label self-serve billing area. Provider-agnostic: all IO flows through the `api`
 * adapter and is cached / invalidated with TanStack Query.
 */
export function ProBillingPortal({ queryClient, ...props }: ProBillingPortalProps) {
  const [fallback] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={queryClient ?? fallback}>
      <Portal {...props} />
    </QueryClientProvider>
  );
}

function Portal({
  api,
  currency = "USD",
  locale = "en-US",
  tab,
  defaultTab = "plan",
  onTabChange,
  onAddPaymentMethod,
  readOnly,
  title = "Billing",
  className,
}: Omit<ProBillingPortalProps, "queryClient">) {
  const [innerTab, setInnerTab] = React.useState<BillingTab>(defaultTab);
  const current = tab ?? innerTab;
  const overview = useQuery({ queryKey: billingKeys.overview, queryFn: api.getOverview });
  const money = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency }),
    [locale, currency],
  );
  const formatMoney = React.useCallback((m: number) => money.format(m / 100), [money]);

  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-crm border border-crm-border bg-crm-bg text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <header className="px-4 pt-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-crm-muted-fg">
          Manage your subscription, payment methods and invoices.
        </p>
      </header>
      <Tabs
        value={current}
        onValueChange={(v) => {
          if (tab === undefined) setInnerTab(v as BillingTab);
          onTabChange?.(v as BillingTab);
        }}
        className="mt-3"
      >
        <TabsList className="overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="p-4">
          {overview.isError ? (
            <div role="alert" className="flex items-center gap-2 text-sm text-crm-danger">
              Could not load billing data.
              <Button size="sm" onClick={() => overview.refetch()}>
                Retry
              </Button>
            </div>
          ) : overview.isPending ? (
            <div aria-busy="true" className="grid gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-crm bg-crm-muted" />
              ))}
            </div>
          ) : (
            <>
              <TabsContent value="plan">
                <PlanPanel
                  api={api}
                  data={overview.data}
                  formatMoney={formatMoney}
                  disabled={readOnly}
                />
              </TabsContent>
              <TabsContent value="payment">
                <PaymentMethodsPanel
                  api={api}
                  methods={overview.data.paymentMethods}
                  onAdd={onAddPaymentMethod}
                  disabled={readOnly}
                />
              </TabsContent>
              <TabsContent value="invoices">
                <InvoicesPanel api={api} formatMoney={formatMoney} />
              </TabsContent>
              <TabsContent value="details">
                <DetailsPanel api={api} details={overview.data.details} disabled={readOnly} />
              </TabsContent>
              <TabsContent value="usage">
                <UsagePanel
                  usage={overview.data.usage}
                  creditBalance={overview.data.creditBalance}
                  formatMoney={formatMoney}
                  locale={locale}
                />
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </section>
  );
}
