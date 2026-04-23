import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MachineForm from "@/components/machines/machine-form";

type PageProps = {
  searchParams?: Promise<{
    customerId?: string;
  }>;
};

type CustomerItem = {
  id: string;
  company_name: string;
  customer_code: string | null;
};

export default async function NewMachinePage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const preselectedCustomerId = params.customerId?.trim() ?? "";

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

  if (appUserError || !appUser) {
    throw new Error("Uygulama kullanıcısı bulunamadı.");
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
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Yeni Makine</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">Yeni makine kaydı oluşturun</p>
      </div>

      <MachineForm
        companyId={appUser.company_id}
        createdBy={appUser.id}
        customers={(customers ?? []) as CustomerItem[]}
        mode="create"
        initialValues={{
          customer_id: preselectedCustomerId || null,
        }}
      />
    </div>
  );
}
