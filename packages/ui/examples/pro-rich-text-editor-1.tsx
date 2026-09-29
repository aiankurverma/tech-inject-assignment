import * as React from "react";
import {
  ProRichTextEditor,
  type MentionSource,
  type ProRichTextEditorHandle,
  type SuggestionItem,
} from "@/components/crm/pro-rich-text-editor";

// ---- realistic data at scale: 400 teammates, 10,000 CRM records ----
const FIRST = [
  "Priya",
  "Marcus",
  "Elena",
  "Kenji",
  "Amara",
  "Lucas",
  "Sofia",
  "Omar",
  "Hannah",
  "Diego",
  "Mei",
  "Tomás",
  "Aisha",
  "Noah",
  "Ingrid",
  "Ravi",
  "Chloe",
  "Samuel",
  "Yara",
  "Felix",
];
const LAST = [
  "Sharma",
  "Bennett",
  "Rossi",
  "Tanaka",
  "Okafor",
  "Silva",
  "Novak",
  "Haddad",
  "Schmidt",
  "Alvarez",
  "Chen",
  "Duarte",
  "Khan",
  "Walker",
  "Berg",
  "Iyer",
  "Martin",
  "Cohen",
  "Farouk",
  "Weber",
];
const ROLES = ["Account Executive", "CSM", "Solutions Engineer", "Sales Manager", "RevOps", "SDR"];
const CO_A = [
  "Northwind",
  "Acme",
  "Globex",
  "Initech",
  "Umbrella",
  "Stark",
  "Wayne",
  "Hooli",
  "Vandelay",
  "Soylent",
  "Tyrell",
  "Cyberdyne",
  "Massive",
  "Oscorp",
  "Wonka",
];
const CO_B = [
  "Logistics",
  "Health",
  "Capital",
  "Robotics",
  "Foods",
  "Energy",
  "Labs",
  "Media",
  "Retail",
  "Systems",
];
const KINDS = ["Deal", "Account", "Ticket", "Contact"] as const;

const people: SuggestionItem[] = Array.from({ length: 400 }, (_, i) => {
  const name = `${FIRST[i % 20]} ${LAST[(i * 7) % 20]}`;
  return {
    id: `u_${i + 1}`,
    label: name.replace(" ", "."),
    description: `${name} · ${ROLES[i % ROLES.length]}`,
    badge: name
      .split(" ")
      .map((p) => p[0])
      .join(""),
  };
});

const records: SuggestionItem[] = Array.from({ length: 10_000 }, (_, i) => {
  const kind = KINDS[i % 4]!;
  const company = `${CO_A[i % 15]} ${CO_B[(i * 3) % 10]}`;
  const n = 1000 + i;
  const label =
    kind === "Deal"
      ? `DEAL-${n}`
      : kind === "Ticket"
        ? `TKT-${n}`
        : kind === "Account"
          ? `ACC-${n}`
          : `CON-${n}`;
  const detail =
    kind === "Deal"
      ? `${company} — $${(((i * 37) % 480) + 20) * 1000} renewal`
      : kind === "Ticket"
        ? `${company} — SSO login loop`
        : kind === "Account"
          ? `${company} (${["Enterprise", "Mid-market", "SMB"][i % 3]})`
          : `${FIRST[i % 20]} ${LAST[i % 20]} at ${company}`;
  return { id: label.toLowerCase(), label, description: detail, group: `${kind}s` };
});

function search(list: SuggestionItem[], query: string, limit = 8) {
  const q = query.toLowerCase();
  const out: SuggestionItem[] = [];
  for (const item of list) {
    if (!q || item.label.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)) {
      out.push(item);
      if (out.length === limit) break;
    }
  }
  return out;
}

const sources: MentionSource[] = [
  { char: "@", label: "People", search: (q) => search(people, q) },
  {
    char: "#",
    label: "Records",
    // Simulate a server search over 10k records.
    search: (q) => new Promise((r) => setTimeout(() => r(search(records, q)), 120)),
    href: (id) => `/records/${id}`,
  },
];

const initial = `
<h2>QBR prep — Northwind Logistics</h2>
<p>Attendees: <span data-type="mention" data-id="u_1" data-label="Priya.Sharma" data-mention-suggestion-char="@">@Priya.Sharma</span> (AE), <span data-type="mention" data-id="u_4" data-label="Kenji.Tanaka" data-mention-suggestion-char="@">@Kenji.Tanaka</span> (SE). Renewal tracked in <span data-type="mention" data-id="deal-1000" data-label="DEAL-1000" data-mention-suggestion-char="#">#DEAL-1000</span>.</p>
<h3>Agenda</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><p>Review Q3 usage (<strong>+38%</strong> seats active)</p></li>
  <li data-type="taskItem" data-checked="false"><p>Walk through SSO rollout blockers</p></li>
  <li data-type="taskItem" data-checked="false"><p>Propose multi-year pricing</p></li>
</ul>
<table><tr><th><p>Metric</p></th><th><p>Q2</p></th><th><p>Q3</p></th></tr>
<tr><td><p>Active seats</p></td><td><p>412</p></td><td><p>569</p></td></tr>
<tr><td><p>Tickets</p></td><td><p>31</p></td><td><p>18</p></td></tr></table>
<pre><code class="language-sql">select account_id, count(*) from logins where ts > now() - interval '30 days' group by 1;</code></pre>
<blockquote><p>Try: select text for the bubble toolbar, type / for blocks, @ or # to link, or paste an image.</p></blockquote>
`;

type Format = "markdown" | "html" | "json";

export default function Example() {
  const ref = React.useRef<ProRichTextEditorHandle>(null);
  const [format, setFormat] = React.useState<Format>("markdown");
  const [output, setOutput] = React.useState("");
  const [saved, setSaved] = React.useState<string | null>(null);

  const render = React.useCallback((f: Format) => {
    const h = ref.current;
    if (!h) return;
    setOutput(
      f === "markdown"
        ? h.getMarkdown()
        : f === "html"
          ? h.getHTML()
          : JSON.stringify(h.getJSON(), null, 2),
    );
  }, []);

  React.useEffect(() => render(format), [format, render]);

  return (
    <div className="grid gap-4 bg-crm-bg p-6 font-crm text-crm-fg xl:grid-cols-[1fr_380px]">
      <ProRichTextEditor
        ref={ref}
        defaultValue={initial}
        mentionSources={sources}
        maxHeight={520}
        characterLimit={20000}
        onChange={() => {
          setSaved(null);
          render(format);
        }}
        toolbarTrailing={
          <button
            type="button"
            onClick={() => setSaved(new Date().toLocaleTimeString())}
            className="rounded-full bg-crm-primary px-3 py-1 text-xs font-medium text-crm-primary-fg"
          >
            {saved ? `Saved ${saved}` : "Save note"}
          </button>
        }
      />
      <section aria-label="Output" className="grid min-w-0 content-start gap-2">
        <div role="tablist" aria-label="Output format" className="flex gap-1">
          {(["markdown", "html", "json"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={format === f}
              onClick={() => setFormat(f)}
              className="rounded-full px-2.5 py-1 text-xs text-crm-muted-fg aria-selected:bg-crm-raised aria-selected:text-crm-fg aria-selected:shadow-crm-raised"
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-crm border border-crm-border bg-crm-card p-3 font-mono text-[11px] leading-relaxed text-crm-soft">
          {output}
        </pre>
      </section>
    </div>
  );
}
