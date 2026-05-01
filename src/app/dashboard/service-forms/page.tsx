import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/supabase/app-user";

type GroupedForms = {
  template_id: string;
  template_name: string;
  form_count: number;
  last_created_at: string | null;
};

type ServiceFormRow = {
  id: string;
  template_id: string | null;
  created_at: string | null;
  created_by: string | null;
};

type TemplateRow = {
  id: string;
  template_name: string | null;
};

function isPrivilegedUser(meta: {
  full_name?: string | null;
  title?: string | null;
}) {
  const text = [meta.full_name ?? "", meta.title ?? ""].join(" ").toLocaleLowerCase("tr-TR");

  return (
    text.includes("yönetici") ||
    text.includes("yonetici") ||
    text.includes("admin") ||
    text.includes("muhasebe") ||
    text.includes("accounting")
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR");
}

export default async function ServiceFormsPage() {
  const { supabase, user, appUser } = await getCurrentAppUser("id, company_id, full_name, title");

  if (!user) redirect("/login");

  if (!appUser?.company_id) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
        Kullanıcı şirket bilgisi bulunamadı. Önce kullanıcı kaydının `app_users` tablosunda
        `company_id` ile eşleştiğini kontrol et.
      </div>
    );
  }

  const privileged = isPrivilegedUser(appUser);

  let formsQuery = supabase
    .from("service_forms")
    .select("id, template_id, created_at, created_by")
    .eq("company_id", appUser.company_id)
    .order("created_at", { ascending: false });

  if (!privileged) {
    formsQuery = formsQuery.eq("created_by", appUser.id);
  }

  const [{ data: forms, error: formsError }, { data: templates, error: templatesError }] =
    await Promise.all([
      formsQuery,
      supabase.from("pdf_templates").select("id, template_name").eq("company_id", appUser.company_id),
    ]);

  if (formsError) {
    throw new Error(formsError.message);
  }

  if (templatesError) {
    throw new Error(templatesError.message);
  }

  const templateNameById = new Map<string, string>();

  for (const template of (templates ?? []) as TemplateRow[]) {
    templateNameById.set(template.id, template.template_name?.trim() || "Adsız Şablon");
  }

  const groupedMap = new Map<string, GroupedForms>();

  for (const form of (forms ?? []) as ServiceFormRow[]) {
    const templateId = form.template_id ?? "no-template";
    const templateName =
      form.template_id && templateNameById.has(form.template_id)
        ? templateNameById.get(form.template_id)!
        : "Şablonsuz Form";

    if (!groupedMap.has(templateId)) {
      groupedMap.set(templateId, {
        template_id: templateId,
        template_name: templateName,
        form_count: 0,
        last_created_at: form.created_at ?? null,
      });
    }

    const row = groupedMap.get(templateId)!;
    row.form_count += 1;

    if (form.created_at && (!row.last_created_at || new Date(form.created_at) > new Date(row.last_created_at))) {
      row.last_created_at = form.created_at;
    }
  }

  const groupedForms = Array.from(groupedMap.values()).sort((a, b) =>
    a.template_name.localeCompare(b.template_name, "tr")
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link
          href="/dashboard/service-forms/new"
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Yeni Form
        </Link>
      </div>

      {groupedForms.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Kayıt bulunamadı.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groupedForms.map((group) => (
            <Link
              key={group.template_id}
              href={
                group.template_id === "no-template"
                  ? "/dashboard/service-forms"
                  : `/dashboard/service-forms/template/${group.template_id}`
              }
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-lg font-semibold tracking-tight text-slate-900">
                    {group.template_name}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">Form listesini açmak için karta tıkla</div>
                </div>

                <div className="inline-flex min-w-[64px] items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-center text-xs font-semibold text-slate-600 transition group-hover:bg-slate-200">
                  {group.form_count} form
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Son Kayıt</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {formatDateTime(group.last_created_at)}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700 transition group-hover:text-slate-900">
                  Listeyi Aç
                </span>
                <span className="text-slate-400 transition group-hover:text-slate-700">{">"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
