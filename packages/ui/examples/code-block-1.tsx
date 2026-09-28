import { CodeBlock } from "@/components/crm/code-block";

const curl = `# Create a deal from your backend
curl -X POST https://api.acme-crm.com/v2/deals \\
  -H "Authorization: Bearer sk_live_51Hc8QmKd2x9Tz7Lr" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Northwind renewal", "amount": 48000, "stage": "proposal"}'`;

const node = `// Idempotency key prevents duplicate deals on retries
const res = await fetch("https://api.acme-crm.com/v2/deals", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.CRM_KEY}\`,
    "Idempotency-Key": "renewal-northwind-2026",
  },
  body: JSON.stringify({ name: "Northwind renewal", amount: 48000 }),
});
const deal = await res.json();`;

const sql = `-- Pipeline by stage for this quarter
SELECT stage, COUNT(*) AS deals, SUM(amount) AS value
FROM deals
WHERE closed_at IS NULL
  AND created_at >= '2026-07-01'
GROUP BY stage
ORDER BY value DESC
LIMIT 10;`;

export default function Example() {
  return (
    <div className="grid w-full max-w-2xl gap-4">
      <CodeBlock
        tabs={[
          { label: "cURL", code: curl, language: "bash" },
          { label: "Node", code: node, language: "ts" },
          { label: "SQL", code: sql, language: "sql" },
        ]}
        highlightLines={[3]}
        redact={/sk_live_\w+/g}
      />
      <CodeBlock
        filename="webhook-payload.json"
        language="json"
        maxLines={6}
        highlightLines={["4-5"]}
        code={JSON.stringify(
          {
            event: "deal.stage_changed",
            deal_id: "dl_9Qx2",
            from: "proposal",
            to: "closed_won",
            amount: 48000,
            currency: "USD",
            owner: { id: "usr_41", name: "Priya Shah" },
            occurred_at: "2026-09-28T10:14:03Z",
          },
          null,
          2,
        )}
      />
    </div>
  );
}
