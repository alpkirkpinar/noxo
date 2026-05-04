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

type TicketPriority = "low" | "medium" | "high" | "critical" | null

type RelatedCustomer = {
  company_name: string
} | null

type RelatedMachine = {
  machine_name: string
} | null

type EmployeeItem = {
  id: string
  full_name: string
}

type RawTicketRow = {
  id: string
  ticket_no: string
  title: string
  status: TicketStatus
  priority: TicketPriority
  created_at: string
  customers: RelatedCustomer | RelatedCustomer[]
  machines: RelatedMachine | RelatedMachine[]
}

type StatusHistoryRow = {
  ticket_id: string
  note: string | null
  changed_at: string
}

function getCustomerName(relation: RelatedCustomer | RelatedCustomer[]) {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0]?.company_name ?? null
  return relation.company_name ?? null
}

function getMachineName(relation: RelatedMachine | RelatedMachine[]) {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0]?.machine_name ?? null
  return relation.machine_name ?? null
}

export async function GET() {
  const auth = await getServerIdentity(PERMISSIONS.tickets)

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const [ticketsResult, customersResult, machinesResult, employeesResult] =
    await Promise.all([
      auth.supabase
        .from("tickets")
        .select(`
          id,
          ticket_no,
          title,
          status,
          priority,
          created_at,
          customers(company_name),
          machines(machine_name)
        `)
        .eq("company_id", auth.identity.companyId)
        .order("created_at", { ascending: false }),

      auth.supabase
        .from("customers")
        .select("id, company_name")
        .eq("company_id", auth.identity.companyId)
        .eq("is_active", true)
        .order("company_name", { ascending: true }),

      auth.supabase
        .from("machines")
        .select("id, customer_id, machine_name, machine_code")
        .eq("company_id", auth.identity.companyId)
        .order("machine_name", { ascending: true }),

      auth.supabase
        .from("app_users")
        .select("id, full_name")
        .eq("company_id", auth.identity.companyId)
        .order("full_name", { ascending: true }),
    ])

  if (ticketsResult.error) {
    return NextResponse.json({ error: localizeErrorMessage(ticketsResult.error.message, "Ticket listesi alınamadı.") }, { status: 500 })
  }

  const rawTickets = (ticketsResult.data ?? []) as RawTicketRow[]
  const ticketIds = rawTickets.map((ticket) => ticket.id)
  const historyResult = ticketIds.length
    ? await auth.supabase
        .from("ticket_status_history")
        .select("ticket_id, note, changed_at")
        .eq("company_id", auth.identity.companyId)
        .in("ticket_id", ticketIds)
        .order("changed_at", { ascending: false })
    : { data: [], error: null }

  if (historyResult.error) {
    return NextResponse.json({ error: localizeErrorMessage(historyResult.error.message, "Ticket geçmişi alınamadı.") }, { status: 500 })
  }

  if (customersResult.error) {
    return NextResponse.json({ error: localizeErrorMessage(customersResult.error.message, "Müşteri listesi alınamadı.") }, { status: 500 })
  }

  if (machinesResult.error) {
    return NextResponse.json({ error: localizeErrorMessage(machinesResult.error.message, "Makine listesi alınamadı.") }, { status: 500 })
  }

  if (employeesResult.error) {
    return NextResponse.json({ error: localizeErrorMessage(employeesResult.error.message, "Çalışan listesi alınamadı.") }, { status: 500 })
  }

  const latestHistoryNoteByTicket = new Map<string, string>()
  const latestStatusChangedAtByTicket = new Map<string, string>()

  for (const item of (historyResult.data ?? []) as StatusHistoryRow[]) {
    if (!latestStatusChangedAtByTicket.has(item.ticket_id)) {
      latestStatusChangedAtByTicket.set(item.ticket_id, item.changed_at)
    }

    if (!item.note?.trim()) continue
    if (!latestHistoryNoteByTicket.has(item.ticket_id)) {
      latestHistoryNoteByTicket.set(item.ticket_id, item.note.trim())
    }
  }

  const tickets = rawTickets.map((row) => ({
    id: row.id,
    ticket_no: row.ticket_no,
    title: row.title,
    status: row.status,
    priority: row.priority,
    created_at: row.created_at,
    customer_name: getCustomerName(row.customers),
    machine_name: getMachineName(row.machines),
    status_note: latestHistoryNoteByTicket.get(row.id) ?? null,
    status_changed_at: latestStatusChangedAtByTicket.get(row.id) ?? row.created_at,
  }))

  return NextResponse.json({
    companyId: auth.identity.companyId,
    openedBy: auth.identity.appUserId,
    customers: customersResult.data ?? [],
    machines: machinesResult.data ?? [],
    employees: (employeesResult.data ?? []) as EmployeeItem[],
    tickets,
  })
}

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
    return NextResponse.json({ error: localizeErrorMessage(error.message, "Ticket oluşturulamadı.") }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
