import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  default_value?: string | null;
};

export default async function FormTemplateLayoutPage({ params }: PageProps) {
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
      text_align,
      default_value
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

  const actionButtonClass =
    "inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition-colors duration-200 hover:border-slate-900 hover:bg-slate-900 hover:text-white";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Form Düzenleme</h1>
          <p className="text-sm text-gray-500">Alan sırası ve form satır yerleşimini rahatça düzenleyin</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/form-templates/${template.id}`}
            className={actionButtonClass}
          >
            Şablona Dön
          </Link>
        </div>
      </div>

      <PdfTemplateEditorClient
        companyId={String(appUser.company_id)}
        userId={String(appUser.id)}
        mode="edit"
        initialTemplate={template}
        initialFields={normalizedFields}
        editorMode="layout"
      />
    </div>
  );
}
