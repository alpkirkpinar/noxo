import InventoryList from "@/components/inventory/inventory-list";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function InventoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div className="text-sm text-red-600">Kullanıcı bulunamadı.</div>;
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!appUser?.company_id) {
    return <div className="text-sm text-red-600">company_id bulunamadı.</div>;
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
    .eq("company_id", appUser.company_id)
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="text-sm text-red-600">{error.message}</div>;
  }

  const permissionIdentity = {
    permissions: Array.isArray(user.app_metadata?.permissions)
      ? user.app_metadata.permissions.map(String)
      : [],
    role: typeof user.app_metadata?.role === "string" ? user.app_metadata.role : null,
    super_user: user.app_metadata?.super_user === true,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Depo</h1>
        <p className="mt-1 text-sm text-slate-500">
          Parça, stok, fiyat ve filtreleme yönetimi
        </p>
      </div>

      <InventoryList
        companyId={appUser.company_id}
        items={items ?? []}
        permissions={{
          canCreate: hasPermission(permissionIdentity, PERMISSIONS.stockCreate),
          canEdit: hasPermission(permissionIdentity, PERMISSIONS.stockEdit),
          canDelete: hasPermission(permissionIdentity, PERMISSIONS.stockDelete),
          canStockIn: hasPermission(permissionIdentity, PERMISSIONS.stockIn),
          canStockOut: hasPermission(permissionIdentity, PERMISSIONS.stockOut),
          canImport: hasPermission(permissionIdentity, PERMISSIONS.csvImport),
          canExport: hasPermission(permissionIdentity, PERMISSIONS.csvExport),
        }}
      />
    </div>
  );
}
