import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { PERMISSIONS } from "@/lib/permissions"

export async function POST(request: Request) {
  const auth = await getServerIdentity(PERMISSIONS.machineEdit)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Record<string, unknown>
  const ids = Array.isArray(body?.ids) ? body.ids.map((id) => String(id).trim()).filter(Boolean) : []

  if (ids.length === 0) {
    return NextResponse.json({ error: "Bakım için makine seçilmedi." }, { status: 400 })
  }

  const today = new Date()
  const todayText = today.toISOString().slice(0, 10)

  const { data: machines, error: fetchError } = await auth.supabase
    .from("machines")
    .select("id, maintenance_period_days")
    .eq("company_id", auth.identity.companyId)
    .in("id", ids)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  for (const machine of machines ?? []) {
    const periodDays = Number(machine.maintenance_period_days ?? 0)
    const nextDate = new Date(today)

    if (periodDays > 0) {
      nextDate.setDate(nextDate.getDate() + periodDays)
    }

    const { error } = await auth.supabase
      .from("machines")
      .update({
        last_maintenance_date: todayText,
        next_maintenance_date: periodDays > 0 ? nextDate.toISOString().slice(0, 10) : null,
      })
      .eq("id", machine.id)
      .eq("company_id", auth.identity.companyId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, updated: machines?.length ?? 0 })
}
