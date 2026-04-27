import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { localizeErrorMessage } from "@/lib/error-messages"
import { PERMISSIONS } from "@/lib/permissions"

type RouteContext = {
  params: Promise<{ id: string }>
}

function normalizeCustomerPayload(body: Record<string, unknown>, companyId: string) {
  return {
    company_id: companyId,
    company_name: String(body?.company_name ?? "").trim(),
    contact_name: String(body?.contact_name ?? "").trim() || null,
    phone: String(body?.phone ?? "").trim() || null,
    email: String(body?.email ?? "").trim() || null,
    address: String(body?.address ?? "").trim() || null,
    city: String(body?.city ?? "").trim() || null,
    country: String(body?.country ?? "").trim() || null,
    tax_office: String(body?.tax_office ?? "").trim() || null,
    tax_number: String(body?.tax_number ?? "").trim() || null,
    notes: String(body?.notes ?? "").trim() || null,
    is_active: body?.is_active !== false,
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getServerIdentity(PERMISSIONS.customerEdit)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  const body = await request.json()
  const payload = normalizeCustomerPayload(body, auth.identity.companyId)

  if (!payload.company_name) {
    return NextResponse.json({ error: "Firma adı zorunludur." }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from("customers")
    .update(payload)
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)
    .select("id")
    .single()

  if (error) {
    return NextResponse.json({ error: localizeErrorMessage(error.message, "Müşteri güncellenemedi.") }, { status: 500 })
  }

  return NextResponse.json({ customer: data })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await getServerIdentity(PERMISSIONS.customerDelete)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  const { error } = await auth.supabase
    .from("customers")
    .delete()
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)

  if (error) {
    return NextResponse.json({ error: localizeErrorMessage(error.message, "Müşteri silinemedi.") }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
