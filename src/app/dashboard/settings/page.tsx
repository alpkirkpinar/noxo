import SystemSettings from "@/components/settings/system-settings";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div className="text-sm text-red-600">Kullanıcı bulunamadı.</div>;
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!appUser?.company_id) {
    return <div className="text-sm text-red-600">company_id bulunamadı.</div>;
  }

  const { data: settings } = await supabase
    .from("system_settings")
    .select("company_name, logo_url")
    .eq("company_id", appUser.company_id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sistem Ayarları</h1>
        <p className="mt-1 text-sm text-slate-500">
          Şirket adı ve tekliflerde kullanılacak logo ayarları
        </p>
      </div>

      <SystemSettings
        companyId={appUser.company_id}
        initialCompanyName={settings?.company_name ?? ""}
        initialLogoUrl={settings?.logo_url ?? ""}
      />
    </div>
  );
}