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

type CustomerOption = {
  id: string
  company_name: string
  customer_code: string | null
}

type AppUserMeta = {
  companyId: string
  appUserId: string
}

export default function MachinesPageClient() {
  const supabase = createClient()
  const [machines, setMachines] = useState<MachineListItem[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [appUserMeta, setAppUserMeta] = useState<AppUserMeta | null>(null)
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

        const { data: appUser, error: appUserError } = await supabase
          .from("app_users")
          .select("id, company_id")
          .eq("auth_user_id", user.id)
          .single()

        if (appUserError || !appUser?.company_id || !appUser?.id) {
          throw new Error(appUserError?.message || "Uygulama kullanicisi bulunamadi.")
        }

        if (!active) return
        setAppUserMeta({
          companyId: String(appUser.company_id),
          appUserId: String(appUser.id),
        })

        const [machinesResponse, customersResponse] = await Promise.all([
          fetch("/api/machines", { cache: "no-store" }),
          fetch("/api/customers", { cache: "no-store" }),
        ])
        const machinesData = await machinesResponse.json().catch(() => ({}))
        const customersData = await customersResponse.json().catch(() => ({}))

        if (!machinesResponse.ok) {
          throw new Error(machinesData?.error || "Makineler alinamadi.")
        }

        if (!customersResponse.ok) {
          throw new Error(customersData?.error || "Musteriler alinamadi.")
        }

        if (!active) return
        setMachines(Array.isArray(machinesData.machines) ? machinesData.machines : [])
        setCustomers(
          Array.isArray(customersData.customers)
            ? customersData.customers
                .filter((customer: { is_active?: boolean }) => customer.is_active !== false)
                .map((customer: CustomerOption) => ({
                  id: customer.id,
                  company_name: customer.company_name,
                  customer_code: customer.customer_code ?? null,
                }))
            : []
        )
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
    return <ListLoadingPanel message="Makineler yükleniyor..." />
  }

  return (
    <MachinesListClient
      initialMachines={machines}
      permissions={permissions}
      companyId={appUserMeta?.companyId ?? ""}
      customers={customers}
    />
  )
}
