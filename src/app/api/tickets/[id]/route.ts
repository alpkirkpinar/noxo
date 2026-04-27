import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { localizeErrorMessage } from "@/lib/error-messages"
import { PERMISSIONS } from "@/lib/permissions"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getServerIdentity(PERMISSIONS.ticketEdit)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  const body = await request.json()
  const title = String(body?.title ?? "").trim()
  const description = String(body?.description ?? "").trim()
  const customerId = String(body?.customerId ?? "").trim()
  const machineId = String(body?.machineId ?? "").trim()
  const priority = String(body?.priority ?? "medium").trim()

  if (!title) {
    return NextResponse.json({ error: "Başlık zorunludur." }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from("tickets")
    .update({
      title,
      description: description || null,
      priority,
      customer_id: customerId || null,
      machine_id: machineId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)

  if (error) {
    return NextResponse.json({ error: localizeErrorMessage(error.message, "Ticket güncellenemedi.") }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getServerIdentity(PERMISSIONS.ticketDelete)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params

  const { error: commentsError } = await auth.supabase
    .from("ticket_comments")
    .delete()
    .eq("ticket_id", id)
    .eq("company_id", auth.identity.companyId)

  if (commentsError) {
    return NextResponse.json({ error: localizeErrorMessage(commentsError.message, "Ticket yorumları silinemedi.") }, { status: 500 })
  }

  const { error: historyError } = await auth.supabase
    .from("ticket_status_history")
    .delete()
    .eq("ticket_id", id)
    .eq("company_id", auth.identity.companyId)

  if (historyError) {
    return NextResponse.json({ error: localizeErrorMessage(historyError.message, "Ticket geçmişi silinemedi.") }, { status: 500 })
  }

  const { error } = await auth.supabase
    .from("tickets")
    .delete()
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)

  if (error) {
    return NextResponse.json({ error: localizeErrorMessage(error.message, "Ticket silinemedi.") }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
