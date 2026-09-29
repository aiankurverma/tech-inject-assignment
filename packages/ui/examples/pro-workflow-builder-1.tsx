import * as React from "react";
import {
  AlarmClock,
  Bell,
  Building2,
  Clock,
  GitBranch,
  Globe,
  Mail,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Tag,
  UserPlus,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import {
  ProWorkflowBuilder,
  type InputPort,
  type NodeDefinition,
  type OutputPort,
  type NodeRunState,
  type WorkflowJSON,
} from "@/components/crm/pro-workflow-builder";

const flowIn: InputPort[] = [{ id: "in", accepts: ["event", "flow"] }];
const flowOut: OutputPort[] = [{ id: "out", type: "flow" }];
const withError: OutputPort[] = [...flowOut, { id: "error", label: "On error", type: "error" }];
const reps = [
  { value: "maya", label: "Maya Chen (EMEA)" },
  { value: "omar", label: "Omar Haddad (NA East)" },
  { value: "priya", label: "Priya Nair (APAC)" },
  { value: "round_robin", label: "Round robin — SDR pod" },
];

const definitions: NodeDefinition[] = [
  {
    type: "crm.form_submitted",
    kind: "trigger",
    label: "Form submitted",
    category: "Triggers",
    icon: <Globe />,
    description: "A website or product form is submitted",
    inputs: [],
    outputs: [{ id: "out", type: "event" }],
    fields: [
      {
        key: "form",
        label: "Form",
        kind: "select",
        required: true,
        options: [
          { value: "demo", label: "Book a demo" },
          { value: "pricing", label: "Pricing enquiry" },
          { value: "trial", label: "Start free trial" },
        ],
      },
    ],
    defaults: { form: "demo" },
    summarize: (c) => (c.form ? `Form: ${String(c.form)}` : undefined),
  },
  {
    type: "crm.deal_stage_changed",
    kind: "trigger",
    label: "Deal stage changed",
    category: "Triggers",
    icon: <Zap />,
    inputs: [],
    outputs: [{ id: "out", type: "event" }],
    fields: [
      {
        key: "stage",
        label: "New stage",
        kind: "select",
        required: true,
        options: [
          { value: "proposal", label: "Proposal sent" },
          { value: "negotiation", label: "Negotiation" },
          { value: "closed_won", label: "Closed won" },
        ],
      },
    ],
  },
  {
    type: "http.webhook",
    kind: "trigger",
    label: "Incoming webhook",
    category: "Triggers",
    icon: <Webhook />,
    inputs: [],
    outputs: [{ id: "out", type: "event" }],
    fields: [
      {
        key: "secret",
        label: "Signing secret name",
        kind: "text",
        required: true,
        placeholder: "WEBHOOK_SECRET",
      },
    ],
  },
  {
    type: "logic.if",
    kind: "condition",
    label: "If / else",
    category: "Logic",
    icon: <GitBranch />,
    description: "Branch on a field",
    inputs: flowIn,
    outputs: [
      { id: "true", label: "Yes", type: "flow" },
      { id: "false", label: "No", type: "flow" },
    ],
    fields: [
      {
        key: "field",
        label: "Field",
        kind: "select",
        required: true,
        options: [
          { value: "employees", label: "Company size" },
          { value: "country", label: "Country" },
          { value: "score", label: "Lead score" },
          { value: "domain_type", label: "Email domain type" },
        ],
      },
      {
        key: "operator",
        label: "Operator",
        kind: "select",
        required: true,
        options: [
          { value: "gt", label: "is greater than" },
          { value: "eq", label: "equals" },
          { value: "in", label: "is one of" },
        ],
      },
      { key: "value", label: "Value", kind: "text", required: true },
    ],
    summarize: (c) =>
      c.field
        ? `${String(c.field)} ${String(c.operator ?? "")} ${String(c.value ?? "")}`
        : undefined,
  },
  {
    type: "logic.delay",
    kind: "delay",
    label: "Wait",
    category: "Logic",
    icon: <Clock />,
    inputs: flowIn,
    outputs: flowOut,
    fields: [
      { key: "amount", label: "Duration", kind: "number", required: true, min: 1, max: 720 },
      {
        key: "unit",
        label: "Unit",
        kind: "select",
        required: true,
        options: [
          { value: "minutes", label: "Minutes" },
          { value: "hours", label: "Hours" },
          { value: "days", label: "Days" },
        ],
      },
      { key: "business_hours", label: "Only count business hours", kind: "switch" },
    ],
    defaults: { amount: 1, unit: "days" },
    summarize: (c) => `${String(c.amount ?? "?")} ${String(c.unit ?? "")}`,
  },
  {
    type: "ai.enrich",
    kind: "action",
    label: "Enrich company",
    category: "Data",
    icon: <Sparkles />,
    description: "Look up size, industry and HQ",
    inputs: flowIn,
    outputs: withError,
    fields: [
      {
        key: "provider",
        label: "Provider",
        kind: "select",
        required: true,
        options: [
          { value: "clearbit", label: "Clearbit" },
          { value: "apollo", label: "Apollo" },
        ],
      },
    ],
    defaults: { provider: "clearbit" },
  },
  {
    type: "crm.create_contact",
    kind: "action",
    label: "Create or update contact",
    category: "CRM",
    icon: <UserPlus />,
    inputs: flowIn,
    outputs: withError,
    fields: [{ key: "dedupe", label: "Match existing contacts by email", kind: "switch" }],
    defaults: { dedupe: true },
  },
  {
    type: "crm.assign_owner",
    kind: "action",
    label: "Assign owner",
    category: "CRM",
    icon: <Users />,
    inputs: flowIn,
    outputs: flowOut,
    fields: [{ key: "owner", label: "Owner", kind: "select", required: true, options: reps }],
    summarize: (c) => reps.find((r) => r.value === c.owner)?.label,
  },
  {
    type: "crm.create_account",
    kind: "action",
    label: "Create account",
    category: "CRM",
    icon: <Building2 />,
    inputs: flowIn,
    outputs: withError,
    fields: [
      {
        key: "tier",
        label: "Tier",
        kind: "select",
        required: true,
        options: [
          { value: "enterprise", label: "Enterprise" },
          { value: "mid", label: "Mid-market" },
          { value: "smb", label: "SMB" },
        ],
      },
    ],
  },
  {
    type: "crm.add_tag",
    kind: "action",
    label: "Add tag",
    category: "CRM",
    icon: <Tag />,
    inputs: flowIn,
    outputs: flowOut,
    fields: [{ key: "tag", label: "Tag", kind: "text", required: true, maxLength: 40 }],
    summarize: (c) => (c.tag ? `#${String(c.tag)}` : undefined),
  },
  {
    type: "msg.email",
    kind: "action",
    label: "Send email",
    category: "Messaging",
    icon: <Mail />,
    inputs: flowIn,
    outputs: withError,
    fields: [
      {
        key: "template",
        label: "Template",
        kind: "select",
        required: true,
        options: [
          { value: "welcome", label: "Welcome — self-serve" },
          { value: "demo_confirm", label: "Demo confirmation" },
          { value: "nurture_1", label: "Nurture #1" },
        ],
      },
      {
        key: "from",
        label: "Send as",
        kind: "select",
        options: [
          { value: "owner", label: "Record owner" },
          { value: "team", label: "Growth team" },
        ],
      },
    ],
    summarize: (c) => (c.template ? `Template: ${String(c.template)}` : undefined),
  },
  {
    type: "msg.slack",
    kind: "action",
    label: "Post to Slack",
    category: "Messaging",
    icon: <MessageSquare />,
    inputs: flowIn,
    outputs: withError,
    fields: [
      {
        key: "channel",
        label: "Channel",
        kind: "text",
        required: true,
        placeholder: "#sales-alerts",
      },
      { key: "message", label: "Message", kind: "textarea", required: true, maxLength: 500 },
    ],
    summarize: (c) => (c.channel ? String(c.channel) : undefined),
  },
  {
    type: "task.create",
    kind: "action",
    label: "Create task",
    category: "CRM",
    icon: <AlarmClock />,
    inputs: flowIn,
    outputs: flowOut,
    fields: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "due_hours", label: "Due in", kind: "number", unit: "hours", min: 1, max: 336 },
    ],
  },
  {
    type: "err.alert",
    kind: "handler",
    label: "Alert on failure",
    category: "Error handling",
    icon: <ShieldAlert />,
    description: "Catches step errors",
    inputs: [{ id: "in", label: "Error", accepts: ["error"] }],
    outputs: [],
    fields: [
      {
        key: "notify",
        label: "Notify",
        kind: "select",
        required: true,
        options: [
          { value: "revops", label: "RevOps on-call" },
          { value: "owner", label: "Workflow owner" },
        ],
      },
    ],
    defaults: { notify: "revops" },
  },
  {
    type: "notify.inapp",
    kind: "action",
    label: "In-app notification",
    category: "Messaging",
    icon: <Bell />,
    inputs: flowIn,
    outputs: flowOut,
    fields: [{ key: "text", label: "Text", kind: "text", required: true }],
  },
];

const e = (s: string, sh: string, t: string) => ({
  id: `e_${s}_${sh}_${t}`,
  source: s,
  sourceHandle: sh,
  target: t,
  targetHandle: "in",
});

const initial: WorkflowJSON = {
  version: 1,
  name: "Inbound demo request routing",
  nodes: [
    {
      id: "trigger",
      type: "crm.form_submitted",
      label: "Demo form submitted",
      position: { x: 0, y: 0 },
      config: { form: "demo" },
    },
    {
      id: "contact",
      type: "crm.create_contact",
      label: "Upsert contact",
      position: { x: 0, y: 0 },
      config: { dedupe: true },
    },
    {
      id: "enrich",
      type: "ai.enrich",
      label: "Enrich company",
      position: { x: 0, y: 0 },
      config: { provider: "clearbit" },
    },
    {
      id: "size",
      type: "logic.if",
      label: "500+ employees?",
      position: { x: 0, y: 0 },
      config: { field: "employees", operator: "gt", value: "500" },
    },
    {
      id: "account",
      type: "crm.create_account",
      label: "Create enterprise account",
      position: { x: 0, y: 0 },
      config: { tier: "enterprise" },
    },
    {
      id: "region",
      type: "logic.if",
      label: "Based in EMEA?",
      position: { x: 0, y: 0 },
      config: { field: "country", operator: "in", value: "DE, FR, GB, NL, ES" },
    },
    {
      id: "own_emea",
      type: "crm.assign_owner",
      label: "Assign EMEA AE",
      position: { x: 0, y: 0 },
      config: { owner: "maya" },
    },
    {
      id: "own_na",
      type: "crm.assign_owner",
      label: "Assign NA AE",
      position: { x: 0, y: 0 },
      config: { owner: "omar" },
    },
    {
      id: "slack",
      type: "msg.slack",
      label: "Alert #enterprise-deals",
      position: { x: 0, y: 0 },
      config: { channel: "#enterprise-deals", message: "New 500+ demo request — owner assigned." },
    },
    {
      id: "task",
      type: "task.create",
      label: "Call within 2 hours",
      position: { x: 0, y: 0 },
      config: { title: "Call new enterprise lead", due_hours: 2 },
    },
    {
      id: "rr",
      type: "crm.assign_owner",
      label: "Round-robin SDR",
      position: { x: 0, y: 0 },
      config: { owner: "round_robin" },
    },
    {
      id: "confirm",
      type: "msg.email",
      label: "Send demo confirmation",
      position: { x: 0, y: 0 },
      config: { template: "demo_confirm", from: "owner" },
    },
    {
      id: "wait",
      type: "logic.delay",
      label: "Wait 2 days",
      position: { x: 0, y: 0 },
      config: { amount: 2, unit: "days", business_hours: true },
    },
    {
      id: "nurture",
      type: "msg.email",
      label: "Nurture #1",
      position: { x: 0, y: 0 },
      config: { template: "nurture_1", from: "team" },
    },
    {
      id: "tag",
      type: "crm.add_tag",
      label: "Tag as nurtured",
      position: { x: 0, y: 0 },
      config: { tag: "inbound-nurture" },
    },
    {
      id: "alert",
      type: "err.alert",
      label: "Alert RevOps",
      position: { x: 0, y: 0 },
      config: { notify: "revops" },
    },
  ],
  edges: [
    e("trigger", "out", "contact"),
    e("contact", "out", "enrich"),
    e("contact", "error", "alert"),
    e("enrich", "out", "size"),
    e("size", "true", "account"),
    e("size", "false", "rr"),
    e("account", "out", "region"),
    e("region", "true", "own_emea"),
    e("region", "false", "own_na"),
    e("own_emea", "out", "slack"),
    e("own_na", "out", "task"),
    e("rr", "out", "confirm"),
    e("confirm", "out", "wait"),
    e("wait", "out", "nurture"),
    e("nurture", "out", "tag"),
  ],
};

// Pre-compute a readable layout for the fixture (the Tidy button does the same live).
const COLS: Record<string, [number, number]> = {
  trigger: [1, 0],
  contact: [1, 1],
  alert: [2.2, 2],
  enrich: [1, 2],
  size: [1, 3],
  account: [0, 4],
  rr: [2, 4],
  region: [0, 5],
  confirm: [2, 5],
  own_emea: [-0.6, 6],
  own_na: [0.6, 6],
  wait: [2, 6],
  slack: [-0.6, 7],
  task: [0.6, 7],
  nurture: [2, 7],
  tag: [2, 8],
};
initial.nodes.forEach((n) => {
  const [c, r] = COLS[n.id]!;
  n.position = { x: c * 300, y: r * 150 };
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Example() {
  const [workflow, setWorkflow] = React.useState<WorkflowJSON>(initial);
  const [run, setRun] = React.useState<Record<string, NodeRunState> | undefined>();
  const [running, setRunning] = React.useState(false);

  /** Simulated executor: walks the graph, picks a branch per condition, fails enrichment on some runs. */
  const simulate = async (wf: WorkflowJSON) => {
    setRunning(true);
    const state: Record<string, NodeRunState> = {};
    for (const n of wf.nodes) state[n.id] = { status: "queued" };
    setRun({ ...state });
    const out = new Map<string, { handle: string; target: string }[]>();
    for (const ed of wf.edges)
      (out.get(ed.source) ?? out.set(ed.source, []).get(ed.source)!).push({
        handle: ed.sourceHandle,
        target: ed.target,
      });
    const typeOf = new Map(wf.nodes.map((n) => [n.id, n.type]));
    const queue = wf.nodes
      .filter((n) => definitions.find((d) => d.type === n.type)?.kind === "trigger")
      .map((n) => n.id);
    const visited = new Set<string>();
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      state[id] = { status: "running" };
      setRun({ ...state });
      const ms = 250 + Math.round(Math.random() * 450);
      await wait(ms);
      const failed = typeOf.get(id) === "ai.enrich" && Math.random() < 0.25;
      state[id] = failed
        ? { status: "error", durationMs: ms, message: "Clearbit returned 429 Too Many Requests" }
        : { status: "success", durationMs: ms };
      setRun({ ...state });
      const next = out.get(id) ?? [];
      const branch =
        typeOf.get(id) === "logic.if" ? (Math.random() < 0.6 ? "true" : "false") : null;
      for (const n of next) {
        if (
          failed ? n.handle === "error" : n.handle !== "error" && (!branch || n.handle === branch)
        )
          queue.push(n.target);
      }
    }
    for (const n of wf.nodes) if (!visited.has(n.id)) state[n.id] = { status: "skipped" };
    setRun({ ...state });
    setRunning(false);
  };

  return (
    <div className="my-6 flex flex-col gap-2">
      <ProWorkflowBuilder
        definitions={definitions}
        value={workflow}
        onChange={(wf) => {
          setWorkflow(wf);
          setRun(undefined);
        }}
        runState={run}
        running={running}
        onRun={simulate}
        height={680}
      />
      <p className="text-xs text-crm-subtle">
        {workflow.nodes.length} steps · {workflow.edges.length} connections · press Test run to
        watch the run-state overlay; enrichment fails on roughly one run in four and routes to the
        error handler.
      </p>
    </div>
  );
}
