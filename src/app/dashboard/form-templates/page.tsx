import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type TemplateRow = {
  id: string;
  template_code: string | null;
  template_name: string | null;
  page_count: number | null;
  created_at: string | null;
};

export default async function FormTemplatesPage() {
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

  const { data: templates, error } = await supabase
    .from("pdf_templates")
    .select(`
      id,
      template_code,
      template_name,
      page_count,
      created_at
    `)
    .eq("company_id", appUser.company_id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Form Şablonları</h1>
          <p className="text-sm text-gray-500">
            Şablon adı doğrudan form tipini temsil eder
          </p>
        </div>

        <Link
          href="/dashboard/form-templates/new"
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Yeni Şablon
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-700">Şablon Adı</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-700">Kod</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-700">Sayfa</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-700">Oluşturulma</th>
              </tr>
            </thead>

            <tbody>
              {(templates ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                ((templates ?? []) as TemplateRow[]).map((template) => (
                  <tr
                    key={template.id}
                    className="border-b border-slate-200 last:border-b-0 transition-all duration-150 hover:bg-slate-200/80 hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      <Link href={`/dashboard/form-templates/${template.id}`} className="block">
                        {template.template_name ?? "-"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <Link href={`/dashboard/form-templates/${template.id}`} className="block">
                        {template.template_code ?? "-"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <Link href={`/dashboard/form-templates/${template.id}`} className="block">
                        {template.page_count ?? "-"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <Link href={`/dashboard/form-templates/${template.id}`} className="block">
                        {template.created_at
                          ? new Date(template.created_at).toLocaleDateString("tr-TR")
                          : "-"}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
