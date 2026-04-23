import React from "react";
import { NextResponse } from "next/server";
import { pdf } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import OfferPdfDocument from "@/lib/pdf/offer-pdf-document";

export const runtime = "nodejs";

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
    return NextResponse.json({ error: "KullanÄ±cÄ± bulunamadÄ±." }, { status: 401 });
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .single();

  if (appUserError || !appUser?.company_id) {
    return NextResponse.json(
      { error: appUserError?.message || "company_id bulunamadÄ±." },
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
      { error: offerError?.message || "Teklif bulunamadÄ±." },
      { status: 404 }
    );
  }

  const [{ data: customer }, { data: items, error: itemsError }] = await Promise.all([
    supabase
      .from("customers")
      .select("company_name, address, city, country, phone, email")
      .eq("company_id", appUser.company_id)
      .eq("id", offer.customer_id)
      .single(),
    supabase
      .from("offer_items")
      .select(`
        id,
        item_code,
        item_name,
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

  const instance = pdf(
    React.createElement(OfferPdfDocument, {
      offer,
      customer: customer ?? null,
      items: items ?? [],
    })
  );

  const pdfBuffer = await instance.toBuffer();

  return new NextResponse(pdfBuffer as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${offer.offer_no}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}