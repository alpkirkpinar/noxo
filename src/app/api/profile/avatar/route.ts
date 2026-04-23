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

function sanitizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 })
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Sadece JPG, PNG veya WEBP yükleyebilirsiniz." },
        { status: 400 }
      )
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Dosya boyutu 5 MB'tan büyük olamaz." },
        { status: 400 }
      )
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg"
    const safeName = sanitizeFileName(file.name || `avatar.${ext}`)
    const filePath = `${user.id}/${Date.now()}-${safeName}`

    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from("profile-avatars")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: publicUrlData } = supabase.storage
      .from("profile-avatars")
      .getPublicUrl(filePath)

    const avatarUrl = publicUrlData.publicUrl

    const { error: updateError } = await supabase
      .from("app_users")
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("auth_user_id", user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      avatarUrl,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Fotoğraf yüklenemedi." },
      { status: 500 }
    )
  }
}