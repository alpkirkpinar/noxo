import { redirect } from "next/navigation"
import TicketsPageClient from "@/components/tickets/tickets-page-client"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { getDashboardContext } from "@/lib/dashboard-context"

export default async function TicketsPage() {
  const { user, identity } = await getDashboardContext()

  if (!user) redirect("/login")

  return (
    <TicketsPageClient
      permissions={{
        canCreate: hasPermission(identity, PERMISSIONS.ticketCreate),
        canDelete: hasPermission(identity, PERMISSIONS.ticketDelete),
        canUpdateStatus: hasPermission(identity, PERMISSIONS.ticketEdit),
      }}
    />
  )
}
