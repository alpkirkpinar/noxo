"use client"

import { useEffect, useState } from "react"
import TicketsListClient from "@/components/tickets/tickets-list-client"
import ListLoadingPanel from "@/components/ui/list-loading-panel"

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

type Props = {
  permissions: {
    canCreate: boolean
    canDelete: boolean
    canUpdateStatus: boolean
  }
}

type TicketsPayload = {
  companyId: string
  openedBy: string
  customers: CustomerItem[]
  machines: MachineItem[]
  employees: EmployeeItem[]
  tickets: TicketRow[]
}

export default function TicketsPageClient({ permissions }: Props) {
  const [payload, setPayload] = useState<TicketsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")

  useEffect(() => {
    let active = true

    async function loadTickets() {
      try {
        setLoading(true)
        setErrorText("")

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
