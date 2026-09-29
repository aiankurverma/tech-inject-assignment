import * as React from "react";
import {
  ProSpreadsheet,
  cellKey,
  type CellFormat,
  type WorkbookData,
} from "@/components/crm/pro-spreadsheet";

// A 10,000-order ledger with live formulas, a cross-sheet regional summary and a small
// revenue plan. Try: edit a quantity and watch Summary update, drag the fill handle, paste
// cells from Excel, Ctrl+Z / Ctrl+Y, Ctrl+Arrow to jump, double-click a tab to rename it.

const ROWS = 10_000;
const REGIONS = ["North America", "EMEA", "APAC", "LATAM", "India"];
const PRODUCTS: [string, number][] = [
  ["Starter seat", 29],
  ["Growth seat", 79],
  ["Scale seat", 149],
  ["Data add-on", 499],
  ["Onboarding", 1200],
  ["Premium support", 2400],
];
const CUSTOMERS = [
  "Acme Robotics",
  "Northwind",
  "Globex",
  "Initech",
  "Umbrella Health",
  "Stark Logistics",
  "Wayne Capital",
  "Hooli",
  "Pied Piper",
  "Soylent Foods",
  "Vandelay Imports",
  "Wonka Labs",
];
const STATUS = ["Paid", "Paid", "Paid", "Invoiced", "Overdue", "Refunded"];

function buildWorkbook(): WorkbookData {
  let seed = 42;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const orders: Record<string, string> = {};
  const formats: Record<string, CellFormat> = {};
  const header = [
    "Order",
    "Date",
    "Customer",
    "Region",
    "Product",
    "Qty",
    "Unit price",
    "Discount",
    "Net",
    "Status",
  ];
  header.forEach((h, c) => (orders[cellKey(0, c)] = h));
  const start = 45658; // 2025-01-01 as a spreadsheet serial date
  for (let r = 1; r <= ROWS; r++) {
    const [product, price] = PRODUCTS[Math.floor(rand() * PRODUCTS.length)]!;
    const n = r + 1;
    orders[cellKey(r, 0)] = `SO-${String(100000 + r)}`;
    orders[cellKey(r, 1)] = String(start + Math.floor((r / ROWS) * 540));
    orders[cellKey(r, 2)] = CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)]!;
    orders[cellKey(r, 3)] = REGIONS[Math.floor(rand() * REGIONS.length)]!;
    orders[cellKey(r, 4)] = product;
    orders[cellKey(r, 5)] = String(1 + Math.floor(rand() * 40));
    orders[cellKey(r, 6)] = String(price);
    orders[cellKey(r, 7)] = String([0, 0, 0.05, 0.1, 0.15][Math.floor(rand() * 5)]);
    orders[cellKey(r, 8)] = `=ROUND(F${n}*G${n}*(1-H${n}),2)`;
    orders[cellKey(r, 9)] = STATUS[Math.floor(rand() * STATUS.length)]!;
    formats[cellKey(r, 1)] = "date";
    formats[cellKey(r, 6)] = "currency";
    formats[cellKey(r, 7)] = "percent";
    formats[cellKey(r, 8)] = "currency";
  }

  const last = ROWS + 1;
  const summary: Record<string, string> = {};
  const sFormats: Record<string, CellFormat> = {};
  ["Region", "Orders", "Net revenue", "Avg order", "Largest", "Share", "Overdue"].forEach(
    (h, c) => (summary[cellKey(0, c)] = h),
  );
  REGIONS.forEach((region, i) => {
    const r = i + 1;
    const n = r + 1;
    summary[cellKey(r, 0)] = region;
    summary[cellKey(r, 1)] = `=COUNTIF(Orders!D2:D${last},A${n})`;
    summary[cellKey(r, 2)] = `=SUMIF(Orders!D2:D${last},A${n},Orders!I2:I${last})`;
    summary[cellKey(r, 3)] = `=IFERROR(C${n}/B${n},0)`;
    summary[cellKey(r, 4)] = `=MAX(Orders!I2:I${last})*(B${n}>0)`;
    summary[cellKey(r, 5)] = `=C${n}/$C$8`;
    summary[cellKey(r, 6)] = `=COUNTIFS(Orders!D2:D${last},A${n},Orders!J2:J${last},"Overdue")`;
    for (const c of [2, 3, 4]) sFormats[cellKey(r, c)] = "currency";
    sFormats[cellKey(r, 5)] = "percent";
  });
  summary[cellKey(7, 0)] = "Total";
  summary[cellKey(7, 1)] = "=SUM(B2:B6)";
  summary[cellKey(7, 2)] = "=SUM(C2:C6)";
  summary[cellKey(7, 3)] = "=C8/B8";
  summary[cellKey(7, 5)] = "=SUM(F2:F6)";
  summary[cellKey(7, 6)] = "=SUM(G2:G6)";
  summary[cellKey(9, 0)] = "Top region";
  summary[cellKey(9, 1)] = "=INDEX(A2:A6,MATCH(MAX(C2:C6),C2:C6,0))";
  summary[cellKey(10, 0)] = "Health";
  summary[cellKey(10, 1)] = `=IF(G8/B8>0.2,"Collections risk","Healthy")`;
  for (const c of [2, 3]) sFormats[cellKey(7, c)] = "currency";
  sFormats[cellKey(7, 5)] = "percent";

  const plan: Record<string, string> = {};
  const pFormats: Record<string, CellFormat> = {};
  plan[cellKey(0, 0)] = "Monthly growth";
  plan[cellKey(0, 1)] = "8%";
  plan[cellKey(1, 0)] = "Churn";
  plan[cellKey(1, 1)] = "2.5%";
  plan[cellKey(3, 0)] = "Month";
  plan[cellKey(3, 1)] = "MRR";
  plan[cellKey(3, 2)] = "Net new";
  plan[cellKey(4, 0)] = "1";
  plan[cellKey(4, 1)] = "=Summary!C8/18";
  for (let r = 5; r < 16; r++) {
    plan[cellKey(r, 0)] = `=A${r}+1`;
    plan[cellKey(r, 1)] = `=ROUND(B${r}*(1+$B$1-$B$2),0)`;
    plan[cellKey(r, 2)] = `=B${r + 1}-B${r}`;
  }
  for (let r = 4; r < 16; r++) {
    pFormats[cellKey(r, 1)] = "currency";
    pFormats[cellKey(r, 2)] = "currency";
  }
  pFormats[cellKey(0, 1)] = "percent";
  pFormats[cellKey(1, 1)] = "percent";

  return {
    activeSheetId: "orders",
    sheets: [
      {
        id: "orders",
        name: "Orders",
        cells: orders,
        formats,
        rowCount: ROWS + 200,
        colCount: 30,
        frozenRows: 1,
        frozenCols: 1,
        colWidths: { 0: 104, 2: 150, 3: 128, 4: 136, 6: 104, 8: 120 },
      },
      {
        id: "summary",
        name: "Summary",
        cells: summary,
        formats: sFormats,
        rowCount: 200,
        colCount: 26,
        frozenRows: 1,
        colWidths: { 0: 140, 2: 140, 3: 120, 4: 120 },
      },
      {
        id: "plan",
        name: "Plan",
        cells: plan,
        formats: pFormats,
        rowCount: 200,
        colCount: 26,
        colWidths: { 0: 140, 1: 130 },
      },
    ],
  };
}

export default function Example() {
  const [workbook, setWorkbook] = React.useState(buildWorkbook);
  const [saved, setSaved] = React.useState(0);
  const onChange = (wb: WorkbookData) => {
    setWorkbook(wb);
    setSaved((n) => n + 1);
  };
  return (
    <div className="space-y-3 p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold text-crm-fg">Q3 revenue workbook</h2>
          <p className="crm-caption text-crm-muted-fg">
            {ROWS.toLocaleString()} orders · live formulas across three sheets
          </p>
        </div>
        <span className="text-xs text-crm-soft tabular-nums" aria-live="polite">
          {saved ? `${saved} change${saved > 1 ? "s" : ""} synced` : "All changes synced"}
        </span>
      </div>
      <ProSpreadsheet value={workbook} onChange={onChange} height={640} />
    </div>
  );
}
