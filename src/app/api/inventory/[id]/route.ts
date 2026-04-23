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

function normalizeItem(body: Record<string, unknown>) {
  return {
    item_code: String(body?.item_code ?? "").trim(),
    item_name: String(body?.item_name ?? "").trim(),
    unit: String(body?.unit ?? "").trim() || "adet",
    current_stock: toNumber(body?.current_stock),
    min_stock: body?.min_stock === null || body?.min_stock === "" ? null : toNumber(body?.min_stock),
    category: String(body?.category ?? "").trim() || null,
    description: String(body?.description ?? "").trim() || null,
    unit_price: body?.unit_price === null || body?.unit_price === "" ? null : toNumber(body?.unit_price),
    currency: String(body?.currency ?? "TRY").trim() || "TRY",
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getServerIdentity(PERMISSIONS.stockEdit)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  const payload = normalizeItem(await request.json())

  if (!payload.item_code || !payload.item_name) {
    return NextResponse.json({ error: "Parça kodu ve adı zorunludur." }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from("inventory_items")
    .update(payload)
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await auth.supabase.from("inventory_movements").insert({
    company_id: auth.identity.companyId,
    inventory_item_id: id,
    movement_type: "update",
    quantity: payload.current_stock,
    unit_cost: payload.unit_price ?? null,
    note: "Parça düzenlendi",
  })

  return NextResponse.json({ item: data })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await getServerIdentity(PERMISSIONS.stockDelete)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  const { error } = await auth.supabase
    .from("inventory_items")
    .delete()
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
