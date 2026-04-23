import DashboardOverviewClient from "@/components/dashboard/dashboard-overview-client"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {}
        },
      },
    }
  )
}

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

function isCompletedStatus(status: string | null | undefined) {
  const normalized = String(status ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")

  return [
    "completed",
    "complete",
    "done",
    "closed",
    "tamamlandı",
    "tamamlandi",
  ].includes(normalized)
}

export default async function DashboardOverview() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Oturum bulunamadı.
      </div>
    )
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("id, company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (!appUser?.company_id) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Kullanıcı şirket bilgisi bulunamadı.
      </div>
    )
  }

  const companyId = appUser.company_id
  const permissionIdentity = {
    role: user.app_metadata?.role,
    super_user: user.app_metadata?.super_user,
    company_modules: Array.isArray(user.app_metadata?.company_modules)
      ? user.app_metadata.company_modules.map(String)
      : undefined,
    company_active: user.app_metadata?.company_active === false ? false : undefined,
    permissions: Array.isArray(user.app_metadata?.permissions)
      ? user.app_metadata.permissions.map(String)
      : [],
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
      .select("id, status")
      .eq("company_id", companyId),

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
  const activeTickets =
    activeTicketsResult.data?.filter((ticket) => !isCompletedStatus(ticket.status)).length ?? 0
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
      canViewTickets={hasPermission(permissionIdentity, PERMISSIONS.tickets)}
      canViewServiceForms={hasPermission(permissionIdentity, PERMISSIONS.serviceForms)}
      canManageCalendar={hasPermission(permissionIdentity, PERMISSIONS.dashboardCalendarManage)}
    />
  )
}
