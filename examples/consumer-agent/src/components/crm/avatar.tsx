import * as React from "react";
import { cn } from "@/lib/utils";

const sizes = {
  xs: "size-4 text-[8px]",
  sm: "size-5 text-[9px]",
  md: "size-8 text-xs",
  lg: "size-12 text-sm",
} as const;

export interface AvatarProps {
  name: string;
  src?: string;
  size?: keyof typeof sizes;
  /** Small image or node in the bottom-right corner (e.g. a company logo). */
  badge?: React.ReactNode;
  className?: string;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

/** Round avatar with initials fallback when the image is missing or fails. */
export function Avatar({ name, src, size = "sm", badge, className }: AvatarProps) {
  const [failed, setFailed] = React.useState(false);
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "relative grid place-items-center overflow-hidden rounded-full bg-crm-muted font-crm font-medium text-crm-chip",
          sizes[size],
        )}
      >
        {src && !failed ? (
          <img
            src={src}
            alt={name}
            className="absolute inset-0 size-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <span aria-label={name}>{initials(name)}</span>
        )}
      </span>
      {badge ? (
        <span className="absolute -right-0.5 -bottom-0.5 grid size-3 place-items-center overflow-hidden rounded-[3px] bg-crm-bg ring-1 ring-crm-bg [&>*]:size-full">
          {badge}
        </span>
      ) : null}
    </span>
  );
}

export interface LogoTileProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md" | "lg";
}

/** Rounded square that holds a company logo or icon. */
export function LogoTile({ size = "md", className, ...props }: LogoTileProps) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-crm bg-crm-muted text-crm-fg shadow-crm-raised [&_svg]:size-1/2 [&_img]:size-3/5 [&_img]:object-contain",
        size === "sm" ? "size-5 rounded-[5px]" : size === "md" ? "size-8" : "size-12 rounded-xl",
        className,
      )}
      {...props}
    />
  );
}
