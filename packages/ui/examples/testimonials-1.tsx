import * as React from "react";
import { Testimonials, type Testimonial } from "@/components/crm/testimonials";
import { SegmentedControl } from "@/components/crm/segmented-control";

const items: Testimonial[] = [
  {
    id: "t1",
    quote:
      "We moved 14 reps off spreadsheets in a week. Forecast calls went from an hour of arguing to 15 minutes.",
    author: { name: "Aisha Khan", title: "VP Sales", company: "Lumen Logistics" },
    rating: 5,
    industry: "Logistics",
    metric: { value: "4x", label: "faster forecast reviews" },
    source: "G2",
  },
  {
    id: "t2",
    quote:
      "Sequences stop the moment a prospect replies, so nobody gets the awkward follow-up after they already booked.",
    author: { name: "Marco Rossi", title: "SDR Manager", company: "Brightpath SaaS" },
    rating: 5,
    industry: "SaaS",
    metric: { value: "38%", label: "more meetings booked" },
  },
  {
    id: "t3",
    quote:
      "Our brokers log site visits from their phones and the pipeline is finally accurate at month end.",
    author: { name: "Rahul Mehta", title: "Director", company: "Skyline Realty" },
    rating: 4,
    industry: "Real estate",
    source: "Capterra",
  },
  {
    id: "t4",
    quote: "SSO and the audit log got us through our SOC 2 review without a single custom export.",
    author: { name: "Lena Fischer", title: "Head of IT", company: "Nordic Health" },
    rating: 5,
    industry: "Healthcare",
    metric: { value: "0", label: "audit findings" },
  },
  {
    id: "t5",
    quote:
      "Support SLAs sit next to the deal, so account managers know about escalations before the renewal call.",
    author: { name: "Tom Becker", title: "CS Lead", company: "Brightpath SaaS" },
    rating: 4,
    industry: "SaaS",
  },
];

export default function Example() {
  const [variant, setVariant] = React.useState<"grid" | "carousel">("carousel");
  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-6">
      <SegmentedControl
        label="Layout"
        size="sm"
        value={variant}
        onValueChange={(v) => setVariant(v as "grid" | "carousel")}
        options={[
          { value: "carousel", label: "Carousel" },
          { value: "grid", label: "Grid" },
        ]}
      />
      <Testimonials items={items} variant={variant} title="Teams that switched, and stayed" />
    </div>
  );
}
