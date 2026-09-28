import * as React from "react";
import { BellOff, Bell, Pin, Star, UserPlus, UserCheck } from "lucide-react";
import { Toggle } from "@/components/crm/toggle";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Example() {
  const [muted, setMuted] = React.useState(false);
  const [log, setLog] = React.useState("Try Follow: every second attempt fails and rolls back.");
  const attempts = React.useRef(0);

  return (
    <div className="flex w-[420px] flex-col gap-4 font-crm">
      <div className="flex flex-wrap items-center gap-2">
        <Toggle
          variant="primary"
          icon={<UserPlus />}
          pressedIcon={<UserCheck />}
          pressedChildren="Following"
          count={1284}
          onPressedChange={async (next) => {
            attempts.current += 1;
            await wait(700);
            if (attempts.current % 2 === 0) throw new Error("Network error");
            setLog(next ? "Now following Northwind Traders." : "Unfollowed Northwind Traders.");
          }}
          onError={() => setLog("Could not update follow status. Change rolled back.")}
        >
          Follow
        </Toggle>
        <Toggle variant="outline" icon={<Star />} defaultPressed count={42} aria-label="Star deal">
          Starred
        </Toggle>
        <Toggle icon={<Pin />} aria-label="Pin to sidebar" />
        <Toggle
          pressed={muted}
          onPressedChange={(v) => setMuted(v)}
          icon={<Bell />}
          pressedIcon={<BellOff />}
          pressedChildren="Muted"
        >
          Notifications on
        </Toggle>
        <Toggle disabled icon={<Star />}>
          Archived
        </Toggle>
      </div>
      <p role="status" className="text-xs text-crm-soft">
        {log}
      </p>
    </div>
  );
}
