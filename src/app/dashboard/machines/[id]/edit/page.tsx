import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MachineForm from "@/components/machines/machine-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

type CustomerItem = {
  id: string;
  company_name: string;
  customer_code: string | null;
};

type MachineInitialValues = {
  id: string;
  machine_code: string | null;
  customer_id: string | null;
  machine_name: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  installation_date: string | null;
  warranty_end_date: string | null;
  maintenance_period_days: number | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  location_text: string | null;
  notes: string | null;
  status: string | null;
};

export default async function EditMachinePage({ params }: PageProps) {
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
      customer_id,
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
      status
    `)
    .eq("id", id)
    .eq("company_id", appUser.company_id)
    .single();

  if (machineError || !machine) {
    notFound();
  }

  const { data: customers, error: customersError } = await supabase
    .from("customers")
    .select("id, company_name, customer_code")
    .eq("company_id", appUser.company_id)
    .eq("is_active", true)
    .order("company_name", { ascending: true });

  if (customersError) {
    throw new Error(customersError.message);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Makine Düzenle</h1>
          <p className="text-sm text-gray-500">Makine bilgilerini güncelleyin</p>
        </div>

        <Link
          href={`/dashboard/machines/${machine.id}`}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Geri
        </Link>
      </div>

      <MachineForm
        companyId={appUser.company_id}
        customers={(customers ?? []) as CustomerItem[]}
        mode="edit"
        initialValues={machine as MachineInitialValues}
        cancelHref={`/dashboard/machines/${machine.id}`}
      />
    </div>
  );
}
