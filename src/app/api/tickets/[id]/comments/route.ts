import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { PERMISSIONS } from "@/lib/permissions"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getServerIdentity(PERMISSIONS.ticketEdit)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  const body = await request.json()
  const commentText = String(body?.commentText ?? "").trim()

  if (!commentText) {
    return NextResponse.json({ error: "Yorum alanı zorunludur." }, { status: 400 })
  }

  const { error } = await auth.supabase.rpc("add_ticket_comment", {
    p_company_id: auth.identity.companyId,
    p_ticket_id: id,
    p_comment_text: commentText,
    p_is_internal: true,
    p_created_by: auth.identity.appUserId,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
