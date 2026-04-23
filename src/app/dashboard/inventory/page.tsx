import InventoryPageClient from "@/components/inventory/inventory-page-client"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { getDashboardContext } from "@/lib/dashboard-context"

export default async function InventoryPage() {
  const { user, companyId, identity } = await getDashboardContext()

  if (!user) {
    return <div className="text-sm text-red-600">Kullanici bulunamadi.</div>
  }

  if (!companyId) {
    return <div className="text-sm text-red-600">company_id bulunamadi.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Depo</h1>
        <p className="mt-1 text-sm text-slate-500">
          Parca, stok, fiyat ve filtreleme yonetimi
        </p>
      </div>

      <InventoryPageClient
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
