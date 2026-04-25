import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MachineMaintenancePanel from "@/components/machines/machine-maintenance-panel";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { isMissingRelationError } from "@/lib/supabase-errors";

type PageProps = {
  params: Promise<{ id: string }>;
};

type MaintenanceRecord = {
  id: string;
  performed_at: string | null;
  next_maintenance_date: string | null;
  maintenance_notes: string | null;
  performed_by_name: string | null;
};

function statusLabel(status: string | null) {
  switch (status) {
    case "active":
      return "Aktif";
    case "inactive":
      return "Pasif";
    case "in_service":
      return "Serviste";
    case "scrapped":
      return "Hurda";
    default:
      return "-";
  }
}

function maintenanceStatusLabel(nextMaintenanceDate: string | null) {
  if (!nextMaintenanceDate) return "Tarih Yok";

  const today = new Date();
  const nextDate = new Date(nextMaintenanceDate);
  const diffMs = nextDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Bakım Gecikmiş";
  if (diffDays <= 15) return "Bakım Yaklaşıyor";
  return "Normal";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("tr-TR");
}

export default async function MachineDetailPage({ params }: PageProps) {
  const { id } = await params;
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

  if (appUserError || !appUser) {
    throw new Error("Uygulama kullanıcısı bulunamadı.");
  }

  const [{ data: machine, error: machineError }, { data: records, error: recordsError }] = await Promise.all([
    supabase
      .from("machines")
      .select(`
        id,
        machine_code,
        machine_name,
        brand,
        model,
        serial_number,
        installation_date,
        warranty_end_date,
        maintenance_period_days,
        last_maintenance_date,
        next_maintenance_date,
        location_text,
        notes,
        status,
        customers(id, customer_code, company_name, contact_name, phone)
      `)
      .eq("id", id)
      .eq("company_id", appUser.company_id)
      .single(),
    supabase
      .from("machine_maintenance_records")
      .select(`
        id,
        performed_at,
        next_maintenance_date,
        maintenance_notes,
        performed_by:app_users(full_name)
      `)
      .eq("company_id", appUser.company_id)
      .eq("machine_id", id)
      .order("performed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (machineError || !machine) {
    notFound();
  }

  const maintenanceTableMissing = isMissingRelationError(recordsError?.message, "machine_maintenance_records");

  if (recordsError && !maintenanceTableMissing) {
    throw new Error(recordsError.message);
  }

  const customer = Array.isArray(machine.customers) ? machine.customers[0] : machine.customers;
  const canEditMachine = hasPermission(
    {
      permissions: Array.isArray(user.app_metadata?.permissions)
        ? user.app_metadata.permissions.map(String)
        : [],
      role: typeof user.app_metadata?.role === "string" ? user.app_metadata.role : null,
      super_user: user.app_metadata?.super_user === true,
    },
    PERMISSIONS.machineEdit
  );

  const maintenanceRecords: MaintenanceRecord[] = (((maintenanceTableMissing ? [] : records) ?? []) as Array<
    Record<string, unknown>
  >).map((record) => {
    const performedBy = Array.isArray(record.performed_by) ? record.performed_by[0] : record.performed_by;

    return {
      id: String(record.id),
      performed_at: typeof record.performed_at === "string" ? record.performed_at : null,
      next_maintenance_date: typeof record.next_maintenance_date === "string" ? record.next_maintenance_date : null,
      maintenance_notes: typeof record.maintenance_notes === "string" ? record.maintenance_notes : null,
      performed_by_name:
        performedBy && typeof performedBy === "object" && "full_name" in performedBy
          ? String(performedBy.full_name ?? "")
          : null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{machine.machine_name}</h1>
          <p className="text-sm text-slate-500">{machine.machine_code}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/machines"
            className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Geri
          </Link>

          {canEditMachine ? (
            <Link
              href={`/dashboard/machines/${machine.id}/edit`}
              className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Düzenle
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Makine Bilgileri</h2>

            <div className="grid gap-4 text-sm text-slate-900 md:grid-cols-2">
              <div><span className="text-slate-500">Marka:</span> <span className="font-medium">{machine.brand ?? "-"}</span></div>
              <div><span className="text-slate-500">Model:</span> <span className="font-medium">{machine.model ?? "-"}</span></div>
              <div><span className="text-slate-500">Seri No:</span> <span className="font-medium">{machine.serial_number ?? "-"}</span></div>
              <div><span className="text-slate-500">Durum:</span> <span className="font-medium">{statusLabel(machine.status)}</span></div>
              <div><span className="text-slate-500">Kurulum Tarihi:</span> <span className="font-medium">{formatDate(machine.installation_date)}</span></div>
              <div><span className="text-slate-500">Garanti Bitiş:</span> <span className="font-medium">{formatDate(machine.warranty_end_date)}</span></div>
              <div><span className="text-slate-500">Bakım Periyodu:</span> <span className="font-medium">{machine.maintenance_period_days ? `${machine.maintenance_period_days} gün` : "-"}</span></div>
              <div><span className="text-slate-500">Konum:</span> <span className="font-medium">{machine.location_text ?? "-"}</span></div>
              <div><span className="text-slate-500">Son Bakım:</span> <span className="font-medium">{formatDate(machine.last_maintenance_date)}</span></div>
              <div><span className="text-slate-500">Sonraki Bakım:</span> <span className="font-medium">{formatDate(machine.next_maintenance_date)}</span></div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs text-slate-500">Notlar</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm whitespace-pre-wrap text-slate-900">
                {machine.notes ?? "-"}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Bakım Geçmişi</h2>
              <span className="text-sm text-slate-500">{maintenanceRecords.length} kayıt</span>
            </div>

            {maintenanceTableMissing ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
                Bakım geçmişi henüz kullanılamıyor. `machine_maintenance_records` migration&apos;ı uygulanmalı.
              </div>
            ) : maintenanceRecords.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Henüz bakım kaydı bulunmuyor.
              </div>
            ) : (
              <div className="space-y-3">
                {maintenanceRecords.map((record) => (
                  <div key={record.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div className="font-medium text-slate-900">{formatDate(record.performed_at)}</div>
                      <div className="text-slate-500">
                        Sonraki bakım: <span className="font-medium text-slate-700">{formatDate(record.next_maintenance_date)}</span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Yapan kişi: <span className="font-medium text-slate-700">{record.performed_by_name ?? "-"}</span>
                    </div>
                    <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                      {record.maintenance_notes?.trim() || "Not girilmedi."}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Müşteri</h2>

            <div className="space-y-3 text-sm text-slate-900">
              <div>
                <Link href={`/dashboard/customers/${customer?.id}`} className="font-medium text-blue-600 hover:underline">
                  {customer?.company_name ?? "-"}
                </Link>
              </div>
              <div><span className="text-slate-500">Müşteri Kodu:</span> <span className="font-medium">{customer?.customer_code ?? "-"}</span></div>
              <div><span className="text-slate-500">İlgili Kişi:</span> <span className="font-medium">{customer?.contact_name ?? "-"}</span></div>
              <div><span className="text-slate-500">Telefon:</span> <span className="font-medium">{customer?.phone ?? "-"}</span></div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Bakım Durumu</h2>

            <div className="space-y-3 text-sm text-slate-900">
              <div>
                <span className="text-slate-500">Durum:</span>{" "}
                <span className="font-medium">{maintenanceStatusLabel(machine.next_maintenance_date)}</span>
              </div>
              <div>
                <span className="text-slate-500">Sonraki Bakım:</span>{" "}
                <span className="font-medium">{formatDate(machine.next_maintenance_date)}</span>
              </div>
              <div>
                <span className="text-slate-500">Periyot:</span>{" "}
                <span className="font-medium">{machine.maintenance_period_days ? `${machine.maintenance_period_days} gün` : "-"}</span>
              </div>
            </div>
          </div>

          <MachineMaintenancePanel
            machineId={machine.id}
            canEdit={canEditMachine}
            defaultPerformedAt={new Date().toISOString().slice(0, 10)}
            maintenanceAvailable={!maintenanceTableMissing}
          />
        </div>
      </div>
    </div>
  );
}
