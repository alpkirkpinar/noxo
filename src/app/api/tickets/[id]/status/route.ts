import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { localizeErrorMessage } from "@/lib/error-messages"
import { PERMISSIONS } from "@/lib/permissions"

type TicketStatus =
  | "new"
  | "assigned"
  | "investigating"
  | "waiting_offer"
  | "waiting_parts"
  | "in_progress"
  | "completed"
  | "cancelled"

const VALID_STATUSES = new Set<TicketStatus>([
  "new",
  "assigned",
  "investigating",
  "waiting_offer",
  "waiting_parts",
  "in_progress",
  "completed",
  "cancelled",
])

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
  const status = String(body?.status ?? "").trim() as TicketStatus
  const note = String(body?.note ?? "").trim()

  if (!status) {
    return NextResponse.json({ error: "Durum zorunludur." }, { status: 400 })
  }

  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Geçersiz durum seçildi." }, { status: 400 })
  }

  const { data: ticket, error: ticketError } = await auth.admin
    .from("tickets")
    .select("id, status")
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)
    .single()

  if (ticketError || !ticket) {
    return NextResponse.json({ error: "Ticket bulunamadı." }, { status: 404 })
  }

  const now = new Date().toISOString()
  const shouldCloseTicket = status === "completed" || status === "cancelled"

  const { error: updateError } = await auth.admin
    .from("tickets")
    .update({
      status,
      updated_at: now,
      closed_at: shouldCloseTicket ? now : null,
    })
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)

  if (updateError) {
    return NextResponse.json(
      { error: localizeErrorMessage(updateError.message, "Ticket durumu güncellenemedi.") },
      { status: 500 }
    )
  }

  const { error: historyError } = await auth.admin
    .from("ticket_status_history")
    .insert({
      company_id: auth.identity.companyId,
      ticket_id: id,
      old_status: ticket.status,
      new_status: status,
      changed_at: now,
      changed_by: auth.identity.appUserId,
      note: note || null,
    })

  if (historyError) {
    return NextResponse.json(
      { error: localizeErrorMessage(historyError.message, "Ticket durum geçmişi kaydedilemedi.") },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
