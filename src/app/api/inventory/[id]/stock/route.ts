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
  const body = await request.json()
  const type = String(body?.type ?? "")
  const auth = await getServerIdentity(type === "out" ? PERMISSIONS.stockOut : PERMISSIONS.stockIn)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  const quantity = toNumber(body?.quantity)

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Geçerli bir adet girin." }, { status: 400 })
  }

  const { data: item, error: itemError } = await auth.supabase
    .from("inventory_items")
    .select("*")
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)
    .single()

  if (itemError || !item) {
    return NextResponse.json({ error: itemError?.message ?? "Parça bulunamadı." }, { status: 404 })
  }

  const currentStock = Number(item.current_stock ?? 0)
  const nextStock = type === "out" ? currentStock - quantity : currentStock + quantity

  if (nextStock < 0) {
    return NextResponse.json({ error: "Çıkış adedi mevcut stoktan büyük olamaz." }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from("inventory_items")
    .update({ current_stock: nextStock })
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
    movement_type: type === "out" ? "stock_out" : "stock_in",
    quantity,
    unit_cost: item.unit_price ?? null,
    note: type === "out" ? "Parça çıkışı" : "Parça girişi",
  })

  return NextResponse.json({ item: data })
}
