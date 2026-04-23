import { redirect } from "next/navigation"
import TicketsListClient from "@/components/tickets/tickets-list-client"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { getDashboardContext } from "@/lib/dashboard-context"

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

export default async function TicketsPage() {
  const { supabase, user, appUserId, companyId, identity } = await getDashboardContext()

  if (!user) redirect("/login")
  if (!companyId || !appUserId) {
    throw new Error("Kullanicinin sirket bilgisi bulunamadi.")
  }

  const [ticketsResult, historyResult, customersResult, machinesResult, employeesResult] = await Promise.all([
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
      .from("ticket_status_history")
      .select("ticket_id, note, changed_at")
      .eq("company_id", companyId)
      .not("note", "is", null)
      .order("changed_at", { ascending: false }),

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

  if (ticketsResult.error) throw new Error(ticketsResult.error.message)
  if (historyResult.error) throw new Error(historyResult.error.message)
  if (customersResult.error) throw new Error(customersResult.error.message)
  if (machinesResult.error) throw new Error(machinesResult.error.message)
  if (employeesResult.error) throw new Error(employeesResult.error.message)

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

  const rows = ((ticketsResult.data ?? []) as RawTicketRow[]).map((row) => ({
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
      employees={(employeesResult.data ?? []) as EmployeeItem[]}
      initialTickets={rows}
      permissions={{
        canCreate: hasPermission(identity, PERMISSIONS.ticketCreate),
        canDelete: hasPermission(identity, PERMISSIONS.ticketDelete),
        canUpdateStatus: hasPermission(identity, PERMISSIONS.ticketEdit),
      }}
    />
  )
}
