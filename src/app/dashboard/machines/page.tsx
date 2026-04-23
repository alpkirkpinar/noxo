import { redirect } from "next/navigation"
import MachinesPageClient from "@/components/machines/machines-page-client"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { getDashboardContext } from "@/lib/dashboard-context"

async function getPageIdentity() {
  const { user, identity } = await getDashboardContext()

  if (!user) redirect("/login")

  return {
    permissions: {
      canCreate: hasPermission(identity, PERMISSIONS.machineCreate),
      canEdit: hasPermission(identity, PERMISSIONS.machineEdit),
      canDelete: hasPermission(identity, PERMISSIONS.machineDelete),
    },
  }
}

export default async function MachinesPage() {
  const { permissions } = await getPageIdentity()

  return <MachinesPageClient permissions={permissions} />
}
