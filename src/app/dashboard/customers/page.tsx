import { redirect } from "next/navigation"
import CustomerList from "@/components/customers/customer-list"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { getDashboardContext } from "@/lib/dashboard-context"

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

export default async function CustomersPage() {
  const { supabase, user, companyId, identity } = await getDashboardContext()

  if (!user) redirect("/login")
  if (!companyId) throw new Error("company_id bulunamadi.")

  const [{ data: customers, error: customersError }, { data: machines, error: machinesError }] =
    await Promise.all([
      supabase
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
        .eq("company_id", companyId)
        .order("company_name", { ascending: true }),

      supabase
        .from("machines")
        .select("id, customer_id")
        .eq("company_id", companyId),
    ])

  if (customersError) throw new Error(customersError.message)
  if (machinesError) throw new Error(machinesError.message)

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

  return (
    <CustomerList
      customers={rows}
      permissions={{
        canCreate: hasPermission(identity, PERMISSIONS.customerCreate),
        canEdit: hasPermission(identity, PERMISSIONS.customerEdit),
        canDelete: hasPermission(identity, PERMISSIONS.customerDelete),
      }}
    />
  )
}
