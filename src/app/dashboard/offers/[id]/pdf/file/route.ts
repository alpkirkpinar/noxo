import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CurrencyCode = "TRY" | "USD" | "EUR";

type PdfItem = {
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
  customer: "M\u00DC\u015ETER\u0130 B\u0130LG\u0130LER\u0130",
  offerInfo: "TEKL\u0130F B\u0130LG\u0130LER\u0130",
  offerNo: "TEKL\u0130F NO",
  offerDate: "Teklif Tarihi",
  validUntil: "Ge\u00E7erlilik",
  currency: "Para Birimi",
  itemCode: "Par\u00E7a Kodu",
  itemName: "Par\u00E7a Ad\u0131",
  quantity: "Miktar",
  unit: "Birim",
  unitPrice: "Birim Fiyat",
  total: "Tutar",
  notes: "NOTLAR",
  subtotal: "Ara Toplam",
  discount: "\u0130skonto",
  tax: "Vergi",
  grandTotal: "Genel Toplam",
  noItems: "Kalem bulunamad\u0131.",
  defaultNotes:
    "- Teklife KDV dahil de\u011Fildir.\n- \u00D6deme : Sipari\u015Fte %100\n- D\u00F6viz \u00E7evriminde \u00F6deme tarihindeki TCMB d\u00F6viz sat\u0131\u015F kuru esas al\u0131nacakt\u0131r.\n- Fiyat\u0131m\u0131z yat\u0131r\u0131m te\u015Fvik kapsam\u0131nda 0 KDV'li faturalama i\u00E7in ge\u00E7erli de\u011Fildir.\n- Aksi belirtilmedik\u00E7e \u00FCr\u00FCn tekliflerimize m\u00FChendislik, programlama \u00E7al\u0131\u015Fmalar\u0131 dahil de\u011Fildir.",
};

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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nl2br(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function getItemUnits(item: PdfItem) {
  return item.description?.trim() ? 2 : 1;
}

function sumLineTotals(items: PdfItem[]) {
  return Number(items.reduce((sum, item) => sum + Number(item.line_total ?? 0), 0).toFixed(2));
}

function takeItemsByUnits(source: PdfItem[], maxUnits: number) {
  const pageItems: PdfItem[] = [];
  let used = 0;
  let index = 0;

  while (index < source.length) {
    const item = source[index];
    const units = getItemUnits(item);

    if (pageItems.length > 0 && used + units > maxUnits) {
      break;
    }

    if (pageItems.length === 0 && units > maxUnits) {
      pageItems.push(item);
      index += 1;
      break;
    }

    if (used + units > maxUnits) {
      break;
    }

    pageItems.push(item);
    used += units;
    index += 1;
  }

  return {
    pageItems,
    rest: source.slice(index),
  };
}

function paginateItems(items: PdfItem[]) {
  if (items.length === 0) {
    return [[]];
  }

  const firstPageUnits = 12;
  const middlePageUnits = 16;
  const lastPageUnits = 5;

  const pages: PdfItem[][] = [];
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

    const restUnits = remaining.reduce((sum, item) => sum + getItemUnits(item), 0);

    if (restUnits <= lastPageUnits) {
      pages.push(remaining);
      break;
    }

    if (restUnits <= middlePageUnits + lastPageUnits) {
      const middleTake = takeItemsByUnits(remaining, middlePageUnits);
      pages.push(middleTake.pageItems);
      remaining = middleTake.rest;
      continue;
    }

    const middleTake = takeItemsByUnits(remaining, middlePageUnits);
    pages.push(middleTake.pageItems);
    remaining = middleTake.rest;
  }

  const nonEmptyPages = pages.filter((page) => page.length > 0);

  return nonEmptyPages.length > 0 ? nonEmptyPages : [[]];
}

function buildItemRows(items: PdfItem[], currency: CurrencyCode) {
  if (items.length === 0) {
    return `
      <tr>
        <td colspan="6" class="empty-row">${escapeHtml(TR.noItems)}</td>
      </tr>
    `;
  }

  return items
    .map((item) => {
      const mainRow = `
        <tr class="main-row">
          <td>${escapeHtml(item.item_code ?? "-")}</td>
          <td>${escapeHtml(item.item_name)}</td>
          <td class="text-center">${escapeHtml(item.quantity)}</td>
          <td class="text-center">${escapeHtml(item.unit)}</td>
          <td class="text-right">${escapeHtml(formatCurrency(Number(item.unit_price ?? 0), currency))}</td>
          <td class="text-right">${escapeHtml(formatCurrency(Number(item.line_total ?? 0), currency))}</td>
        </tr>
      `;

      const desc = item.description?.trim();
      const descRow = desc
        ? `
          <tr class="desc-row">
            <td></td>
            <td colspan="5">${escapeHtml(desc)}</td>
          </tr>
        `
        : "";

      return mainRow + descRow;
    })
    .join("");
}

function buildOfferHtml(data: {
  offer: {
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
  customer: {
    company_name?: string | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  settings: {
    company_name?: string | null;
    logo_url?: string | null;
  } | null;
  items: PdfItem[];
  supabaseUrl: string;
}) {
  const currency = normalizeCurrency(data.offer.currency_code);
  const rawNotes = data.offer.notes?.trim() || TR.defaultNotes;
  const noteLines = rawNotes.split("\n");

  const salesRepLine = noteLines.find((line) => line.startsWith("Sat\u0131\u015F Temsilcisi:")) ?? "";
  const salesRepEmailLine = noteLines.find((line) => line.startsWith("E-mail:")) ?? "";
  const salesRepPhoneLine = noteLines.find((line) => line.startsWith("Telefon:")) ?? "";

  const notes = noteLines
    .filter(
      (line) =>
        !line.startsWith("Sat\u0131\u015F Temsilcisi:") &&
        !line.startsWith("E-mail:") &&
        !line.startsWith("Telefon:")
    )
    .join("\n")
    .trim() || TR.defaultNotes;

  const salesRep = salesRepLine.replace("Sat\u0131\u015F Temsilcisi:", "").trim();
  const salesRepEmail = salesRepEmailLine.replace("E-mail:", "").trim();
  const salesRepPhone = salesRepPhoneLine.replace("Telefon:", "").trim();

  const companyName = data.settings?.company_name?.trim() || "noxo";
  const logoUrl = data.settings?.logo_url?.trim() || "";
  const pages = paginateItems(data.items);

  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" class="logo" />`
    : `<div class="brand-title">${escapeHtml(companyName)}</div>`;

  const pagesHtml = pages
    .map((pageItems, index) => {
      const isFirstPage = index === 0;
      const isLastPage = index === pages.length - 1;
      const pageSubtotal = sumLineTotals(pageItems);
      const itemRows = buildItemRows(pageItems, currency);

      return `
        <section class="page ${!isLastPage ? "page-break" : ""}">
          <div class="page-content">
          ${
            isFirstPage
              ? `
            <div class="header">
              <div class="header-left">
                ${logoHtml}
                <p class="brand-sub">${escapeHtml(TR.offerDocument)}</p>
              </div>

              <div class="offer-no-wrap">
                <div class="offer-no-label">${escapeHtml(TR.offerNo)}</div>
                <div class="offer-no-value">${escapeHtml(data.offer.offer_no)}</div>
              </div>
            </div>

            <div class="divider"></div>

            <div class="two-col">
              <div class="info-card">
                <h2 class="section-title">${escapeHtml(TR.customer)}</h2>
                <div class="customer-name">${escapeHtml(data.customer?.company_name ?? "-")}</div>
                <p class="line">${escapeHtml(data.customer?.address ?? "-")}</p>
                <p class="line">${escapeHtml([data.customer?.city, data.customer?.country].filter(Boolean).join(" / ") || "-")}</p>
                <p class="line">${escapeHtml(data.customer?.phone ?? "-")}</p>
                <p class="line">${escapeHtml(data.customer?.email ?? "-")}</p>
              </div>

              <div class="info-card">
                <h2 class="section-title">${escapeHtml(TR.offerInfo)}</h2>

                <div class="info-row">
                  <div class="info-label">${escapeHtml(TR.offerDate)}</div>
                  <div class="info-value">${escapeHtml(formatDate(data.offer.offer_date))}</div>
                </div>

                <div class="info-row">
                  <div class="info-label">${escapeHtml(TR.validUntil)}</div>
                  <div class="info-value">${escapeHtml(formatDate(data.offer.valid_until))}</div>
                </div>

                <div class="info-row">
                  <div class="info-label">${escapeHtml(TR.currency)}</div>
                  <div class="info-value">${escapeHtml(data.offer.currency_code ?? "TRY")}</div>
                </div>

                <div class="info-row">
                  <div class="info-label">${escapeHtml("Sat\u0131\u015F Temsilcisi")}</div>
                  <div class="info-value">${escapeHtml(salesRep || "-")}</div>
                </div>

                <div class="info-row">
                  <div class="info-label">E-mail</div>
                  <div class="info-value">${escapeHtml(salesRepEmail || "-")}</div>
                </div>

                <div class="info-row">
                  <div class="info-label">Telefon</div>
                  <div class="info-value">${escapeHtml(salesRepPhone || "-")}</div>
                </div>
              </div>
            </div>
          `
              : `
            <div class="continued-header">
              <div class="continued-title">${escapeHtml(data.offer.offer_no)}</div>
              <div class="continued-subtitle">${escapeHtml(TR.offerDocument)} - ${index + 1}. Sayfa</div>
            </div>
          `
          }

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="width: 120px;">${escapeHtml(TR.itemCode)}</th>
                  <th>${escapeHtml(TR.itemName)}</th>
                  <th style="width: 80px;">${escapeHtml(TR.quantity)}</th>
                  <th style="width: 80px;">${escapeHtml(TR.unit)}</th>
                  <th style="width: 120px;" class="text-right">${escapeHtml(TR.unitPrice)}</th>
                  <th style="width: 120px;" class="text-right">${escapeHtml(TR.total)}</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
              </tbody>
            </table>
          </div>

          <div class="page-subtotal-wrap">
            <div class="page-subtotal-label">${escapeHtml(TR.subtotal)}</div>
            <div class="page-subtotal-value">${escapeHtml(formatCurrency(pageSubtotal, currency))}</div>
          </div>

          ${
            isLastPage
              ? `
            <div class="notes-totals">
              <div class="notes">
                <h2 class="section-title">${escapeHtml(TR.notes)}</h2>
                <div class="notes-body">${nl2br(notes)}</div>
              </div>

              <div class="totals">
                <div class="total-row">
                  <div class="total-label">${escapeHtml(TR.subtotal)}</div>
                  <div class="total-value">${escapeHtml(formatCurrency(Number(data.offer.subtotal ?? 0), currency))}</div>
                </div>

                <div class="total-row">
                  <div class="total-label">${escapeHtml(TR.discount)}</div>
                  <div class="total-value">${escapeHtml(formatCurrency(Number(data.offer.discount_total ?? 0), currency))}</div>
                </div>

                <div class="total-row">
                  <div class="total-label">${escapeHtml(TR.tax)}</div>
                  <div class="total-value">${escapeHtml(formatCurrency(Number(data.offer.tax_total ?? 0), currency))}</div>
                </div>

                <div class="grand-row">
                  <div class="grand-label">${escapeHtml(TR.grandTotal)}</div>
                  <div class="grand-value">${escapeHtml(formatCurrency(Number(data.offer.grand_total ?? 0), currency))}</div>
                </div>
              </div>
            </div>

            <div class="footer">${escapeHtml(companyName)}</div>
          `
              : `
            <div class="footer footer-light">${escapeHtml(companyName)}</div>
          `
          }
          </div>
        </section>
      `;
    })
    .join("");

  return `
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(data.offer.offer_no)}</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 14mm 18mm 14mm;
    }

    @font-face {
      font-family: "CalibriCustom";
      src: url("${data.supabaseUrl}/storage/v1/object/public/public-assets/calibri-regular.ttf") format("truetype");
      font-weight: 400;
      font-style: normal;
    }

    @font-face {
      font-family: "CalibriCustom";
      src: url("${data.supabaseUrl}/storage/v1/object/public/public-assets/calibri-bold.ttf") format("truetype");
      font-weight: 700;
      font-style: normal;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      color: #0f172a;
      font-family: "CalibriCustom", Arial, Helvetica, sans-serif;
      font-size: 13px;
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
    }

    body {
      padding: 0;
    }

    .page {
      width: 100%;
      min-height: 261mm;
      display: flex;
      flex-direction: column;
      break-inside: auto;
      page-break-inside: auto;
    }

    .page-content {
      min-height: 261mm;
      display: flex;
      flex: 1;
      flex-direction: column;
    }

    .page-break {
      break-after: page;
      page-break-after: always;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .logo {
      max-width: 260px;
      max-height: 115px;
      object-fit: contain;
      display: block;
    }

    .brand-title {
      font-size: 30px;
      font-weight: 700;
      margin: 0;
    }

    .brand-sub {
      font-size: 14px;
      color: #475569;
      margin: 0;
    }

    .offer-no-wrap {
      text-align: right;
      padding-top: 14px;
    }

    .offer-no-label {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 5px;
    }

    .offer-no-value {
      font-size: 24px;
      font-weight: 700;
    }

    .divider {
      border-top: 1px solid #cbd5e1;
      margin: 12px 0 14px;
    }

    .continued-header {
      display: flex;
      justify-content: space-between;
      align-items: end;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #cbd5e1;
    }

    .continued-title {
      font-size: 18px;
      font-weight: 700;
    }

    .continued-subtitle {
      font-size: 14px;
      color: #64748b;
    }

    .two-col {
      display: flex;
      gap: 20px;
      margin-bottom: 16px;
    }

    .info-card {
      flex: 1;
      border: 1px solid #94a3b8;
      border-radius: 12px;
      padding: 14px 16px;
      background: #fafafa;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      margin: 0 0 10px 0;
    }

    .customer-name {
      font-size: 16px;
      font-weight: 700;
      margin: 0 0 8px 0;
    }

    .line {
      margin: 0 0 6px 0;
      color: #334155;
      line-height: 1.4;
      font-size: 14px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .info-label {
      color: #334155;
    }

    .info-value {
      font-weight: 700;
      text-align: right;
      word-break: break-word;
    }

    .table-wrap {
      width: 100%;
      border: 1px solid #94a3b8;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    thead th {
      background: #f8fafc;
      border-bottom: 1px solid #cbd5e1;
      padding: 10px 12px;
      text-align: left;
      font-size: 13px;
      font-weight: 700;
      color: #334155;
    }

    tbody td {
      border-bottom: 1px solid #e2e8f0;
      padding: 11px 12px;
      font-size: 14px;
      line-height: 1.35;
      vertical-align: top;
    }

    .main-row td {
      background: #ffffff;
    }

    .desc-row td {
      padding-top: 6px;
      padding-bottom: 10px;
      font-size: 13px;
      color: #64748b;
      background: #fcfcfc;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .text-right {
      text-align: right;
    }

    .text-center {
      text-align: center;
    }

    .empty-row {
      text-align: center;
      color: #64748b;
      padding: 20px;
    }

    .page-subtotal-wrap {
      width: 100%;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 18px;
      padding: 8px 12px 0 12px;
      font-size: 13px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .page-subtotal-label {
      color: #475569;
      font-weight: 700;
    }

    .page-subtotal-value {
      color: #0f172a;
      font-weight: 700;
      min-width: 110px;
      text-align: right;
      white-space: nowrap;
    }

    .notes-totals {
      display: flex;
      gap: 20px;
      align-items: flex-start;
      margin-top: 10px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .notes {
      flex: 1;
      border: 1px solid #94a3b8;
      border-radius: 12px;
      padding: 14px 16px;
      background: #fafafa;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .notes-body {
      color: #334155;
      line-height: 1.5;
      font-size: 13px;
    }

    .totals {
      width: 280px;
      border: 1px solid #94a3b8;
      border-radius: 12px;
      padding: 14px 16px;
      background: #fafafa;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .total-label {
      color: #475569;
    }

    .total-value {
      font-weight: 700;
    }

    .grand-row {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      border-top: 1px solid #cbd5e1;
      margin-top: 6px;
      padding-top: 10px;
    }

    .grand-label,
    .grand-value {
      font-size: 15px;
      font-weight: 700;
    }

    .footer {
      margin-top: auto;
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
      color: #64748b;
      font-size: 13px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .footer-light {
      margin-top: 6px;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
  `;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Kullan\u0131c\u0131 bulunamad\u0131." }, { status: 401 });
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .single();

  if (appUserError || !appUser?.company_id) {
    return NextResponse.json(
      { error: appUserError?.message || "company_id bulunamad\u0131." },
      { status: 400 }
    );
  }

  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .select(`
      id,
      offer_no,
      customer_id,
      offer_date,
      valid_until,
      currency_code,
      status,
      subtotal,
      discount_total,
      tax_total,
      grand_total,
      notes
    `)
    .eq("company_id", appUser.company_id)
    .eq("id", id)
    .single();

  if (offerError || !offer) {
    return NextResponse.json(
      { error: offerError?.message || "Teklif bulunamad\u0131." },
      { status: 404 }
    );
  }

  const [{ data: customer }, { data: settings }, { data: items, error: itemsError }] = await Promise.all([
    supabase
      .from("customers")
      .select("company_name, address, city, country, phone, email")
      .eq("company_id", appUser.company_id)
      .eq("id", offer.customer_id)
      .single(),
    supabase
      .from("system_settings")
      .select("company_name, logo_url")
      .eq("company_id", appUser.company_id)
      .maybeSingle(),
    supabase
      .from("offer_items")
      .select(`
        id,
        item_code,
        item_name,
        description,
        quantity,
        unit,
        unit_price,
        line_total
      `)
      .eq("company_id", appUser.company_id)
      .eq("offer_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_URL tan\u0131ml\u0131 de\u011Fil." }, { status: 500 });
  }

  const html = buildOfferHtml({
    offer,
    customer: customer ?? null,
    settings: settings ?? null,
    items: (items ?? []) as PdfItem[],
    supabaseUrl,
  });

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${offer.offer_no}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF olu\u015Fturulamad\u0131.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
