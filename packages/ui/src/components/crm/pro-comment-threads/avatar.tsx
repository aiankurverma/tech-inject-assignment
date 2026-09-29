import { cn } from "@/lib/utils";
import type { CommentUser } from "@/components/crm/pro-comment-threads/types";

const PALETTE = ["#4124fb", "#16a34a", "#d97706", "#db2777", "#0891b2", "#7c3aed", "#dc2626"];

function hue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}

export function Avatar({
  user,
  size = 24,
  className,
}: {
  user: CommentUser | undefined;
  size?: number;
  className?: string;
}) {
  const name = user?.name ?? "Unknown user";
  return (
    <span
      aria-hidden
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.4),
        background: user?.avatarUrl ? undefined : hue(user?.id ?? name),
      }}
    >
      {user?.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
