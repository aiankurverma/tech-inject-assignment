import * as React from "react";
import {
  ProWebTerminal,
  createDemoShell,
  type CommandEntry,
} from "@/components/crm/pro-web-terminal";

// Swap createDemoShell for a WebSocket PTY factory in production, e.g.
// (ctx) => { const ws = new WebSocket(`/pty/${ctx.id}?cols=${ctx.cols}&rows=${ctx.rows}`); ... }
const shell = createDemoShell({ user: "maya", host: "acme-prod-bastion", cwd: "~/acme-api" });

export default function Example() {
  const [audit, setAudit] = React.useState<CommandEntry[]>([]);
  return (
    <div className="space-y-3 p-4">
      <ProWebTerminal
        shell={shell}
        initialTabs={2}
        height={440}
        onCommand={(e) => setAudit((a) => [e, ...a].slice(0, 5))}
      />
      <div className="rounded-crm border border-crm-border bg-crm-card p-3 text-xs">
        <div className="mb-1 font-medium text-crm-fg">Audit log</div>
        {audit.length === 0 ? (
          <p className="text-crm-muted-fg">Try: help, npm test, deploy, kubectl, git log</p>
        ) : (
          <ul className="space-y-0.5 font-mono text-crm-muted-fg">
            {audit.map((a) => (
              <li key={`${a.sessionId}-${a.at}`}>
                {new Date(a.at).toLocaleTimeString()} · {a.sessionId} · {a.command}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
