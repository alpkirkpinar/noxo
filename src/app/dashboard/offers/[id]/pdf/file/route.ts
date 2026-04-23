import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OfferPdfDocument from "@/lib/pdf/offer-pdf-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OfferRow = {
  id: string;
  offer_no: string | null;
  customer_id: string | null;
  offer_date: string | null;
  valid_until: string | null;
  currency_code: string | null;
  status: string | null;
  subtotal: number | null;
  discount_total: number | null;
  tax_total: number | null;
  grand_total: number | null;
  notes: string | null;
};

type OfferItemRow = {
  id: string;
  item_code: string | null;
  item_name: string;
  description: string | null;
  quantity: number | null;
  unit: string;
  unit_price: number | null;
  line_total: number | null;
};

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
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 401 });
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .single();

  if (appUserError || !appUser?.company_id) {
    return NextResponse.json(
      { error: appUserError?.message || "company_id bulunamadı." },
      { status: 400 }
    );
  }

  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .select(
      `
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
    `
    )
    .eq("company_id", appUser.company_id)
    .eq("id", id)
    .single();

  if (offerError || !offer) {
    return NextResponse.json(
      { error: offerError?.message || "Teklif bulunamadı." },
      { status: 404 }
    );
  }

  const [{ data: customer }, { data: settings }, { data: items, error: itemsError }] = await Promise.all([
    offer.customer_id
      ? supabase
          .from("customers")
          .select("company_name, address, city, country, phone, email")
          .eq("company_id", appUser.company_id)
          .eq("id", offer.customer_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("system_settings")
      .select("company_name, logo_url")
      .eq("company_id", appUser.company_id)
      .maybeSingle(),
    supabase
      .from("offer_items")
      .select(
        `
        id,
        item_code,
        item_name,
        description,
        quantity,
        unit,
        unit_price,
        line_total
      `
      )
      .eq("company_id", appUser.company_id)
      .eq("offer_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  try {
    const pdfBuffer = await renderToBuffer(
      createElement(OfferPdfDocument as never, {
        offer: {
          id: String((offer as OfferRow).id),
          offer_no: String((offer as OfferRow).offer_no ?? "teklif"),
          offer_date: (offer as OfferRow).offer_date,
          valid_until: (offer as OfferRow).valid_until,
          currency_code: (offer as OfferRow).currency_code,
          status: (offer as OfferRow).status,
          subtotal: (offer as OfferRow).subtotal,
          discount_total: (offer as OfferRow).discount_total,
          tax_total: (offer as OfferRow).tax_total,
          grand_total: (offer as OfferRow).grand_total,
          notes: (offer as OfferRow).notes,
        },
        customer: customer ?? null,
        settings: settings ?? null,
        items: ((items ?? []) as OfferItemRow[]).map((item) => ({
          id: item.id,
          item_code: item.item_code,
          item_name: item.item_name,
          description: item.description,
          quantity: Number(item.quantity ?? 0),
          unit: item.unit,
          unit_price: Number(item.unit_price ?? 0),
          line_total: Number(item.line_total ?? 0),
        })),
      }) as never
    );

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${offer.offer_no ?? "teklif"}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
