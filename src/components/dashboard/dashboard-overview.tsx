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

type CalendarEventRow = {
  id: string
  title: string
  note: string | null
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

type CalendarCreatorRow = {
  id: string
  full_name: string | null
  calendar_color?: string | null
}

const EMPLOYEE_CALENDAR_COLOR_PALETTE = [
  "#E11D48",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#14B8A6",
  "#06B6D4",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#F43F5E",
  "#84CC16",
  "#10B981",
  "#0EA5E9",
]

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getCalendarStart(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const day = firstDay.getDay()
  const diff = day === 0 ? -6 : 1 - day
  firstDay.setDate(firstDay.getDate() + diff)
  return firstDay
}

function getCalendarRange(date = new Date()) {
  const month = new Date(date.getFullYear(), date.getMonth(), 1)
  const start = getCalendarStart(month)
  const end = new Date(start)
  end.setDate(start.getDate() + 41)

  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
  }
}

function normalizeCalendarColor(value: unknown) {
  const text = String(value ?? "").trim().toUpperCase()
  if (!text) return null
  if (!/^#[0-9A-F]{6}$/.test(text)) return null
  return text
}

function deriveCalendarColor(seed: string) {
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }

  return EMPLOYEE_CALENDAR_COLOR_PALETTE[hash % EMPLOYEE_CALENDAR_COLOR_PALETTE.length]
}

function attachCreatorMeta(events: CalendarEventRow[], creators: CalendarCreatorRow[]) {
  const creatorMap = new Map(
    creators.map((creator) => [
      String(creator.id),
      {
        full_name: creator.full_name ?? null,
        calendar_color: normalizeCalendarColor(creator.calendar_color),
      },
    ])
  )

  return events.map((event) => {
    const creator = event.created_by ? creatorMap.get(event.created_by) : null

    return {
      ...event,
      creator_name: creator?.full_name ?? null,
      creator_color:
        creator?.calendar_color ||
        deriveCalendarColor(String(event.created_by ?? event.id)),
    }
  })
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

  const calendarRange = getCalendarRange()

  const [
    ticketsCountResult,
    activeTicketsResult,
    customersCountResult,
    machinesCountResult,
    serviceFormsCountResult,
    latestTicketsResult,
    latestServiceFormsResult,
    calendarEventsResult,
    calendarCreatorsResult,
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

    supabase
      .from("dashboard_calendar_events")
      .select("id, title, note, start_date, end_date, start_time, end_time, created_at, updated_at, created_by")
      .eq("company_id", companyId)
      .lte("start_date", calendarRange.end)
      .gte("end_date", calendarRange.start)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),

    supabase
      .from("app_users")
      .select("id, full_name, calendar_color")
      .eq("company_id", companyId),
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
      initialCalendarEvents={attachCreatorMeta(
        (calendarEventsResult.data ?? []) as CalendarEventRow[],
        (calendarCreatorsResult.data ?? []) as CalendarCreatorRow[]
      )}
      initialCalendarRange={calendarRange}
    />
  )
}
