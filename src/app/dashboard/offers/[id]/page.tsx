import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type CurrencyCode = "TRY" | "USD" | "EUR";

const TR = {
  pageTitle: "Teklif Detay\u0131",
  back: "Geri D\u00F6n",
  edit: "D\u00FCzenle",
  pdfDownload: "PDF \u0130ndir",
  offerInfo: "Teklif Bilgileri",
  customerInfo: "M\u00FC\u015Fteri Bilgileri",
  offerItems: "Teklif Kalemleri",
  notes: "Notlar",
  totals: "Toplamlar",
  offerNo: "Teklif No",
  offerDate: "Teklif Tarihi",
  validUntil: "Ge\u00E7erlilik",
  currency: "Para Birimi",
  salesRep: "Sat\u0131\u015F Temsilcisi",
  salesRepEmail: "E-mail",
  salesRepPhone: "Telefon",
  createdAt: "Olu\u015Fturulma",
  company: "Firma",
  customerCode: "M\u00FC\u015Fteri Kodu",
  contact: "Yetkili",
  phone: "Telefon",
  email: "Email",
  location: "Konum",
  address: "Adres",
  itemCode: "Par\u00E7a Kodu",
  itemName: "Par\u00E7a Ad\u0131",
  quantity: "Adet",
  unit: "Birim",
  unitPrice: "Birim Fiyat",
  discountRate: "\u0130skonto %",
  taxRate: "Vergi %",
  amount: "Tutar",
  subtotal: "Ara Toplam",
  discount: "\u0130skonto",
  tax: "Vergi",
  grandTotal: "Genel Toplam",
  noItems: "Kalem bulunamad\u0131.",
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

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userAgent = (await headers()).get("user-agent") ?? "";
  const isIos = /iPad|iPhone|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent));
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div className="text-sm text-red-600">Kullan\u0131c\u0131 bulunamad\u0131.</div>;
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!appUser?.company_id) {
    return <div className="text-sm text-red-600">company_id bulunamad\u0131.</div>;
  }

  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .select(`
      id,
      company_id,
      offer_no,
      customer_id,
      ticket_id,
      template_id,
      offer_date,
      valid_until,
      currency_code,
      status,
      subtotal,
      discount_total,
      tax_total,
      grand_total,
      notes,
      pdf_output_path,
      created_by,
      created_at,
      updated_at
    `)
    .eq("company_id", appUser.company_id)
    .eq("id", id)
    .single();

  if (offerError || !offer) {
    notFound();
  }

  const [{ data: customer }, { data: items }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, company_name, customer_code, contact_name, phone, email, address, city, country")
      .eq("company_id", appUser.company_id)
      .eq("id", offer.customer_id)
      .single(),
    supabase
      .from("offer_items")
      .select(`
        id,
        inventory_item_id,
        item_code,
        item_name,
        description,
        quantity,
        unit,
        unit_price,
        discount_rate,
        tax_rate,
        line_total,
        created_at
      `)
      .eq("company_id", appUser.company_id)
      .eq("offer_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const currency = normalizeCurrency(offer.currency_code);

  const noteLines = String(offer.notes ?? "").split("\n");
  const salesRepLine = noteLines.find((line) => line.startsWith("Satış Temsilcisi:")) ?? "";
  const salesRepEmailLine = noteLines.find((line) => line.startsWith("E-mail:")) ?? "";
  const salesRepPhoneLine = noteLines.find((line) => line.startsWith("Telefon:")) ?? "";

  const cleanNotes = noteLines
    .filter(
      (line) =>
        !line.startsWith("Satış Temsilcisi:") &&
        !line.startsWith("E-mail:") &&
        !line.startsWith("Telefon:")
    )
    .join("\n")
    .trim();

  const salesRep = salesRepLine.replace("Satış Temsilcisi:", "").trim();
  const salesRepEmail = salesRepEmailLine.replace("E-mail:", "").trim();
  const salesRepPhone = salesRepPhoneLine.replace("Telefon:", "").trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {TR.pageTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{offer.offer_no}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/offers"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {TR.back}
          </Link>

          <Link
            href={`/dashboard/offers/${offer.id}/edit`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {TR.edit}
          </Link>

          <a
            href={`/dashboard/offers/${offer.id}/pdf/file`}
            target={isIos ? "_blank" : undefined}
            rel={isIos ? "noopener noreferrer" : undefined}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {TR.pdfDownload}
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{TR.offerInfo}</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{TR.offerNo}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{offer.offer_no}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{TR.offerDate}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">
                {offer.offer_date ? new Date(offer.offer_date).toLocaleDateString("tr-TR") : "-"}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{TR.validUntil}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">
                {offer.valid_until ? new Date(offer.valid_until).toLocaleDateString("tr-TR") : "-"}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{TR.currency}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{offer.currency_code}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{TR.salesRep}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{salesRep || "-"}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{TR.salesRepEmail}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{salesRepEmail || "-"}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{TR.salesRepPhone}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{salesRepPhone || "-"}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{TR.createdAt}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">
                {offer.created_at ? new Date(offer.created_at).toLocaleString("tr-TR") : "-"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{TR.customerInfo}</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{TR.company}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{customer?.company_name ?? "-"}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{TR.customerCode}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{customer?.customer_code ?? "-"}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{TR.contact}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{customer?.contact_name ?? "-"}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{TR.phone}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{customer?.phone ?? "-"}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{TR.email}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">
                {customer?.email ? String(customer.email) : "-"}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{TR.location}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">
                {[customer?.city, customer?.country].filter(Boolean).join(" / ") || "-"}
              </div>
            </div>

            <div className="sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-slate-500">{TR.address}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{customer?.address ?? "-"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{TR.offerItems}</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.itemCode}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.itemName}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.quantity}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.unit}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.unitPrice}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.discountRate}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.taxRate}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.amount}</th>
              </tr>
            </thead>

            <tbody>
              {(items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                    {TR.noItems}
                  </td>
                </tr>
              ) : (
                (items ?? []).flatMap((item) => {
                  const mainRow = (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-sm text-slate-700">{item.item_code ?? "-"}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.item_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{item.unit}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatCurrency(Number(item.unit_price ?? 0), currency)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{item.discount_rate ?? 0}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{item.tax_rate ?? 0}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatCurrency(Number(item.line_total ?? 0), currency)}
                      </td>
                    </tr>
                  );

                  const desc = item.description?.trim();
                  const descRow = desc ? (
                    <tr key={`${item.id}-desc`} className="border-b border-slate-100 bg-slate-50/60 last:border-b-0">
                      <td className="px-4 py-2"></td>
                      <td colSpan={7} className="px-4 py-2 text-sm text-slate-500">
                        {desc}
                      </td>
                    </tr>
                  ) : null;

                  return descRow ? [mainRow, descRow] : [mainRow];
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{TR.notes}</h2>
          <div className="mt-4 whitespace-pre-wrap text-sm text-slate-700">
            {cleanNotes || "-"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{TR.totals}</h2>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{TR.subtotal}</span>
              <span className="font-medium text-slate-900">
                {formatCurrency(Number(offer.subtotal ?? 0), currency)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">{TR.discount}</span>
              <span className="font-medium text-slate-900">
                {formatCurrency(Number(offer.discount_total ?? 0), currency)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">{TR.tax}</span>
              <span className="font-medium text-slate-900">
                {formatCurrency(Number(offer.tax_total ?? 0), currency)}
              </span>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-slate-900">{TR.grandTotal}</span>
                <span className="text-lg font-bold text-slate-900">
                  {formatCurrency(Number(offer.grand_total ?? 0), currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
