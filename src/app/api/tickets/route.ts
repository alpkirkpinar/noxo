import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { PERMISSIONS } from "@/lib/permissions"

export async function POST(request: Request) {
  const auth = await getServerIdentity(PERMISSIONS.ticketCreate)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const customerId = String(body?.customerId ?? "").trim()
  const machineId = String(body?.machineId ?? "").trim()
  const assignedTo = String(body?.assignedTo ?? "").trim()
  const title = String(body?.title ?? "").trim()
  const description = String(body?.description ?? "").trim()
  const priority = String(body?.priority ?? "medium").trim()

  if (!customerId) {
    return NextResponse.json({ error: "Müşteri seçmek zorunludur." }, { status: 400 })
  }

  if (!title) {
    return NextResponse.json({ error: "Başlık zorunludur." }, { status: 400 })
  }

  if (assignedTo) {
    const { data: employee, error: employeeError } = await auth.supabase
      .from("app_users")
      .select("id")
      .eq("id", assignedTo)
      .eq("company_id", auth.identity.companyId)
      .single()

    if (employeeError || !employee) {
      return NextResponse.json({ error: "Atanan kullanıcı bulunamadı." }, { status: 400 })
    }
  }

  const { error } = await auth.supabase.rpc("create_ticket", {
    p_company_id: auth.identity.companyId,
    p_customer_id: customerId,
    p_machine_id: machineId || null,
    p_title: title,
    p_description: description || null,
    p_priority: priority,
    p_opened_by: auth.identity.appUserId,
    p_assigned_to: assignedTo || null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
