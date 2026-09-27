// Builds pipeline-health.json: the bundle uploaded through the admin in the demo (flow A).
// Run: node examples/demo-bundles/build.mjs
import { readFileSync, writeFileSync } from "node:fs";

const here = (p) => new URL(p, import.meta.url);
const example = `import { PipelineHealth } from "@/components/crm/pipeline-health";

export default function Example() {
  return (
    <div className="w-[440px] rounded-crm bg-crm-sidebar p-5">
      <PipelineHealth
        probability={82}
        stages={[
          { label: "Discovery", value: 31, tone: "danger" },
          { label: "Evaluation", value: 53, tone: "warning" },
          { label: "Procurement", value: 31, tone: "success" },
        ]}
      />
    </div>
  );
}
`;

const bundle = {
  name: "Pipeline Health",
  slug: "pipeline-health",
  description:
    "Company pipeline-health panel: overall win probability with a segmented bar per deal stage.",
  category: "Data display",
  version: "1.0.0",
  access: "free",
  dependencies: [],
  files: [
    {
      path: "components/crm/pipeline-health.tsx",
      content: readFileSync(here("./pipeline-health.tsx"), "utf8"),
    },
  ],
  examples: [{ title: "Company detail", code: example }],
  props: [
    {
      name: "probability",
      type: "number",
      required: true,
      description: "Overall win probability, 0-100",
    },
    {
      name: "stages",
      type: "{ label: string; value: number; tone: 'danger' | 'warning' | 'success' }[]",
      required: true,
      description: "One bar per stage",
    },
    {
      name: "caption",
      type: "string",
      default: '"Win probability across all open deals"',
      required: false,
      description: "Text under the number",
    },
    {
      name: "segments",
      type: "number",
      default: "60",
      required: false,
      description: "Segments per bar",
    },
  ],
  usage:
    "Reference: Sales CRM company detail sheet (docs/reference/screens/d42-company-details.png).",
};
writeFileSync(here("./pipeline-health.json"), JSON.stringify(bundle, null, 2) + "\n");
console.log("wrote pipeline-health.json");
