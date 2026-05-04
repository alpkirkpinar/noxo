import { redirect } from "next/navigation"
import TicketsListClient from "@/components/tickets/tickets-list-client"
import { getDashboardContext } from "@/lib/dashboard-context"
import { localizeErrorMessage } from "@/lib/error-messages"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

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

export default async function TicketsPage() {
  const { supabase, user, appUserId, companyId, identity } = await getDashboardContext()

  if (!user) {
    redirect("/login")
  }

  if (!companyId || !appUserId) {
    throw new Error("Kullanıcı şirket bilgisi bulunamadı.")
  }

  if (!hasPermission(identity, PERMISSIONS.tickets)) {
    redirect("/dashboard/unauthorized")
  }

  const [ticketsResult, customersResult, machinesResult, employeesResult] = await Promise.all([
    supabase
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
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),

    supabase
      .from("customers")
      .select("id, company_name")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("company_name", { ascending: true }),

    supabase
      .from("machines")
      .select("id, customer_id, machine_name, machine_code")
      .eq("company_id", companyId)
      .order("machine_name", { ascending: true }),

    supabase
      .from("app_users")
      .select("id, full_name")
      .eq("company_id", companyId)
      .order("full_name", { ascending: true }),
  ])

  if (ticketsResult.error) {
    throw new Error(localizeErrorMessage(ticketsResult.error.message, "Ticket listesi alınamadı."))
  }

  if (customersResult.error) {
    throw new Error(localizeErrorMessage(customersResult.error.message, "Müşteri listesi alınamadı."))
  }

  if (machinesResult.error) {
    throw new Error(localizeErrorMessage(machinesResult.error.message, "Makine listesi alınamadı."))
  }

  if (employeesResult.error) {
    throw new Error(localizeErrorMessage(employeesResult.error.message, "Çalışan listesi alınamadı."))
  }

  const rawTickets = (ticketsResult.data ?? []) as RawTicketRow[]
  const ticketIds = rawTickets.map((ticket) => ticket.id)
  const historyResult = ticketIds.length
    ? await supabase
        .from("ticket_status_history")
        .select("ticket_id, note, changed_at")
        .eq("company_id", companyId)
        .in("ticket_id", ticketIds)
        .order("changed_at", { ascending: false })
    : { data: [], error: null }

  if (historyResult.error) {
    throw new Error(localizeErrorMessage(historyResult.error.message, "Ticket geçmişi alınamadı."))
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

  return (
    <TicketsListClient
      companyId={companyId}
      openedBy={appUserId}
      customers={customersResult.data ?? []}
      machines={machinesResult.data ?? []}
      employees={employeesResult.data ?? []}
      initialTickets={tickets}
      permissions={{
        canCreate: hasPermission(identity, PERMISSIONS.ticketCreate),
        canDelete: hasPermission(identity, PERMISSIONS.ticketDelete),
        canUpdateStatus: hasPermission(identity, PERMISSIONS.ticketEdit),
      }}
    />
  )
}
