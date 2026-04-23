import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PdfTemplateEditorClient from "@/components/form-templates/pdf-template-editor-client";

export default async function NewFormTemplatePage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Yeni Form Şablonu</h1>
        <p className="text-sm text-gray-500">
          PDF yükleyin ve doldurulacak alanları doğrudan PDF üzerinde yerleştirin
        </p>
      </div>

      <PdfTemplateEditorClient
        companyId={String(appUser.company_id)}
        userId={String(appUser.id)}
        mode="create"
      />
    </div>
  );
}
