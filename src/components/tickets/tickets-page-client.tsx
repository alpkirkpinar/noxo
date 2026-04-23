"use client"

import { useEffect, useState } from "react"
import TicketsListClient from "@/components/tickets/tickets-list-client"
import ListLoadingPanel from "@/components/ui/list-loading-panel"
import { createClient } from "@/lib/supabase/client"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

type TicketStatus =
  | "new"
  | "assigned"
  | "investigating"
  | "waiting_offer"
  | "waiting_parts"
  | "in_progress"
  | "completed"
  | "cancelled"

type TicketPriority = "low" | "medium" | "high" | "critical" | null

type TicketRow = {
  id: string
  ticket_no: string
  title: string
  status: TicketStatus
  priority: TicketPriority
  created_at: string
  status_changed_at: string
  customer_name: string | null
  machine_name: string | null
  status_note: string | null
}

type CustomerItem = {
  id: string
  company_name: string
}

type MachineItem = {
  id: string
  customer_id: string
  machine_name: string
  machine_code: string
}

type EmployeeItem = {
  id: string
  full_name: string
}

type TicketsPayload = {
  companyId: string
  openedBy: string
  customers: CustomerItem[]
  machines: MachineItem[]
  employees: EmployeeItem[]
  tickets: TicketRow[]
}

export default function TicketsPageClient() {
  const supabase = createClient()
  const [payload, setPayload] = useState<TicketsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canDelete: false,
    canUpdateStatus: false,
  })

  useEffect(() => {
    let active = true

    async function loadTickets() {
      try {
        setLoading(true)
        setErrorText("")

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          throw new Error("Kullanici bulunamadi.")
        }

        const identity = {
          permissions: Array.isArray(user.app_metadata?.permissions)
            ? user.app_metadata.permissions.map(String)
            : [],
          role: typeof user.app_metadata?.role === "string" ? user.app_metadata.role : null,
          super_user: user.app_metadata?.super_user === true,
        }

        if (!active) return
        setPermissions({
          canCreate: hasPermission(identity, PERMISSIONS.ticketCreate),
          canDelete: hasPermission(identity, PERMISSIONS.ticketDelete),
          canUpdateStatus: hasPermission(identity, PERMISSIONS.ticketEdit),
        })

        const response = await fetch("/api/tickets", { cache: "no-store" })
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data?.error || "Ticket listesi alinamadi.")
        }

        if (!active) return
        setPayload({
          companyId: String(data.companyId ?? ""),
          openedBy: String(data.openedBy ?? ""),
          customers: Array.isArray(data.customers) ? data.customers : [],
          machines: Array.isArray(data.machines) ? data.machines : [],
          employees: Array.isArray(data.employees) ? data.employees : [],
          tickets: Array.isArray(data.tickets) ? data.tickets : [],
        })
      } catch (error: unknown) {
        if (!active) return
        setErrorText(error instanceof Error ? error.message : "Ticket listesi alinamadi.")
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadTickets()

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (errorText) {
    return <div className="text-sm text-red-600">{errorText}</div>
  }

  if (loading || !payload) {
    return <ListLoadingPanel message="Ticketlar yukleniyor..." />
  }

  return (
    <TicketsListClient
      companyId={payload.companyId}
      openedBy={payload.openedBy}
      customers={payload.customers}
      machines={payload.machines}
      employees={payload.employees}
      initialTickets={payload.tickets}
      permissions={permissions}
    />
  )
}
