import EmployeeCards, { type Employee } from "@/components/employees/employee-cards"
import { createAdminClient } from "@/lib/supabase/admin"
import { getDashboardContext } from "@/lib/dashboard-context"

export default async function EmployeesPage() {
  const { supabase, user, companyId } = await getDashboardContext()

  if (!user) {
    return <div className="text-sm text-red-600">Kullanici bulunamadi.</div>
  }

  if (!companyId) {
    return <div className="text-sm text-red-600">company_id bulunamadi.</div>
  }

  const { data: employees, error: employeesError } = await supabase
    .from("app_users")
    .select("id, auth_user_id, full_name, email, phone, title")
    .eq("company_id", companyId)
    .order("full_name", { ascending: true })

  if (employeesError) {
    return <div className="text-sm text-red-600">{employeesError.message}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Calisanlar</h1>
        <p className="mt-1 text-sm text-slate-500">
          Calisan bilgileri, giris hesaplari ve yetkileri
        </p>
      </div>

      <EmployeeCards employees={await withAuthMetadata((employees ?? []) as Employee[])} />
    </div>
  )
}

async function withAuthMetadata(employees: Employee[]) {
  try {
    const admin = createAdminClient()

    return await Promise.all(
      employees.map(async (employee) => {
        if (!employee.auth_user_id) return employee

        const { data } = await admin.auth.admin.getUserById(employee.auth_user_id)
        const permissions = data.user?.app_metadata?.permissions

        return {
          ...employee,
          is_super_user:
            data.user?.app_metadata?.super_user === true ||
            data.user?.app_metadata?.role === "super_user",
          permissions: Array.isArray(permissions) ? permissions.map(String) : [],
        }
      })
    )
  } catch {
    return employees
  }
}
