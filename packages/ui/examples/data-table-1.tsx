import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Avatar } from "@/components/crm/avatar";
import { Checkbox } from "@/components/crm/checkbox";
import { DateCell, MoneyValue } from "@/components/crm/data-cells";
import {
  Table,
  TableBody,
  TableCell,
  TableFooterBar,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/crm/data-table";
import { SegmentedMeter } from "@/components/crm/segmented-meter";
import { Sparkline } from "@/components/crm/sparkline";
import { TagList, type TagColor } from "@/components/crm/tag";

const rows: {
  name: string;
  tags: { label: string; color: TagColor }[];
  owner: string;
  deals: number;
  value: number;
  win: number;
  date: string;
  type: string;
}[] = [
  {
    name: "Apple",
    tags: [{ label: "Pilot", color: "orange" }],
    owner: "Alex Santos",
    deals: 6,
    value: 530111,
    win: 82,
    date: "Mar 12",
    type: "Exec",
  },
  {
    name: "Snowflake",
    tags: [
      { label: "Enterprise", color: "blue" },
      { label: "Mid-Market", color: "green" },
    ],
    owner: "Grace Miller",
    deals: 6,
    value: 520000,
    win: 24,
    date: "Sept 11",
    type: "Pricing",
  },
  {
    name: "Stripe",
    tags: [
      { label: "Expansion", color: "green" },
      { label: "SMB", color: "yellow" },
      { label: "Upsell", color: "purple" },
    ],
    owner: "Noah Lee",
    deals: 3,
    value: 442231,
    win: 44,
    date: "Sept 9",
    type: "Demo",
  },
];

export default function Example() {
  const [selected, setSelected] = useState<string[]>(["Snowflake"]);
  const all = selected.length === rows.length ? true : selected.length ? "indeterminate" : false;
  const toggle = (n: string) =>
    setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));
  return (
    <div className="w-[980px] max-w-full rounded-crm border border-crm-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>
              <Checkbox
                aria-label="Select all companies"
                checked={all}
                onCheckedChange={() => setSelected(all === true ? [] : rows.map((r) => r.name))}
              />
            </TableHead>
            <TableHead>Companies</TableHead>
            <TableHead>Segment & Stage</TableHead>
            <TableHead>Account Owner</TableHead>
            <TableHead align="right">Open Deals</TableHead>
            <TableHead align="right">Pipeline Value</TableHead>
            <TableHead>Win Probability</TableHead>
            <TableHead>Activity Trend</TableHead>
            <TableHead>Last Interaction</TableHead>
            <TableHead>
              <span className="sr-only">Action</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.name} selected={selected.includes(r.name)}>
              <TableCell>
                <Checkbox
                  aria-label={"Select " + r.name}
                  checked={selected.includes(r.name)}
                  onCheckedChange={() => toggle(r.name)}
                />
              </TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>
                <TagList tags={r.tags} />
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  <Avatar name={r.owner} />
                  {r.owner}
                </span>
              </TableCell>
              <TableCell align="right">{r.deals}</TableCell>
              <TableCell align="right">
                <MoneyValue amount={r.value} />
              </TableCell>
              <TableCell>
                <SegmentedMeter value={r.win} showValue label={r.name + " win probability"} />
              </TableCell>
              <TableCell>
                <Sparkline data={[2, 4, 1, 5, 3, 6, 4, 7, 5, 8]} />
              </TableCell>
              <TableCell>
                <DateCell date={r.date} type={r.type} />
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  aria-label={"Open " + r.name + " details"}
                  className="rounded p-1 text-crm-soft hover:text-crm-fg"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TableFooterBar
        cells={[
          { label: "Companies in view", value: rows.length },
          { label: "Sum of pipeline", onAdd: () => {} },
          { label: "Avg win probability", onAdd: () => {} },
          { label: "Add Calculation", onAdd: () => {} },
        ]}
      />
    </div>
  );
}
