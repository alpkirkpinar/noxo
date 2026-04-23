import React from "react";
import {
  Document,
  Font,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

type CurrencyCode = "TRY" | "USD" | "EUR";

export type OfferPdfCustomer = {
  company_name?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type OfferPdfOffer = {
  id: string;
  offer_no: string;
  offer_date?: string | null;
  valid_until?: string | null;
  currency_code?: string | null;
  status?: string | null;
  subtotal?: number | null;
  discount_total?: number | null;
  tax_total?: number | null;
  grand_total?: number | null;
  notes?: string | null;
};

export type OfferPdfItem = {
  id: string;
  item_code?: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total?: number | null;
};

const TR = {
  offerDocument: "Teklif Dok\u00FCman\u0131",
  customer: "M\u00DC\u015ETER\u0130",
  offerInfo: "TEKL\u0130F B\u0130LG\u0130LER\u0130",
  offerDate: "Teklif Tarihi",
  validUntil: "Ge\u00E7erlilik",
  status: "Durum",
  currency: "Para Birimi",
  description: "A\u00E7\u0131klama",
  quantity: "Miktar",
  unit: "Birim",
  unitPrice: "Birim Fiyat",
  total: "Tutar",
  noItems: "Kalem bulunamad\u0131.",
  notes: "NOTLAR",
  subtotal: "Ara Toplam",
  discount: "\u0130skonto",
  tax: "Vergi",
  grandTotal: "Genel Toplam",
  defaultNotes:
    "KDV dahil de\u011Fildir.\n\u00D6deme: Sipari\u015Fte %100\nD\u00F6viz \u00E7evriminde \u00F6deme tarihindeki TCMB d\u00F6viz sat\u0131\u015F kuru esas al\u0131nacakt\u0131r.",
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL tan\u0131ml\u0131 de\u011Fil.");
}

Font.register({
  family: "DejaVuSansCustom",
  fonts: [
    {
      src: `${supabaseUrl}/storage/v1/object/public/public-assets/DejaVuSans.ttf`,
      fontWeight: 400,
    },
    {
      src: `${supabaseUrl}/storage/v1/object/public/public-assets/DejaVuSans-Bold.ttf`,
      fontWeight: 700,
    },
  ],
});

function normalizeCurrency(value?: string | null): CurrencyCode {
  if (value === "USD" || value === "EUR") return value;
  return "TRY";
}

function formatCurrency(value?: number | null, currency: CurrencyCode = "TRY") {
  const safeValue = Number(value ?? 0);

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(safeValue);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("tr-TR");
  } catch {
    return value;
  }
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 32,
    fontSize: 10,
    color: "#0f172a",
    fontFamily: "DejaVuSansCustom",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  brandWrap: {
    width: "55%",
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 4,
  },
  brandSub: {
    fontSize: 10,
    color: "#475569",
  },
  offerNoWrap: {
    width: "35%",
    alignItems: "flex-end",
  },
  mutedLabel: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 2,
    
  },
  offerNo: {
    fontSize: 18,
    fontWeight: 700,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    marginBottom: 16,
  },
  twoCol: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 18,
  },
  card: {
    flexGrow: 1,
    flexBasis: 0,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 8,
    
  },
  customerName: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
  },
  lineText: {
    marginBottom: 3,
    color: "#334155",
    lineHeight: 1.35,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 12,
  },
  infoLabel: {
    color: "#475569",
  },
  infoValue: {
    fontWeight: 700,
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 18,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  cellDesc: {
    width: "40%",
    paddingRight: 8,
  },
  cellQty: {
    width: "12%",
    paddingRight: 8,
  },
  cellUnit: {
    width: "12%",
    paddingRight: 8,
  },
  cellPrice: {
    width: "18%",
    paddingRight: 8,
    textAlign: "right",
  },
  cellTotal: {
    width: "18%",
    textAlign: "right",
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: 700,
    color: "#334155",
  },
  tableCellText: {
    fontSize: 10,
    color: "#0f172a",
    lineHeight: 1.35,
  },
  notesAndTotals: {
    flexDirection: "row",
    gap: 24,
    marginTop: 4,
  },
  notesWrap: {
    width: "56%",
  },
  totalsWrap: {
    width: "44%",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  totalLabel: {
    color: "#475569",
  },
  totalValue: {
    fontWeight: 700,
  },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    marginTop: 6,
    paddingTop: 10,
  },
  grandLabel: {
    fontSize: 12,
    fontWeight: 700,
  },
  grandValue: {
    fontSize: 14,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    left: 32,
    right: 32,
    bottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingTop: 8,
    fontSize: 8,
    color: "#64748b",
  },
});

export default function OfferPdfDocument({
  offer,
  customer,
  items,
}: {
  offer: OfferPdfOffer;
  customer: OfferPdfCustomer | null;
  items: OfferPdfItem[];
}) {
  const currency = normalizeCurrency(offer.currency_code);
  const notes = offer.notes?.trim() || TR.defaultNotes;

  return (
    <Document
      title={offer.offer_no}
      author="noxo"
      subject="Fiyat Teklifi"
      creator="noxo"
      producer="noxo"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.brandWrap}>
            <Text style={styles.brandTitle}>noxo</Text>
            <Text style={styles.brandSub}>{TR.offerDocument}</Text>
          </View>

          <View style={styles.offerNoWrap}>
            <Text style={styles.mutedLabel}>TEKLIF NO</Text>
            <Text style={styles.offerNo}>{offer.offer_no}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.twoCol}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{TR.customer}</Text>
            <Text style={styles.customerName}>{customer?.company_name ?? "-"}</Text>
            <Text style={styles.lineText}>{customer?.address ?? "-"}</Text>
            <Text style={styles.lineText}>
              {[customer?.city, customer?.country].filter(Boolean).join(" / ") || "-"}
            </Text>
            <Text style={styles.lineText}>{customer?.phone ?? "-"}</Text>
            <Text style={styles.lineText}>{customer?.email ?? "-"}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{TR.offerInfo}</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{TR.offerDate}</Text>
              <Text style={styles.infoValue}>{formatDate(offer.offer_date)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{TR.validUntil}</Text>
              <Text style={styles.infoValue}>{formatDate(offer.valid_until)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{TR.status}</Text>
              <Text style={styles.infoValue}>{offer.status ?? "-"}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{TR.currency}</Text>
              <Text style={styles.infoValue}>{offer.currency_code ?? "TRY"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tableWrap}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.cellDesc]}>{TR.description}</Text>
            <Text style={[styles.tableHeaderText, styles.cellQty]}>{TR.quantity}</Text>
            <Text style={[styles.tableHeaderText, styles.cellUnit]}>{TR.unit}</Text>
            <Text style={[styles.tableHeaderText, styles.cellPrice]}>{TR.unitPrice}</Text>
            <Text style={[styles.tableHeaderText, styles.cellTotal]}>{TR.total}</Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.tableCellText}>{TR.noItems}</Text>
            </View>
          ) : (
            items.map((item) => (
              <View key={item.id} style={styles.tableRow} wrap={false}>
                <Text style={[styles.tableCellText, styles.cellDesc]}>
                  [{item.item_code ?? "-"}] {item.item_name}
                </Text>
                <Text style={[styles.tableCellText, styles.cellQty]}>{String(item.quantity ?? 0)}</Text>
                <Text style={[styles.tableCellText, styles.cellUnit]}>{item.unit}</Text>
                <Text style={[styles.tableCellText, styles.cellPrice]}>
                  {formatCurrency(Number(item.unit_price ?? 0), currency)}
                </Text>
                <Text style={[styles.tableCellText, styles.cellTotal]}>
                  {formatCurrency(Number(item.line_total ?? 0), currency)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.notesAndTotals}>
          <View style={styles.notesWrap}>
            <Text style={styles.sectionTitle}>{TR.notes}</Text>
            {notes.split("\n").map((line, index) => (
              <Text key={index} style={styles.lineText}>
                {line}
              </Text>
            ))}
          </View>

          <View style={styles.totalsWrap}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{TR.subtotal}</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(Number(offer.subtotal ?? 0), currency)}
              </Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{TR.discount}</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(Number(offer.discount_total ?? 0), currency)}
              </Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{TR.tax}</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(Number(offer.tax_total ?? 0), currency)}
              </Text>
            </View>

            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>{TR.grandTotal}</Text>
              <Text style={styles.grandValue}>
                {formatCurrency(Number(offer.grand_total ?? 0), currency)}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          noxo
        </Text>
      </Page>
    </Document>
  );
}
