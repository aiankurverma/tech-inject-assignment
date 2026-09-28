import * as React from "react";
import { Building2, Mail, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { TagList, type TagColor } from "@/components/crm/tag";

export interface ContactCardProps {
  name: string;
  title?: string;
  company?: string;
  avatar?: string;
  email?: string;
  phone?: string;
  location?: string;
  tags?: { label: string; color: TagColor }[];
  /** Owner / last-touch line at the bottom. */
  footer?: React.ReactNode;
  /** Buttons in the top-right (e.g. a DropdownMenu trigger). */
  actions?: React.ReactNode;
  /** "card" = full details, "compact" = one row for lists and popovers. */
  variant?: "card" | "compact";
  onClick?: () => void;
  className?: string;
}

/** Person summary with avatar, role, company, contact links and tags. Clickable when onClick is set. */
export function ContactCard({
  name,
  title,
  company,
  avatar,
  email,
  phone,
  location,
  tags,
  footer,
  actions,
  variant = "card",
  onClick,
  className,
}: ContactCardProps) {
  const role = [title, company].filter(Boolean).join(" · ");
  const Wrapper = onClick ? "button" : "div";
  if (variant === "compact") {
    return (
      <Wrapper
        {...(onClick ? { type: "button" as const, onClick } : {})}
        className={cn(
          "flex w-full items-center gap-3 rounded-crm px-2 py-2 text-left font-crm",
          onClick &&
            "cursor-pointer outline-none hover:bg-crm-card focus-visible:ring-2 focus-visible:ring-crm-ring/60",
          className,
        )}
      >
        <Avatar name={name} src={avatar} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-crm-fg">{name}</span>
          {role ? <span className="block truncate text-xs text-crm-soft">{role}</span> : null}
        </span>
        {tags?.length ? <TagList tags={tags} max={1} size="sm" /> : null}
      </Wrapper>
    );
  }
  const link =
    "flex min-w-0 items-center gap-2 rounded text-xs text-crm-soft outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-crm-subtle";
  return (
    <article
      aria-label={name}
      className={cn(
        "relative flex flex-col gap-4 rounded-xl border border-crm-border bg-crm-card p-4 font-crm shadow-crm-raised",
        className,
      )}
    >
      <header className="flex items-start gap-3">
        <Avatar name={name} src={avatar} size="lg" />
        <div className="min-w-0 flex-1 pt-1">
          {onClick ? (
            <button
              type="button"
              onClick={onClick}
              className="truncate text-left text-base font-semibold text-crm-fg outline-none after:absolute after:inset-0 after:rounded-xl hover:underline focus-visible:after:ring-2 focus-visible:after:ring-crm-ring/60"
            >
              {name}
            </button>
          ) : (
            <h3 className="truncate text-base font-semibold text-crm-fg">{name}</h3>
          )}
          {title ? <p className="mt-1 truncate text-xs text-crm-soft">{title}</p> : null}
        </div>
        {actions ? <div className="relative z-10 flex gap-1">{actions}</div> : null}
      </header>
      <div className="relative z-10 flex flex-col gap-2">
        {company ? (
          <span className={link}>
            <Building2 />
            <span className="truncate">{company}</span>
          </span>
        ) : null}
        {email ? (
          <a href={`mailto:${email}`} className={link}>
            <Mail />
            <span className="truncate">{email}</span>
          </a>
        ) : null}
        {phone ? (
          <a href={`tel:${phone.replace(/\s+/g, "")}`} className={link}>
            <Phone />
            <span className="truncate">{phone}</span>
          </a>
        ) : null}
        {location ? (
          <span className={link}>
            <MapPin />
            <span className="truncate">{location}</span>
          </span>
        ) : null}
      </div>
      {tags?.length ? <TagList tags={tags} max={3} size="sm" /> : null}
      {footer ? (
        <footer className="border-t border-crm-border pt-3 text-xs text-crm-subtle">
          {footer}
        </footer>
      ) : null}
    </article>
  );
}
