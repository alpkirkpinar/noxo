import { cache } from "react"
import { getCurrentAppUser } from "@/lib/supabase/app-user"
import type { PermissionIdentity } from "@/lib/permissions"

type DashboardAppUser = {
  id: string
  company_id: string
  full_name?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  avatar_url?: string | null
  avatar_scale?: number | null
  avatar_offset_x?: number | null
  avatar_offset_y?: number | null
}

export const getDashboardContext = cache(async () => {
  const { supabase, user, appUser } = await getCurrentAppUser<DashboardAppUser>(
    "id, company_id, full_name, email, phone, title, avatar_url, avatar_scale, avatar_offset_x, avatar_offset_y"
  )

  const permissions = Array.isArray(user?.app_metadata?.permissions)
    ? user.app_metadata.permissions.map(String)
    : []

  const identity: PermissionIdentity = {
    role: typeof user?.app_metadata?.role === "string" ? user.app_metadata.role : null,
    email: user?.email ?? null,
    super_user: user?.app_metadata?.super_user === true,
    company_modules: Array.isArray(user?.app_metadata?.company_modules)
      ? user.app_metadata.company_modules.map(String)
      : undefined,
    company_active: user?.app_metadata?.company_active === false ? false : undefined,
    permissions,
  }

  return {
    supabase,
    user,
    appUser,
    companyId: appUser?.company_id ?? null,
    appUserId: appUser?.id ?? null,
    identity,
  }
})
