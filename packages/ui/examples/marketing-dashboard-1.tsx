import { MarketingDashboard } from "@/components/crm/marketing-dashboard";

export default function Example() {
  return (
    <MarketingDashboard
      className="w-[1080px]"
      channelColors={{
        "Google Ads": "blue",
        LinkedIn: "purple",
        Webinar: "teal",
        Organic: "green",
        Events: "orange",
      }}
      campaigns={[
        {
          id: "c1",
          name: "Q3 Brand Search",
          channel: "Google Ads",
          status: "active",
          spend: 18400,
          leads: 412,
          sqls: 96,
          customers: 14,
          revenue: 126000,
        },
        {
          id: "c2",
          name: "Competitor Keywords",
          channel: "Google Ads",
          status: "paused",
          spend: 9200,
          leads: 138,
          sqls: 21,
          customers: 2,
          revenue: 14800,
        },
        {
          id: "c3",
          name: "RevOps Leaders ABM",
          channel: "LinkedIn",
          status: "active",
          spend: 22600,
          leads: 184,
          sqls: 58,
          customers: 9,
          revenue: 171000,
        },
        {
          id: "c4",
          name: "Pipeline Hygiene Webinar",
          channel: "Webinar",
          status: "ended",
          spend: 4100,
          leads: 356,
          sqls: 44,
          customers: 6,
          revenue: 52800,
        },
        {
          id: "c5",
          name: "SEO: CRM templates hub",
          channel: "Organic",
          status: "active",
          spend: 3500,
          leads: 628,
          sqls: 71,
          customers: 11,
          revenue: 84500,
        },
        {
          id: "c6",
          name: "SaaStr booth",
          channel: "Events",
          status: "ended",
          spend: 31000,
          leads: 240,
          sqls: 39,
          customers: 3,
          revenue: 27000,
        },
        {
          id: "c7",
          name: "Retargeting — pricing page",
          channel: "LinkedIn",
          status: "active",
          spend: 6800,
          leads: 97,
          sqls: 29,
          customers: 4,
          revenue: 38400,
        },
      ]}
    />
  );
}
