import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { PERMISSIONS } from "@/lib/permissions"

type RouteContext = {
  params: Promise<{ id: string }>
}

function normalizeMachinePayload(body: Record<string, unknown>) {
  return {
    customer_id: String(body?.customer_id ?? "").trim() || null,
    machine_code: String(body?.machine_code ?? "").trim() || null,
    machine_name: String(body?.machine_name ?? "").trim(),
    brand: String(body?.brand ?? "").trim() || null,
    model: String(body?.model ?? "").trim() || null,
    serial_number: String(body?.serial_number ?? "").trim() || null,
    installation_date: String(body?.installation_date ?? "").trim() || null,
    warranty_end_date: String(body?.warranty_end_date ?? "").trim() || null,
    maintenance_period_days: Number(body?.maintenance_period_days) || null,
    last_maintenance_date: String(body?.last_maintenance_date ?? "").trim() || null,
    next_maintenance_date: String(body?.next_maintenance_date ?? "").trim() || null,
    location_text: String(body?.location_text ?? "").trim() || null,
    notes: String(body?.notes ?? "").trim() || null,
    status: String(body?.status ?? "").trim() || "active",
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getServerIdentity(PERMISSIONS.machineEdit)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  const body = await request.json()
  const payload = normalizeMachinePayload(body)

  if (!payload.machine_name) {
    return NextResponse.json({ error: "Makine adı zorunludur." }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from("machines")
    .update(payload)
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)
    .select("id")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ machine: data })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await getServerIdentity(PERMISSIONS.machineDelete)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  const { error } = await auth.supabase
    .from("machines")
    .delete()
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
