import { Avatar } from "@/components/crm/avatar";
import { cn } from "@/lib/utils";

const overlap = { xs: "-ml-1", sm: "-ml-1.5", md: "-ml-1.5", lg: "-ml-4" } as const;
const overflowSize = {
  xs: "size-4 text-[8px]",
  sm: "size-5 text-[9px]",
  md: "size-8 text-xs",
  lg: "size-12 text-sm",
} as const;

export interface AvatarGroupPerson {
  name: string;
  src?: string;
}

export interface AvatarGroupProps {
  people: AvatarGroupPerson[];
  /** How many avatars to show before collapsing the rest into "+N". */
  max?: number;
  size?: keyof typeof overlap;
  /** Accessible label for the whole group. Defaults to a list of names. */
  label?: string;
  className?: string;
}

/** Overlapping stack of avatars with a "+N" overflow bubble listing the hidden names on hover. */
export function AvatarGroup({ people, max = 4, size = "sm", label, className }: AvatarGroupProps) {
  const shown = people.slice(0, max);
  const hidden = people.slice(max);
  return (
    <span
      role="group"
      aria-label={label ?? people.map((p) => p.name).join(", ")}
      className={cn("inline-flex items-center", className)}
    >
      {shown.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          name={p.name}
          src={p.src}
          size={size}
          className={cn("shrink-0 rounded-full ring-2 ring-crm-bg", i > 0 && overlap[size])}
        />
      ))}
      {hidden.length ? (
        <span
          title={hidden.map((p) => p.name).join(", ")}
          aria-label={`${hidden.length} more: ${hidden.map((p) => p.name).join(", ")}`}
          className={cn(
            "grid shrink-0 place-items-center rounded-full bg-crm-raised font-crm font-medium text-crm-soft ring-2 ring-crm-bg",
            overflowSize[size],
            shown.length > 0 && overlap[size],
          )}
        >
          +{hidden.length}
        </span>
      ) : null}
    </span>
  );
}
