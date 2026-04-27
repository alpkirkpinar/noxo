import { createAdminClient } from "@/lib/supabase/admin"
import { localizeErrorMessage } from "@/lib/error-messages"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/permissions"

export async function getServerIdentity(requiredPermission?: string) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Oturum bulunamadı.", status: 401 as const }
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("id, company_id")
    .eq("auth_user_id", user.id)
    .single()

  if (appUserError || !appUser?.company_id || !appUser?.id) {
    return {
      error: localizeErrorMessage(appUserError?.message, "Şirket bilgisi bulunamadı."),
      status: 400 as const,
    }
  }

  const { data: freshUser, error: freshUserError } = await admin.auth.admin.getUserById(user.id)

  if (freshUserError || !freshUser.user) {
    return {
      error: localizeErrorMessage(freshUserError?.message, "Kullanıcı yetkileri okunamadı."),
      status: 500 as const,
    }
  }

  const metadata = freshUser.user.app_metadata ?? {}
  const identity = {
    authUserId: user.id,
    appUserId: String(appUser.id),
    companyId: String(appUser.company_id),
    role: metadata.role,
    super_user: metadata.super_user,
    company_modules: Array.isArray(metadata.company_modules)
      ? metadata.company_modules.map(String)
      : undefined,
    company_active: metadata.company_active === false ? false : undefined,
    permissions: Array.isArray(metadata.permissions) ? metadata.permissions.map(String) : [],
  }

  if (requiredPermission && !hasPermission(identity, requiredPermission)) {
    return { error: "Bu işlem için yetkiniz yok.", status: 403 as const }
  }

  return { supabase, admin, identity }
}
