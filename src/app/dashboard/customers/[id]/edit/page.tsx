import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerForm from "@/components/customers/customer-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCustomerPage({ params }: PageProps) {
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

  const { data: customer, error } = await supabase
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
      is_active
    `)
    .eq("id", id)
    .eq("company_id", appUser.company_id)
    .single();

  if (error || !customer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Müşteri Düzenle</h1>
        <p className="text-sm text-gray-500">Müşteri bilgilerini güncelleyin</p>
      </div>

      <CustomerForm
        companyId={appUser.company_id}
        mode="edit"
        initialValues={customer}
      />
    </div>
  );
}
