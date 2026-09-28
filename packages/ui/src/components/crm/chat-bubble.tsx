import * as React from "react";
import { AlertCircle, Check, CheckCheck, Clock, FileText, RotateCw } from "lucide-react";
import { Avatar } from "@/components/crm/avatar";
import { cn } from "@/lib/utils";

export type ChatDelivery = "sending" | "sent" | "delivered" | "read" | "failed";

export interface ChatAttachment {
  name: string;
  /** Size in bytes. */
  size: number;
  href?: string;
  /** Image URL renders a thumbnail instead of a file row. */
  thumbnail?: string;
}

export interface ChatBubbleProps {
  /** Message body. URLs are linkified; line breaks are kept. */
  text?: string;
  author: { name: string; src?: string; role?: string };
  at: Date | string | number;
  /** Outgoing messages (agent/you) sit on the right in the primary colour. */
  outgoing?: boolean;
  /** Private note visible to the team only (support desks). */
  internal?: boolean;
  delivery?: ChatDelivery;
  onRetry?: () => void;
  /** Quoted message this replies to. */
  replyTo?: { author: string; text: string };
  attachments?: ChatAttachment[];
  edited?: boolean;
  /**
   * Position inside a run of consecutive messages from the same author. Middle and last hide
   * the avatar and name and tighten corners, like iMessage / Intercom.
   */
  groupPosition?: "single" | "first" | "middle" | "last";
  /** Render as the "is typing" indicator instead of a message. */
  typing?: boolean;
  locale?: string;
  children?: React.ReactNode;
  className?: string;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noreferrer noopener"
            className="break-all underline underline-offset-2"
          >
            {p}
          </a>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

const deliveryMeta: Record<ChatDelivery, { icon: typeof Check; label: string }> = {
  sending: { icon: Clock, label: "Sending" },
  sent: { icon: Check, label: "Sent" },
  delivered: { icon: CheckCheck, label: "Delivered" },
  read: { icon: CheckCheck, label: "Read" },
  failed: { icon: AlertCircle, label: "Failed to send" },
};

/**
 * Live-chat message bubble for support inboxes and deal rooms: incoming/outgoing alignment,
 * grouped runs, internal notes, reply quotes, attachments with sizes, linkified text, delivery
 * ticks with retry on failure, and a typing indicator.
 */
export function ChatBubble({
  text,
  author,
  at,
  outgoing,
  internal,
  delivery,
  onRetry,
  replyTo,
  attachments = [],
  edited,
  groupPosition = "single",
  typing,
  locale,
  children,
  className,
}: ChatBubbleProps) {
  const date = new Date(at);
  const time = Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
  const showHead = groupPosition === "single" || groupPosition === "first";
  const showAvatar = groupPosition === "single" || groupPosition === "last";
  const meta = delivery ? deliveryMeta[delivery] : null;
  const DeliveryIcon = meta?.icon;

  const corners = outgoing
    ? cn(
        groupPosition === "first" && "rounded-br-md",
        groupPosition === "middle" && "rounded-r-md",
        groupPosition === "last" && "rounded-tr-md",
      )
    : cn(
        groupPosition === "first" && "rounded-bl-md",
        groupPosition === "middle" && "rounded-l-md",
        groupPosition === "last" && "rounded-tl-md",
      );

  return (
    <div
      className={cn(
        "flex items-end gap-2 font-crm",
        outgoing && "flex-row-reverse",
        groupPosition === "first" || groupPosition === "middle" ? "mb-0.5" : "mb-3",
        className,
      )}
    >
      <span className="w-8 shrink-0" aria-hidden={!showAvatar}>
        {showAvatar ? <Avatar name={author.name} src={author.src} size="md" /> : null}
      </span>
      <div
        className={cn(
          "flex max-w-[min(80%,520px)] min-w-0 flex-col",
          outgoing ? "items-end" : "items-start",
        )}
      >
        {showHead ? (
          <p className="mb-1 flex items-center gap-1.5 px-1 crm-caption text-crm-soft">
            <span className="font-medium text-crm-chip">{author.name}</span>
            {author.role ? <span>· {author.role}</span> : null}
            {internal ? (
              <span className="rounded-full bg-crm-warning/15 px-1.5 text-[10px] text-crm-warning">
                Internal note
              </span>
            ) : null}
          </p>
        ) : null}
        <div
          role={typing ? "status" : undefined}
          aria-label={typing ? `${author.name} is typing` : undefined}
          className={cn(
            "rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap",
            internal
              ? "border border-dashed border-crm-warning/40 bg-crm-warning/10 text-crm-fg"
              : outgoing
                ? "bg-crm-primary text-crm-primary-fg"
                : "bg-crm-raised text-crm-fg shadow-crm-raised",
            delivery === "failed" && "opacity-70",
            corners,
          )}
        >
          {typing ? (
            <span className="flex h-5 items-center gap-1" aria-hidden>
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="size-1.5 animate-bounce rounded-full bg-current opacity-60 motion-reduce:animate-none"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </span>
          ) : (
            <>
              {replyTo ? (
                <blockquote
                  className={cn(
                    "mb-1.5 border-l-2 pl-2 text-xs",
                    outgoing && !internal
                      ? "border-white/50 text-white/80"
                      : "border-crm-input text-crm-soft",
                  )}
                >
                  <span className="block font-medium">{replyTo.author}</span>
                  <span className="line-clamp-2">{replyTo.text}</span>
                </blockquote>
              ) : null}
              {text ? <Linkified text={text} /> : null}
              {children}
              {attachments.length ? (
                <ul className={cn("flex flex-col gap-1.5", (text || children) && "mt-2")}>
                  {attachments.map((a, i) => (
                    <li key={`${a.name}-${i}`}>
                      {a.thumbnail ? (
                        <a
                          href={a.href ?? a.thumbnail}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="block"
                        >
                          <img
                            src={a.thumbnail}
                            alt={a.name}
                            className="max-h-48 rounded-lg object-cover"
                          />
                        </a>
                      ) : (
                        <a
                          href={a.href}
                          download={a.href ? a.name : undefined}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                            outgoing && !internal ? "bg-white/15" : "bg-crm-muted",
                          )}
                        >
                          <FileText className="size-4 shrink-0" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{a.name}</span>
                          <span className="shrink-0 tabular-nums opacity-70">
                            {formatBytes(a.size)}
                          </span>
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
        {!typing &&
        (groupPosition === "single" || groupPosition === "last" || delivery === "failed") ? (
          <p className="mt-1 flex items-center gap-1 px-1 crm-caption text-crm-subtle">
            <time dateTime={Number.isNaN(date.getTime()) ? undefined : date.toISOString()}>
              {time}
            </time>
            {edited ? <span>· edited</span> : null}
            {meta && DeliveryIcon && outgoing ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  delivery === "read" && "text-crm-status",
                  delivery === "failed" && "text-crm-danger",
                )}
              >
                <DeliveryIcon className="size-3" role="img" aria-label={meta.label} />
                {delivery === "failed" ? (
                  <>
                    Not sent
                    {onRetry ? (
                      <button
                        type="button"
                        onClick={onRetry}
                        className="ml-1 inline-flex items-center gap-0.5 underline outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                      >
                        <RotateCw className="size-3" aria-hidden /> Retry
                      </button>
                    ) : null}
                  </>
                ) : null}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
