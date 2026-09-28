import { InlineCode } from "@/components/crm/inline-code";

export default function Example() {
  return (
    <div className="max-w-md space-y-3 font-crm text-sm leading-6 text-crm-soft">
      <p>
        Stripe customer{" "}
        <InlineCode copyable maxChars={14}>
          cus_Q8fK2mZr7VnT4pL9Q91z
        </InlineCode>{" "}
        is linked to account <InlineCode copyable>acc_northwind</InlineCode>.
      </p>
      <p>
        Map the CSV column <InlineCode>annual_revenue</InlineCode> to the field{" "}
        <InlineCode tone="primary">company.arr</InlineCode>. Rows with{" "}
        <InlineCode tone="danger">email = null</InlineCode> will be skipped.
      </p>
      <p>
        Run <InlineCode copyable>npx kitbase add money</InlineCode> to install.
      </p>
    </div>
  );
}
