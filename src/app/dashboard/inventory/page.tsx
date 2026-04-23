import InventoryList from "@/components/inventory/inventory-list"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { getDashboardContext } from "@/lib/dashboard-context"

export default async function InventoryPage() {
  const { supabase, user, companyId, identity } = await getDashboardContext()

  if (!user) {
    return <div className="text-sm text-red-600">Kullanici bulunamadi.</div>
  }

  if (!companyId) {
    return <div className="text-sm text-red-600">company_id bulunamadi.</div>
  }

  const { data: items, error } = await supabase
    .from("inventory_items")
    .select(`
      id,
      company_id,
      warehouse_id,
      item_code,
      item_name,
      description,
      category,
      unit,
      cost_price,
      sale_price,
      min_stock,
      current_stock,
      currency_code,
      location_text,
      is_active,
      created_at,
      updated_at,
      unit_price,
      currency
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })

  if (error) {
    return <div className="text-sm text-red-600">{error.message}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Depo</h1>
        <p className="mt-1 text-sm text-slate-500">
          Parca, stok, fiyat ve filtreleme yonetimi
        </p>
      </div>

      <InventoryList
        companyId={companyId}
        items={items ?? []}
        permissions={{
          canCreate: hasPermission(identity, PERMISSIONS.stockCreate),
          canEdit: hasPermission(identity, PERMISSIONS.stockEdit),
          canDelete: hasPermission(identity, PERMISSIONS.stockDelete),
          canStockIn: hasPermission(identity, PERMISSIONS.stockIn),
          canStockOut: hasPermission(identity, PERMISSIONS.stockOut),
          canImport: hasPermission(identity, PERMISSIONS.csvImport),
          canExport: hasPermission(identity, PERMISSIONS.csvExport),
        }}
      />
    </div>
  )
}
