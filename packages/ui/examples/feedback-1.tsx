import { Skeleton } from "@/components/crm/feedback";

export default function Example() {
  return (
    <div className="flex w-[420px] flex-col gap-3" aria-busy="true" aria-label="Loading companies">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
