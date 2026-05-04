import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendNewEmployeeCredentialsEmail } from "@/lib/email"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

type EmployeePayload = {
  fullName?: string
  email?: string
  phone?: string
  title?: string
  calendarColor?: string
}

const EMPLOYEE_CALENDAR_COLOR_PALETTE = [
  "#E11D48",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#14B8A6",
  "#06B6D4",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#F43F5E",
  "#84CC16",
  "#10B981",
  "#0EA5E9",
]

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 })
    }

    if (
      !hasPermission(
        {
          role: user.app_metadata?.role,
          super_user: user.app_metadata?.super_user,
          company_modules: Array.isArray(user.app_metadata?.company_modules)
            ? user.app_metadata.company_modules.map(String)
            : undefined,
          company_active: user.app_metadata?.company_active === false ? false : undefined,
          permissions: Array.isArray(user.app_metadata?.permissions)
            ? user.app_metadata.permissions.map(String)
            : [],
        },
        PERMISSIONS.employees
      )
    ) {
      return NextResponse.json({ error: "Calisan goruntuleme yetkiniz yok." }, { status: 403 })
    }

    const { data: currentAppUser, error: appUserError } = await supabase
      .from("app_users")
      .select("company_id")
      .eq("auth_user_id", user.id)
      .single()

    if (appUserError || !currentAppUser?.company_id) {
      return NextResponse.json(
        { error: appUserError?.message || "company_id bulunamadi." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    const { data: employees, error: employeesError } = await selectEmployeesForCompany(
      supabase,
      currentAppUser.company_id
    )

    if (employeesError) {
      return NextResponse.json({ error: employeesError.message }, { status: 500 })
    }

    const employeesWithPermissions = await Promise.all(
      (employees ?? []).map(async (employee) => {
        const authUserId = String(employee.auth_user_id ?? "").trim()

        if (!isUuid(authUserId)) {
          return {
            ...withResolvedCalendarColor(employee),
            permissions: [],
            is_super_user: false,
          }
        }

        const { data: authUserData, error: authUserError } =
          await admin.auth.admin.getUserById(authUserId)

        if (authUserError || !authUserData.user) {
          return {
            ...withResolvedCalendarColor(employee),
            permissions: [],
            is_super_user: false,
          }
        }

        const appMetadata = authUserData.user.app_metadata ?? {}

        return {
          ...withResolvedCalendarColor(employee),
          permissions: Array.isArray(appMetadata.permissions)
            ? appMetadata.permissions.map(String)
            : [],
          is_super_user: appMetadata.super_user === true,
        }
      })
    )

    return NextResponse.json({ employees: employeesWithPermissions })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Calisanlar alinamadi."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  let createdAuthUserId: string | null = null

  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 })
    }

    if (
      !hasPermission(
        {
          role: user.app_metadata?.role,
          super_user: user.app_metadata?.super_user,
          company_modules: Array.isArray(user.app_metadata?.company_modules)
            ? user.app_metadata.company_modules.map(String)
            : undefined,
          company_active: user.app_metadata?.company_active === false ? false : undefined,
          permissions: Array.isArray(user.app_metadata?.permissions)
            ? user.app_metadata.permissions.map(String)
            : [],
        },
        PERMISSIONS.employeeCreate
      )
    ) {
      return NextResponse.json({ error: "Calisan olusturma yetkiniz yok." }, { status: 403 })
    }

    const { data: currentAppUser, error: appUserError } = await supabase
      .from("app_users")
      .select("company_id")
      .eq("auth_user_id", user.id)
      .single()

    if (appUserError || !currentAppUser?.company_id) {
      return NextResponse.json(
        { error: appUserError?.message || "company_id bulunamadi." },
        { status: 400 }
      )
    }

    const body = (await request.json()) as EmployeePayload
    const fullName = String(body?.fullName ?? "").trim()
    const email = String(body?.email ?? "").trim().toLowerCase()
    const phone = String(body?.phone ?? "").trim()
    const title = String(body?.title ?? "").trim()
    const calendarColor = normalizeCalendarColor(body?.calendarColor)

    if (!fullName) {
      return NextResponse.json({ error: "Ad Soyad zorunludur." }, { status: 400 })
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Gecerli bir e-posta girin." }, { status: 400 })
    }

    if (body?.calendarColor !== undefined && !calendarColor) {
      return NextResponse.json({ error: "Gecerli bir renk girin." }, { status: 400 })
    }

    const admin = createAdminClient()
    const password = generateInitialPassword()
    const username = await generateUniqueUsername(admin, email)
    const supportsCalendarColor = await appUsersSupportsCalendarColor(admin)
    const assignedCalendarColor = supportsCalendarColor
      ? calendarColor ||
        (await pickAvailableCalendarColor(admin, currentAppUser.company_id, email))
      : null

    const { data: authData, error: createAuthError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        must_change_password: true,
      },
      app_metadata: {
        role: "employee",
        super_user: false,
        company_modules: Array.isArray(user.app_metadata?.company_modules)
          ? user.app_metadata.company_modules.map(String)
          : undefined,
        company_active: user.app_metadata?.company_active === false ? false : undefined,
        permissions: [],
      },
    })

    if (createAuthError || !authData.user) {
      return NextResponse.json(
        { error: createAuthError?.message || "Auth kullanicisi olusturulamadi." },
        { status: 500 }
      )
    }

    createdAuthUserId = authData.user.id

    const insertPayload = {
      auth_user_id: createdAuthUserId,
      company_id: currentAppUser.company_id,
      username,
      full_name: fullName,
      email,
      phone: phone || null,
      title: title || null,
      ...(supportsCalendarColor ? { calendar_color: assignedCalendarColor } : {}),
    }

    const insertQuery = admin.from("app_users").insert(insertPayload)
    const employeeResult = supportsCalendarColor
      ? await insertQuery
          .select("id, auth_user_id, full_name, email, phone, title, calendar_color")
          .single()
      : await insertQuery.select("id, auth_user_id, full_name, email, phone, title").single()

    const { data: employee, error: insertError } = employeeResult

    if (insertError || !employee) {
      await admin.auth.admin.deleteUser(createdAuthUserId)

      return NextResponse.json(
        { error: insertError?.message || "Calisan kaydi olusturulamadi." },
        { status: 500 }
      )
    }

    const companyName = await getCompanyName(admin, currentAppUser.company_id)
    const emailDelivery = await sendNewEmployeeCredentialsEmail({
      fullName,
      email,
      password,
      companyName,
      loginUrl: getLoginUrl(request),
    })

    if (!emailDelivery.sent) {
      console.error("Employee credentials email could not be sent:", emailDelivery.error)
    }

    return NextResponse.json(
      {
        employee: withResolvedCalendarColor(employee),
        initialPassword: password,
        emailDelivery,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Calisan olusturulamadi."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function generateInitialPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*"
  const bytes = new Uint8Array(14)
  crypto.getRandomValues(bytes)

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

async function generateUniqueUsername(
  admin: ReturnType<typeof createAdminClient>,
  email: string
) {
  const localPart = email.split("@")[0] || "user"
  const base = localPart
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  )
}

function normalizeCalendarColor(value: unknown) {
  const text = String(value ?? "").trim().toUpperCase()
  if (!text) return null
  if (!/^#[0-9A-F]{6}$/.test(text)) return null
  return text
}

function deriveCalendarColor(seed: string) {
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }

  return EMPLOYEE_CALENDAR_COLOR_PALETTE[hash % EMPLOYEE_CALENDAR_COLOR_PALETTE.length]
}

function withResolvedCalendarColor<T extends { id: string; auth_user_id?: string | null; calendar_color?: string | null }>(
  employee: T
) {
  return {
    ...employee,
    calendar_color:
      normalizeCalendarColor(employee.calendar_color) ||
      deriveCalendarColor(String(employee.auth_user_id ?? employee.id)),
  }
}

async function pickAvailableCalendarColor(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  seed: string
) {
  const { data, error } = await admin
    .from("app_users")
    .select("calendar_color")
    .eq("company_id", companyId)

  if (error) {
    throw error
  }

  const usedColors = new Set(
    (data ?? [])
      .map((item) => normalizeCalendarColor(item.calendar_color))
      .filter((value): value is string => Boolean(value))
  )

  const unusedColor = EMPLOYEE_CALENDAR_COLOR_PALETTE.find((color) => !usedColors.has(color))
  return unusedColor || deriveCalendarColor(seed)
}

async function getCompanyName(admin: ReturnType<typeof createAdminClient>, companyId: string) {
  const { data: settings } = await admin
    .from("system_settings")
    .select("company_name")
    .eq("company_id", companyId)
    .maybeSingle()

  const companyName = String(settings?.company_name ?? "").trim()
  return companyName || "Noxo"
}

function getLoginUrl(request: Request) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim()

  if (configuredUrl) {
    return `${configuredUrl.replace(/\/+$/, "")}/login`
  }

  return new URL("/login", request.url).toString()
}

async function selectEmployeesForCompany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string
) {
  const withColor = await supabase
    .from("app_users")
    .select("id, auth_user_id, full_name, email, phone, title, calendar_color")
    .eq("company_id", companyId)
    .order("full_name", { ascending: true })

  if (!hasMissingCalendarColorColumn(withColor.error)) {
    return withColor
  }

  return supabase
    .from("app_users")
    .select("id, auth_user_id, full_name, email, phone, title")
    .eq("company_id", companyId)
    .order("full_name", { ascending: true })
}

async function appUsersSupportsCalendarColor(admin: ReturnType<typeof createAdminClient>) {
  const result = await admin.from("app_users").select("calendar_color").limit(1)
  return !hasMissingCalendarColorColumn(result.error)
}

function hasMissingCalendarColorColumn(
  error: { code?: string | null; message?: string | null } | null
) {
  if (!error) return false

  return (
    error.code === "42703" &&
    String(error.message ?? "").toLowerCase().includes("calendar_color")
  )
}
