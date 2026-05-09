import { NextResponse } from "next/server"
import { getServerIdentity } from "@/lib/authz"
import { sendNewTicketNotificationEmail } from "@/lib/email"
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

type TicketNotificationRow = {
  id: string
  ticket_no: string
  title: string
  description: string | null
  priority: TicketPriority
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
        .select("id, customer_id, machine_name, serial_number")
        .eq("company_id", auth.identity.companyId)
        .order("machine_name", { ascending: true }),

      auth.supabase
        .from("app_users")
        .select("id, full_name")
        .eq("company_id", auth.identity.companyId)
        .order("full_name", { ascending: true }),
    ])

  if (ticketsResult.error) {
    return NextResponse.json(
      {
        error: localizeErrorMessage(
          ticketsResult.error.message,
          "Ticket listesi alinamadi."
        ),
      },
      { status: 500 }
    )
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
    return NextResponse.json(
      {
        error: localizeErrorMessage(
          historyResult.error.message,
          "Ticket gecmisi alinamadi."
        ),
      },
      { status: 500 }
    )
  }

  if (customersResult.error) {
    return NextResponse.json(
      {
        error: localizeErrorMessage(
          customersResult.error.message,
          "Musteri listesi alinamadi."
        ),
      },
      { status: 500 }
    )
  }

  if (machinesResult.error) {
    return NextResponse.json(
      {
        error: localizeErrorMessage(
          machinesResult.error.message,
          "Makine listesi alinamadi."
        ),
      },
      { status: 500 }
    )
  }

  if (employeesResult.error) {
    return NextResponse.json(
      {
        error: localizeErrorMessage(
          employeesResult.error.message,
          "Calisan listesi alinamadi."
        ),
      },
      { status: 500 }
    )
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
    return NextResponse.json({ error: "Musteri secmek zorunludur." }, { status: 400 })
  }

  if (!title) {
    return NextResponse.json({ error: "Baslik zorunludur." }, { status: 400 })
  }

  if (assignedTo) {
    const { data: employee, error: employeeError } = await auth.supabase
      .from("app_users")
      .select("id")
      .eq("id", assignedTo)
      .eq("company_id", auth.identity.companyId)
      .single()

    if (employeeError || !employee) {
      return NextResponse.json({ error: "Atanan kullanici bulunamadi." }, { status: 400 })
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
    return NextResponse.json(
      {
        error: localizeErrorMessage(error.message, "Ticket olusturulamadi."),
      },
      { status: 500 }
    )
  }

  const [ticketResult, recipientsResult, companyResult, customerResult, machineResult, openerResult] =
    await Promise.all([
      auth.supabase
        .from("tickets")
        .select("id, ticket_no, title, description, priority")
        .eq("company_id", auth.identity.companyId)
        .eq("customer_id", customerId)
        .eq("opened_by", auth.identity.appUserId)
        .eq("title", title)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      auth.supabase
        .from("app_users")
        .select("email")
        .eq("company_id", auth.identity.companyId),
      auth.supabase
        .from("system_settings")
        .select("company_name")
        .eq("company_id", auth.identity.companyId)
        .maybeSingle(),
      auth.supabase
        .from("customers")
        .select("company_name")
        .eq("id", customerId)
        .eq("company_id", auth.identity.companyId)
        .maybeSingle(),
      machineId
        ? auth.supabase
            .from("machines")
            .select("machine_name")
            .eq("id", machineId)
            .eq("company_id", auth.identity.companyId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      auth.supabase
        .from("app_users")
        .select("full_name, email")
        .eq("id", auth.identity.appUserId)
        .eq("company_id", auth.identity.companyId)
        .maybeSingle(),
    ])

  if (ticketResult.data && !ticketResult.error) {
    const ticket = ticketResult.data as TicketNotificationRow
    const recipientEmails = (recipientsResult.data ?? [])
      .map((row) => String(row.email ?? "").trim().toLowerCase())
      .filter(Boolean)
    const companyName = String(companyResult.data?.company_name ?? "").trim() || "Noxo"
    const customerName = String(customerResult.data?.company_name ?? "").trim() || "-"
    const openedByName =
      String(openerResult.data?.full_name ?? "").trim() ||
      String(openerResult.data?.email ?? "").trim() ||
      "Noxo kullanicisi"

    const emailDelivery = await sendNewTicketNotificationEmail({
      to: recipientEmails,
      companyName,
      ticketNo: ticket.ticket_no,
      title: ticket.title,
      description: ticket.description,
      customerName,
      machineName: machineResult.data?.machine_name ?? null,
      openedByName,
      priority: ticket.priority,
      detailUrl: getTicketDetailUrl(request, ticket.id),
    })

    if (!emailDelivery.sent) {
      console.error("Ticket notification email could not be sent:", emailDelivery.error)
    }
  } else {
    console.error(
      "Ticket notification skipped because created ticket could not be reloaded.",
      ticketResult.error
    )
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

function getTicketDetailUrl(request: Request, ticketId: string) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim()

  if (configuredUrl) {
    return `${configuredUrl.replace(/\/+$/, "")}/dashboard/tickets/${ticketId}`
  }

  return new URL(`/dashboard/tickets/${ticketId}`, request.url).toString()
}
