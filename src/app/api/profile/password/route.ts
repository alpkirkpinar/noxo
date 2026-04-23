import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "Kullanıcının e-posta bilgisi bulunamadı." },
        { status: 400 }
      )
    }

    const body = await request.json()
    const currentPassword = String(body?.currentPassword ?? "")
    const newPassword = String(body?.newPassword ?? "")
    const confirmPassword = String(body?.confirmPassword ?? "")

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Eski şifre, yeni şifre ve şifre tekrarı zorunludur." },
        { status: 400 }
      )
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Yeni şifre ve şifre tekrarı eşleşmiyor." },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Yeni şifre en az 6 karakter olmalıdır." },
        { status: 400 }
      )
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInError) {
      return NextResponse.json(
        { error: "Eski şifre doğru değil." },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
      data: {
        ...user.user_metadata,
        must_change_password: false,
      },
    })

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Şifre güncellenemedi."

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
