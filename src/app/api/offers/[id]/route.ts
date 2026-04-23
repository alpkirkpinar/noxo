import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { PERMISSIONS } from "@/lib/permissions"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await getServerIdentity(PERMISSIONS.offerDelete)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params

  const { error: itemsError } = await auth.supabase
    .from("offer_items")
    .delete()
    .eq("offer_id", id)
    .eq("company_id", auth.identity.companyId)

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  const { error: offerError } = await auth.supabase
    .from("offers")
    .delete()
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)

  if (offerError) {
    return NextResponse.json({ error: offerError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
