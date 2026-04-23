import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

type EmployeePayload = {
  fullName?: string
  email?: string
  phone?: string
  title?: string
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
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
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
      return NextResponse.json({ error: "Çalışan oluşturma yetkiniz yok." }, { status: 403 })
    }

    const { data: currentAppUser, error: appUserError } = await supabase
      .from("app_users")
      .select("company_id")
      .eq("auth_user_id", user.id)
      .single()

    if (appUserError || !currentAppUser?.company_id) {
      return NextResponse.json(
        { error: appUserError?.message || "company_id bulunamadı." },
        { status: 400 }
      )
    }

    const body = (await request.json()) as EmployeePayload
    const fullName = String(body?.fullName ?? "").trim()
    const email = String(body?.email ?? "").trim().toLowerCase()
    const phone = String(body?.phone ?? "").trim()
    const title = String(body?.title ?? "").trim()

    if (!fullName) {
      return NextResponse.json({ error: "Ad Soyad zorunludur." }, { status: 400 })
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Geçerli bir e-posta girin." }, { status: 400 })
    }

    const admin = createAdminClient()
    const password = generateInitialPassword()
    const username = await generateUniqueUsername(admin, email)

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
        { error: createAuthError?.message || "Auth kullanıcısı oluşturulamadı." },
        { status: 500 }
      )
    }

    createdAuthUserId = authData.user.id

    const { data: employee, error: insertError } = await admin
      .from("app_users")
      .insert({
        auth_user_id: createdAuthUserId,
        company_id: currentAppUser.company_id,
        username,
        full_name: fullName,
        email,
        phone: phone || null,
        title: title || null,
      })
      .select("id, auth_user_id, full_name, email, phone, title")
      .single()

    if (insertError || !employee) {
      await admin.auth.admin.deleteUser(createdAuthUserId)

      return NextResponse.json(
        { error: insertError?.message || "Çalışan kaydı oluşturulamadı." },
        { status: 500 }
      )
    }

    return NextResponse.json({ employee, initialPassword: password }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Çalışan oluşturulamadı."
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
