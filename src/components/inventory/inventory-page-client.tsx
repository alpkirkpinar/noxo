"use client"

import { useEffect, useState } from "react"
import InventoryList from "@/components/inventory/inventory-list"
import ListLoadingPanel from "@/components/ui/list-loading-panel"

type CurrencyCode = "TRY" | "USD" | "EUR"

type InventoryRow = {
  id: string
  company_id: string
  warehouse_id?: string | null
  item_code: string
  item_name: string
  description?: string | null
  category?: string | null
  unit?: string | null
  cost_price?: number | null
  sale_price?: number | null
  min_stock?: number | null
  current_stock: number
  currency_code?: string | null
  location_text?: string | null
  is_active?: boolean | null
  created_at?: string | null
  updated_at?: string | null
  unit_price?: number | null
  currency?: CurrencyCode | null
}

type Props = {
  permissions: {
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canStockIn: boolean
    canStockOut: boolean
    canImport: boolean
    canExport: boolean
  }
}

export default function InventoryPageClient({ permissions }: Props) {
  const [companyId, setCompanyId] = useState("")
  const [items, setItems] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")

  useEffect(() => {
    let active = true

    async function loadInventory() {
      try {
        setLoading(true)
        setErrorText("")

        const response = await fetch("/api/inventory", { cache: "no-store" })
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data?.error || "Depo listesi alinamadi.")
        }

        if (!active) return
        setCompanyId(String(data.companyId ?? ""))
        setItems(Array.isArray(data.items) ? data.items : [])
      } catch (error: unknown) {
        if (!active) return
        setErrorText(error instanceof Error ? error.message : "Depo listesi alinamadi.")
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadInventory()

    return () => {
      active = false
    }
  }, [])

  if (errorText) {
    return <div className="text-sm text-red-600">{errorText}</div>
  }

  if (loading) {
    return <ListLoadingPanel message="Depo listesi yukleniyor..." />
  }

  return <InventoryList companyId={companyId} items={items} permissions={permissions} />
}
