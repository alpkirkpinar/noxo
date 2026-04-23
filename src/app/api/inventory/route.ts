import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { PERMISSIONS } from "@/lib/permissions"

function toNumber(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "")
  const num = Number(normalized)
  return Number.isNaN(num) ? 0 : num
}

function normalizeItem(body: Record<string, unknown>, companyId: string) {
  return {
    company_id: companyId,
    item_code: String(body?.item_code ?? "").trim(),
    item_name: String(body?.item_name ?? "").trim(),
    unit: String(body?.unit ?? "").trim() || "adet",
    current_stock: toNumber(body?.current_stock),
    min_stock: body?.min_stock === null || body?.min_stock === "" ? null : toNumber(body?.min_stock),
    category: String(body?.category ?? "").trim() || null,
    description: String(body?.description ?? "").trim() || null,
    unit_price: body?.unit_price === null || body?.unit_price === "" ? null : toNumber(body?.unit_price),
    currency: String(body?.currency ?? "TRY").trim() || "TRY",
    is_active: body?.is_active !== false,
  }
}

export async function GET() {
  const auth = await getServerIdentity(PERMISSIONS.inventory)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from("inventory_items")
    .select(`
      id,
      company_id,
      warehouse_id,
      item_code,
      item_name,
      description,
      category,
      unit,
      cost_price,
      sale_price,
      min_stock,
      current_stock,
      currency_code,
      location_text,
      is_active,
      created_at,
      updated_at,
      unit_price,
      currency
    `)
    .eq("company_id", auth.identity.companyId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    companyId: auth.identity.companyId,
    items: data ?? [],
  })
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>
  const permission = body?.mode === "import" ? PERMISSIONS.csvImport : PERMISSIONS.stockCreate
  const auth = await getServerIdentity(permission)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (body?.mode === "import") {
    const items = Array.isArray(body?.items) ? body.items : []
    const importMode = body?.importMode === "overwrite" ? "overwrite" : "append"
    const payload = items
      .map((item) => normalizeItem(item as Record<string, unknown>, auth.identity.companyId))
      .filter((item) => item.item_code && item.item_name)

    if (payload.length === 0) {
      return NextResponse.json({ error: "İçe aktarılacak geçerli kayıt bulunamadı." }, { status: 400 })
    }

    if (importMode === "overwrite") {
      const itemCodes = Array.from(new Set(payload.map((item) => item.item_code)))

      const { data: existingItems, error: existingError } = await auth.supabase
        .from("inventory_items")
        .select("id, item_code")
        .eq("company_id", auth.identity.companyId)
        .in("item_code", itemCodes)

      if (existingError) {
        return NextResponse.json({ error: existingError.message }, { status: 500 })
      }

      const existingByCode = new Map(
        (existingItems ?? []).map((item) => [String(item.item_code), String(item.id)])
      )
      const updatedItems = []
      const newItems = []

      for (const item of payload) {
        const existingId = existingByCode.get(item.item_code)

        if (!existingId) {
          newItems.push(item)
          continue
        }

        const { data: updated, error: updateError } = await auth.supabase
          .from("inventory_items")
          .update(item)
          .eq("id", existingId)
          .eq("company_id", auth.identity.companyId)
          .select("*")
          .single()

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        updatedItems.push(updated)
      }

      const { data: insertedItems, error: insertError } = newItems.length
        ? await auth.supabase.from("inventory_items").insert(newItems).select("*")
        : { data: [], error: null }

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      const data = [...updatedItems, ...(insertedItems ?? [])]

      for (const item of data) {
        await auth.supabase.from("inventory_movements").insert({
          company_id: auth.identity.companyId,
          inventory_item_id: item.id,
          movement_type: "import",
          quantity: Number(item.current_stock ?? 0),
          unit_cost: item.unit_price ?? null,
          note: "CSV import üzerine yaz",
        })
      }

      return NextResponse.json({ items: data })
    }

    const { data, error } = await auth.supabase.from("inventory_items").insert(payload).select("*")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    for (const item of data ?? []) {
      await auth.supabase.from("inventory_movements").insert({
        company_id: auth.identity.companyId,
        inventory_item_id: item.id,
        movement_type: "import",
        quantity: Number(item.current_stock ?? 0),
        unit_cost: item.unit_price ?? null,
        note: "CSV import",
      })
    }

    return NextResponse.json({ items: data ?? [] })
  }

  const payload = normalizeItem(body, auth.identity.companyId)

  if (!payload.item_code || !payload.item_name) {
    return NextResponse.json({ error: "Parça kodu ve adı zorunludur." }, { status: 400 })
  }

  const { data, error } = await auth.supabase.from("inventory_items").insert(payload).select("*").single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await auth.supabase.from("inventory_movements").insert({
    company_id: auth.identity.companyId,
    inventory_item_id: data.id,
    movement_type: "create",
    quantity: payload.current_stock,
    unit_cost: payload.unit_price,
    note: body?.note ?? "Yeni parça eklendi",
  })

  return NextResponse.json({ item: data })
}

export async function DELETE(request: Request) {
  const auth = await getServerIdentity(PERMISSIONS.stockDelete)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Record<string, unknown>
  const ids = Array.isArray(body?.ids)
    ? body.ids.map((id) => String(id).trim()).filter(Boolean)
    : []

  if (ids.length === 0) {
    return NextResponse.json({ error: "Silinecek kayıt seçilmedi." }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from("inventory_items")
    .delete()
    .eq("company_id", auth.identity.companyId)
    .in("id", ids)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, deleted: ids.length })
}
