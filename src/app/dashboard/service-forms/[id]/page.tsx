import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerIdentity } from "@/lib/authz";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getCurrentAppUser } from "@/lib/supabase/app-user";
import ServiceFormEditorClient from "@/components/service-forms/service-form-editor-client";

type TemplateItem = {
  id: string;
  template_name: string;
  template_code: string | null;
  file_path: string | null;
  page_count: number | null;
};

type FieldValueItem = {
  template_field_id: string;
  field_key: string;
  value_text: string;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ServiceFormDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, user, appUser } = await getCurrentAppUser("id, company_id");

  if (!user) redirect("/login");

  if (!appUser?.id || !appUser?.company_id) {
    throw new Error("Uygulama kullanıcısı bulunamadı.");
  }

  const { data: form, error: formError } = await supabase
    .from("service_forms")
    .select(`
      id,
      form_no,
      template_id,
      customer_id,
      machine_id,
      ticket_id,
      service_date
    `)
    .eq("id", id)
    .eq("company_id", appUser.company_id)
    .single();

  if (formError || !form) {
    notFound();
  }

  const [{ data: templates }, { data: values }] =
    await Promise.all([
      supabase
        .from("pdf_templates")
        .select("id, template_name, template_code, file_path, page_count")
        .eq("company_id", appUser.company_id)
        .eq("is_active", true)
        .order("template_name", { ascending: true }),

      supabase
        .from("service_form_field_values")
        .select("template_field_id, field_key, value_text")
        .eq("service_form_id", id),
    ]);

  async function deleteServiceForm() {
    "use server";

    const auth = await getServerIdentity(PERMISSIONS.serviceFormDelete);
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

    const { error: deleteValuesError } = await supabase
      .from("service_form_field_values")
      .delete()
      .eq("service_form_id", id);

    if (deleteValuesError) {
      throw new Error(deleteValuesError.message);
    }

    const { error: deleteFormError } = await supabase
      .from("service_forms")
      .delete()
      .eq("id", id)
      .eq("company_id", auth.identity.companyId);

    if (deleteFormError) {
      throw new Error(deleteFormError.message);
    }

    redirect("/dashboard/service-forms");
  }

  const canDelete = hasPermission(
    {
      permissions: Array.isArray(user.app_metadata?.permissions)
        ? user.app_metadata.permissions.map(String)
        : [],
      role: typeof user.app_metadata?.role === "string" ? user.app_metadata.role : null,
      super_user: user.app_metadata?.super_user === true,
    },
    PERMISSIONS.serviceFormDelete
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Servis Formu Düzenle</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/service-forms"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Geri
          </Link>

          {canDelete ? (
          <form action={deleteServiceForm}>
            <button
              type="submit"
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600"
            >
              Formu Sil
            </button>
          </form>
          ) : null}
        </div>
      </div>

      <ServiceFormEditorClient
        companyId={String(appUser.company_id)}
        userId={String(appUser.id)}
        mode="edit"
        templates={(templates ?? []) as TemplateItem[]}
        initialForm={form}
        initialFields={(values ?? []) as FieldValueItem[]}
      />
    </div>
  );
}
