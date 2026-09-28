import * as React from "react";
import { Pagination } from "@/components/crm/pagination";

export default function Example() {
  const [page, setPage] = React.useState(4);
  const [compact, setCompact] = React.useState(1);
  return (
    <div className="flex w-[560px] flex-col gap-6">
      <Pagination page={page} pageCount={13} onPageChange={setPage} total={312} pageSize={25} />
      <Pagination page={compact} pageCount={8} onPageChange={setCompact} variant="compact" />
    </div>
  );
}
