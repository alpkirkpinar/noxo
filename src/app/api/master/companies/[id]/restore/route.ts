import { NextResponse } from "next/server"
import { writeActivityLogSafe } from "@/lib/activity-log"
import { localizeErrorMessage } from "@/lib/error-messages"
import { isMasterUser } from "@/lib/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await getMasterAuth()
  if ("response" in auth) return auth.response

  const { id: companyId } = await context.params
  
  try {
    const backupData = await request.json()

    // Güvenlik kontrolü: Yedek dosyasındaki company_id ile hedef company_id eşleşmeli
    if (backupData.company_id !== companyId) {
      return NextResponse.json(
        { error: "Yedek dosyasi bu firmaya ait degil. (ID uyusmazligi)" },
        { status: 400 }
      )
    }

    const admin = auth.admin

    // Verileri sırayla geri yükleme (İlişki sırasına göre)
    // 1. Temel Bilgiler
    if (backupData.system_settings) {
      await admin.from("system_settings").upsert(backupData.system_settings)
    }

    // 2. Kullanıcılar ve Müşteriler
    if (backupData.app_users?.length > 0) {
      await admin.from("app_users").upsert(backupData.app_users)
    }
    if (backupData.customers?.length > 0) {
      await admin.from("customers").upsert(backupData.customers)
    }

    // 3. Envanter
    if (backupData.inventory_items?.length > 0) {
      await admin.from("inventory_items").upsert(backupData.inventory_items)
    }
    if (backupData.inventory_movements?.length > 0) {
      await admin.from("inventory_movements").upsert(backupData.inventory_movements)
    }

    // 4. Makineler ve Bakımlar
    if (backupData.machines?.length > 0) {
      await admin.from("machines").upsert(backupData.machines)
    }
    if (backupData.machine_maintenance_records?.length > 0) {
      await admin.from("machine_maintenance_records").upsert(backupData.machine_maintenance_records)
    }

    // 5. Biletler ve Yorumlar
    if (backupData.tickets?.length > 0) {
      await admin.from("tickets").upsert(backupData.tickets)
    }
    if (backupData.ticket_status_history?.length > 0) {
      await admin.from("ticket_status_history").upsert(backupData.ticket_status_history)
    }
    if (backupData.ticket_comments?.length > 0) {
      await admin.from("ticket_comments").upsert(backupData.ticket_comments)
    }

    // 6. Servis Formları ve Teklifler
    if (backupData.pdf_templates?.length > 0) {
      await admin.from("pdf_templates").upsert(backupData.pdf_templates)
    }
    if (backupData.pdf_template_fields?.length > 0) {
      await admin.from("pdf_template_fields").upsert(backupData.pdf_template_fields)
    }
    if (backupData.service_forms?.length > 0) {
      await admin.from("service_forms").upsert(backupData.service_forms)
    }
    if (backupData.service_form_field_values?.length > 0) {
      await admin.from("service_form_field_values").upsert(backupData.service_form_field_values)
    }
    if (backupData.offers?.length > 0) {
      await admin.from("offers").upsert(backupData.offers)
    }
    if (backupData.offer_items?.length > 0) {
      await admin.from("offer_items").upsert(backupData.offer_items)
    }

    // 7. Diğerleri
    if (backupData.dashboard_calendar_events?.length > 0) {
      await admin.from("dashboard_calendar_events").upsert(backupData.dashboard_calendar_events)
    }
    if (backupData.activity_logs?.length > 0) {
      await admin.from("activity_logs").upsert(backupData.activity_logs)
    }

    await writeActivityLogSafe(admin, {
      companyId,
      userId: auth.appUserId,
      moduleName: "master",
      actionName: "company_backup_restored",
      recordType: "company_backup",
      recordId: companyId,
      detail: {
        message: "Yerel dosyadan geri yukleme yapildi.",
        version: backupData.version,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Restore error:", error)
    return NextResponse.json(
      { error: "Geri yukleme sirasinda bir hata olustu." },
      { status: 500 }
    )
  }
}

async function getMasterAuth() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 }) }

  const { data: freshUser } = await admin.auth.admin.getUserById(user.id)
  if (!isMasterUser({ role: freshUser.user?.app_metadata?.role })) {
    return { response: NextResponse.json({ error: "Master yetkisi gerekli." }, { status: 403 }) }
  }

  const { data: appUser } = await admin.from("app_users").select("id").eq("auth_user_id", user.id).maybeSingle()
  return { admin, appUserId: appUser?.id ? String(appUser.id) : null }
}
