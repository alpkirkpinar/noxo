import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/supabase/app-user";
import ServiceFormEditorClient from "@/components/service-forms/service-form-editor-client";

type TemplateItem = {
  id: string;
  template_name: string;
  template_code: string | null;
  file_path: string | null;
  page_count: number | null;
};

export default async function NewServiceFormPage() {
  const { supabase, user, appUser } = await getCurrentAppUser("id, company_id");

  if (!user) redirect("/login");

  if (!appUser?.id || !appUser?.company_id) {
    throw new Error("Uygulama kullanıcısı bulunamadı.");
  }

  const { data: templates } = await supabase
    .from("pdf_templates")
    .select("id, template_name, template_code, file_path, page_count")
    .eq("company_id", appUser.company_id)
    .eq("is_active", true)
    .order("template_name", { ascending: true });

  return (
    <div className="space-y-6">
      <ServiceFormEditorClient
        companyId={String(appUser.company_id)}
        userId={String(appUser.id)}
        mode="create"
        templates={(templates ?? []) as TemplateItem[]}
        pageTitle="Yeni Servis Formu"
        backHref="/dashboard/service-forms"
      />
    </div>
  );
}
