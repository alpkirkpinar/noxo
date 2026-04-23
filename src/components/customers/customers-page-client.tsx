"use client"

import { useEffect, useState } from "react"
import CustomerList from "@/components/customers/customer-list"
import ListLoadingPanel from "@/components/ui/list-loading-panel"

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

type Props = {
  permissions: {
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
  }
}

export default function CustomersPageClient({ permissions }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")

  useEffect(() => {
    let active = true

    async function loadCustomers() {
      try {
        setLoading(true)
        setErrorText("")

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
  }, [])

  if (errorText) {
    return <div className="text-sm text-red-600">{errorText}</div>
  }

  if (loading) {
    return <ListLoadingPanel message="Musteriler yukleniyor..." />
  }

  return <CustomerList customers={customers} permissions={permissions} />
}
