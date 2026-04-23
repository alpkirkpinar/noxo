import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
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
      warranty_end_date,
      maintenance_period_days,
      last_maintenance_date,
      next_maintenance_date,
      location_text,
      notes,
      status,
      created_at,
      customers(id, customer_code, company_name, contact_name, phone)
    `)
    .eq("id", id)
    .eq("company_id", appUser.company_id)
    .single();

  if (machineError || !machine) {
    notFound();
  }

  const customer = Array.isArray(machine.customers) ? machine.customers[0] : machine.customers;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{machine.machine_name}</h1>
          <p className="text-sm text-gray-500">{machine.machine_code}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/machines"
            className="inline-flex rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Geri
          </Link>

          <Link
            href={`/dashboard/machines/${machine.id}/edit`}
            className="inline-flex rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Düzenle
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Makine Bilgileri</h2>

          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div><span className="text-gray-500">Marka:</span> <span className="font-medium">{machine.brand ?? "-"}</span></div>
            <div><span className="text-gray-500">Model:</span> <span className="font-medium">{machine.model ?? "-"}</span></div>
            <div><span className="text-gray-500">Seri No:</span> <span className="font-medium">{machine.serial_number ?? "-"}</span></div>
            <div><span className="text-gray-500">Durum:</span> <span className="font-medium">{statusLabel(machine.status)}</span></div>
            <div><span className="text-gray-500">Kurulum Tarihi:</span> <span className="font-medium">{machine.installation_date ? new Date(machine.installation_date).toLocaleDateString("tr-TR") : "-"}</span></div>
            <div><span className="text-gray-500">Garanti Bitiş:</span> <span className="font-medium">{machine.warranty_end_date ? new Date(machine.warranty_end_date).toLocaleDateString("tr-TR") : "-"}</span></div>
            <div><span className="text-gray-500">Bakım Periyodu:</span> <span className="font-medium">{machine.maintenance_period_days ?? "-"} gün</span></div>
            <div><span className="text-gray-500">Konum:</span> <span className="font-medium">{machine.location_text ?? "-"}</span></div>
            <div><span className="text-gray-500">Son Bakım:</span> <span className="font-medium">{machine.last_maintenance_date ? new Date(machine.last_maintenance_date).toLocaleDateString("tr-TR") : "-"}</span></div>
            <div><span className="text-gray-500">Sonraki Bakım:</span> <span className="font-medium">{machine.next_maintenance_date ? new Date(machine.next_maintenance_date).toLocaleDateString("tr-TR") : "-"}</span></div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs text-gray-500">Notlar</p>
            <div className="rounded-lg border bg-gray-50 p-4 text-sm whitespace-pre-wrap">
              {machine.notes ?? "-"}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold">Müşteri</h2>

            <div className="space-y-3 text-sm">
              <div>
                <Link href={`/dashboard/customers/${customer?.id}`} className="font-medium text-blue-600 hover:underline">
                  {customer?.company_name ?? "-"}
                </Link>
              </div>
              <div><span className="text-gray-500">Müşteri Kodu:</span> <span className="font-medium">{customer?.customer_code ?? "-"}</span></div>
              <div><span className="text-gray-500">İlgili Kişi:</span> <span className="font-medium">{customer?.contact_name ?? "-"}</span></div>
              <div><span className="text-gray-500">Telefon:</span> <span className="font-medium">{customer?.phone ?? "-"}</span></div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold">Bakım Durumu</h2>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">Durum:</span>{" "}
                <span className="font-medium">{maintenanceStatusLabel(machine.next_maintenance_date)}</span>
              </div>
              <div>
                <span className="text-gray-500">Sonraki Bakım:</span>{" "}
                <span className="font-medium">
                  {machine.next_maintenance_date
                    ? new Date(machine.next_maintenance_date).toLocaleDateString("tr-TR")
                    : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
