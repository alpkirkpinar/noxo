import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { localizeErrorMessage } from "@/lib/error-messages"
import { PERMISSIONS } from "@/lib/permissions"

type CustomerRow = {
  id: string
  company_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  city: string | null
  country: string | null
  is_active: boolean
  created_at: string
}

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

export async function GET() {
  const auth = await getServerIdentity(PERMISSIONS.customers)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const [{ data: customers, error: customersError }, { data: machines, error: machinesError }] =
    await Promise.all([
      auth.supabase
        .from("customers")
        .select(`
          id,
          company_name,
          contact_name,
          phone,
          email,
          city,
          country,
          is_active,
          created_at
        `)
        .eq("company_id", auth.identity.companyId)
        .order("company_name", { ascending: true }),

      auth.supabase
        .from("machines")
        .select("id, customer_id")
        .eq("company_id", auth.identity.companyId),
    ])

  if (customersError) {
    return NextResponse.json({ error: localizeErrorMessage(customersError.message, "Müşteriler alınamadı.") }, { status: 500 })
  }

  if (machinesError) {
    return NextResponse.json({ error: localizeErrorMessage(machinesError.message, "Makine bilgileri alınamadı.") }, { status: 500 })
  }

  const machineCountMap = new Map<string, number>()

  for (const machine of machines ?? []) {
    if (!machine.customer_id) continue
    machineCountMap.set(
      machine.customer_id,
      (machineCountMap.get(machine.customer_id) ?? 0) + 1
    )
  }

  const rows = ((customers ?? []) as CustomerRow[]).map((customer) => ({
    ...customer,
    machine_count: machineCountMap.get(customer.id) ?? 0,
  }))

  return NextResponse.json({ customers: rows })
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
    return NextResponse.json({ error: localizeErrorMessage(error.message, "Müşteri kaydedilemedi.") }, { status: 500 })
  }

  return NextResponse.json({ customer: data })
}
