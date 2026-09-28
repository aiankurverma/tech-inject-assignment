import * as React from "react";
import { RichTextToolbar } from "@/components/crm/rich-text-toolbar";

const initial = `## Call notes — Acme Logistics
Spoke with **Priya Raman** (VP Ops) about the fleet expansion.

- Wants rollout to 120 trucks before _peak season_
- Security review owned by Tom Becker

Next steps:
1. Send revised pricing
2. Book technical deep dive`;

export default function Example() {
  const [value, setValue] = React.useState(initial);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  return (
    <div className="w-full max-w-[640px] overflow-hidden rounded-xl border border-crm-border bg-crm-raised font-crm">
      <RichTextToolbar targetRef={ref} value={value} onChange={setValue} maxLength={2000} />
      <label htmlFor="rtt-notes" className="sr-only">
        Call notes
      </label>
      <textarea
        id="rtt-notes"
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={12}
        className="block w-full resize-y bg-transparent p-3 font-mono text-[13px] leading-5 text-crm-fg outline-none placeholder:text-crm-subtle"
        placeholder="Write notes in markdown…"
      />
      <p className="border-t border-crm-border px-3 py-2 text-[11px] text-crm-subtle">
        Tip: select text and press ⌘/Ctrl+B. Press Enter inside a list to continue it.
      </p>
    </div>
  );
}
