import { redirect } from "next/navigation"
import MachinesListClient from "@/components/machines/machines-list-client"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { getDashboardContext } from "@/lib/dashboard-context"

type MachineRow = {
  id: string
  machine_code: string
  machine_name: string
  brand: string | null
  model: string | null
  serial_number: string | null
  maintenance_period_days: number | null
  last_maintenance_date: string | null
  next_maintenance_date: string | null
  status: string | null
  customers: { company_name: string } | { company_name: string }[] | null
}

function getCustomerName(relation: { company_name: string } | { company_name: string }[] | null) {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0]?.company_name ?? null
  return relation.company_name ?? null
}

async function getPageIdentity() {
  const { user, companyId, identity } = await getDashboardContext()

  if (!user) redirect("/login")
  if (!companyId) {
    throw new Error("Kullanicinin sirket bilgisi bulunamadi.")
  }

  return {
    companyId,
    permissions: {
      canCreate: hasPermission(identity, PERMISSIONS.machineCreate),
      canEdit: hasPermission(identity, PERMISSIONS.machineEdit),
      canDelete: hasPermission(identity, PERMISSIONS.machineDelete),
    },
  }
}

async function getMachines(companyId: string) {
  const { supabase } = await getDashboardContext()

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
    .eq("company_id", companyId)

  if (error) throw new Error(error.message)

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
  }))
}

export default async function MachinesPage() {
  const { companyId, permissions } = await getPageIdentity()
  const machines = await getMachines(companyId)

  return <MachinesListClient initialMachines={machines} permissions={permissions} />
}
