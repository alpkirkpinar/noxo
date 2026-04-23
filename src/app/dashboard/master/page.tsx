import { redirect } from "next/navigation"
import MasterCompaniesClient from "@/components/master/master-companies-client"
import { isMasterUser } from "@/lib/permissions"
import { loadManagedCompanies } from "@/lib/master-companies"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export default async function MasterPanelPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: freshUser } = await admin.auth.admin.getUserById(user.id)

  if (!isMasterUser({ role: freshUser.user?.app_metadata?.role })) {
    redirect("/dashboard/unauthorized")
  }

  const companies = await loadManagedCompanies(admin)

  return <MasterCompaniesClient initialCompanies={companies} />
}
