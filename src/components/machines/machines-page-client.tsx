"use client"

import { useEffect, useState } from "react"
import MachinesListClient from "@/components/machines/machines-list-client"
import ListLoadingPanel from "@/components/ui/list-loading-panel"

type MachineListItem = {
  id: string
  machine_code: string
  machine_name: string
  customer_name: string | null
  brand_model: string
  serial_number: string | null
  maintenance_period_days: number | null
  last_maintenance_date: string | null
  next_maintenance_date: string | null
  status: string | null
}

type Props = {
  permissions: {
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
  }
}

export default function MachinesPageClient({ permissions }: Props) {
  const [machines, setMachines] = useState<MachineListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")

  useEffect(() => {
    let active = true

    async function loadMachines() {
      try {
        setLoading(true)
        setErrorText("")

        const response = await fetch("/api/machines", { cache: "no-store" })
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data?.error || "Makineler alinamadi.")
        }

        if (!active) return
        setMachines(Array.isArray(data.machines) ? data.machines : [])
      } catch (error: unknown) {
        if (!active) return
        setErrorText(error instanceof Error ? error.message : "Makineler alinamadi.")
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadMachines()

    return () => {
      active = false
    }
  }, [])

  if (errorText) {
    return <div className="text-sm text-red-600">{errorText}</div>
  }

  if (loading) {
    return <ListLoadingPanel message="Makineler yukleniyor..." />
  }

  return <MachinesListClient initialMachines={machines} permissions={permissions} />
}
