import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import FloatingActions from "@/components/ui/floating-actions";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, appUser, identity } = await getDashboardContext();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="elevated-page-bg min-h-screen">
      <Sidebar
        permissions={identity.permissions ?? []}
        companyModules={identity.company_modules}
        companyActive={identity.company_active ?? undefined}
        role={String(identity.role ?? "")}
        superUser={user.app_metadata?.super_user === true}
      />

      <div className="2xl:pl-[304px]">
        <main className="min-h-screen overflow-x-hidden px-3 py-3 pb-28 sm:px-4 md:px-6 2xl:px-8 2xl:py-4 2xl:pb-4">
          <Topbar
            fullName={appUser?.full_name ?? null}
            email={appUser?.email ?? user.email ?? null}
            phone={appUser?.phone ?? null}
            title={appUser?.title ?? null}
            avatarUrl={appUser?.avatar_url ?? null}
            avatarScale={Number(appUser?.avatar_scale ?? 1)}
            avatarOffsetX={Number(appUser?.avatar_offset_x ?? 50)}
            avatarOffsetY={Number(appUser?.avatar_offset_y ?? 50)}
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
