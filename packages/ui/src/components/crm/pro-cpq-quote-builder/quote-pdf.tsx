import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { formatBp } from "@/components/crm/pro-cpq-quote-builder/money";
import type {
  ApprovalResult,
  PricedLine,
  QuoteDraft,
  QuoteTotals,
} from "@/components/crm/pro-cpq-quote-builder/types";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: "#1b1b1f", fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  muted: { color: "#6b6b76" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#dcdce2",
    paddingVertical: 4,
  },
  th: { fontFamily: "Helvetica-Bold", color: "#6b6b76" },
  cName: { flex: 3 },
  cNum: { flex: 1, textAlign: "right" },
  totals: { marginTop: 14, marginLeft: "auto", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  banner: { marginTop: 12, padding: 8, backgroundColor: "#fff4dc", color: "#8a5a00" },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, color: "#9a9aa4", fontSize: 8 },
});

export interface QuotePdfProps {
  quote: QuoteDraft;
  lines: readonly PricedLine[];
  totals: QuoteTotals;
  approval: ApprovalResult;
  version: number;
  sellerName: string;
  format: (minor: number) => string;
}

/** Paginated quote document; the header row repeats on every page. */
export function QuotePdfDocument({
  quote,
  lines,
  totals,
  approval,
  version,
  sellerName,
  format,
}: QuotePdfProps) {
  return (
    <Document title={`${quote.number} v${version}`} author={sellerName}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.h1}>Quote {quote.number}</Text>
            <Text style={s.muted}>
              Version {version} · {quote.currency} · valid until {quote.header.validUntil}
            </Text>
          </View>
          <View>
            <Text>{sellerName}</Text>
            <Text style={s.muted}>Prepared for {quote.header.customer}</Text>
            <Text style={s.muted}>{quote.header.contactEmail}</Text>
          </View>
        </View>
        <View style={[s.row, s.th]} fixed>
          <Text style={s.cName}>Product</Text>
          <Text style={s.cNum}>Qty</Text>
          <Text style={s.cNum}>Term</Text>
          <Text style={s.cNum}>List</Text>
          <Text style={s.cNum}>Discount</Text>
          <Text style={s.cNum}>Net</Text>
        </View>
        {lines.map((l) => (
          <View key={l.line.id} style={s.row} wrap={false}>
            <Text style={s.cName}>
              {l.product.name} ({l.product.sku})
            </Text>
            <Text style={s.cNum}>{l.line.quantity.toLocaleString()}</Text>
            <Text style={s.cNum}>
              {l.product.billing === "one-time" ? "-" : `${l.line.termMonths} mo`}
            </Text>
            <Text style={s.cNum}>{format(l.listTotal)}</Text>
            <Text style={s.cNum}>{format(l.lineDiscount + l.headerDiscount)}</Text>
            <Text style={s.cNum}>{format(l.netTotal)}</Text>
          </View>
        ))}
        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}>
            <Text>List total</Text>
            <Text>{format(totals.list)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text>Discounts ({formatBp(totals.effectiveDiscountBp)})</Text>
            <Text>-{format(totals.lineDiscounts + totals.headerDiscount)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text>One-time fees</Text>
            <Text>{format(totals.oneTime)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text>Annual contract value</Text>
            <Text>{format(totals.annualContractValue)}</Text>
          </View>
          <View style={[s.totalRow, s.grand]}>
            <Text>Total</Text>
            <Text>{format(totals.net)}</Text>
          </View>
        </View>
        {approval.required ? (
          <Text style={s.banner}>
            Pending approval by {approval.approvers.join(", ")}. {approval.reasons.join(". ")}.
          </Text>
        ) : null}
        {quote.header.notes ? <Text style={{ marginTop: 12 }}>{quote.header.notes}</Text> : null}
        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${quote.number} v${version} · payment ${quote.header.paymentTerms} · page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

/** Render to a Blob and trigger a download named QUOTE-v{n}.pdf. */
export async function downloadQuotePdf(props: QuotePdfProps): Promise<void> {
  const blob = await pdf(<QuotePdfDocument {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${props.quote.number}-v${props.version}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
