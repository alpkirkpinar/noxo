import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import CustomerBackupButton from "@/components/customers/customer-backup-button";
import { createClient } from "@/lib/supabase/server";
import { getServerIdentity } from "@/lib/authz";
import { computeNextMaintenanceDate, normalizeDateOnly } from "@/lib/machines";
import { hasPermission, isMasterUser, PERMISSIONS } from "@/lib/permissions";

type PageProps = {
  params: Promise<{ id: string }>;
};

type CustomerMachineRow = {
  id: string;
  machine_name: string | null;
  machine_code: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  location_text: string | null;
  status: string | null;
  next_maintenance_date: string | null;
};

function createMachineCode() {
  return `MAC-${Date.now()}`;
}

function getPermissionIdentity(user: { app_metadata?: Record<string, unknown> }) {
  return {
    permissions: Array.isArray(user.app_metadata?.permissions)
      ? user.app_metadata.permissions.map(String)
      : [],
    role: typeof user.app_metadata?.role === "string" ? user.app_metadata.role : null,
    super_user: user.app_metadata?.super_user === true,
  };
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("id, company_id")
    .eq("auth_user_id", user.id)
    .single();

  if (appUserError || !appUser?.company_id) {
    throw new Error("company_id bulunamadı.");
  }

  const [{ data: customer, error: customerError }, { data: machines, error: machinesError }] =
    await Promise.all([
      supabase
        .from("customers")
        .select(`
          id,
          company_name,
          contact_name,
          phone,
          email,
          address,
          city,
          country,
          tax_office,
          tax_number,
          notes,
          is_active,
          created_at
        `)
        .eq("id", id)
        .eq("company_id", appUser.company_id)
        .single(),

      supabase
        .from("machines")
        .select(`
          id,
          machine_name,
          machine_code,
          brand,
          model,
          serial_number,
          location_text,
          status,
          next_maintenance_date
        `)
        .eq("company_id", appUser.company_id)
        .eq("customer_id", id)
        .order("machine_name", { ascending: true }),
    ]);

  if (customerError || !customer) notFound();
  if (machinesError) throw new Error(machinesError.message);

  const permissionIdentity = getPermissionIdentity(user);
  const canCreateMachine = hasPermission(permissionIdentity, PERMISSIONS.machineCreate);
  const canEditCustomer = hasPermission(permissionIdentity, PERMISSIONS.customerEdit);
  const canBackupCustomer = isMasterUser(permissionIdentity);

  async function createMachineForCustomer(formData: FormData) {
    "use server";

    const auth = await getServerIdentity(PERMISSIONS.machineCreate);
    if ("error" in auth) {
      throw new Error(auth.error);
    }

    const machine_name = String(formData.get("machine_name") ?? "").trim();
    const brand = String(formData.get("brand") ?? "").trim();
    const model = String(formData.get("model") ?? "").trim();
    const serial_number = String(formData.get("serial_number") ?? "").trim();
    const location_text = String(formData.get("location_text") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const maintenance_period_days = Number(formData.get("maintenance_period_days") ?? 0) || null;
    const installation_date = normalizeDateOnly(String(formData.get("installation_date") ?? "").trim());
    const last_maintenance_date = normalizeDateOnly(String(formData.get("last_maintenance_date") ?? "").trim());

    if (!machine_name) {
      throw new Error("Makine adı zorunludur.");
    }

    const { error } = await auth.supabase.from("machines").insert({
      company_id: auth.identity.companyId,
      customer_id: id,
      machine_name,
      machine_code: createMachineCode(),
      brand: brand || null,
      model: model || null,
      serial_number: serial_number || null,
      location_text: location_text || null,
      notes: notes || null,
      maintenance_period_days,
      installation_date,
      last_maintenance_date,
      next_maintenance_date: computeNextMaintenanceDate({
        maintenancePeriodDays: maintenance_period_days,
        lastMaintenanceDate: last_maintenance_date,
        installationDate: installation_date,
      }),
      status: "active",
    });

    if (error) {
      throw new Error(error.message);
    }

    redirect(`/dashboard/customers/${id}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{customer.company_name}</h1>
          <p className="text-sm text-slate-500">Müşteri detayı ve bağlı makineler</p>
        </div>

        <div className="flex items-center gap-2">
          {canBackupCustomer ? <CustomerBackupButton customerId={customer.id} /> : null}

          {canEditCustomer ? (
            <Link
              href={`/dashboard/customers/${customer.id}/edit`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Düzenle
            </Link>
          ) : null}

          {canCreateMachine ? (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">
                Yeni Makine Ekle
              </summary>

              <div className="absolute right-0 z-20 mt-2 w-[520px] max-w-[90vw] rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Bu Müşteriye Yeni Makine Ekle</h2>

                <form action={createMachineForCustomer} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Makine Adı</label>
                    <input
                      type="text"
                      name="machine_name"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      required
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Marka</label>
                      <input type="text" name="brand" className="w-full rounded-lg border px-3 py-2 text-sm" />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Model</label>
                      <input type="text" name="model" className="w-full rounded-lg border px-3 py-2 text-sm" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Seri No</label>
                    <input
                      type="text"
                      name="serial_number"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Konum</label>
                    <input
                      type="text"
                      name="location_text"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Kurulum Tarihi</label>
                      <input
                        type="date"
                        name="installation_date"
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Bakım Periyodu (Gün)</label>
                      <input
                        type="number"
                        name="maintenance_period_days"
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Son Bakım Tarihi</label>
                    <input
                      type="date"
                      name="last_maintenance_date"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Notlar</label>
                    <textarea
                      name="notes"
                      className="min-h-[100px] w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
                    >
                      Makineyi Ekle
                    </button>
                  </div>
                </form>
              </div>
            </details>
          ) : null}

          <Link
            href="/dashboard/customers"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Geri
          </Link>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Müşteri Bilgileri</h2>
            <span className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700">
              {customer.is_active ? "Aktif" : "Pasif"}
            </span>
          </div>

          <div className="grid gap-4 text-sm text-slate-900 md:grid-cols-2">
            <div>
              <div className="text-slate-500">İlgili Kişi</div>
              <div className="font-medium">{customer.contact_name || "-"}</div>
            </div>

            <div>
              <div className="text-slate-500">Telefon</div>
              <div className="font-medium">{customer.phone || "-"}</div>
            </div>

            <div>
              <div className="text-slate-500">E-posta</div>
              <div className="font-medium">{customer.email || "-"}</div>
            </div>

            <div>
              <div className="text-slate-500">Konum</div>
              <div className="font-medium">
                {[customer.city, customer.country].filter(Boolean).join(" / ") || "-"}
              </div>
            </div>

            <div>
              <div className="text-slate-500">Vergi Dairesi</div>
              <div className="font-medium">{customer.tax_office || "-"}</div>
            </div>

            <div>
              <div className="text-slate-500">Vergi No</div>
              <div className="font-medium">{customer.tax_number || "-"}</div>
            </div>

            <div className="md:col-span-2">
              <div className="text-slate-500">Adres</div>
              <div className="whitespace-pre-wrap font-medium">{customer.address || "-"}</div>
            </div>

            <div className="md:col-span-2">
              <div className="text-slate-500">Notlar</div>
              <div className="whitespace-pre-wrap font-medium">{customer.notes || "-"}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Bağlı Makineler</h2>
            <span className="text-sm text-slate-500">{(machines ?? []).length} adet</span>
          </div>

          {(machines ?? []).length === 0 ? (
            <div className="text-sm text-slate-500">Bu müşteriye bağlı makine yok.</div>
          ) : (
            <div className="grid gap-3">
              {((machines ?? []) as CustomerMachineRow[]).map((machine) => (
                <Link
                  key={machine.id}
                  href={`/dashboard/machines/${machine.id}`}
                  className="rounded-xl border border-slate-200 px-4 py-3 transition hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-blue-600">{machine.machine_name}</div>
                      <div className="text-sm text-slate-500">
                        {[machine.brand, machine.model].filter(Boolean).join(" / ") || "-"}
                      </div>
                      <div className="text-sm text-slate-500">
                        {machine.serial_number || machine.machine_code || "-"}
                      </div>
                    </div>

                    <div className="text-right text-sm text-slate-900">
                      <div>{machine.status || "-"}</div>
                      <div className="text-slate-500">
                        {machine.next_maintenance_date
                          ? `Sonraki bakım: ${new Date(machine.next_maintenance_date).toLocaleDateString("tr-TR")}`
                          : "-"}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
