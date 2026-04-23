import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import FloatingActions from "@/components/ui/floating-actions";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("full_name, company_id")
    .eq("auth_user_id", user.id)
    .single();

  const permissions = Array.isArray(user.app_metadata?.permissions)
    ? user.app_metadata.permissions.map(String)
    : [];
  const companyModules = Array.isArray(user.app_metadata?.company_modules)
    ? user.app_metadata.company_modules.map(String)
    : undefined;
  const companyActive = user.app_metadata?.company_active === false ? false : undefined;

  return (
    <div className="elevated-page-bg min-h-screen">
      <Sidebar
        permissions={permissions}
        companyModules={companyModules}
        companyActive={companyActive}
        role={String(user.app_metadata?.role ?? "")}
        superUser={user.app_metadata?.super_user === true}
      />

      <div className="2xl:pl-[304px]">
        <main className="min-h-screen overflow-x-hidden px-3 py-3 pb-28 sm:px-4 md:px-6 2xl:px-8 2xl:py-4 2xl:pb-4">
          <Topbar
            fullName={appUser?.full_name ?? null}
            email={user.email ?? null}
            mustChangePassword={user.user_metadata?.must_change_password === true}
          />
          <div className="pt-3">
            {children}
          </div>
        </main>
      </div>

      <FloatingActions />
    </div>
  );
}
