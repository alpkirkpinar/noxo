import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { PERMISSIONS } from "@/lib/permissions"

type RouteContext = {
  params: Promise<{ id: string }>
}

function toNumber(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "")
  const num = Number(normalized)
  return Number.isNaN(num) ? 0 : num
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getServerIdentity(PERMISSIONS.offerEdit)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  const body = (await request.json()) as Record<string, unknown>
  const rows = Array.isArray(body.rows) ? body.rows : []
  const customerId = String(body.customer_id ?? "").trim()

  if (!customerId) {
    return NextResponse.json({ error: "Müşteri seçmek zorunludur." }, { status: 400 })
  }

  const validRows = rows
    .map((row) => row as Record<string, unknown>)
    .filter((row) => String(row.item_code ?? "").trim() && String(row.item_name ?? "").trim() && toNumber(row.quantity) > 0)

  if (validRows.length === 0) {
    return NextResponse.json({ error: "En az bir geçerli teklif satırı girin." }, { status: 400 })
  }

  const subtotal = Number(validRows.reduce((sum, row) => sum + toNumber(row.line_total), 0).toFixed(2))
  const currencyCode = String(validRows[0]?.currency ?? "TRY")

  const { error: updateError } = await auth.supabase
    .from("offers")
    .update({
      offer_no: String(body.offer_no ?? "").trim(),
      customer_id: customerId,
      offer_date: String(body.offer_date ?? "").trim(),
      valid_until: String(body.valid_until ?? "").trim() || null,
      currency_code: currencyCode,
      subtotal,
      discount_total: 0,
      tax_total: 0,
      grand_total: subtotal,
      notes: String(body.notes ?? "").trim() || null,
    })
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { error: deleteItemsError } = await auth.supabase
    .from("offer_items")
    .delete()
    .eq("offer_id", id)
    .eq("company_id", auth.identity.companyId)

  if (deleteItemsError) {
    return NextResponse.json({ error: deleteItemsError.message }, { status: 500 })
  }

  const offerItemsPayload = validRows.map((row) => ({
    company_id: auth.identity.companyId,
    offer_id: id,
    inventory_item_id: String(row.item_id ?? "").trim() || null,
    item_code: String(row.item_code ?? "").trim() || null,
    item_name: String(row.item_name ?? "").trim(),
    description: String(row.description ?? "").trim() || null,
    quantity: toNumber(row.quantity),
    unit: String(row.unit ?? "").trim() || "pcs",
    unit_price: toNumber(row.offer_unit_price),
    discount_rate: 0,
    tax_rate: 0,
  }))

  const { error: itemsError } = await auth.supabase.from("offer_items").insert(offerItemsPayload)

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  const { data: updatedOffer, error: fetchError } = await auth.supabase
    .from("offers")
    .select(
      "id, customer_id, offer_no, offer_date, valid_until, currency_code, status, subtotal, discount_total, tax_total, grand_total, created_at"
    )
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)
    .single()

  if (fetchError || !updatedOffer) {
    return NextResponse.json({ error: fetchError?.message ?? "Teklif güncellendi ama okunamadı." }, { status: 500 })
  }

  return NextResponse.json({ offer: updatedOffer })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await getServerIdentity(PERMISSIONS.offerDelete)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params

  const { error: itemsError } = await auth.supabase
    .from("offer_items")
    .delete()
    .eq("offer_id", id)
    .eq("company_id", auth.identity.companyId)

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  const { error: offerError } = await auth.supabase
    .from("offers")
    .delete()
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)

  if (offerError) {
    return NextResponse.json({ error: offerError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
