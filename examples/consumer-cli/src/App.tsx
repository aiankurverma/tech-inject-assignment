import { useState } from "react";
import { Bell, Download, Plus, Search } from "lucide-react";
import { StatusBadge } from "@/components/crm/badge";
import { Button, IconButton } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { MoneyValue } from "@/components/crm/data-cells";
import {
  Table,
  TableBody,
  TableCell,
  TableFooterBar,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/crm/data-table";
import { FilterSelect } from "@/components/crm/filter-select";
import { PageHeader, ProfileChip } from "@/components/crm/page-header";
import { SegmentedMeter } from "@/components/crm/segmented-meter";
import { TagList } from "@/components/crm/tag";

// Consumer check: every component here was added with `npx <site>/cli/kitbase.tgz add <slug>`.
const rows = [
  { name: "Apple", value: 530111, win: 82 },
  { name: "Snowflake", value: 520000, win: 24 },
];

export function App() {
  const [sort, setSort] = useState("Pipeline Value");
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Companies"
        badge={<StatusBadge>Active</StatusBadge>}
        actions={
          <>
            <IconButton label="Search">
              <Search />
            </IconButton>
            <IconButton label="Notifications" dot>
              <Bell />
            </IconButton>
            <ProfileChip name="Jensen Ackles" />
          </>
        }
      />
      <div className="flex items-center gap-2 px-4 py-3">
        <FilterSelect
          label="Sort by"
          value={sort}
          onValueChange={setSort}
          options={["Pipeline Value", "Win Probability"]}
        />
        <Button className="ml-auto">
          <Download /> Export
        </Button>
        <Button variant="primary">
          <Plus /> New Company
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead>Companies</TableHead>
            <TableHead>Segment</TableHead>
            <TableHead align="right">Pipeline Value</TableHead>
            <TableHead>Win Probability</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.name} selected={picked.includes(r.name)}>
              <TableCell>
                <Checkbox
                  aria-label={`Select ${r.name}`}
                  checked={picked.includes(r.name)}
                  onCheckedChange={() =>
                    setPicked((p) =>
                      p.includes(r.name) ? p.filter((x) => x !== r.name) : [...p, r.name],
                    )
                  }
                />
              </TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>
                <TagList tags={[{ label: "Enterprise", color: "blue" }]} />
              </TableCell>
              <TableCell align="right">
                <MoneyValue amount={r.value} />
              </TableCell>
              <TableCell>
                <SegmentedMeter value={r.win} showValue label="Win probability" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TableFooterBar
        cells={[
          { label: "Companies in view", value: rows.length },
          { label: "Add Calculation", onAdd: () => {} },
        ]}
      />
    </div>
  );
}
