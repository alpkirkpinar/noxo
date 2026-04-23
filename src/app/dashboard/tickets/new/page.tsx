import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import NewTicketForm from "@/components/tickets/new-ticket-form"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

type CustomerItem = {
  id: string
  company_name: string
}

type MachineItem = {
  id: string
  customer_id: string
  machine_name: string
  machine_code: string
}

type EmployeeItem = {
  id: string
  full_name: string
}

async function getPageData() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const canCreate = hasPermission(
    {
      role: user.app_metadata?.role,
      super_user: user.app_metadata?.super_user,
      permissions: Array.isArray(user.app_metadata?.permissions)
        ? user.app_metadata.permissions.map(String)
        : [],
    },
    PERMISSIONS.ticketCreate
  )

  if (!canCreate) {
    redirect("/dashboard/unauthorized")
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("id, company_id")
    .eq("auth_user_id", user.id)
    .single()

  if (appUserError || !appUser) {
    throw new Error("Uygulama kullanıcısı bulunamadı.")
  }

  const { data: customers, error: customersError } = await supabase
    .from("customers")
    .select("id, company_name")
    .eq("company_id", appUser.company_id)
    .eq("is_active", true)
    .order("company_name", { ascending: true })

  if (customersError) {
    throw new Error(customersError.message)
  }

  const { data: machines, error: machinesError } = await supabase
    .from("machines")
    .select("id, customer_id, machine_name, machine_code")
    .eq("company_id", appUser.company_id)
    .order("machine_name", { ascending: true })

  if (machinesError) {
    throw new Error(machinesError.message)
  }

  const { data: employees, error: employeesError } = await supabase
    .from("app_users")
    .select("id, full_name")
    .eq("company_id", appUser.company_id)
    .order("full_name", { ascending: true })

  if (employeesError) {
    throw new Error(employeesError.message)
  }

  return {
    companyId: appUser.company_id as string,
    openedBy: appUser.id as string,
    customers: (customers ?? []) as CustomerItem[],
    machines: (machines ?? []) as MachineItem[],
    employees: (employees ?? []) as EmployeeItem[],
    canCreate,
  }
}

export default async function NewTicketPage() {
  const { companyId, openedBy, customers, machines, employees, canCreate } = await getPageData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Yeni Ticket</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">Yeni bir servis kaydı oluşturun</p>
      </div>

      <NewTicketForm
        companyId={companyId}
        openedBy={openedBy}
        customers={customers}
        machines={machines}
        employees={employees}
        canCreate={canCreate}
      />
    </div>
  )
}
