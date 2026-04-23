import React from "react";
import {
  Document,
  Font,
  Image,
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

export type OfferPdfSettings = {
  company_name?: string | null;
  logo_url?: string | null;
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
  description?: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total?: number | null;
};

const TR = {
  offerDocument: "Fiyat Teklifi",
  customer: "MUSTERI BILGILERI",
  offerInfo: "TEKLIF BILGILERI",
  offerNo: "TEKLIF NO",
  offerDate: "Teklif Tarihi",
  validUntil: "Gecerlilik",
  currency: "Para Birimi",
  itemCode: "Parca Kodu",
  itemName: "Parca Adi",
  quantity: "Miktar",
  unit: "Birim",
  unitPrice: "Birim Fiyat",
  total: "Tutar",
  notes: "NOTLAR",
  subtotal: "Ara Toplam",
  discount: "Iskonto",
  tax: "Vergi",
  grandTotal: "Genel Toplam",
  noItems: "Kalem bulunamadi.",
  defaultNotes:
    "- Teklife KDV dahil degildir.\n- Odeme : Sipariste %100\n- Doviz cevriminde odeme tarihindeki TCMB doviz satis kuru esas alinacaktir.\n- Fiyatimiz yatirim tesvik kapsaminda 0 KDV'li faturalama icin gecerli degildir.\n- Aksi belirtilmedikce urun tekliflerimize muhendislik, programlama calismalari dahil degildir.",
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL tanimli degil.");
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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
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

function getItemUnits(item: OfferPdfItem) {
  return item.description?.trim() ? 2 : 1;
}

function takeItemsByUnits(source: OfferPdfItem[], maxUnits: number) {
  const pageItems: OfferPdfItem[] = [];
  let used = 0;
  let index = 0;

  while (index < source.length) {
    const item = source[index];
    const units = getItemUnits(item);

    if (pageItems.length > 0 && used + units > maxUnits) break;
    if (pageItems.length === 0 && units > maxUnits) {
      pageItems.push(item);
      index += 1;
      break;
    }
    if (used + units > maxUnits) break;

    pageItems.push(item);
    used += units;
    index += 1;
  }

  return {
    pageItems,
    rest: source.slice(index),
  };
}

function paginateItems(items: OfferPdfItem[]) {
  if (items.length === 0) return [[]];

  const firstPageUnits = 12;
  const middlePageUnits = 16;
  const lastPageUnits = 5;
  const pages: OfferPdfItem[][] = [];
  let remaining = [...items];
  let isFirst = true;

  while (remaining.length > 0) {
    const remainingUnits = remaining.reduce((sum, item) => sum + getItemUnits(item), 0);

    if (isFirst) {
      if (remainingUnits <= firstPageUnits) {
        pages.push(remaining);
        break;
      }

      if (remainingUnits <= firstPageUnits + lastPageUnits) {
        const firstTake = takeItemsByUnits(remaining, firstPageUnits);
        pages.push(firstTake.pageItems);
        remaining = firstTake.rest;
        isFirst = false;
        continue;
      }

      const firstTake = takeItemsByUnits(remaining, firstPageUnits);
      pages.push(firstTake.pageItems);
      remaining = firstTake.rest;
      isFirst = false;
      continue;
    }

    if (remainingUnits <= lastPageUnits) {
      pages.push(remaining);
      break;
    }

    if (remainingUnits <= middlePageUnits + lastPageUnits) {
      const middleTake = takeItemsByUnits(remaining, middlePageUnits);
      pages.push(middleTake.pageItems);
      remaining = middleTake.rest;
      continue;
    }

    const middleTake = takeItemsByUnits(remaining, middlePageUnits);
    pages.push(middleTake.pageItems);
    remaining = middleTake.rest;
  }

  return pages.length > 0 ? pages : [[]];
}

function sumLineTotals(items: OfferPdfItem[]) {
  return Number(items.reduce((sum, item) => sum + Number(item.line_total ?? 0), 0).toFixed(2));
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 34,
    paddingHorizontal: 34,
    fontSize: 10,
    color: "#0f172a",
    fontFamily: "DejaVuSansCustom",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  headerLeft: {
    width: "58%",
  },
  logo: {
    maxWidth: 180,
    maxHeight: 82,
    objectFit: "contain",
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: 700,
    marginBottom: 6,
  },
  brandSub: {
    fontSize: 11,
    color: "#475569",
  },
  offerNoWrap: {
    width: "32%",
    alignItems: "flex-end",
    paddingTop: 10,
  },
  offerNoLabel: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 4,
  },
  offerNoValue: {
    fontSize: 22,
    fontWeight: 700,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    marginBottom: 14,
  },
  continuedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  continuedTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  continuedSubtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  twoCol: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 16,
  },
  infoCard: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fafafa",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 10,
  },
  customerName: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
  },
  line: {
    fontSize: 11,
    color: "#334155",
    marginBottom: 5,
    lineHeight: 1.4,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 7,
  },
  infoLabel: {
    fontSize: 11,
    color: "#334155",
  },
  infoValue: {
    fontSize: 11,
    fontWeight: 700,
    textAlign: "right",
    maxWidth: "55%",
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 12,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  mainRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  descRow: {
    flexDirection: "row",
    paddingTop: 0,
    paddingBottom: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fcfcfc",
  },
  emptyRow: {
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  codeCell: {
    width: "17%",
    paddingRight: 8,
  },
  nameCell: {
    width: "35%",
    paddingRight: 8,
  },
  qtyCell: {
    width: "10%",
    paddingRight: 8,
    textAlign: "center",
  },
  unitCell: {
    width: "10%",
    paddingRight: 8,
    textAlign: "center",
  },
  priceCell: {
    width: "14%",
    paddingRight: 8,
    textAlign: "right",
  },
  totalCell: {
    width: "14%",
    textAlign: "right",
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: 700,
    color: "#334155",
  },
  tableText: {
    fontSize: 10.5,
    color: "#0f172a",
    lineHeight: 1.35,
  },
  descText: {
    fontSize: 9.5,
    color: "#64748b",
    lineHeight: 1.35,
  },
  pageSubtotalWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    paddingTop: 8,
    paddingRight: 12,
    marginBottom: 10,
  },
  pageSubtotalLabel: {
    fontSize: 10,
    color: "#475569",
    fontWeight: 700,
  },
  pageSubtotalValue: {
    fontSize: 10,
    color: "#0f172a",
    fontWeight: 700,
    minWidth: 100,
    textAlign: "right",
  },
  notesTotals: {
    flexDirection: "row",
    gap: 18,
    marginTop: 6,
  },
  notesWrap: {
    width: "58%",
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fafafa",
  },
  notesBody: {
    fontSize: 10.5,
    color: "#334155",
    lineHeight: 1.5,
    marginBottom: 4,
  },
  totalsWrap: {
    width: "42%",
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fafafa",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 10.5,
    color: "#475569",
  },
  totalValue: {
    fontSize: 10.5,
    fontWeight: 700,
  },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
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
    fontSize: 13,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    left: 34,
    right: 34,
    bottom: 18,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingTop: 8,
    fontSize: 9,
    color: "#64748b",
  },
});

export default function OfferPdfDocument({
  offer,
  customer,
  settings,
  items,
}: {
  offer: OfferPdfOffer;
  customer: OfferPdfCustomer | null;
  settings?: OfferPdfSettings | null;
  items: OfferPdfItem[];
}) {
  const currency = normalizeCurrency(offer.currency_code);
  const rawNotes = offer.notes?.trim() || TR.defaultNotes;
  const noteLines = rawNotes.split("\n");
  const salesRepLine = noteLines.find((line) => line.startsWith("Satış Temsilcisi:")) ?? "";
  const salesRepEmailLine = noteLines.find((line) => line.startsWith("E-mail:")) ?? "";
  const salesRepPhoneLine = noteLines.find((line) => line.startsWith("Telefon:")) ?? "";
  const notes = noteLines
    .filter(
      (line) =>
        !line.startsWith("Satış Temsilcisi:") &&
        !line.startsWith("E-mail:") &&
        !line.startsWith("Telefon:")
    )
    .join("\n")
    .trim() || TR.defaultNotes;
  const salesRep = salesRepLine.replace("Satış Temsilcisi:", "").trim() || "-";
  const salesRepEmail = salesRepEmailLine.replace("E-mail:", "").trim() || "-";
  const salesRepPhone = salesRepPhoneLine.replace("Telefon:", "").trim() || "-";
  const companyName = settings?.company_name?.trim() || "noxo";
  const pages = paginateItems(items);

  return (
    <Document title={offer.offer_no} author="noxo" subject="Fiyat Teklifi" creator="noxo" producer="noxo">
      {pages.map((pageItems, index) => {
        const isFirstPage = index === 0;
        const isLastPage = index === pages.length - 1;
        const pageSubtotal = sumLineTotals(pageItems);

        return (
          <Page key={`${offer.id}-${index}`} size="A4" style={styles.page}>
            {isFirstPage ? (
              <>
                <View style={styles.header}>
                  <View style={styles.headerLeft}>
                    {settings?.logo_url ? (
                      <Image src={settings.logo_url} style={styles.logo} />
                    ) : (
                      <Text style={styles.brandTitle}>{companyName}</Text>
                    )}
                    <Text style={styles.brandSub}>{TR.offerDocument}</Text>
                  </View>

                  <View style={styles.offerNoWrap}>
                    <Text style={styles.offerNoLabel}>{TR.offerNo}</Text>
                    <Text style={styles.offerNoValue}>{offer.offer_no}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.twoCol}>
                  <View style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>{TR.customer}</Text>
                    <Text style={styles.customerName}>{customer?.company_name ?? "-"}</Text>
                    <Text style={styles.line}>{customer?.address ?? "-"}</Text>
                    <Text style={styles.line}>
                      {[customer?.city, customer?.country].filter(Boolean).join(" / ") || "-"}
                    </Text>
                    <Text style={styles.line}>{customer?.phone ?? "-"}</Text>
                    <Text style={styles.line}>{customer?.email ?? "-"}</Text>
                  </View>

                  <View style={styles.infoCard}>
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
                      <Text style={styles.infoLabel}>{TR.currency}</Text>
                      <Text style={styles.infoValue}>{offer.currency_code ?? "TRY"}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Satış Temsilcisi</Text>
                      <Text style={styles.infoValue}>{salesRep}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>E-mail</Text>
                      <Text style={styles.infoValue}>{salesRepEmail}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Telefon</Text>
                      <Text style={styles.infoValue}>{salesRepPhone}</Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.continuedHeader}>
                <Text style={styles.continuedTitle}>{offer.offer_no}</Text>
                <Text style={styles.continuedSubtitle}>
                  {TR.offerDocument} - {index + 1}. Sayfa
                </Text>
              </View>
            )}

            <View style={styles.tableWrap}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.codeCell]}>{TR.itemCode}</Text>
                <Text style={[styles.tableHeaderText, styles.nameCell]}>{TR.itemName}</Text>
                <Text style={[styles.tableHeaderText, styles.qtyCell]}>{TR.quantity}</Text>
                <Text style={[styles.tableHeaderText, styles.unitCell]}>{TR.unit}</Text>
                <Text style={[styles.tableHeaderText, styles.priceCell]}>{TR.unitPrice}</Text>
                <Text style={[styles.tableHeaderText, styles.totalCell]}>{TR.total}</Text>
              </View>

              {pageItems.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.tableText}>{TR.noItems}</Text>
                </View>
              ) : (
                pageItems.map((item) => (
                  <React.Fragment key={item.id}>
                    <View style={styles.mainRow} wrap={false}>
                      <Text style={[styles.tableText, styles.codeCell]}>{item.item_code ?? "-"}</Text>
                      <Text style={[styles.tableText, styles.nameCell]}>{item.item_name}</Text>
                      <Text style={[styles.tableText, styles.qtyCell]}>{String(item.quantity ?? 0)}</Text>
                      <Text style={[styles.tableText, styles.unitCell]}>{item.unit}</Text>
                      <Text style={[styles.tableText, styles.priceCell]}>
                        {formatCurrency(Number(item.unit_price ?? 0), currency)}
                      </Text>
                      <Text style={[styles.tableText, styles.totalCell]}>
                        {formatCurrency(Number(item.line_total ?? 0), currency)}
                      </Text>
                    </View>
                    {item.description?.trim() ? (
                      <View style={styles.descRow} wrap={false}>
                        <Text style={styles.codeCell}></Text>
                        <Text style={[styles.descText, { width: "83%" }]}>{item.description.trim()}</Text>
                      </View>
                    ) : null}
                  </React.Fragment>
                ))
              )}
            </View>

            <View style={styles.pageSubtotalWrap}>
              <Text style={styles.pageSubtotalLabel}>{TR.subtotal}</Text>
              <Text style={styles.pageSubtotalValue}>{formatCurrency(pageSubtotal, currency)}</Text>
            </View>

            {isLastPage ? (
              <View style={styles.notesTotals}>
                <View style={styles.notesWrap}>
                  <Text style={styles.sectionTitle}>{TR.notes}</Text>
                  {notes.split("\n").map((line, lineIndex) => (
                    <Text key={`${offer.id}-note-${lineIndex}`} style={styles.notesBody}>
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
            ) : null}

            <Text style={styles.footer} fixed>
              {companyName}
            </Text>
          </Page>
        );
      })}
    </Document>
  );
}
