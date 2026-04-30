import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"

type PatchBody = {
  fullName?: string
  email?: string
  phone?: string
  title?: string
  permissions?: string[]
  calendarColor?: string
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const identity = await getIdentity()

    if ("response" in identity) {
      return identity.response
    }

    if (!hasPermission(identity, PERMISSIONS.employeePermissions)) {
      return NextResponse.json(
        { error: "Çalışan yetkilerini görüntüleme yetkiniz yok." },
        { status: 403 }
      )
    }

    const { employee, admin } = await getEmployeeForCompany(id, identity.companyId)

    if (!employee) {
      return NextResponse.json({ error: "Çalışan bulunamadı." }, { status: 404 })
    }

    const authUserId = getValidAuthUserId(employee)
    if (!authUserId) {
      return NextResponse.json(
        { error: "Bu çalışan kaydına bağlı geçerli bir Auth kullanıcısı yok." },
        { status: 400 }
      )
    }

    const { data, error } = await admin.auth.admin.getUserById(authUserId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const permissions = data.user?.app_metadata?.permissions

    return NextResponse.json({
      permissions: Array.isArray(permissions) ? permissions.map(String) : [],
      isSuperUser:
        data.user?.app_metadata?.super_user === true ||
        data.user?.app_metadata?.role === "super_user",
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Yetkiler alınamadı."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const identity = await getIdentity()

    if ("response" in identity) {
      return identity.response
    }

    const { employee, admin } = await getEmployeeForCompany(id, identity.companyId)

    if (!employee) {
      return NextResponse.json({ error: "Çalışan bulunamadı." }, { status: 404 })
    }

    const body = (await request.json()) as PatchBody
    const updates: Record<string, string | null> = {}
    const wantsInfoUpdate =
      body.fullName !== undefined ||
      body.email !== undefined ||
      body.phone !== undefined ||
      body.title !== undefined ||
      body.calendarColor !== undefined

    if (wantsInfoUpdate && !hasPermission(identity, PERMISSIONS.employeeEdit)) {
      return NextResponse.json(
        { error: "Çalışan bilgisi düzenleme yetkiniz yok." },
        { status: 403 }
      )
    }

    if (body.permissions !== undefined && !hasPermission(identity, PERMISSIONS.employeePermissions)) {
      return NextResponse.json(
        { error: "Çalışan yetkisi düzenleme yetkiniz yok." },
        { status: 403 }
      )
    }

    if (body.fullName !== undefined) {
      const fullName = String(body.fullName).trim()
      if (!fullName) {
        return NextResponse.json({ error: "Ad Soyad zorunludur." }, { status: 400 })
      }
      updates.full_name = fullName
    }

    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase()
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Geçerli bir e-posta girin." }, { status: 400 })
      }
      updates.email = email
    }

    if (body.phone !== undefined) {
      updates.phone = String(body.phone).trim() || null
    }

    if (body.title !== undefined) {
      updates.title = String(body.title).trim() || null
    }

    if (body.calendarColor !== undefined) {
      const supportsCalendarColor = await appUsersSupportsCalendarColor(admin)
      if (!supportsCalendarColor) {
        return NextResponse.json(
          { error: "Takvim rengi icin veritabani migration'i henuz uygulanmamis." },
          { status: 400 }
        )
      }

      const calendarColor = normalizeCalendarColor(body.calendarColor)
      if (!calendarColor) {
        return NextResponse.json({ error: "GeÃ§erli bir renk girin." }, { status: 400 })
      }
      updates.calendar_color = calendarColor
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await admin
        .from("app_users")
        .update(updates)
        .eq("id", id)
        .eq("company_id", identity.companyId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      const authUpdates: Record<string, unknown> = {}
      if (updates.email) authUpdates.email = updates.email
      const authUserId = getValidAuthUserId(employee)
      if (updates.full_name && authUserId) {
        const { data: authUser } = await admin.auth.admin.getUserById(authUserId)
        authUpdates.user_metadata = {
          ...(authUser.user?.user_metadata ?? {}),
          full_name: updates.full_name,
        }
      }

      if (updates.email && !authUserId) {
        return NextResponse.json(
          { error: "E-posta değiştirmek için çalışanın geçerli bir Auth kullanıcısı olmalı." },
          { status: 400 }
        )
      }

      if (Object.keys(authUpdates).length > 0 && authUserId) {
        const { error: authUpdateError } = await admin.auth.admin.updateUserById(
          authUserId,
          authUpdates
        )

        if (authUpdateError) {
          return NextResponse.json({ error: authUpdateError.message }, { status: 500 })
        }
      }
    }

    if (body.permissions !== undefined) {
      const permissions = Array.isArray(body.permissions)
        ? body.permissions.map((item) => String(item)).filter(Boolean)
        : []
      const authUserId = getValidAuthUserId(employee)

      if (!authUserId) {
        return NextResponse.json(
          { error: "Yetki düzenlemek için çalışanın geçerli bir Auth kullanıcısı olmalı." },
          { status: 400 }
        )
      }

      const { data: authUser } = await admin.auth.admin.getUserById(authUserId)

      if (
        authUser.user?.app_metadata?.super_user === true ||
        authUser.user?.app_metadata?.role === "super_user"
      ) {
        return NextResponse.json(
          { error: "Super user yetkileri değiştirilemez." },
          { status: 400 }
        )
      }

      const { error: permissionError } = await admin.auth.admin.updateUserById(
        authUserId,
        {
          app_metadata: {
            ...(authUser.user?.app_metadata ?? {}),
            permissions,
          },
        }
      )

      if (permissionError) {
        return NextResponse.json({ error: permissionError.message }, { status: 500 })
      }
    }

    const { data: updatedEmployee, error: selectError } = await selectEmployeeWithOptionalColor(
      admin,
      id,
      identity.companyId
    )

    if (selectError || !updatedEmployee) {
      return NextResponse.json(
        { error: selectError?.message || "Çalışan okunamadı." },
        { status: 500 }
      )
    }

    const updatedAuthUserId = getValidAuthUserId(updatedEmployee)
    const { data: updatedAuthUserData } = updatedAuthUserId
      ? await admin.auth.admin.getUserById(updatedAuthUserId)
      : { data: { user: null } }
    const permissions = updatedAuthUserData.user?.app_metadata?.permissions

    return NextResponse.json({
      employee: {
        ...withResolvedCalendarColor(updatedEmployee),
        permissions: Array.isArray(permissions) ? permissions.map(String) : [],
        is_super_user:
          updatedAuthUserData.user?.app_metadata?.super_user === true ||
          updatedAuthUserData.user?.app_metadata?.role === "super_user",
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Çalışan güncellenemedi."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const identity = await getIdentity()

    if ("response" in identity) {
      return identity.response
    }

    if (!hasPermission(identity, PERMISSIONS.employeeDelete)) {
      return NextResponse.json(
        { error: "Çalışan silme yetkiniz yok." },
        { status: 403 }
      )
    }

    const { employee, admin } = await getEmployeeForCompany(id, identity.companyId)

    if (!employee) {
      return NextResponse.json({ error: "Çalışan bulunamadı." }, { status: 404 })
    }

    const authUserId = getValidAuthUserId(employee)

    if (!authUserId) {
      return NextResponse.json(
        { error: "Bu çalışan kaydına bağlı geçerli bir Auth kullanıcısı yok." },
        { status: 400 }
      )
    }

    if (authUserId === identity.authUserId) {
      return NextResponse.json(
        { error: "Kendi kullanıcı kaydınızı silemezsiniz." },
        { status: 400 }
      )
    }

    const { data: targetAuthUser, error: targetAuthError } =
      await admin.auth.admin.getUserById(authUserId)

    if (targetAuthError) {
      return NextResponse.json({ error: targetAuthError.message }, { status: 500 })
    }

    if (
      targetAuthUser.user?.app_metadata?.super_user === true ||
      targetAuthUser.user?.app_metadata?.role === "super_user"
    ) {
      return NextResponse.json(
        { error: "Super user silinemez." },
        { status: 400 }
      )
    }

    const { error: deleteAppUserError } = await admin
      .from("app_users")
      .delete()
      .eq("id", id)
      .eq("company_id", identity.companyId)

    if (deleteAppUserError) {
      return NextResponse.json({ error: deleteAppUserError.message }, { status: 500 })
    }

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(authUserId)

    if (deleteAuthError) {
      return NextResponse.json({ error: deleteAuthError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Çalışan silinemedi."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function getIdentity() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      response: NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 }),
    }
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .single()

  if (appUserError || !appUser?.company_id) {
    return {
      response: NextResponse.json(
        { error: appUserError?.message || "company_id bulunamadı." },
        { status: 400 }
      ),
    }
  }

  const { data: freshAuthUser, error: freshAuthUserError } =
    await admin.auth.admin.getUserById(user.id)

  if (freshAuthUserError || !freshAuthUser.user) {
    return {
      response: NextResponse.json(
        { error: freshAuthUserError?.message || "Kullanıcı yetkileri okunamadı." },
        { status: 500 }
      ),
    }
  }

  const appMetadata = freshAuthUser.user.app_metadata ?? {}

  return {
    authUserId: user.id,
    companyId: String(appUser.company_id),
    role: appMetadata.role,
    super_user: appMetadata.super_user,
    company_modules: Array.isArray(appMetadata.company_modules)
      ? appMetadata.company_modules.map(String)
      : undefined,
    company_active: appMetadata.company_active === false ? false : undefined,
    permissions: Array.isArray(appMetadata.permissions)
      ? appMetadata.permissions.map(String)
      : [],
  }
}

async function getEmployeeForCompany(id: string, companyId: string) {
  const admin = createAdminClient()
  const { data: employee } = await admin
    .from("app_users")
    .select("id, auth_user_id")
    .eq("id", id)
    .eq("company_id", companyId)
    .single()

  return { admin, employee }
}

function getValidAuthUserId(employee: { auth_user_id?: string | null } | null) {
  const authUserId = String(employee?.auth_user_id ?? "").trim()
  return isUuid(authUserId) ? authUserId : null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  )
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

async function selectEmployeeWithOptionalColor(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  companyId: string
) {
  const withColor = await admin
    .from("app_users")
    .select("id, auth_user_id, full_name, email, phone, title, calendar_color")
    .eq("id", id)
    .eq("company_id", companyId)
    .single()

  if (!hasMissingCalendarColorColumn(withColor.error)) {
    return withColor
  }

  return admin
    .from("app_users")
    .select("id, auth_user_id, full_name, email, phone, title")
    .eq("id", id)
    .eq("company_id", companyId)
    .single()
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
