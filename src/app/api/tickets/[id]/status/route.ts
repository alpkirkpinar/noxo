import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
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
  const status = String(body?.status ?? "").trim()
  const note = String(body?.note ?? "").trim()

  if (!status) {
    return NextResponse.json({ error: "Durum zorunludur." }, { status: 400 })
  }

  const { error } = await auth.supabase.rpc("change_ticket_status", {
    p_ticket_id: id,
    p_new_status: status,
    p_changed_by: auth.identity.appUserId,
    p_note: note || null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
