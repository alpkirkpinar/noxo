import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { PERMISSIONS } from "@/lib/permissions"

function normalizeCustomerPayload(body: Record<string, unknown>, companyId: string, appUserId?: string) {
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
    ...(appUserId ? { created_by: appUserId } : {}),
  }
}

export async function POST(request: Request) {
  const auth = await getServerIdentity(PERMISSIONS.customerCreate)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const payload = normalizeCustomerPayload(body, auth.identity.companyId, auth.identity.appUserId)

  if (!payload.company_name) {
    return NextResponse.json({ error: "Firma adı zorunludur." }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from("customers")
    .insert(payload)
    .select("id")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ customer: data })
}
