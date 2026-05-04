import MachinesListClient from "@/components/machines/machines-list-client";
import { getDashboardContext } from "@/lib/dashboard-context";
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

type CustomerOption = {
  id: string;
  company_name: string;
  customer_code: string | null;
  is_active: boolean | null;
};

function getCustomerName(relation: MachineRow["customers"]) {
  if (!relation) return null;
  if (Array.isArray(relation)) return relation[0]?.company_name ?? null;
  return relation.company_name ?? null;
}

export default async function MachinesPage() {
  const { supabase, companyId, identity } = await getDashboardContext();

  if (!companyId) {
    return <div className="text-sm text-red-600">Kullanici sirket bilgisi bulunamadi.</div>;
  }

  const [{ data: machines, error: machinesError }, { data: customers, error: customersError }] =
    await Promise.all([
      supabase
        .from("machines")
        .select(
          "id, machine_code, machine_name, brand, model, serial_number, maintenance_period_days, last_maintenance_date, next_maintenance_date, status, customers(company_name)"
        )
        .eq("company_id", companyId),
      supabase
        .from("customers")
        .select("id, company_name, customer_code, is_active")
        .eq("company_id", companyId)
        .order("company_name", { ascending: true }),
    ]);

  if (machinesError) {
    return <div className="text-sm text-red-600">{machinesError.message}</div>;
  }

  if (customersError) {
    return <div className="text-sm text-red-600">{customersError.message}</div>;
  }

  return (
    <MachinesListClient
      initialMachines={((machines ?? []) as MachineRow[]).map((machine) => ({
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
      }))}
      permissions={{
        canCreate: hasPermission(identity, PERMISSIONS.machineCreate),
        canEdit: hasPermission(identity, PERMISSIONS.machineEdit),
        canDelete: hasPermission(identity, PERMISSIONS.machineDelete),
      }}
      companyId={companyId}
      customers={((customers ?? []) as CustomerOption[])
        .filter((customer) => customer.is_active !== false)
        .map((customer) => ({
          id: customer.id,
          company_name: customer.company_name,
          customer_code: customer.customer_code ?? null,
        }))}
    />
  );
}
