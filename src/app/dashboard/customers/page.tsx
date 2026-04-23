import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerList from "@/components/customers/customer-list";
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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .single();

  if (appUserError || !appUser?.company_id) {
    throw new Error("company_id bulunamadı.");
  }

  const permissionIdentity = {
    role: user.app_metadata?.role,
    super_user: user.app_metadata?.super_user,
    permissions: Array.isArray(user.app_metadata?.permissions)
      ? user.app_metadata.permissions.map(String)
      : [],
  };

  const [{ data: customers, error: customersError }, { data: machines, error: machinesError }] =
    await Promise.all([
      supabase
        .from("customers")
        .select(`
          id,
          company_name,
          contact_name,
          phone,
          email,
          city,
          country,
          is_active,
          created_at
        `)
        .eq("company_id", appUser.company_id)
        .order("company_name", { ascending: true }),

      supabase
        .from("machines")
        .select("id, customer_id")
        .eq("company_id", appUser.company_id),
    ]);

  if (customersError) throw new Error(customersError.message);
  if (machinesError) throw new Error(machinesError.message);

  const machineCountMap = new Map<string, number>();
  for (const machine of machines ?? []) {
    if (!machine.customer_id) continue;
    machineCountMap.set(
      machine.customer_id,
      (machineCountMap.get(machine.customer_id) ?? 0) + 1
    );
  }

  const rows = ((customers ?? []) as CustomerRow[]).map((customer) => ({
    ...customer,
    machine_count: machineCountMap.get(customer.id) ?? 0,
  }));

  return (
    <CustomerList
      customers={rows}
      permissions={{
        canCreate: hasPermission(permissionIdentity, PERMISSIONS.customerCreate),
        canEdit: hasPermission(permissionIdentity, PERMISSIONS.customerEdit),
        canDelete: hasPermission(permissionIdentity, PERMISSIONS.customerDelete),
      }}
    />
  );
}
