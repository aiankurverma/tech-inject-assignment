import * as React from "react";
import { AspectRatio } from "@/components/crm/aspect-ratio";
import { SegmentedControl } from "@/components/crm/segmented-control";

const assets = [
  {
    title: "Q3 product webinar",
    src: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800",
    badge: "42:18",
  },
  {
    title: "Case study: Globex",
    src: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
    badge: "PDF",
  },
  { title: "Onboarding walkthrough", src: "https://invalid.example/missing.jpg", badge: "6:05" },
];

export default function Example() {
  const [ratio, setRatio] = React.useState("16:9");
  return (
    <div className="w-full max-w-2xl space-y-3 font-crm">
      <SegmentedControl
        label="Thumbnail ratio"
        value={ratio}
        onValueChange={setRatio}
        options={[
          { value: "16:9", label: "16:9" },
          { value: "4:3", label: "4:3" },
          { value: "1:1", label: "1:1" },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {assets.map((a) => (
          <figure key={a.title} className="space-y-1.5">
            <AspectRatio ratio={ratio} src={a.src} alt={a.title} badge={a.badge} />
            <figcaption className="truncate text-xs text-crm-soft">{a.title}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
