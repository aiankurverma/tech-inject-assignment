import * as React from "react";
import { Alert } from "@/components/crm/alert";
import { Button } from "@/components/crm/button";

export default function Example() {
  const [shown, setShown] = React.useState(true);
  return (
    <div className="flex w-[440px] flex-col gap-3">
      <Alert title="Mailbox connected">We'll log emails with known contacts automatically.</Alert>
      <Alert tone="success" title="Import finished">
        1,248 contacts added, 12 duplicates merged.
      </Alert>
      {shown ? (
        <Alert
          tone="warning"
          title="3 deals are past their close date"
          onDismiss={() => setShown(false)}
          action={<Button size="sm">Review deals</Button>}
        >
          Update the close date or mark them lost to keep the forecast accurate.
        </Alert>
      ) : null}
      <Alert tone="danger" title="Salesforce sync failed">
        Token expired. Reconnect the integration in Settings.
      </Alert>
    </div>
  );
}
