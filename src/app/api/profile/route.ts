import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

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

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("app_users")
      .select("id, auth_user_id, full_name, email, phone, title, avatar_url, avatar_scale, avatar_offset_x, avatar_offset_y")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({
      profile: {
        fullName: profile?.full_name ?? user.user_metadata?.full_name ?? "",
        email: profile?.email ?? user.email ?? "",
        phone: profile?.phone ?? "",
        title: profile?.title ?? "",
        avatarUrl: profile?.avatar_url ?? "",
        avatarScale: Number(profile?.avatar_scale ?? 1),
        avatarOffsetX: Number(profile?.avatar_offset_x ?? 50),
        avatarOffsetY: Number(profile?.avatar_offset_y ?? 50),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Profil bilgileri alınamadı." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
    }

    const body = await request.json()
    const fullName = String(body?.fullName ?? "").trim()
    const email = String(body?.email ?? "").trim()
    const phone = String(body?.phone ?? "").trim()
    const title = String(body?.title ?? "").trim()
    const avatarUrl = String(body?.avatarUrl ?? "").trim()

    const parsedScale = Number(body?.avatarScale ?? 1)
    const parsedOffsetX = Number(body?.avatarOffsetX ?? 50)
    const parsedOffsetY = Number(body?.avatarOffsetY ?? 50)

    const avatarScale = Number.isFinite(parsedScale)
      ? Math.min(3, Math.max(1, parsedScale))
      : 1

    const avatarOffsetX = Number.isFinite(parsedOffsetX)
      ? Math.min(100, Math.max(0, parsedOffsetX))
      : 50

    const avatarOffsetY = Number.isFinite(parsedOffsetY)
      ? Math.min(100, Math.max(0, parsedOffsetY))
      : 50

    if (!fullName) {
      return NextResponse.json({ error: "Ad Soyad zorunludur." }, { status: 400 })
    }

    const { data: existingUser, error: existingUserError } = await supabase
      .from("app_users")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    if (existingUserError) {
      return NextResponse.json({ error: existingUserError.message }, { status: 500 })
    }

    if (!existingUser) {
      return NextResponse.json(
        { error: "Bu kullanıcı için app_users kaydı bulunamadı." },
        { status: 404 }
      )
    }

    const { error: updateError } = await supabase
      .from("app_users")
      .update({
        full_name: fullName,
        email: email || null,
        phone: phone || null,
        title: title || null,
        avatar_url: avatarUrl || null,
        avatar_scale: avatarScale,
        avatar_offset_x: avatarOffsetX,
        avatar_offset_y: avatarOffsetY,
        updated_at: new Date().toISOString(),
      })
      .eq("auth_user_id", user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Profil güncellenemedi." },
      { status: 500 }
    )
  }
}