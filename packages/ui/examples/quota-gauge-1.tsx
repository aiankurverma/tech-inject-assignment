import { QuotaGauge } from "@/components/crm/quota-gauge";

export default function Example() {
  return (
    <div className="flex flex-wrap gap-6">
      <div className="rounded-crm border border-crm-border bg-crm-card p-4">
        <p className="mb-3 crm-eyebrow text-crm-muted-fg">Q3 · Priya Sharma</p>
        <QuotaGauge
          closed={286_000}
          quota={380_000}
          forecast={72_000}
          periodStart="2026-07-01"
          periodEnd="2026-09-30"
          asOf="2026-09-02"
        />
      </div>
      <div className="rounded-crm border border-crm-border bg-crm-card p-4">
        <p className="mb-3 crm-eyebrow text-crm-muted-fg">Q3 · Rahul Verma</p>
        <QuotaGauge
          closed={88_000}
          quota={180_000}
          forecast={31_000}
          periodStart="2026-07-01"
          periodEnd="2026-09-30"
          asOf="2026-09-02"
          size={180}
        />
      </div>
      <div className="rounded-crm border border-crm-border bg-crm-card p-4">
        <p className="mb-3 crm-eyebrow text-crm-muted-fg">FY26 · EMEA team (EUR)</p>
        <QuotaGauge
          closed={4_150_000}
          quota={4_000_000}
          currency="EUR"
          locale="de-DE"
          periodStart="2026-01-01"
          periodEnd="2026-12-31"
          asOf="2026-09-02"
          size={180}
        />
      </div>
    </div>
  );
}
