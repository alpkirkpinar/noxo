import React from "react";
import path from "node:path";
import { existsSync } from "node:fs";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
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

export type OfferPdfSalesRep = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
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
  customer: "MÜŞTERİ BİLGİLERİ",
  offerInfo: "TEKLİF BİLGİLERİ",
  offerNo: "TEKLİF NO",
  offerDate: "Teklif Tarihi",
  validUntil: "Geçerlilik",
  currency: "Para Birimi",
  itemCode: "Parça Kodu",
  itemName: "Parça Adı",
  quantity: "Miktar",
  unit: "Birim",
  unitPrice: "Birim Fiyat",
  total: "Tutar",
  notes: "NOTLAR",
  subtotal: "Ara Toplam",
  discount: "İskonto",
  tax: "Vergi",
  grandTotal: "Genel Toplam",
  noItems: "Kalem bulunamadı.",
  salesRep: "Satış Temsilcisi",
  defaultNotes:
    "KDV dahil değildir.\nÖdeme: Siparişte %100\nDöviz çevriminde ödeme tarihindeki TCMB döviz satış kuru esas alınacaktır.",
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const REMOTE_CALIBRI = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/public-assets/calibri-regular.ttf`
  : "";
const REMOTE_CALIBRI_BOLD = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/public-assets/calibri-bold.ttf`
  : "";
const LOCAL_ARIAL = path.join(process.cwd(), "public", "fonts", "arial.ttf");
const LOCAL_ARIAL_BOLD = path.join(process.cwd(), "public", "fonts", "arialbd.ttf");
const LOCAL_LOGO = path.join(process.cwd(), "public", "noxo-logo.png");

function pickFontSource(preferred: string, fallback: string) {
  if (preferred) return preferred;
  return fallback;
}

Font.register({
  family: "OfferPdfSans",
  fonts: [
    {
      src: pickFontSource(REMOTE_CALIBRI, LOCAL_ARIAL),
      fontWeight: 400,
    },
    {
      src: pickFontSource(REMOTE_CALIBRI_BOLD, LOCAL_ARIAL_BOLD),
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

const SALES_REP_TAGS = ["Satış Temsilcisi:", "Satis Temsilcisi:"];
const EMAIL_TAGS = ["E-mail:", "E-posta:", "E-Posta:"];
const PHONE_TAGS = ["Telefon:", "Phone:"];

function getItemUnits(item: OfferPdfItem) {
  return item.description?.trim() ? 1.85 : 1;
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

  const firstPageUnits = 13.5;
  const nextPageUnits = 9;
  const pages: OfferPdfItem[][] = [];
  let remaining = [...items];
  let isFirstPage = true;

  while (remaining.length > 0) {
    const take = takeItemsByUnits(remaining, isFirstPage ? firstPageUnits : nextPageUnits);
    pages.push(take.pageItems);
    remaining = take.rest;
    isFirstPage = false;
  }

  return pages;
}

function sumLineTotals(items: OfferPdfItem[]) {
  return Number(items.reduce((sum, item) => sum + Number(item.line_total ?? 0), 0).toFixed(2));
}

function getLogoSource(logoUrl?: string | null) {
  if (logoUrl?.trim()) return logoUrl.trim();
  if (existsSync(LOCAL_LOGO)) return LOCAL_LOGO;
  return null;
}

const colors = {
  ink: "#0f172a",
  text: "#334155",
  muted: "#475569",
  soft: "#64748b",
  border: "#94a3b8",
  divider: "#cbd5e1",
  rowDivider: "#e2e8f0",
  headerFill: "#f8fafc",
  altFill: "#fcfcfc",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 39.75,
    paddingBottom: 32,
    paddingHorizontal: 39.75,
    fontFamily: "OfferPdfSans",
    fontSize: 10.5,
    color: colors.ink,
  },
  firstPageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  logoBlock: {
    width: 210,
  },
  logo: {
    width: 72,
    height: 100,
    objectFit: "contain",
    marginBottom: 1,
  },
  documentTitle: {
    fontSize: 10.5,
    color: colors.muted,
  },
  offerNoWrap: {
    width: 190,
    alignItems: "flex-end",
    paddingTop: 0,
  },
  offerNoLabel: {
    fontSize: 9.75,
    color: colors.soft,
    marginBottom: 3,
  },
  offerNoValue: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.ink,
  },
  divider: {
    borderBottomWidth: 1.25,
    borderBottomColor: colors.divider,
    marginBottom: 9,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 15,
    marginBottom: 10,
  },
  card: {
    width: 250.5,
    minHeight: 128,
    borderWidth: 1.25,
    borderColor: colors.border,
    borderRadius: 14,
    paddingTop: 14,
    paddingRight: 18,
    paddingBottom: 12,
    paddingLeft: 14,
  },
  cardTitle: {
    fontSize: 9.75,
    fontWeight: 700,
    color: colors.text,
    marginBottom: 8,
  },
  customerName: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.ink,
    marginBottom: 6,
  },
  cardText: {
    fontSize: 10.5,
    color: colors.text,
    marginBottom: 4,
    lineHeight: 1.08,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 10,
  },
  infoLabel: {
    fontSize: 10.5,
    color: colors.text,
    width: 82,
  },
  infoValue: {
    fontSize: 10.5,
    fontWeight: 700,
    color: colors.ink,
    textAlign: "left",
    maxWidth: 125,
  },
  continuationHeader: {
    marginTop: 2,
    marginBottom: 10,
  },
  continuationTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 7,
  },
  continuationTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.ink,
  },
  continuationSubtitle: {
    fontSize: 10.5,
    color: colors.soft,
  },
  tableWrap: {
    borderWidth: 1.25,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: "hidden",
  },
  tableInner: {
    borderRadius: 14,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.headerFill,
    borderBottomWidth: 1.2,
    borderBottomColor: colors.divider,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 18.75,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1.15,
    borderBottomColor: colors.rowDivider,
    paddingTop: 7.5,
    paddingBottom: 7.5,
    paddingHorizontal: 18.75,
  },
  rowAlt: {
    backgroundColor: colors.altFill,
    paddingTop: 5.5,
    paddingBottom: 5.5,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  codeCell: {
    width: 90,
  },
  nameCell: {
    width: 124.5,
  },
  qtyCell: {
    width: 60,
    textAlign: "center",
  },
  unitCell: {
    width: 60,
    textAlign: "center",
  },
  priceCell: {
    width: 90,
    textAlign: "right",
  },
  totalCell: {
    width: 90,
    textAlign: "right",
  },
  headerText: {
    fontSize: 9.75,
    fontWeight: 700,
    color: colors.text,
  },
  cellText: {
    fontSize: 10.5,
    color: colors.ink,
    lineHeight: 1.22,
  },
  descText: {
    fontSize: 9.75,
    color: colors.soft,
    lineHeight: 1.22,
  },
  pageSubtotal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 0,
    paddingTop: 6,
    marginBottom: 12,
    paddingRight: 18.75,
  },
  pageSubtotalLabel: {
    fontSize: 9.75,
    fontWeight: 700,
    color: colors.muted,
    width: 90,
    textAlign: "right",
    marginRight: 5.25,
  },
  pageSubtotalValue: {
    fontSize: 9.75,
    fontWeight: 700,
    color: colors.ink,
    width: 90,
    textAlign: "right",
  },
  notesAndTotals: {
    flexDirection: "row",
    gap: 15,
    marginTop: 10,
  },
  notesBox: {
    width: 290.25,
    minHeight: 132,
    borderWidth: 1.25,
    borderColor: colors.border,
    borderRadius: 14,
    paddingTop: 18,
    paddingRight: 24,
    paddingBottom: 18,
    paddingLeft: 24,
  },
  noteText: {
    fontSize: 10.5,
    color: colors.text,
    lineHeight: 1.5,
    marginBottom: 6,
  },
  totalsBox: {
    width: 210,
    minHeight: 132,
    borderWidth: 1.25,
    borderColor: colors.border,
    borderRadius: 14,
    paddingTop: 18,
    paddingRight: 24,
    paddingBottom: 18,
    paddingLeft: 24,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  totalLabel: {
    fontSize: 10.5,
    color: colors.muted,
  },
  totalValue: {
    fontSize: 10.5,
    fontWeight: 700,
    color: colors.ink,
  },
  totalDivider: {
    borderBottomWidth: 1.2,
    borderBottomColor: colors.divider,
    marginTop: 4,
    marginBottom: 13,
  },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  grandLabel: {
    fontSize: 13.5,
    fontWeight: 700,
    color: colors.ink,
  },
  grandValue: {
    fontSize: 13.5,
    fontWeight: 700,
    color: colors.ink,
  },
  footerWrap: {
    position: "absolute",
    left: 39.75,
    right: 39.75,
    bottom: 24,
  },
  footerText: {
    marginTop: 10.5,
    fontSize: 10.5,
    color: colors.soft,
  },
  emptyRow: {
    paddingVertical: 12,
    paddingHorizontal: 18.75,
  },
});

function renderTable(
  items: OfferPdfItem[],
  currency: CurrencyCode
) {
  return (
    <>
      <View style={styles.tableWrap}>
        <View style={styles.tableInner}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.codeCell]}>{TR.itemCode}</Text>
            <Text style={[styles.headerText, styles.nameCell]}>{TR.itemName}</Text>
            <Text style={[styles.headerText, styles.qtyCell]}>{TR.quantity}</Text>
            <Text style={[styles.headerText, styles.unitCell]}>{TR.unit}</Text>
            <Text style={[styles.headerText, styles.priceCell]}>{TR.unitPrice}</Text>
            <Text style={[styles.headerText, styles.totalCell]}>{TR.total}</Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.cellText}>{TR.noItems}</Text>
            </View>
          ) : (
            items.map((item, itemIndex) => {
              const isFinalRow = itemIndex === items.length - 1 && !item.description?.trim();

              return (
                <React.Fragment key={item.id}>
                  <View style={isFinalRow ? [styles.row, styles.rowLast] : styles.row} wrap={false}>
                    <Text style={[styles.cellText, styles.codeCell]}>{item.item_code ?? "-"}</Text>
                    <Text style={[styles.cellText, styles.nameCell]}>{item.item_name}</Text>
                    <Text style={[styles.cellText, styles.qtyCell]}>{String(item.quantity ?? 0)}</Text>
                    <Text style={[styles.cellText, styles.unitCell]}>{item.unit}</Text>
                    <Text style={[styles.cellText, styles.priceCell]}>
                      {formatCurrency(Number(item.unit_price ?? 0), currency)}
                    </Text>
                    <Text style={[styles.cellText, styles.totalCell]}>
                      {formatCurrency(Number(item.line_total ?? 0), currency)}
                    </Text>
                  </View>

                  {item.description?.trim() ? (
                    <View
                      style={itemIndex === items.length - 1 ? [styles.row, styles.rowAlt, styles.rowLast] : [styles.row, styles.rowAlt]}
                      wrap={false}
                    >
                      <Text style={styles.codeCell}></Text>
                      <Text style={[styles.descText, { width: 394.5 }]}>{item.description.trim()}</Text>
                    </View>
                  ) : null}
                </React.Fragment>
              );
            })
          )}
        </View>
      </View>
    </>
  );
}

export default function OfferPdfDocument({
  offer,
  customer,
  settings,
  salesRep,
  items,
}: {
  offer: OfferPdfOffer;
  customer: OfferPdfCustomer | null;
  settings?: OfferPdfSettings | null;
  salesRep?: OfferPdfSalesRep | null;
  items: OfferPdfItem[];
}) {
  const currency = normalizeCurrency(offer.currency_code);
  const rawNotes = offer.notes?.trim() || TR.defaultNotes;
  const noteLines = rawNotes.split("\n");
  const salesRepName =
    salesRep?.full_name?.trim() || extractTaggedNoteValue(noteLines, SALES_REP_TAGS) || "-";
  const salesRepEmail =
    salesRep?.email?.trim() || extractTaggedNoteValue(noteLines, EMAIL_TAGS) || "-";
  const salesRepPhone =
    salesRep?.phone?.trim() || extractTaggedNoteValue(noteLines, PHONE_TAGS) || "-";
  const notes = (
    noteLines
      .filter(
        (line) =>
          !isTaggedNoteLine(line, SALES_REP_TAGS) &&
          !isTaggedNoteLine(line, EMAIL_TAGS) &&
          !isTaggedNoteLine(line, PHONE_TAGS)
      )
      .join("\n")
      .trim() || TR.defaultNotes
  )
    .split("\n")
    .filter(Boolean);
  const pages = paginateItems(items);
  const companyName = (settings?.company_name?.trim() || "NORAPP").toUpperCase();
  const logoSrc = getLogoSource(settings?.logo_url);

  return (
    <Document title={offer.offer_no} author="noxo" subject="Fiyat Teklifi" creator="noxo" producer="noxo">
      {pages.map((pageItems, index) => {
        const isFirstPage = index === 0;
        const isLastPage = index === pages.length - 1;

        return (
          <Page key={`${offer.id}-${index}`} size="A4" style={styles.page}>
            {isFirstPage ? (
              <>
                <View style={styles.firstPageHeader}>
                  <View style={styles.logoBlock}>
                    {logoSrc ? (
                      // eslint-disable-next-line jsx-a11y/alt-text
                      <Image src={logoSrc} style={styles.logo} />
                    ) : null}
                    <Text style={styles.documentTitle}>{TR.offerDocument}</Text>
                  </View>

                  <View style={styles.offerNoWrap}>
                    <Text style={styles.offerNoLabel}>{TR.offerNo}</Text>
                    <Text style={styles.offerNoValue}>{offer.offer_no}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.cardsRow}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{TR.customer}</Text>
                    <Text style={styles.customerName}>{customer?.company_name ?? "-"}</Text>
                    <Text style={styles.cardText}>{customer?.address ?? "-"}</Text>
                    <Text style={styles.cardText}>
                      {[customer?.city, customer?.country].filter(Boolean).join(" / ") || "-"}
                    </Text>
                    <Text style={styles.cardText}>{customer?.phone ?? "-"}</Text>
                    <Text style={[styles.cardText, { marginBottom: 0 }]}>{customer?.email ?? "-"}</Text>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{TR.offerInfo}</Text>

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
                      <Text style={styles.infoLabel}>{TR.salesRep}</Text>
                      <Text style={styles.infoValue}>{salesRepName}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>E-mail</Text>
                      <Text style={styles.infoValue}>{salesRepEmail}</Text>
                    </View>
                    <View style={[styles.infoRow, { marginBottom: 0 }]}>
                      <Text style={styles.infoLabel}>Telefon</Text>
                      <Text style={styles.infoValue}>{salesRepPhone}</Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.continuationHeader}>
                <View style={styles.continuationTop}>
                  <Text style={styles.continuationTitle}>{offer.offer_no}</Text>
                  <Text style={styles.continuationSubtitle}>
                    {TR.offerDocument} - {index + 1}. Sayfa
                  </Text>
                </View>
                <View style={styles.divider} />
              </View>
            )}

            {renderTable(pageItems, currency)}

            <View style={styles.pageSubtotal}>
              <Text style={styles.pageSubtotalLabel}>{TR.subtotal}</Text>
              <Text style={styles.pageSubtotalValue}>
                {formatCurrency(sumLineTotals(pageItems), currency)}
              </Text>
            </View>

            {isLastPage ? (
              <>
                <View style={styles.notesAndTotals}>
                  <View style={styles.notesBox}>
                    <Text style={styles.cardTitle}>{TR.notes}</Text>
                    {notes.map((line, lineIndex) => (
                      <Text key={`${offer.id}-note-${lineIndex}`} style={styles.noteText}>
                        {line}
                      </Text>
                    ))}
                  </View>

                  <View style={styles.totalsBox}>
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>{TR.subtotal}</Text>
                      <Text style={styles.totalValue}>{formatCurrency(Number(offer.subtotal ?? 0), currency)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>{TR.discount}</Text>
                      <Text style={styles.totalValue}>
                        {formatCurrency(Number(offer.discount_total ?? 0), currency)}
                      </Text>
                    </View>
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>{TR.tax}</Text>
                      <Text style={styles.totalValue}>{formatCurrency(Number(offer.tax_total ?? 0), currency)}</Text>
                    </View>

                    <View style={styles.totalDivider} />

                    <View style={styles.grandRow}>
                      <Text style={styles.grandLabel}>{TR.grandTotal}</Text>
                      <Text style={styles.grandValue}>
                        {formatCurrency(Number(offer.grand_total ?? 0), currency)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.footerWrap}>
                  <View style={[styles.divider, { marginBottom: 0 }]} />
                  <Text style={styles.footerText}>{companyName}</Text>
                </View>
              </>
            ) : (
              <View style={styles.footerWrap} fixed>
                <View style={[styles.divider, { marginBottom: 0 }]} />
                <Text style={styles.footerText}>{companyName}</Text>
              </View>
            )}
          </Page>
        );
      })}
    </Document>
  );
}
