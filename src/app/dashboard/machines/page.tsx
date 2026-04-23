import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MachinesListClient from "@/components/machines/machines-list-client";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

type MachineRow = {
  id: string;
  machine_code: string;
  machine_name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  maintenance_period_days: number | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  status: string | null;
  customers: { company_name: string } | { company_name: string }[] | null;
};

function getCustomerName(relation: { company_name: string } | { company_name: string }[] | null) {
  if (!relation) return null;
  if (Array.isArray(relation)) return relation[0]?.company_name ?? null;
  return relation.company_name ?? null;
}

async function getPageIdentity() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("app_users")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !data?.company_id) {
    throw new Error("Kullanıcının şirket bilgisi bulunamadı.");
  }

  return {
    companyId: data.company_id as string,
    permissions: {
      canCreate: hasPermission(
        {
          role: user.app_metadata?.role,
          super_user: user.app_metadata?.super_user,
          permissions: Array.isArray(user.app_metadata?.permissions)
            ? user.app_metadata.permissions.map(String)
            : [],
        },
        PERMISSIONS.machineCreate
      ),
      canEdit: hasPermission(
        {
          role: user.app_metadata?.role,
          super_user: user.app_metadata?.super_user,
          permissions: Array.isArray(user.app_metadata?.permissions)
            ? user.app_metadata.permissions.map(String)
            : [],
        },
        PERMISSIONS.machineEdit
      ),
      canDelete: hasPermission(
        {
          role: user.app_metadata?.role,
          super_user: user.app_metadata?.super_user,
          permissions: Array.isArray(user.app_metadata?.permissions)
            ? user.app_metadata.permissions.map(String)
            : [],
        },
        PERMISSIONS.machineDelete
      ),
    },
  };
}

async function getMachines(companyId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("machines")
    .select(`
      id,
      machine_code,
      machine_name,
      brand,
      model,
      serial_number,
      maintenance_period_days,
      last_maintenance_date,
      next_maintenance_date,
      status,
      customers(company_name)
    `)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);

  return ((data ?? []) as MachineRow[]).map((machine) => ({
    id: machine.id,
    machine_code: machine.machine_code,
    machine_name: machine.machine_name,
    customer_name: getCustomerName(machine.customers),
    brand_model: [machine.brand ?? "", machine.model ?? ""].join(" ").trim() || "-",
    serial_number: machine.serial_number,
    maintenance_period_days: machine.maintenance_period_days,
    last_maintenance_date: machine.last_maintenance_date,
    next_maintenance_date: machine.next_maintenance_date,
    status: machine.status,
  }));
}

export default async function MachinesPage() {
  const { companyId, permissions } = await getPageIdentity();
  const machines = await getMachines(companyId);

  return <MachinesListClient initialMachines={machines} permissions={permissions} />;
}
