import * as React from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ProFilePreview, type PreviewFile } from "@/components/crm/pro-file-preview";

// ---- A 48-page contract generated in the browser (no network needed) ----
const CLAUSES = [
  "Services. Provider shall perform the services described in each Order Form with due skill and care.",
  "Fees. Customer shall pay all fees within thirty (30) days of the invoice date, in US dollars.",
  "Term. This Agreement starts on the Effective Date and renews automatically for successive 12-month terms.",
  "Confidentiality. Each party shall protect the other's Confidential Information with reasonable care.",
  "Data Protection. Provider processes Personal Data only on documented instructions from Customer.",
  "Service Levels. Provider targets 99.9% monthly uptime; service credits are the sole remedy for downtime.",
  "Limitation of Liability. Neither party's aggregate liability exceeds fees paid in the prior 12 months.",
  "Indemnification. Provider will defend Customer against third-party claims of IP infringement.",
  "Termination. Either party may terminate for material breach not cured within thirty (30) days.",
  "Governing Law. This Agreement is governed by the laws of the State of Delaware.",
];

async function buildContract(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let p = 0; p < 48; p++) {
    const page = doc.addPage([612, 792]);
    page.drawText("Master Services Agreement - Northwind Traders x Acme Cloud", {
      x: 56,
      y: 750,
      size: 9,
      font,
      color: rgb(0.45, 0.45, 0.5),
    });
    page.drawText(`Section ${p + 1}`, {
      x: 56,
      y: 700,
      size: 20,
      font: bold,
      color: rgb(0.1, 0.1, 0.2),
    });
    let y = 664;
    for (let i = 0; i < 9; i++) {
      const clause = CLAUSES[(p * 3 + i) % CLAUSES.length];
      page.drawText(`${p + 1}.${i + 1}`, { x: 56, y, size: 10, font: bold });
      const words = clause!.split(" ");
      let line = "";
      for (const w of words) {
        if (font.widthOfTextAtSize(`${line} ${w}`, 10.5) > 440) {
          page.drawText(line.trim(), { x: 92, y, size: 10.5, font, color: rgb(0.15, 0.15, 0.2) });
          y -= 15;
          line = "";
        }
        line += ` ${w}`;
      }
      page.drawText(line.trim(), { x: 92, y, size: 10.5, font, color: rgb(0.15, 0.15, 0.2) });
      y -= 30;
    }
    page.drawText(`Page ${p + 1} of 48  |  Confidential`, {
      x: 250,
      y: 36,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.55),
    });
  }
  return doc.save();
}

// ---- A short WAV voicemail synthesised in memory ----
function buildVoicemail(): Blob {
  const rate = 16000;
  const n = rate * 4;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const env = Math.sin(Math.PI * ((t * 2) % 1)) * 0.3;
    v.setInt16(
      44 + i * 2,
      Math.sin(2 * Math.PI * (220 + 40 * Math.sin(t * 3)) * t) * env * 32767,
      true,
    );
  }
  return new Blob([buf], { type: "audio/wav" });
}

// ---- An org chart screenshot as an SVG image ----
const chart = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="#f8fafc"/><text x="80" y="110" font-family="Helvetica" font-size="44" font-weight="700" fill="#0f172a">Q3 pipeline by stage</text>${[
    ["Prospecting", 1240, "#6366f1"],
    ["Qualified", 980, "#8b5cf6"],
    ["Demo", 720, "#0ea5e9"],
    ["Proposal", 460, "#14b8a6"],
    ["Negotiation", 280, "#f59e0b"],
    ["Closed won", 170, "#22c55e"],
  ]
    .map(
      ([l, val, c], i) =>
        `<text x="80" y="${230 + i * 120}" font-family="Helvetica" font-size="26" fill="#334155">${l}</text><rect x="330" y="${195 + i * 120}" width="${val}" height="54" rx="8" fill="${c}"/><text x="${350 + Number(val)}" y="${231 + i * 120}" font-family="Helvetica" font-size="24" fill="#0f172a">$${(Number(val) * 3.2).toFixed(0)}k</text>`,
    )
    .join("")}</svg>`,
)}`;

const handler = `import { z } ${"from"} "zod";
import { db } ${"from"} "@/lib/db";
import { stripe } ${"from"} "@/lib/stripe";

const Body = z.object({
  accountId: z.string().uuid(),
  seats: z.number().int().min(1).max(5000),
  plan: z.enum(["starter", "growth", "enterprise"]),
});

/** Upgrades a workspace plan and prorates the invoice immediately. */
${"export"} async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 422 });
  const { accountId, seats, plan } = parsed.data;

  const account = await db.account.findUniqueOrThrow({ where: { id: accountId } });
  const sub = await stripe.subscriptions.update(account.subscriptionId, {
    items: [{ id: account.itemId, price: PRICES[plan], quantity: seats }],
    proration_behavior: "always_invoice",
  });

  await db.auditLog.create({
    data: { accountId, action: "plan.upgraded", meta: { plan, seats, sub: sub.id } },
  });
  return Response.json({ ok: true, status: sub.status });
}
`.repeat(1);

const sql = `-- Net revenue retention by signup cohort
WITH cohorts AS (
  SELECT account_id, date_trunc('month', created_at) AS cohort
  FROM accounts
  WHERE created_at >= now() - interval '24 months'
),
mrr AS (
  SELECT account_id, date_trunc('month', period_start) AS month, sum(amount_cents) / 100.0 AS mrr
  FROM invoice_lines
  GROUP BY 1, 2
)
SELECT c.cohort,
       m.month,
       round(sum(m.mrr) / nullif(first_value(sum(m.mrr)) OVER w, 0) * 100, 1) AS nrr_pct
FROM cohorts c
JOIN mrr m USING (account_id)
GROUP BY c.cohort, m.month
WINDOW w AS (PARTITION BY c.cohort ORDER BY m.month)
ORDER BY 1, 2;
`;

// ~250 additional generated attachments exercise the virtualised gallery strip.
const reportExports: PreviewFile[] = Array.from({ length: 250 }, (_, i) => {
  const id = String(i + 1).padStart(4, "0");
  return {
    id: `inv-${id}`,
    name: `invoice-INV-${id}.json`,
    size: 1800 + ((i * 97) % 900),
    meta: "Synced from billing",
    content: JSON.stringify(
      {
        id: `INV-${id}`,
        customer: ["Northwind", "Globex", "Initech", "Umbrella", "Stark Industries"][i % 5],
        issued: `2026-${String((i % 9) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
        currency: "USD",
        lines: [
          { sku: "SEAT-GROWTH", qty: 20 + (i % 40), unit: 49 },
          { sku: "API-CALLS-1M", qty: 1 + (i % 6), unit: 120 },
        ],
        status: i % 7 === 0 ? "overdue" : "paid",
      },
      null,
      2,
    ),
  };
});

export default function Example() {
  const [contract, setContract] = React.useState<Uint8Array | null>(null);
  const voicemail = React.useMemo(() => buildVoicemail(), []);
  React.useEffect(() => {
    buildContract().then(setContract);
  }, []);

  const files = React.useMemo<PreviewFile[]>(
    () => [
      {
        id: "msa",
        name: "Northwind-MSA-v7-redlined.pdf",
        mimeType: "application/pdf",
        src: contract ?? undefined,
        size: contract?.byteLength,
        meta: "Uploaded by Priya Shah - 2h ago",
      },
      {
        id: "chart",
        name: "q3-pipeline.svg",
        src: chart,
        size: 4200,
        meta: "From weekly forecast deck",
      },
      {
        id: "api",
        name: "upgrade-plan.ts",
        content: handler,
        size: handler.length,
        meta: "PR #1842",
      },
      {
        id: "sql",
        name: "nrr-by-cohort.sql",
        content: sql,
        size: sql.length,
        meta: "Metabase export",
      },
      {
        id: "vm",
        name: "voicemail-cfo-northwind.wav",
        src: voicemail,
        mimeType: "audio/wav",
        size: voicemail.size,
        meta: "Call recording - 0:04",
      },
      { id: "zip", name: "security-questionnaire.xlsx", size: 88_214, meta: "Needs review" },
      ...reportExports,
    ],
    [contract, voicemail],
  );

  return (
    <div className="bg-crm-bg p-6">
      <ProFilePreview
        files={files}
        loading={!contract}
        height={720}
        onDownload={(f) => console.info("download", f.name)}
      />
      <p className="mt-3 text-xs text-crm-muted-fg">
        Left / Right switch files, + / - / 0 zoom, R rotates, Ctrl+F searches the PDF (try
        "liability").
      </p>
    </div>
  );
}
