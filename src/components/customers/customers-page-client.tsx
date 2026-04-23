"use client"

import { useEffect, useState } from "react"
import CustomerList from "@/components/customers/customer-list"
import ListLoadingPanel from "@/components/ui/list-loading-panel"
import { createClient } from "@/lib/supabase/client"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

type Customer = {
  id: string
  company_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  city: string | null
  country: string | null
  is_active: boolean
  created_at: string
  machine_count: number
}

export default function CustomersPageClient() {
  const supabase = createClient()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canEdit: false,
    canDelete: false,
  })

  useEffect(() => {
    let active = true

    async function loadCustomers() {
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
          canCreate: hasPermission(identity, PERMISSIONS.customerCreate),
          canEdit: hasPermission(identity, PERMISSIONS.customerEdit),
          canDelete: hasPermission(identity, PERMISSIONS.customerDelete),
        })

        const response = await fetch("/api/customers", { cache: "no-store" })
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data?.error || "Musteriler alinamadi.")
        }

        if (!active) return
        setCustomers(Array.isArray(data.customers) ? data.customers : [])
      } catch (error: unknown) {
        if (!active) return
        setErrorText(error instanceof Error ? error.message : "Musteriler alinamadi.")
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadCustomers()

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (errorText) {
    return <div className="text-sm text-red-600">{errorText}</div>
  }

  if (loading) {
    return <ListLoadingPanel message="Musteriler yukleniyor..." />
  }

  return <CustomerList customers={customers} permissions={permissions} />
}
