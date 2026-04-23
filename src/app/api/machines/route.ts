import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { PERMISSIONS } from "@/lib/permissions"

function normalizeMachinePayload(body: Record<string, unknown>, companyId: string) {
  return {
    company_id: companyId,
    customer_id: String(body?.customer_id ?? "").trim() || null,
    machine_code: String(body?.machine_code ?? "").trim() || `MAC-${Date.now()}`,
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

export async function POST(request: Request) {
  const auth = await getServerIdentity(PERMISSIONS.machineCreate)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const payload = normalizeMachinePayload(body, auth.identity.companyId)

  if (!payload.machine_name) {
    return NextResponse.json({ error: "Makine adı zorunludur." }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from("machines")
    .insert(payload)
    .select("id")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ machine: data })
}
