import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { Check, ChevronDown, ChevronUp, Copy, X } from "lucide-react";
import { JsonDiffView } from "@/components/crm/pro-audit-log/json-diff";
import { actionTone, formatFullTime, toneClass } from "@/components/crm/pro-audit-log/format";
import type { AuditEvent } from "@/components/crm/pro-audit-log/types";
import { cn } from "@/lib/utils";

export interface AuditEventDrawerProps {
  event: AuditEvent | null;
  onOpenChange: (open: boolean) => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** Extra content under the metadata list, e.g. "Open record" links. */
  renderActions?: (event: AuditEvent) => React.ReactNode;
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-crm-muted-fg">{label}</dt>
      <dd className="min-w-0 break-words text-crm-fg">{children}</dd>
    </div>
  );
}

function pretty(v: unknown) {
  if (v === undefined) return "—";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/** Right-hand sheet with event metadata, before/after diff and raw JSON. J/K step through rows. */
export function AuditEventDrawer({
  event,
  onOpenChange,
  onPrev,
  onNext,
  renderActions,
}: AuditEventDrawerProps) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    if (!event) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(event, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest("input,textarea")) return;
    if (e.key === "j" || (e.key === "ArrowDown" && e.altKey)) {
      e.preventDefault();
      onNext?.();
    } else if (e.key === "k" || (e.key === "ArrowUp" && e.altKey)) {
      e.preventDefault();
      onPrev?.();
    }
  };

  return (
    <Dialog.Root open={event !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          onKeyDown={onKeyDown}
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl animate-crm-sheet-in flex-col border-l border-crm-border bg-crm-bg text-crm-fg shadow-crm-overlay outline-none"
        >
          {event && (
            <>
              <header className="flex items-start gap-3 border-b border-crm-border p-4">
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "inline-flex rounded px-1.5 py-0.5 font-mono text-xs",
                      toneClass[actionTone(event.action)],
                    )}
                  >
                    {event.action}
                  </span>
                  <Dialog.Title className="mt-1.5 truncate text-base font-semibold">
                    {event.actor.name} · {event.resource.name ?? event.resource.id}
                  </Dialog.Title>
                  <p className="text-xs text-crm-muted-fg">{formatFullTime(event.occurredAt)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton label="Previous event (K)" onClick={onPrev} disabled={!onPrev}>
                    <ChevronUp className="size-4" />
                  </IconButton>
                  <IconButton label="Next event (J)" onClick={onNext} disabled={!onNext}>
                    <ChevronDown className="size-4" />
                  </IconButton>
                  <IconButton label={copied ? "Copied" : "Copy event JSON"} onClick={copy}>
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </IconButton>
                  <Dialog.Close asChild>
                    <IconButton label="Close">
                      <X className="size-4" />
                    </IconButton>
                  </Dialog.Close>
                </div>
              </header>
              <div className="flex-1 overflow-y-auto p-4">
                <dl className="divide-y divide-crm-border">
                  <Meta label="Actor">
                    {event.actor.name}
                    {event.actor.email && (
                      <span className="text-crm-muted-fg"> · {event.actor.email}</span>
                    )}
                    {event.actor.kind && event.actor.kind !== "user" && (
                      <span className="ml-2 rounded bg-crm-muted px-1 text-xs text-crm-soft">
                        {event.actor.kind.replace("_", " ")}
                      </span>
                    )}
                  </Meta>
                  <Meta label="Resource">
                    <span className="font-mono text-xs">
                      {event.resource.type}/{event.resource.id}
                    </span>
                  </Meta>
                  <Meta label="Outcome">
                    <span
                      className={cn(
                        event.outcome === "failure" && "text-crm-danger",
                        event.outcome === "denied" && "text-crm-warning",
                        (!event.outcome || event.outcome === "success") && "text-crm-success",
                      )}
                    >
                      {event.outcome ?? "success"}
                    </span>
                  </Meta>
                  {event.ip && (
                    <Meta label="Source">
                      <span className="font-mono text-xs">{event.ip}</span>
                      {event.location && (
                        <span className="text-crm-muted-fg"> · {event.location}</span>
                      )}
                    </Meta>
                  )}
                  {event.userAgent && <Meta label="User agent">{event.userAgent}</Meta>}
                  {event.requestId && (
                    <Meta label="Request ID">
                      <span className="font-mono text-xs">{event.requestId}</span>
                    </Meta>
                  )}
                </dl>
                {renderActions && <div className="mt-3 flex gap-2">{renderActions(event)}</div>}
                <Tabs.Root defaultValue="diff" className="mt-5">
                  <Tabs.List
                    aria-label="Change view"
                    className="mb-3 flex gap-1 border-b border-crm-border"
                  >
                    {[
                      ["diff", "Changes"],
                      ["side", "Before / after"],
                      ["raw", "Raw event"],
                    ].map(([v, l]) => (
                      <Tabs.Trigger
                        key={v}
                        value={v!}
                        className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-crm-muted-fg outline-none focus-visible:text-crm-fg data-[state=active]:border-crm-primary data-[state=active]:text-crm-fg"
                      >
                        {l}
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>
                  <Tabs.Content value="diff" className="outline-none">
                    <JsonDiffView before={event.before} after={event.after} />
                  </Tabs.Content>
                  <Tabs.Content value="side" className="grid grid-cols-2 gap-2 outline-none">
                    {(
                      [
                        ["Before", event.before],
                        ["After", event.after],
                      ] as const
                    ).map(([label, v]) => (
                      <section key={label} aria-label={label} className="min-w-0">
                        <h3 className="mb-1 text-xs text-crm-muted-fg">{label}</h3>
                        <pre className="max-h-96 overflow-auto rounded-crm border border-crm-border bg-crm-card p-2 font-mono text-[11px] leading-relaxed text-crm-soft">
                          {pretty(v)}
                        </pre>
                      </section>
                    ))}
                  </Tabs.Content>
                  <Tabs.Content value="raw" className="outline-none">
                    <pre className="max-h-[28rem] overflow-auto rounded-crm border border-crm-border bg-crm-card p-2 font-mono text-[11px] leading-relaxed text-crm-soft">
                      {pretty(event)}
                    </pre>
                  </Tabs.Content>
                </Tabs.Root>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const IconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
>(function IconButton({ label, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-crm text-crm-soft hover:bg-crm-muted hover:text-crm-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-crm-ring disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
});
