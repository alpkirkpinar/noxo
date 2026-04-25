import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { computeNextMaintenanceDate, normalizeDateOnly } from "@/lib/machines"
import { PERMISSIONS } from "@/lib/permissions"

type MachineRow = {
  id: string
  machine_code: string
  machine_name: string
  brand: string | null
  model: string | null
  serial_number: string | null
  maintenance_period_days: number | null
  last_maintenance_date: string | null
  next_maintenance_date: string | null
  status: string | null
  customers: { company_name: string } | { company_name: string }[] | null
}

function normalizeMachinePayload(body: Record<string, unknown>, companyId: string) {
  const installationDate = normalizeDateOnly(String(body?.installation_date ?? "").trim())
  const lastMaintenanceDate = normalizeDateOnly(String(body?.last_maintenance_date ?? "").trim())
  const maintenancePeriodDays = Number(body?.maintenance_period_days) || null

  return {
    company_id: companyId,
    customer_id: String(body?.customer_id ?? "").trim() || null,
    machine_code: String(body?.machine_code ?? "").trim() || `MAC-${Date.now()}`,
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

function getCustomerName(relation: { company_name: string } | { company_name: string }[] | null) {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0]?.company_name ?? null
  return relation.company_name ?? null
}

export async function GET() {
  const auth = await getServerIdentity(PERMISSIONS.machines)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from("machines")
    .select(`
      id,
      machine_code,
      machine_name,
      brand,
      model,
      serial_number,
      maintenance_period_days,
      last_maintenance_date,
      next_maintenance_date,
      status,
      customers(company_name)
    `)
    .eq("company_id", auth.identity.companyId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const machines = ((data ?? []) as MachineRow[]).map((machine) => ({
    id: machine.id,
    machine_code: machine.machine_code,
    machine_name: machine.machine_name,
    customer_name: getCustomerName(machine.customers),
    brand_model: [machine.brand ?? "", machine.model ?? ""].join(" ").trim() || "-",
    serial_number: machine.serial_number,
    maintenance_period_days: machine.maintenance_period_days,
    last_maintenance_date: machine.last_maintenance_date,
    next_maintenance_date: machine.next_maintenance_date,
    status: machine.status,
  }))

  return NextResponse.json({ machines })
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
