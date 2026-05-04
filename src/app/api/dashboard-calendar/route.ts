import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getServerIdentity } from "@/lib/authz"
import { PERMISSIONS } from "@/lib/permissions"

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

async function attachCreatorMeta(
  supabase: SupabaseClient,
  companyId: string,
  events: Array<{
    id: string
    title: string
    note: string | null
    start_date: string
    end_date: string
    start_time: string | null
    end_time: string | null
    created_at: string
    updated_at: string
    created_by: string | null
  }>
) {
  const creatorIds = Array.from(
    new Set(events.map((event) => event.created_by).filter((value): value is string => Boolean(value)))
  )

  const creatorMap = new Map<string, { full_name: string | null; calendar_color: string | null }>()

  if (creatorIds.length > 0) {
    const creatorsResult = await selectCreatorsWithOptionalColor(supabase, companyId, creatorIds)

    for (const creator of creatorsResult.data ?? []) {
      creatorMap.set(String(creator.id), {
        full_name: creator.full_name ?? null,
        calendar_color: normalizeCalendarColor(
          "calendar_color" in creator ? creator.calendar_color : null
        ),
      })
    }
  }

  return events.map((event) => {
    const creator = event.created_by ? creatorMap.get(event.created_by) : null

    return {
      ...event,
      creator_name: creator?.full_name ?? null,
      creator_color:
        creator?.calendar_color ||
        deriveCalendarColor(String(event.created_by ?? event.id)),
    }
  })
}

async function selectCreatorsWithOptionalColor(
  supabase: SupabaseClient,
  companyId: string,
  creatorIds: string[]
) {
  const withColor = await supabase
    .from("app_users")
    .select("id, full_name, calendar_color")
    .eq("company_id", companyId)
    .in("id", creatorIds)

  if (!hasMissingCalendarColorColumn(withColor.error)) {
    return withColor
  }

  return supabase
    .from("app_users")
    .select("id, full_name")
    .eq("company_id", companyId)
    .in("id", creatorIds)
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

export async function GET(request: Request) {
  try {
    const auth = await getServerIdentity(PERMISSIONS.dashboard)
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const url = new URL(request.url)
    const start = toIsoDate(url.searchParams.get("start") || "")
    const end = toIsoDate(url.searchParams.get("end") || "")

    if (!start || !end) {
      return NextResponse.json({ error: "Geçerli tarih aralığı gerekli." }, { status: 400 })
    }

    const { data, error } = await auth.supabase
      .from("dashboard_calendar_events")
      .select("id, title, note, start_date, end_date, start_time, end_time, created_at, updated_at, created_by")
      .eq("company_id", auth.identity.companyId)
      .lte("start_date", end)
      .gte("end_date", start)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      events: await attachCreatorMeta(auth.supabase, auth.identity.companyId, data ?? []),
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Takvim verisi alınamadı." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getServerIdentity(PERMISSIONS.dashboardCalendarManage)
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
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

    const { data, error } = await auth.supabase
      .from("dashboard_calendar_events")
      .insert({
        company_id: auth.identity.companyId,
        title,
        note: note || null,
        start_date: startDate,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime,
        created_by: auth.identity.appUserId,
      })
      .select("id, title, note, start_date, end_date, start_time, end_time, created_at, updated_at, created_by")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const [event] = await attachCreatorMeta(auth.supabase, auth.identity.companyId, [data])
    return NextResponse.json({ event })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Takvim kaydı eklenemedi." },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getServerIdentity(PERMISSIONS.dashboardCalendarManage)
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
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

    const { data, error } = await auth.supabase
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
      .eq("company_id", auth.identity.companyId)
      .select("id, title, note, start_date, end_date, start_time, end_time, created_at, updated_at, created_by")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const [event] = await attachCreatorMeta(auth.supabase, auth.identity.companyId, [data])
    return NextResponse.json({ event })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Etkinlik güncellenemedi." },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getServerIdentity(PERMISSIONS.dashboardCalendarManage)
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const url = new URL(request.url)
    const id = String(url.searchParams.get("id") ?? "").trim()

    if (!id) {
      return NextResponse.json({ error: "Etkinlik id zorunludur." }, { status: 400 })
    }

    const { error } = await auth.supabase
      .from("dashboard_calendar_events")
      .delete()
      .eq("id", id)
      .eq("company_id", auth.identity.companyId)

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
