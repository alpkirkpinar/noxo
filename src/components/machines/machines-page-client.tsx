"use client"

import { useEffect, useState } from "react"
import MachinesListClient from "@/components/machines/machines-list-client"
import ListLoadingPanel from "@/components/ui/list-loading-panel"
import { createClient } from "@/lib/supabase/client"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

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

export default function MachinesPageClient() {
  const supabase = createClient()
  const [machines, setMachines] = useState<MachineListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canEdit: false,
    canDelete: false,
  })

  useEffect(() => {
    let active = true

    async function loadMachines() {
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
          canCreate: hasPermission(identity, PERMISSIONS.machineCreate),
          canEdit: hasPermission(identity, PERMISSIONS.machineEdit),
          canDelete: hasPermission(identity, PERMISSIONS.machineDelete),
        })

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (errorText) {
    return <div className="text-sm text-red-600">{errorText}</div>
  }

  if (loading) {
    return <ListLoadingPanel message="Makineler yukleniyor..." />
  }

  return <MachinesListClient initialMachines={machines} permissions={permissions} />
}
