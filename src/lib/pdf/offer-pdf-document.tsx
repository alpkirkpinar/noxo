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
  family: "CalibriCustom",
  fonts: [
    {
      src: `${supabaseUrl}/storage/v1/object/public/public-assets/calibri-regular.ttf`,
      fontWeight: 400,
    },
    {
      src: `${supabaseUrl}/storage/v1/object/public/public-assets/calibri-bold.ttf`,
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

function extractTaggedNoteValue(lines: string[], tags: string[]) {
  for (const line of lines) {
    for (const tag of tags) {
      if (line.startsWith(tag)) {
        return line.slice(tag.length).trim();
      }
    }
  }

  return "";
}

function isTaggedNoteLine(line: string, tags: string[]) {
  return tags.some((tag) => line.startsWith(tag));
}

const SALES_REP_TAGS = ["Satis Temsilcisi:", "SatÄ±ÅŸ Temsilcisi:", "SatÃ„Â±Ã…Å¸ Temsilcisi:"];
const EMAIL_TAGS = ["E-mail:", "E-Posta:", "E-posta:"];
const PHONE_TAGS = ["Telefon:", "Phone:"];

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 28,
    paddingHorizontal: 28,
    fontSize: 10,
    color: "#0f172a",
    fontFamily: "CalibriCustom",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  headerLeft: {
    width: "62%",
  },
  logo: {
    maxWidth: 245,
    maxHeight: 92,
    objectFit: "contain",
    marginBottom: 4,
  },
  brandTitle: {
    fontSize: 27,
    fontWeight: 700,
    marginBottom: 2,
  },
  brandSub: {
    fontSize: 11,
    color: "#334155",
  },
  offerNoWrap: {
    width: "30%",
    alignItems: "flex-end",
    paddingTop: 10,
  },
  offerNoLabel: {
    fontSize: 10,
    color: "#475569",
    marginBottom: 1,
  },
  offerNoValue: {
    fontSize: 25,
    fontWeight: 700,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#94a3b8",
    marginBottom: 10,
  },
  continuedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#94a3b8",
  },
  continuedTitle: {
    fontSize: 17,
    fontWeight: 700,
  },
  continuedSubtitle: {
    fontSize: 10,
    color: "#475569",
  },
  twoCol: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 10,
  },
  infoCard: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 8,
  },
  customerName: {
    fontSize: 12.5,
    fontWeight: 700,
    marginBottom: 6,
  },
  line: {
    fontSize: 10,
    color: "#334155",
    marginBottom: 2,
    lineHeight: 1.25,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 10,
    color: "#334155",
  },
  infoValue: {
    fontSize: 10,
    fontWeight: 700,
    textAlign: "right",
    maxWidth: "57%",
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 0,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#eef2f7",
    borderBottomWidth: 1,
    borderBottomColor: "#94a3b8",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  mainRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  descRow: {
    flexDirection: "row",
    paddingTop: 0,
    paddingBottom: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  emptyRow: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  codeCell: {
    width: "19%",
    paddingRight: 6,
  },
  nameCell: {
    width: "33%",
    paddingRight: 6,
  },
  qtyCell: {
    width: "9%",
    paddingRight: 6,
    textAlign: "center",
  },
  unitCell: {
    width: "8%",
    paddingRight: 6,
    textAlign: "center",
  },
  priceCell: {
    width: "15.5%",
    paddingRight: 6,
    textAlign: "right",
  },
  totalCell: {
    width: "15.5%",
    textAlign: "right",
  },
  tableHeaderText: {
    fontSize: 9.5,
    fontWeight: 700,
    color: "#334155",
  },
  tableText: {
    fontSize: 9.5,
    color: "#0f172a",
    lineHeight: 1.2,
  },
  descText: {
    fontSize: 8.8,
    color: "#64748b",
    lineHeight: 1.2,
  },
  pageSubtotalWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 14,
    paddingTop: 5,
    paddingRight: 10,
    marginBottom: 6,
  },
  pageSubtotalLabel: {
    fontSize: 9,
    color: "#475569",
    fontWeight: 700,
  },
  pageSubtotalValue: {
    fontSize: 9,
    color: "#0f172a",
    fontWeight: 700,
    minWidth: 90,
    textAlign: "right",
  },
  notesTotals: {
    flexDirection: "row",
    gap: 14,
    marginTop: 2,
  },
  notesWrap: {
    width: "60%",
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
  notesBody: {
    fontSize: 9.5,
    color: "#334155",
    lineHeight: 1.3,
    marginBottom: 2,
  },
  totalsWrap: {
    width: "40%",
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 5,
  },
  totalLabel: {
    fontSize: 9.5,
    color: "#475569",
  },
  totalValue: {
    fontSize: 9.5,
    fontWeight: 700,
  },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#94a3b8",
    marginTop: 4,
    paddingTop: 7,
  },
  grandLabel: {
    fontSize: 10,
    fontWeight: 700,
  },
  grandValue: {
    fontSize: 11.5,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#94a3b8",
    paddingTop: 6,
    fontSize: 8.5,
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
  const salesRepValue = extractTaggedNoteValue(noteLines, SALES_REP_TAGS);
  const salesRepEmailValue = extractTaggedNoteValue(noteLines, EMAIL_TAGS);
  const salesRepPhoneValue = extractTaggedNoteValue(noteLines, PHONE_TAGS);
  const notes = noteLines
    .filter(
      (line) =>
        !isTaggedNoteLine(line, SALES_REP_TAGS) &&
        !isTaggedNoteLine(line, EMAIL_TAGS) &&
        !isTaggedNoteLine(line, PHONE_TAGS)
    )
    .join("\n")
    .trim() || TR.defaultNotes;
  const salesRep = salesRepValue || "-";
  const salesRepEmail = salesRepEmailValue || "-";
  const salesRepPhone = salesRepPhoneValue || "-";
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
                      <Text style={styles.infoLabel}>Satis Temsilcisi</Text>
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
