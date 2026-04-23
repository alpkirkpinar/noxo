import EmployeesPageClient from "@/components/employees/employees-page-client"
import { getDashboardContext } from "@/lib/dashboard-context"

export default async function EmployeesPage() {
  const { user, companyId } = await getDashboardContext()

  if (!user) {
    return <div className="text-sm text-red-600">Kullanici bulunamadi.</div>
  }

  if (!companyId) {
    return <div className="text-sm text-red-600">company_id bulunamadi.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Calisanlar</h1>
        <p className="mt-1 text-sm text-slate-500">
          Calisan bilgileri, giris hesaplari ve yetkileri
        </p>
      </div>

      <EmployeesPageClient />
    </div>
  )
}
