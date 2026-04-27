import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { localizeErrorMessage } from "@/lib/error-messages"
import { computeNextMaintenanceDate, normalizeDateOnly } from "@/lib/machines"
import { PERMISSIONS } from "@/lib/permissions"

type RouteContext = {
  params: Promise<{ id: string }>
}

function mapMachineWriteError(message: string) {
  if (/null value in column "customer_id".*violates not-null constraint/i.test(message)) {
    return "Müşteri seçmek zorunludur."
  }

  return localizeErrorMessage(message, "Makine güncellenemedi.")
}

function normalizeMachinePayload(body: Record<string, unknown>) {
  const installationDate = normalizeDateOnly(String(body?.installation_date ?? "").trim())
  const lastMaintenanceDate = normalizeDateOnly(String(body?.last_maintenance_date ?? "").trim())
  const maintenancePeriodDays = Number(body?.maintenance_period_days) || null

  return {
    customer_id: String(body?.customer_id ?? "").trim() || null,
    machine_code: String(body?.machine_code ?? "").trim() || null,
    machine_name: String(body?.machine_name ?? "").trim(),
    brand: String(body?.brand ?? "").trim() || null,
    model: String(body?.model ?? "").trim() || null,
    serial_number: String(body?.serial_number ?? "").trim() || null,
    installation_date: installationDate,
    warranty_end_date: String(body?.warranty_end_date ?? "").trim() || null,
    maintenance_period_days: maintenancePeriodDays,
    last_maintenance_date: lastMaintenanceDate,
    next_maintenance_date: computeNextMaintenanceDate({
      maintenancePeriodDays,
      lastMaintenanceDate,
      installationDate,
    }),
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

  if (!payload.customer_id) {
    return NextResponse.json({ error: "Müşteri seçmek zorunludur." }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from("machines")
    .update(payload)
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)
    .select("id")
    .single()

  if (error) {
    return NextResponse.json({ error: mapMachineWriteError(error.message) }, { status: 500 })
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
    return NextResponse.json({ error: localizeErrorMessage(error.message, "Makine silinemedi.") }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
