import * as React from "react";
import { NewsletterSignup } from "@/components/crm/newsletter-signup";

export default function Example() {
  return (
    <div className="grid w-full max-w-3xl gap-6 md:grid-cols-2">
      <NewsletterSignup
        requireWorkEmail
        subscriberCount={18420}
        topics={[
          { id: "playbooks", label: "Sales playbooks", cadence: "Weekly", defaultSelected: true },
          { id: "benchmarks", label: "Pipeline benchmarks", cadence: "Monthly" },
          { id: "product", label: "Product updates", cadence: "As released" },
        ]}
        onSubscribe={async ({ email }) => {
          await new Promise((r) => setTimeout(r, 900));
          if (email.startsWith("taken@")) throw new Error("This address is already subscribed.");
        }}
      />
      <NewsletterSignup
        layout="inline"
        doubleOptIn={false}
        title="Customer success digest"
        description="One email a month: renewal tactics and churn research."
        onSubscribe={() => new Promise<void>((r) => setTimeout(r, 600))}
      />
    </div>
  );
}
