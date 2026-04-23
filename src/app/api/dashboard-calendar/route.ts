import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { getServerIdentity } from "@/lib/authz"
import { PERMISSIONS } from "@/lib/permissions"

async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {}
        },
      },
    }
  )
}

function toIsoDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function normalizeTime(value: unknown) {
  const text = String(value ?? "").trim()
  if (!text) return null
  if (!/^\d{2}:\d{2}$/.test(text)) return null
  return text
}

async function getCurrentAppUser(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Oturum bulunamadı.", status: 401 as const, user: null, appUser: null }
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("id, company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (appUserError || !appUser?.company_id) {
    return {
      error: "Kullanıcı şirket bilgisi bulunamadı.",
      status: 400 as const,
      user,
      appUser: null,
    }
  }

  return { error: null, status: 200 as const, user, appUser }
}

export async function GET(request: Request) {
  try {
    const permission = await getServerIdentity(PERMISSIONS.dashboard)
    if ("error" in permission) {
      return NextResponse.json({ error: permission.error }, { status: permission.status })
    }

    const supabase = await createSupabaseServerClient()
    const identity = await getCurrentAppUser(supabase)

    if (identity.error || !identity.appUser) {
      return NextResponse.json({ error: identity.error }, { status: identity.status })
    }

    const url = new URL(request.url)
    const start = toIsoDate(url.searchParams.get("start") || "")
    const end = toIsoDate(url.searchParams.get("end") || "")

    if (!start || !end) {
      return NextResponse.json({ error: "Geçerli tarih aralığı gerekli." }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("dashboard_calendar_events")
      .select("id, title, note, start_date, end_date, start_time, end_time, created_at, updated_at")
      .eq("company_id", identity.appUser.company_id)
      .lte("start_date", end)
      .gte("end_date", start)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ events: data ?? [] })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Takvim verisi alınamadı." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const permission = await getServerIdentity(PERMISSIONS.dashboardCalendarManage)
    if ("error" in permission) {
      return NextResponse.json({ error: permission.error }, { status: permission.status })
    }

    const supabase = await createSupabaseServerClient()
    const identity = await getCurrentAppUser(supabase)

    if (identity.error || !identity.appUser) {
      return NextResponse.json({ error: identity.error }, { status: identity.status })
    }

    const body = await request.json()

    const title = String(body?.title ?? "").trim() || "Etkinlik"
    const note = String(body?.note ?? "").trim()
    const startDate = toIsoDate(body?.startDate ?? "")
    const endDate = toIsoDate(body?.endDate ?? "") || startDate
    const startTime = normalizeTime(body?.startTime)
    const endTime = normalizeTime(body?.endTime)

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Başlangıç ve bitiş tarihi zorunludur." }, { status: 400 })
    }

    if (startDate > endDate) {
      return NextResponse.json({ error: "Başlangıç tarihi bitiş tarihinden büyük olamaz." }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("dashboard_calendar_events")
      .insert({
        company_id: identity.appUser.company_id,
        title,
        note: note || null,
        start_date: startDate,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime,
        created_by: identity.appUser.id,
      })
      .select("id, title, note, start_date, end_date, start_time, end_time, created_at, updated_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ event: data })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Takvim kaydı eklenemedi." },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const permission = await getServerIdentity(PERMISSIONS.dashboardCalendarManage)
    if ("error" in permission) {
      return NextResponse.json({ error: permission.error }, { status: permission.status })
    }

    const supabase = await createSupabaseServerClient()
    const identity = await getCurrentAppUser(supabase)

    if (identity.error || !identity.appUser) {
      return NextResponse.json({ error: identity.error }, { status: identity.status })
    }

    const body = await request.json()

    const id = String(body?.id ?? "").trim()
    const title = String(body?.title ?? "").trim() || "Etkinlik"
    const note = String(body?.note ?? "").trim()
    const startDate = toIsoDate(body?.startDate ?? "")
    const endDate = toIsoDate(body?.endDate ?? "") || startDate
    const startTime = normalizeTime(body?.startTime)
    const endTime = normalizeTime(body?.endTime)

    if (!id) {
      return NextResponse.json({ error: "Etkinlik id zorunludur." }, { status: 400 })
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Başlangıç ve bitiş tarihi zorunludur." }, { status: 400 })
    }

    if (startDate > endDate) {
      return NextResponse.json({ error: "Başlangıç tarihi bitiş tarihinden büyük olamaz." }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("dashboard_calendar_events")
      .update({
        title,
        note: note || null,
        start_date: startDate,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("company_id", identity.appUser.company_id)
      .select("id, title, note, start_date, end_date, start_time, end_time, created_at, updated_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ event: data })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Etkinlik güncellenemedi." },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const permission = await getServerIdentity(PERMISSIONS.dashboardCalendarManage)
    if ("error" in permission) {
      return NextResponse.json({ error: permission.error }, { status: permission.status })
    }

    const supabase = await createSupabaseServerClient()
    const identity = await getCurrentAppUser(supabase)

    if (identity.error || !identity.appUser) {
      return NextResponse.json({ error: identity.error }, { status: identity.status })
    }

    const url = new URL(request.url)
    const id = String(url.searchParams.get("id") ?? "").trim()

    if (!id) {
      return NextResponse.json({ error: "Etkinlik id zorunludur." }, { status: 400 })
    }

    const { error } = await supabase
      .from("dashboard_calendar_events")
      .delete()
      .eq("id", id)
      .eq("company_id", identity.appUser.company_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Etkinlik silinemedi." },
      { status: 500 }
    )
  }
}
