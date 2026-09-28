import * as React from "react";
import { UsageMeter } from "@/components/crm/usage-meter";

const now = new Date("2026-09-20T10:00:00Z");
const period = { periodStart: "2026-09-01", periodEnd: "2026-10-01", now };

export default function Example() {
  const [seats, setSeats] = React.useState(23);
  return (
    <div className="flex w-full max-w-md flex-col gap-5 rounded-crm border border-crm-border bg-crm-card p-4">
      <UsageMeter
        label="Seats"
        used={seats}
        limit={25}
        unit="seats"
        action={
          <button
            type="button"
            className="text-crm-fg underline"
            onClick={() => setSeats((s) => s + 1)}
          >
            Invite user
          </button>
        }
      />
      <UsageMeter
        label="API calls"
        used={742_300}
        limit={1_000_000}
        unit="calls"
        compact
        {...period}
      />
      <UsageMeter
        label="Email sends"
        used={54_200}
        limit={50_000}
        unit="emails"
        compact
        overageRate={2}
        overageBlock={1000}
        {...period}
      />
      <UsageMeter label="Contacts" used={18_420} limit={null} compact />
      <UsageMeter label="File storage" used={0} limit={100} unit="GB" loading />
    </div>
  );
}
