import DashboardOverviewClient from "@/components/dashboard/dashboard-overview-client"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { getDashboardContext } from "@/lib/dashboard-context"

type TicketRow = {
  id: string
  ticket_no: string | null
  title: string | null
  status: string | null
  created_at: string | null
  customers?: {
    company_name: string | null
  } | { company_name: string | null }[] | null
}

type ServiceFormRow = {
  id: string
  service_date: string | null
  created_at: string | null
  customers?: {
    company_name: string | null
  } | { company_name: string | null }[] | null
}

export default async function DashboardOverview() {
  const { supabase, user, companyId, identity } = await getDashboardContext()

  if (!user) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Oturum bulunamadi.
      </div>
    )
  }

  if (!companyId) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Kullanici sirket bilgisi bulunamadi.
      </div>
    )
  }

  const [
    ticketsCountResult,
    activeTicketsResult,
    customersCountResult,
    machinesCountResult,
    serviceFormsCountResult,
    latestTicketsResult,
    latestServiceFormsResult,
  ] = await Promise.all([
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),

    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .not("status", "in", "(completed,cancelled)"),

    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),

    supabase
      .from("machines")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),

    supabase
      .from("service_forms")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),

    supabase
      .from("tickets")
      .select("id, ticket_no, title, status, created_at, customers(company_name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(3),

    supabase
      .from("service_forms")
      .select("id, service_date, created_at, customers(company_name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(3),
  ])

  const totalTickets = ticketsCountResult.count ?? 0
  const activeTickets = activeTicketsResult.count ?? 0
  const totalCustomers = customersCountResult.count ?? 0
  const totalMachines = machinesCountResult.count ?? 0
  const totalServiceForms = serviceFormsCountResult.count ?? 0

  return (
    <DashboardOverviewClient
      totalTickets={totalTickets}
      activeTickets={activeTickets}
      totalCustomers={totalCustomers}
      totalMachines={totalMachines}
      totalServiceForms={totalServiceForms}
      latestTickets={(latestTicketsResult.data ?? []) as TicketRow[]}
      latestServiceForms={(latestServiceFormsResult.data ?? []) as ServiceFormRow[]}
      canViewTickets={hasPermission(identity, PERMISSIONS.tickets)}
      canViewServiceForms={hasPermission(identity, PERMISSIONS.serviceForms)}
      canManageCalendar={hasPermission(identity, PERMISSIONS.dashboardCalendarManage)}
    />
  )
}
