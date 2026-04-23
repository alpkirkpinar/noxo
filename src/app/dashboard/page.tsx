import { redirect } from "next/navigation";
import DashboardOverview from "@/components/dashboard/dashboard-overview";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const allowed = hasPermission(
    {
      role: user.app_metadata?.role,
      super_user: user.app_metadata?.super_user,
      company_modules: Array.isArray(user.app_metadata?.company_modules)
        ? user.app_metadata.company_modules.map(String)
        : undefined,
      company_active: user.app_metadata?.company_active === false ? false : undefined,
      permissions: Array.isArray(user.app_metadata?.permissions)
        ? user.app_metadata.permissions.map(String)
        : [],
    },
    PERMISSIONS.dashboard
  );

  if (!allowed) {
    redirect("/dashboard/unauthorized");
  }

  return (
    <div className="space-y-6">
      <DashboardOverview />
    </div>
  );
}
