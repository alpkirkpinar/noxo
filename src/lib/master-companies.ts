import type { createAdminClient } from "@/lib/supabase/admin"
import { ALL_APP_MODULE_KEYS, normalizeAppModules, type AppModuleKey } from "@/lib/permissions"

type AdminClient = ReturnType<typeof createAdminClient>

export type ManagedCompanyLog = {
  id: string
  userId: string | null
  userName: string | null
  moduleName: string | null
  actionName: string | null
  recordType: string | null
  recordId: string | null
  detail: string | null
  createdAt: string | null
}

export type ManagedCompany = {
  companyId: string
  companyName: string
  isActive: boolean
  enabledModules: AppModuleKey[]
  userCount: number
  users: Array<{
    id: string
    authUserId: string | null
    fullName: string | null
    email: string | null
    title: string | null
  }>
  logs: ManagedCompanyLog[]
}

export async function loadManagedCompanies(admin: AdminClient) {
  const [
    { data: appUsers, error: appUsersError },
    { data: settings, error: settingsError },
    companiesResult,
    logsResult,
    authUsers,
  ] = await Promise.all([
    admin
      .from("app_users")
      .select("id, auth_user_id, company_id, full_name, email, title")
      .order("full_name", { ascending: true }),
    admin.from("system_settings").select("company_id, company_name"),
    admin.from("companies").select("id, is_active"),
    admin
      .from("activity_logs")
      .select("id, company_id, user_id, module_name, action_name, record_type, record_id, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    listAllAuthUsers(admin),
  ])

  if (appUsersError) throw appUsersError
  if (settingsError) throw settingsError

  const settingsByCompany = new Map<string, string>()
  const activeByCompany = new Map<string, boolean>()
  const authUserById = new Map(authUsers.map((user) => [user.id, user]))
  const appUserById = new Map<string, { fullName: string | null; email: string | null }>()
  const modulesByCompany = new Map<string, AppModuleKey[]>()
  const logsByCompany = new Map<string, ManagedCompanyLog[]>()

  for (const item of settings ?? []) {
    const companyId = String(item.company_id ?? "")
    if (!companyId) continue
    settingsByCompany.set(companyId, String(item.company_name ?? "").trim())
  }

  if (!companiesResult.error) {
    for (const company of companiesResult.data ?? []) {
      const companyId = String(company.id ?? "")
      if (!companyId) continue
      activeByCompany.set(companyId, company.is_active !== false)
    }
  }

  for (const user of appUsers ?? []) {
    const userId = String(user.id ?? "")
    if (!userId) continue

    appUserById.set(userId, {
      fullName: user.full_name ? String(user.full_name) : null,
      email: user.email ? String(user.email) : null,
    })
  }

  for (const user of appUsers ?? []) {
    const companyId = String(user.company_id ?? "")
    const authUserId = user.auth_user_id ? String(user.auth_user_id) : ""
    if (!companyId || !authUserId || modulesByCompany.has(companyId)) continue

    const modules = normalizeAppModules(authUserById.get(authUserId)?.app_metadata?.company_modules)
    if (modules) modulesByCompany.set(companyId, modules)
  }

  if (!logsResult.error) {
    for (const log of logsResult.data ?? []) {
      const companyId = String(log.company_id ?? "")
      if (!companyId) continue

      const list = logsByCompany.get(companyId) ?? []
      if (list.length >= 40) continue

      const appUser = log.user_id ? appUserById.get(String(log.user_id)) : null
      list.push({
        id: String(log.id),
        userId: log.user_id ? String(log.user_id) : null,
        userName: appUser?.fullName || appUser?.email || null,
        moduleName: log.module_name ? String(log.module_name) : null,
        actionName: log.action_name ? String(log.action_name) : null,
        recordType: log.record_type ? String(log.record_type) : null,
        recordId: log.record_id ? String(log.record_id) : null,
        detail: formatLogDetail(log.detail),
        createdAt: log.created_at ? String(log.created_at) : null,
      })
      logsByCompany.set(companyId, list)
    }
  }

  const companies = new Map<string, ManagedCompany>()

  for (const user of appUsers ?? []) {
    const companyId = String(user.company_id ?? "")
    if (!companyId) continue

    const company =
      companies.get(companyId) ??
      ({
        companyId,
        companyName: settingsByCompany.get(companyId) || "Adsiz Firma",
        isActive: activeByCompany.get(companyId) ?? true,
        enabledModules: modulesByCompany.get(companyId) ?? [...ALL_APP_MODULE_KEYS],
        userCount: 0,
        users: [],
        logs: logsByCompany.get(companyId) ?? [],
      } satisfies ManagedCompany)

    company.userCount += 1
    company.users.push({
      id: String(user.id),
      authUserId: user.auth_user_id ? String(user.auth_user_id) : null,
      fullName: user.full_name ? String(user.full_name) : null,
      email: user.email ? String(user.email) : null,
      title: user.title ? String(user.title) : null,
    })

    companies.set(companyId, company)
  }

  return Array.from(companies.values()).sort((left, right) =>
    left.companyName.localeCompare(right.companyName, "tr")
  )
}

async function listAllAuthUsers(admin: AdminClient) {
  const users = []

  for (let page = 1; page < 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error

    users.push(...(data.users ?? []))
    if (!data.users || data.users.length < 1000) break
  }

  return users
}

function formatLogDetail(detail: unknown) {
  if (detail === null || detail === undefined) return null
  if (typeof detail === "string") return detail

  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}
