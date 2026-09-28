import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/crm/tabs";

const companies = [
  { name: "Acme Corp", stage: "Negotiation", value: "$120k" },
  { name: "Globex", stage: "Proposal", value: "$84k" },
  { name: "Initech", stage: "Discovery", value: "$42k" },
];
const deals = [
  { name: "Acme renewal", owner: "Priya S.", close: "Oct 14" },
  { name: "Globex expansion", owner: "Marco L.", close: "Oct 28" },
  { name: "Initech pilot", owner: "Dana K.", close: "Nov 03" },
];

export default function Example() {
  return (
    <Tabs
      defaultValue="companies"
      className="w-full max-w-md rounded-crm border border-crm-border bg-crm-card px-4 font-crm text-crm-fg"
    >
      <TabsList>
        <TabsTrigger value="companies">Companies</TabsTrigger>
        <TabsTrigger value="deals">Deals</TabsTrigger>
        <TabsTrigger value="forecast">Forecast</TabsTrigger>
        <TabsTrigger value="archived" disabled>
          Archived
        </TabsTrigger>
      </TabsList>
      <TabsContent value="companies" className="py-4 text-sm">
        <p className="mb-2 text-xs text-crm-soft">18 companies in view · top 3 by value</p>
        <ul className="divide-y divide-crm-border">
          {companies.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-3 py-2">
              <span className="truncate font-medium">{c.name}</span>
              <span className="flex shrink-0 gap-4 text-xs">
                <span className="text-crm-soft">{c.stage}</span>
                <span className="w-12 text-right tabular-nums">{c.value}</span>
              </span>
            </li>
          ))}
        </ul>
      </TabsContent>
      <TabsContent value="deals" className="py-4 text-sm">
        <p className="mb-2 text-xs text-crm-soft">90 open deals · closing soonest</p>
        <ul className="divide-y divide-crm-border">
          {deals.map((d) => (
            <li key={d.name} className="flex items-center justify-between gap-3 py-2">
              <span className="truncate font-medium">{d.name}</span>
              <span className="flex shrink-0 gap-4 text-xs text-crm-soft">
                <span>{d.owner}</span>
                <span className="tabular-nums">{d.close}</span>
              </span>
            </li>
          ))}
        </ul>
      </TabsContent>
      <TabsContent value="forecast" className="py-4 text-sm">
        <p className="text-xs text-crm-soft">Q4 forecast</p>
        <p className="mt-1 text-2xl font-medium tabular-nums">$5.1M</p>
        <p className="mt-1 text-xs text-crm-soft">Commit $3.4M · Best case $1.7M</p>
      </TabsContent>
    </Tabs>
  );
}
