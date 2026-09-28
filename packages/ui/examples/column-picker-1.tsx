import * as React from "react";
import { ColumnPicker, type PickerColumn } from "@/components/crm/column-picker";

const initial: PickerColumn[] = [
  { id: "name", label: "Company", visible: true, locked: true },
  { id: "owner", label: "Owner", visible: true },
  { id: "stage", label: "Stage", visible: true },
  { id: "amount", label: "Amount", visible: true },
  { id: "industry", label: "Industry", visible: false },
  { id: "employees", label: "Employees", visible: false },
  { id: "updated", label: "Last activity", visible: true },
];

export default function Example() {
  const [columns, setColumns] = React.useState(initial);
  return (
    <ColumnPicker columns={columns} onChange={setColumns} onReset={() => setColumns(initial)} />
  );
}
