import { TruncatedText } from "@/components/crm/truncated-text";

export default function Example() {
  return (
    <div className="w-80">
      <TruncatedText lines={2}>
        Met with the Acme procurement team to review the renewal. They want a three-year term with a
        12% discount, SSO included in the base plan, and a dedicated success manager. Legal flagged
        the data residency clause; we agreed to send an updated DPA by Friday and schedule a
        follow-up with their security lead next week.
      </TruncatedText>
    </div>
  );
}
