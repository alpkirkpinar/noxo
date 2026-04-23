import { redirect } from "next/navigation";
import DashboardOverview from "@/components/dashboard/dashboard-overview";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function DashboardPage() {
  const { user, identity } = await getDashboardContext();

  if (!user) {
    redirect("/login");
  }

  const allowed = hasPermission(identity, PERMISSIONS.dashboard);

  if (!allowed) {
    redirect("/dashboard/unauthorized");
  }

  return (
    <div className="space-y-6">
      <DashboardOverview />
    </div>
  );
}
