import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { localizeErrorMessage } from "@/lib/error-messages"
import { getMobileRouteIdentity } from "@/lib/mobile-route-auth"
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
  const mobileAuth = await getMobileRouteIdentity(request, PERMISSIONS.ticketEdit)
  if (mobileAuth && "error" in mobileAuth) {
    return NextResponse.json({ error: mobileAuth.error }, { status: mobileAuth.status })
  }

  const serverAuth = mobileAuth ? null : await getServerIdentity(PERMISSIONS.ticketEdit)

  if (serverAuth && "error" in serverAuth) {
    return NextResponse.json({ error: serverAuth.error }, { status: serverAuth.status })
  }

  const admin = mobileAuth ? mobileAuth.admin : serverAuth!.admin
  const identity = mobileAuth ? mobileAuth.identity : serverAuth!.identity

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

  const { data: ticket, error: ticketError } = await admin
    .from("tickets")
    .select("id")
    .eq("id", id)
    .eq("company_id", identity.companyId)
    .single()

  if (ticketError || !ticket) {
    return NextResponse.json({ error: "Ticket bulunamadı." }, { status: 404 })
  }

  const now = new Date().toISOString()
  const shouldCloseTicket = status === "completed" || status === "cancelled"

  const { error: updateError } = await admin
    .from("tickets")
    .update({
      status,
      updated_at: now,
      closed_at: shouldCloseTicket ? now : null,
    })
    .eq("id", id)
    .eq("company_id", identity.companyId)

  if (updateError) {
    return NextResponse.json(
      { error: localizeErrorMessage(updateError.message, "Ticket durumu güncellenemedi.") },
      { status: 500 }
    )
  }

  const { data: latestHistory, error: latestHistoryError } = await admin
    .from("ticket_status_history")
    .select("id, note")
    .eq("ticket_id", id)
    .eq("company_id", identity.companyId)
    .eq("new_status", status)
    .order("changed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestHistoryError) {
    return NextResponse.json(
      { error: localizeErrorMessage(latestHistoryError.message, "Ticket durum geçmişi okunamadı.") },
      { status: 500 }
    )
  }

  if (latestHistory) {
    const { error: historyUpdateError } = await admin
      .from("ticket_status_history")
      .update({
        note: note || null,
        changed_by: identity.appUserId,
      })
      .eq("id", latestHistory.id)
      .eq("company_id", identity.companyId)

    if (historyUpdateError) {
      return NextResponse.json(
        { error: localizeErrorMessage(historyUpdateError.message, "Ticket durum geçmişi kaydedilemedi.") },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, latestStatusNote: note || null })
  }

  const { error: historyInsertError } = await admin
    .from("ticket_status_history")
    .insert({
      company_id: identity.companyId,
      ticket_id: id,
      new_status: status,
      changed_at: now,
      changed_by: identity.appUserId,
      note: note || null,
    })

  if (historyInsertError) {
    return NextResponse.json(
      { error: localizeErrorMessage(historyInsertError.message, "Ticket durum geçmişi kaydedilemedi.") },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, latestStatusNote: note || null })
}
