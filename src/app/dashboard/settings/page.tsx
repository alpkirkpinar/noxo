import SystemSettings from "@/components/settings/system-settings"
import { getDashboardContext } from "@/lib/dashboard-context"
import { isSuperUser } from "@/lib/permissions"

export default async function SettingsPage() {
  const { supabase, user, companyId, identity } = await getDashboardContext()

  if (!user) {
    return <div className="text-sm text-red-600">Kullanici bulunamadi.</div>
  }

  if (!companyId) {
    return <div className="text-sm text-red-600">company_id bulunamadi.</div>
  }

  const { data: settings } = await supabase
    .from("system_settings")
    .select("company_name, logo_url, maintenance_approver_name, maintenance_approver_title")
    .eq("company_id", companyId)
    .maybeSingle()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sistem Ayarlari</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sirket adi ve tekliflerde kullanilacak logo ayarlari
        </p>
      </div>

      <SystemSettings
        companyId={companyId}
        initialCompanyName={settings?.company_name ?? ""}
        initialLogoUrl={settings?.logo_url ?? ""}
        initialMaintenanceApproverName={settings?.maintenance_approver_name ?? ""}
        initialMaintenanceApproverTitle={settings?.maintenance_approver_title ?? ""}
        canManageApprover={isSuperUser(identity)}
      />
    </div>
  )
}
