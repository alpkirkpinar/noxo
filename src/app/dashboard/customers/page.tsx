import CustomerList from "@/components/customers/customer-list";
import { getDashboardContext } from "@/lib/dashboard-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

type CustomerRow = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean;
  created_at: string;
};

export default async function CustomersPage() {
  const { supabase, companyId, appUserId, identity } = await getDashboardContext();

  if (!companyId || !appUserId) {
    return <div className="text-sm text-red-600">Kullanici sirket bilgisi bulunamadi.</div>;
  }

  const [{ data: customers, error: customersError }, { data: machines, error: machinesError }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, company_name, contact_name, phone, email, city, country, is_active, created_at")
        .eq("company_id", companyId)
        .order("company_name", { ascending: true }),
      supabase.from("machines").select("id, customer_id").eq("company_id", companyId),
    ]);

  if (customersError) {
    return <div className="text-sm text-red-600">{customersError.message}</div>;
  }

  if (machinesError) {
    return <div className="text-sm text-red-600">{machinesError.message}</div>;
  }

  const machineCountByCustomer = new Map<string, number>();

  for (const machine of machines ?? []) {
    if (!machine.customer_id) continue;
    machineCountByCustomer.set(machine.customer_id, (machineCountByCustomer.get(machine.customer_id) ?? 0) + 1);
  }

  const rows = ((customers ?? []) as CustomerRow[]).map((customer) => ({
    ...customer,
    machine_count: machineCountByCustomer.get(customer.id) ?? 0,
  }));

  return (
    <CustomerList
      customers={rows}
      permissions={{
        canCreate: hasPermission(identity, PERMISSIONS.customerCreate),
        canEdit: hasPermission(identity, PERMISSIONS.customerEdit),
        canDelete: hasPermission(identity, PERMISSIONS.customerDelete),
      }}
      companyId={companyId}
      appUserId={appUserId}
    />
  );
}
