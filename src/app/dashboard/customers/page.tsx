import { redirect } from "next/navigation"
import CustomersPageClient from "@/components/customers/customers-page-client"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { getDashboardContext } from "@/lib/dashboard-context"

export default async function CustomersPage() {
  const { user, identity } = await getDashboardContext()

  if (!user) redirect("/login")

  return (
    <CustomersPageClient
      permissions={{
        canCreate: hasPermission(identity, PERMISSIONS.customerCreate),
        canEdit: hasPermission(identity, PERMISSIONS.customerEdit),
        canDelete: hasPermission(identity, PERMISSIONS.customerDelete),
      }}
    />
  )
}
