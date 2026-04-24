import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerForm from "@/components/customers/customer-form";

export default async function NewCustomerPage() {
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

  if (appUserError || !appUser?.company_id || !appUser?.id) {
    throw new Error("company_id bulunamadı.");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Yeni Müşteri</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Yeni müşteri kaydı oluşturun</p>
        </div>

        <Link
          href="/dashboard/customers"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Geri
        </Link>
      </div>

      <CustomerForm
        companyId={appUser.company_id}
        createdBy={appUser.id}
        mode="create"
        cancelHref="/dashboard/customers"
      />
    </div>
  );
}
