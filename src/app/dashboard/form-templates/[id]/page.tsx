import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerIdentity } from "@/lib/authz";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import PdfTemplateEditorClient from "@/components/form-templates/pdf-template-editor-client";

type PageProps = {
  params: Promise<{ id: string }>;
};

type TemplateFieldRow = {
  id: string;
  field_key: string;
  field_label: string;
  page_number: number;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  font_size: number;
  field_type: string;
  is_required: boolean;
  data_source: string | null;
  options_json: unknown;
  show_in_input_panel: boolean;
  is_readonly: boolean;
  text_align: string;
};

export default async function FormTemplateDetailPage({ params }: PageProps) {
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

  if (appUserError || !appUser?.id || !appUser?.company_id) {
    throw new Error("Uygulama kullanıcısı veya company_id bulunamadı.");
  }

  const { data: template, error: templateError } = await supabase
    .from("pdf_templates")
    .select(`
      id,
      template_code,
      template_name,
      page_count,
      is_active,
      file_path
    `)
    .eq("id", id)
    .eq("company_id", appUser.company_id)
    .single();

  if (templateError || !template) {
    notFound();
  }

  const { data: fields, error: fieldsError } = await supabase
    .from("pdf_template_fields")
    .select(`
      id,
      field_key,
      field_label,
      page_number,
      pos_x,
      pos_y,
      width,
      height,
      font_size,
      field_type,
      is_required,
      data_source,
      options_json,
      show_in_input_panel,
      is_readonly,
      text_align
    `)
    .eq("template_id", template.id)
    .order("sort_order", { ascending: true });

  if (fieldsError) {
    throw new Error(fieldsError.message);
  }

  const normalizedFields = ((fields ?? []) as TemplateFieldRow[]).map((field) => ({
    ...field,
    font_family: "Calibri",
    vertical_align: "middle",
  }));

  async function deleteTemplate() {
    "use server";

    const auth = await getServerIdentity(PERMISSIONS.formTemplateDelete);
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

    const { error: fieldsDeleteError } = await supabase
      .from("pdf_template_fields")
      .delete()
      .eq("template_id", id);

    if (fieldsDeleteError) {
      throw new Error(fieldsDeleteError.message);
    }

    const { error: templateDeleteError } = await supabase
      .from("pdf_templates")
      .delete()
      .eq("id", id)
      .eq("company_id", auth.identity.companyId);

    if (templateDeleteError) {
      throw new Error(templateDeleteError.message);
    }

    redirect("/dashboard/form-templates");
  }

  const canDelete = hasPermission(
    {
      permissions: Array.isArray(user.app_metadata?.permissions)
        ? user.app_metadata.permissions.map(String)
        : [],
      role: typeof user.app_metadata?.role === "string" ? user.app_metadata.role : null,
      super_user: user.app_metadata?.super_user === true,
    },
    PERMISSIONS.formTemplateDelete
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Form Şablonu Düzenle</h1>
          <p className="text-sm text-gray-500">PDF alanlarını güncelleyin</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/form-templates"
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Geri
          </Link>

          {canDelete ? (
          <form action={deleteTemplate}>
            <button
              type="submit"
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600"
            >
              Şablonu Sil
            </button>
          </form>
          ) : null}
        </div>
      </div>

      <PdfTemplateEditorClient
        companyId={String(appUser.company_id)}
        userId={String(appUser.id)}
        mode="edit"
        initialTemplate={template}
        initialFields={normalizedFields}
      />
    </div>
  );
}
