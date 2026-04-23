import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerIdentity } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";

function createCustomerCode() {
  return `CUS-${Date.now()}`;
}

export default async function NewCustomerPage() {
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

  if (appUserError || !appUser?.company_id) {
    throw new Error("company_id bulunamadı.");
  }

  async function createCustomer(formData: FormData) {
    "use server";

    const auth = await getServerIdentity(PERMISSIONS.customerCreate);
    if ("error" in auth) {
      throw new Error(auth.error);
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: appUser } = await supabase
      .from("app_users")
      .select("company_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!appUser?.company_id) {
      throw new Error("company_id bulunamadı.");
    }

    const company_name = String(formData.get("company_name") ?? "").trim();
    const contact_name = String(formData.get("contact_name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const country = String(formData.get("country") ?? "").trim();
    const tax_office = String(formData.get("tax_office") ?? "").trim();
    const tax_number = String(formData.get("tax_number") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const is_active = formData.get("is_active") === "on";

    if (!company_name) {
      throw new Error("Firma adı zorunludur.");
    }

    const { error } = await supabase.from("customers").insert({
      company_id: auth.identity.companyId,
      customer_code: createCustomerCode(),
      company_name,
      contact_name: contact_name || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      city: city || null,
      country: country || null,
      tax_office: tax_office || null,
      tax_number: tax_number || null,
      notes: notes || null,
      is_active,
    });

    if (error) {
      throw new Error(error.message);
    }

    redirect("/dashboard/customers");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Yeni Müşteri</h1>
          <p className="text-sm text-gray-500">
            Yeni müşteri kaydı oluşturun
          </p>
        </div>

        <Link
          href="/dashboard/customers"
          className="rounded-lg border px-4 py-2 text-sm font-medium"
        >
          Geri
        </Link>
      </div>

      <form action={createCustomer} className="rounded-xl border bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Firma Adı</label>
            <input
              type="text"
              name="company_name"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">İlgili Kişi</label>
            <input
              type="text"
              name="contact_name"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Telefon</label>
            <input
              type="text"
              name="phone"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">E-posta</label>
            <input
              type="email"
              name="email"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Şehir</label>
            <input
              type="text"
              name="city"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Ülke</label>
            <input
              type="text"
              name="country"
              defaultValue="Türkiye"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Vergi Dairesi</label>
            <input
              type="text"
              name="tax_office"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Vergi No</label>
            <input
              type="text"
              name="tax_number"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Adres</label>
            <textarea
              name="address"
              className="min-h-[100px] w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Notlar</label>
            <textarea
              name="notes"
              className="min-h-[120px] w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" defaultChecked />
            Aktif müşteri
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Müşteriyi Kaydet
          </button>
        </div>
      </form>
    </div>
  );
}
