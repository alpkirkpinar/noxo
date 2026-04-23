import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { ALL_APP_MODULE_KEYS, isMasterUser, normalizeAppModules } from "@/lib/permissions"
import { loadManagedCompanies } from "@/lib/master-companies"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type CompanyPayload = {
  companyName?: string
  adminFullName?: string
  adminEmail?: string
  adminPhone?: string
}

type CompanyUpdatePayload = {
  companyId?: string
  companyName?: string
  isActive?: boolean
  enabledModules?: string[]
}

export async function GET() {
  const auth = await getMasterAuth()
  if ("response" in auth) return auth.response

  try {
    const companies = await loadManagedCompanies(auth.admin)
    return NextResponse.json({ companies })
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Firmalar okunamadı.") },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await getMasterAuth()
  if ("response" in auth) return auth.response

  let createdAuthUserId: string | null = null
  let createdAppUserId: string | null = null
  let createdCompanyId: string | null = null

  try {
    const body = (await request.json()) as CompanyPayload
    const companyName = String(body.companyName ?? "").trim()
    const adminFullName = String(body.adminFullName ?? "").trim()
    const adminEmail = String(body.adminEmail ?? "").trim().toLowerCase()
    const adminPhone = String(body.adminPhone ?? "").trim()

    if (!companyName) {
      return NextResponse.json({ error: "Firma adı zorunludur." }, { status: 400 })
    }

    if (!adminFullName) {
      return NextResponse.json({ error: "Yönetici adı zorunludur." }, { status: 400 })
    }

    if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return NextResponse.json({ error: "Geçerli bir yönetici e-postası girin." }, { status: 400 })
    }

    const companyId = randomUUID()
    const password = generateInitialPassword()
    const username = await generateUniqueUsername(auth.admin, adminEmail)
    const companyInsert = await insertCompanyRecord(auth.admin, companyId, companyName)

    if (companyInsert.error) {
      return NextResponse.json(
        { error: companyInsert.error },
        { status: 500 }
      )
    }

    createdCompanyId = companyId

    const { data: authData, error: createAuthError } = await auth.admin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: adminFullName,
        must_change_password: true,
      },
      app_metadata: {
        role: "super_user",
        super_user: true,
        company_modules: ALL_APP_MODULE_KEYS,
        company_active: true,
        permissions: [],
      },
    })

    if (createAuthError || !authData.user) {
      await deleteCompanyRecord(auth.admin, companyId)
      return NextResponse.json(
        { error: createAuthError?.message || "Firma yöneticisi oluşturulamadı." },
        { status: 500 }
      )
    }

    createdAuthUserId = authData.user.id

    const { data: appUser, error: appUserError } = await auth.admin
      .from("app_users")
      .insert({
        auth_user_id: createdAuthUserId,
        company_id: companyId,
        username,
        full_name: adminFullName,
        email: adminEmail,
        phone: adminPhone || null,
        title: "Firma Yöneticisi",
      })
      .select("id")
      .single()

    if (appUserError || !appUser) {
      await auth.admin.auth.admin.deleteUser(createdAuthUserId)
      await deleteCompanyRecord(auth.admin, companyId)
      return NextResponse.json(
        { error: appUserError?.message || "Firma kullanıcı kaydı oluşturulamadı." },
        { status: 500 }
      )
    }

    createdAppUserId = String(appUser.id)

    const { error: settingsError } = await auth.admin.from("system_settings").upsert(
      {
        company_id: companyId,
        company_name: companyName,
        logo_url: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id" }
    )

    if (settingsError) {
      await auth.admin.from("app_users").delete().eq("id", createdAppUserId)
      await auth.admin.auth.admin.deleteUser(createdAuthUserId)
      await deleteCompanyRecord(auth.admin, companyId)
      return NextResponse.json(
        { error: settingsError.message || "Firma ayarı oluşturulamadı." },
        { status: 500 }
      )
    }

    await writeActivityLog(auth.admin, {
      companyId,
      userId: auth.appUserId,
      moduleName: "master",
      actionName: "company_created",
      recordType: "company",
      recordId: companyId,
      detail: { companyName, adminEmail, enabledModules: ALL_APP_MODULE_KEYS },
    })

    const companies = await loadManagedCompanies(auth.admin)

    return NextResponse.json(
      {
        company: {
          companyId,
          companyName,
          adminFullName,
          adminEmail,
          username,
          initialPassword: password,
        },
        companies,
      },
      { status: 201 }
    )
  } catch (error) {
    if (createdAppUserId) {
      await auth.admin.from("app_users").delete().eq("id", createdAppUserId)
    }

    if (createdAuthUserId) {
      await auth.admin.auth.admin.deleteUser(createdAuthUserId)
    }

    if (createdCompanyId) {
      await deleteCompanyRecord(auth.admin, createdCompanyId)
    }

    return NextResponse.json(
      { error: getErrorMessage(error, "Firma oluşturulamadı.") },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const auth = await getMasterAuth()
  if ("response" in auth) return auth.response

  try {
    const body = (await request.json()) as CompanyUpdatePayload
    const companyId = String(body.companyId ?? "").trim()
    const companyName = String(body.companyName ?? "").trim()
    const enabledModules = normalizeAppModules(body.enabledModules)
    const isActive = body.isActive !== false

    if (!companyId) {
      return NextResponse.json({ error: "Firma bulunamadi." }, { status: 400 })
    }

    if (!companyName) {
      return NextResponse.json({ error: "Firma adi zorunludur." }, { status: 400 })
    }

    if (!enabledModules) {
      return NextResponse.json({ error: "Modul listesi gecersiz." }, { status: 400 })
    }

    const { error: settingsError } = await auth.admin.from("system_settings").upsert(
      {
        company_id: companyId,
        company_name: companyName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id" }
    )

    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 500 })
    }

    await updateCompanyRecord(auth.admin, companyId, companyName, isActive)
    await updateCompanyUserModules(auth.admin, companyId, enabledModules, isActive)
    await writeActivityLog(auth.admin, {
      companyId,
      userId: auth.appUserId,
      moduleName: "master",
      actionName: "company_settings_updated",
      recordType: "company",
      recordId: companyId,
      detail: { companyName, isActive, enabledModules },
    })

    const companies = await loadManagedCompanies(auth.admin)

    return NextResponse.json({ companies })
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Firma ayarlari kaydedilemedi.") },
      { status: 500 }
    )
  }
}

async function getMasterAuth() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { response: NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 }) }
  }

  const { data: freshUser, error: freshUserError } = await admin.auth.admin.getUserById(user.id)

  if (freshUserError || !freshUser.user) {
    return {
      response: NextResponse.json(
        { error: freshUserError?.message || "Kullanıcı yetkileri okunamadı." },
        { status: 500 }
      ),
    }
  }

  if (!isMasterUser({ role: freshUser.user.app_metadata?.role })) {
    return { response: NextResponse.json({ error: "Master yetkisi gerekli." }, { status: 403 }) }
  }

  const { data: appUser } = await admin
    .from("app_users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  return { admin, appUserId: appUser?.id ? String(appUser.id) : null }
}

function generateInitialPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*"
  const bytes = new Uint8Array(14)
  crypto.getRandomValues(bytes)

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

async function generateUniqueUsername(admin: ReturnType<typeof createAdminClient>, email: string) {
  const localPart = email.split("@")[0] || "user"
  const base =
    localPart
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 32) || "user"

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const username = attempt === 0 ? base : `${base}${attempt + 1}`
    const { data, error } = await admin
      .from("app_users")
      .select("id")
      .eq("username", username)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return username
    }
  }

  return `${base}${Date.now()}`
}

async function insertCompanyRecord(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  companyName: string
) {
  const payloads = [
    { id: companyId, name: companyName, short_code: buildShortCode(companyName, companyId) },
    { id: companyId, company_name: companyName },
    { id: companyId },
  ]

  let lastError = "Firma kaydı oluşturulamadı."

  for (const payload of payloads) {
    const { error } = await admin.from("companies").insert(payload)

    if (!error) {
      return { error: null }
    }

    lastError = error.message

    if (
      !/column .* does not exist/i.test(error.message) &&
      !/could not find .* column/i.test(error.message) &&
      !/null value in column/i.test(error.message)
    ) {
      break
    }
  }

  return { error: lastError }
}

async function deleteCompanyRecord(admin: ReturnType<typeof createAdminClient>, companyId: string) {
  await admin.from("companies").delete().eq("id", companyId)
}

async function updateCompanyRecord(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  companyName: string,
  isActive: boolean
) {
  const payloads = [
    { name: companyName, is_active: isActive, updated_at: new Date().toISOString() },
    { name: companyName, updated_at: new Date().toISOString() },
    { is_active: isActive, updated_at: new Date().toISOString() },
  ]

  for (const payload of payloads) {
    const { error } = await admin.from("companies").update(payload).eq("id", companyId)
    if (!error) return

    if (
      !/column .* does not exist/i.test(error.message) &&
      !/could not find .* column/i.test(error.message)
    ) {
      throw error
    }
  }
}

async function updateCompanyUserModules(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  enabledModules: string[],
  isActive: boolean
) {
  const { data: users, error } = await admin
    .from("app_users")
    .select("auth_user_id")
    .eq("company_id", companyId)

  if (error) throw error

  for (const user of users ?? []) {
    const authUserId = user.auth_user_id ? String(user.auth_user_id) : ""
    if (!authUserId) continue

    const { data: authUser, error: readError } = await admin.auth.admin.getUserById(authUserId)
    if (readError || !authUser.user) throw readError ?? new Error("Kullanici okunamadi.")

    const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
      app_metadata: {
        ...(authUser.user.app_metadata ?? {}),
        company_modules: enabledModules,
        company_active: isActive,
      },
    })

    if (updateError) throw updateError
  }
}

async function writeActivityLog(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    companyId: string
    userId: string | null
    moduleName: string
    actionName: string
    recordType: string
    recordId: string
    detail: Record<string, unknown>
  }
) {
  await admin.from("activity_logs").insert({
    company_id: input.companyId,
    user_id: input.userId,
    module_name: input.moduleName,
    action_name: input.actionName,
    record_type: input.recordType,
    record_id: input.recordId,
    detail: JSON.stringify(input.detail),
  })
}

function buildShortCode(companyName: string, companyId: string) {
  const code = companyName
    .toUpperCase()
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8)

  return `${code || "FIRMA"}${companyId.replace(/-/g, "").slice(0, 4).toUpperCase()}`
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
