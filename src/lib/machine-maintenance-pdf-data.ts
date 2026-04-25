import { createClient } from "@/lib/supabase/server";
import { isMissingRelationError } from "@/lib/supabase-errors";

type MaintenanceRecordRow = {
  id: string;
  performed_at: string | null;
  next_maintenance_date: string | null;
  maintenance_notes: string | null;
  maintenance_scope_items: string[];
  performed_by_name: string | null;
  performed_by_title: string | null;
};

export async function getMachineMaintenancePdfData(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Kullanıcı bulunamadı.", status: 401 as const };
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("id, company_id")
    .eq("auth_user_id", user.id)
    .single();

  if (appUserError || !appUser?.company_id) {
    return {
      error: appUserError?.message || "company_id bulunamadı.",
      status: 400 as const,
    };
  }

  const { data: machine, error: machineError } = await supabase
    .from("machines")
    .select(`
      id,
      machine_code,
      machine_name,
      brand,
      model,
      serial_number,
      installation_date,
      maintenance_period_days,
      last_maintenance_date,
      next_maintenance_date,
      location_text,
      notes,
      customers(company_name, contact_name, phone, email, address, city, country)
    `)
    .eq("company_id", appUser.company_id)
    .eq("id", id)
    .single();

  if (machineError || !machine) {
    return {
      error: machineError?.message || "Makine bulunamadı.",
      status: 404 as const,
    };
  }

  const [{ data: settings }, { data: records, error: recordsError }] = await Promise.all([
    supabase
      .from("system_settings")
      .select("company_name, logo_url, maintenance_approver_name, maintenance_approver_title")
      .eq("company_id", appUser.company_id)
      .maybeSingle(),
    supabase
      .from("machine_maintenance_records")
      .select(`
        id,
        performed_at,
        next_maintenance_date,
        maintenance_notes,
        maintenance_scope_items,
        performed_by:app_users(full_name, title)
      `)
      .eq("company_id", appUser.company_id)
      .eq("machine_id", id)
      .order("performed_at", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const maintenanceTableMissing = isMissingRelationError(recordsError?.message, "machine_maintenance_records");

  if (recordsError && !maintenanceTableMissing) {
    return { error: recordsError.message, status: 500 as const };
  }

  const customer = Array.isArray(machine.customers) ? machine.customers[0] ?? null : machine.customers ?? null;
  const normalizedRecords: MaintenanceRecordRow[] = (((maintenanceTableMissing ? [] : records) ?? []) as Array<Record<string, unknown>>).map(
    (record) => {
      const performedBy = Array.isArray(record.performed_by) ? record.performed_by[0] : record.performed_by;

      return {
        id: String(record.id),
        performed_at: typeof record.performed_at === "string" ? record.performed_at : null,
        next_maintenance_date:
          typeof record.next_maintenance_date === "string" ? record.next_maintenance_date : null,
        maintenance_notes: typeof record.maintenance_notes === "string" ? record.maintenance_notes : null,
        maintenance_scope_items: Array.isArray(record.maintenance_scope_items)
          ? record.maintenance_scope_items.map(String)
          : [],
        performed_by_name:
          performedBy && typeof performedBy === "object" && "full_name" in performedBy
            ? String(performedBy.full_name ?? "")
            : null,
        performed_by_title:
          performedBy && typeof performedBy === "object" && "title" in performedBy
            ? String(performedBy.title ?? "")
            : null,
      };
    }
  );

  return {
    machine,
    customer,
    settings,
    records: normalizedRecords,
    maintenanceAvailable: !maintenanceTableMissing,
  };
}
