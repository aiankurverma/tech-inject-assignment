import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/crm/tabs";

export default function Example() {
  return (
    <Tabs defaultValue="companies" className="w-[420px] text-crm-fg">
      <TabsList>
        <TabsTrigger value="companies">Companies</TabsTrigger>
        <TabsTrigger value="deals">Deals</TabsTrigger>
        <TabsTrigger value="forecast">Forecast</TabsTrigger>
        <TabsTrigger value="archived" disabled>
          Archived
        </TabsTrigger>
      </TabsList>
      <TabsContent value="companies" className="p-4 text-sm">
        18 companies in view
      </TabsContent>
      <TabsContent value="deals" className="p-4 text-sm">
        90 open deals
      </TabsContent>
      <TabsContent value="forecast" className="p-4 text-sm">
        Forecast: $5.1M
      </TabsContent>
    </Tabs>
  );
}
