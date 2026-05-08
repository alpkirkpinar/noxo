import SystemSettings from "@/components/settings/system-settings"
import { getDashboardContext } from "@/lib/dashboard-context"
import { isSuperUser } from "@/lib/permissions"
import { isMissingColumnError } from "@/lib/supabase-errors"

type SettingsRow = {
  company_name?: string | null
  logo_url?: string | null
  website_url?: string | null
  phone?: string | null
  address?: string | null
  maintenance_approver_name?: string | null
  maintenance_approver_title?: string | null
}

export default async function SettingsPage() {
  const { supabase, user, companyId, identity } = await getDashboardContext()

  if (!user) {
    return <div className="text-sm text-red-600">Kullanici bulunamadi.</div>
  }

  if (!companyId) {
    return <div className="text-sm text-red-600">company_id bulunamadi.</div>
  }

  const initialSettingsResult = await supabase
    .from("system_settings")
    .select("company_name, logo_url, website_url, phone, address, maintenance_approver_name, maintenance_approver_title")
    .eq("company_id", companyId)
    .maybeSingle()

  let settings: SettingsRow | null = initialSettingsResult.data
    ? {
        company_name: initialSettingsResult.data.company_name,
        logo_url: initialSettingsResult.data.logo_url,
        website_url: initialSettingsResult.data.website_url,
        phone: initialSettingsResult.data.phone,
        address: initialSettingsResult.data.address,
        maintenance_approver_name: initialSettingsResult.data.maintenance_approver_name,
        maintenance_approver_title: initialSettingsResult.data.maintenance_approver_title,
      }
    : null
  let settingsError = initialSettingsResult.error

  if (
    settingsError &&
    (isMissingColumnError(settingsError.message, "website_url", "system_settings") ||
      isMissingColumnError(settingsError.message, "phone", "system_settings") ||
      isMissingColumnError(settingsError.message, "address", "system_settings"))
  ) {
    const fallback = await supabase
      .from("system_settings")
      .select("company_name, logo_url, maintenance_approver_name, maintenance_approver_title")
      .eq("company_id", companyId)
      .maybeSingle()

    settings = fallback.data
      ? {
          company_name: fallback.data.company_name,
          logo_url: fallback.data.logo_url,
          website_url: null,
          phone: null,
          address: null,
          maintenance_approver_name: fallback.data.maintenance_approver_name,
          maintenance_approver_title: fallback.data.maintenance_approver_title,
        }
      : null
    settingsError = fallback.error
  }

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
        initialWebsiteUrl={settings?.website_url ?? ""}
        initialPhone={settings?.phone ?? ""}
        initialAddress={settings?.address ?? ""}
        initialMaintenanceApproverName={settings?.maintenance_approver_name ?? ""}
        initialMaintenanceApproverTitle={settings?.maintenance_approver_title ?? ""}
        canManageApprover={isSuperUser(identity)}
      />
    </div>
  )
}
