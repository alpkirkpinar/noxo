"use client"

import { useEffect, useState } from "react"
import InventoryList from "@/components/inventory/inventory-list"
import ListLoadingPanel from "@/components/ui/list-loading-panel"
import { createClient } from "@/lib/supabase/client"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

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

export default function InventoryPageClient() {
  const supabase = createClient()
  const [companyId, setCompanyId] = useState("")
  const [items, setItems] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canStockIn: false,
    canStockOut: false,
    canImport: false,
    canExport: false,
  })

  useEffect(() => {
    let active = true

    async function loadInventory() {
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
          canCreate: hasPermission(identity, PERMISSIONS.stockCreate),
          canEdit: hasPermission(identity, PERMISSIONS.stockEdit),
          canDelete: hasPermission(identity, PERMISSIONS.stockDelete),
          canStockIn: hasPermission(identity, PERMISSIONS.stockIn),
          canStockOut: hasPermission(identity, PERMISSIONS.stockOut),
          canImport: hasPermission(identity, PERMISSIONS.csvImport),
          canExport: hasPermission(identity, PERMISSIONS.csvExport),
        })

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (errorText) {
    return <div className="text-sm text-red-600">{errorText}</div>
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Depo</h1>
          <p className="mt-1 text-sm text-slate-500">Parca, stok, fiyat ve filtreleme yonetimi</p>
        </div>
        <ListLoadingPanel message="Depo listesi yükleniyor..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Depo</h1>
        <p className="mt-1 text-sm text-slate-500">Parca, stok, fiyat ve filtreleme yonetimi</p>
      </div>
      <InventoryList companyId={companyId} items={items} permissions={permissions} />
    </div>
  )
}
