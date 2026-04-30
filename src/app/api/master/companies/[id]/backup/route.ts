import { NextResponse } from "next/server"
import { writeActivityLogSafe } from "@/lib/activity-log"
import { localizeErrorMessage } from "@/lib/error-messages"
import { uploadJsonBackupToGoogleDrive } from "@/lib/google-drive"
import { isMasterUser } from "@/lib/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ id: string }>
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function POST(_request: Request, context: RouteContext) {
  const auth = await getMasterAuth()
  if ("response" in auth) return auth.response

  const { id: companyId } = await context.params

  try {
    const [
      companyResult,
      settingsResult,
      appUsersResult,
      customersResult,
      machinesResult,
      ticketsResult,
      serviceFormsResult,
      offersResult,
      inventoryItemsResult,
      inventoryMovementsResult,
      calendarEventsResult,
      logsResult,
      templatesResult,
    ] = await Promise.all([
      auth.admin.from("companies").select("*").eq("id", companyId).maybeSingle(),
      auth.admin.from("system_settings").select("*").eq("company_id", companyId).maybeSingle(),
      auth.admin.from("app_users").select("*").eq("company_id", companyId).order("created_at", { ascending: true }),
      auth.admin.from("customers").select("*").eq("company_id", companyId).order("created_at", { ascending: true }),
      auth.admin.from("machines").select("*").eq("company_id", companyId).order("created_at", { ascending: true }),
      auth.admin.from("tickets").select("*").eq("company_id", companyId).order("created_at", { ascending: true }),
      auth.admin.from("service_forms").select("*").eq("company_id", companyId).order("created_at", { ascending: true }),
      auth.admin.from("offers").select("*").eq("company_id", companyId).order("created_at", { ascending: true }),
      auth.admin.from("inventory_items").select("*").eq("company_id", companyId).order("created_at", { ascending: true }),
      auth.admin.from("inventory_movements").select("*").eq("company_id", companyId).order("created_at", { ascending: true }),
      auth.admin.from("dashboard_calendar_events").select("*").eq("company_id", companyId).order("created_at", { ascending: true }),
      auth.admin.from("activity_logs").select("*").eq("company_id", companyId).order("created_at", { ascending: true }),
      auth.admin.from("pdf_templates").select("*").eq("company_id", companyId).order("created_at", { ascending: true }),
    ])

    for (const result of [
      companyResult,
      settingsResult,
      appUsersResult,
      customersResult,
      machinesResult,
      ticketsResult,
      serviceFormsResult,
      offersResult,
      inventoryItemsResult,
      inventoryMovementsResult,
      calendarEventsResult,
      logsResult,
      templatesResult,
    ]) {
      if (result.error) {
        return NextResponse.json(
          { error: localizeErrorMessage(result.error.message, "Firma yedegi icin veriler okunamadi.") },
          { status: 500 }
        )
      }
    }

    if (!companyResult.data && !settingsResult.data) {
      return NextResponse.json({ error: "Firma bulunamadi." }, { status: 404 })
    }

    const machineIds = (machinesResult.data ?? []).map((machine) => String(machine.id))
    const ticketIds = (ticketsResult.data ?? []).map((ticket) => String(ticket.id))
    const serviceFormIds = (serviceFormsResult.data ?? []).map((form) => String(form.id))
    const offerIds = (offersResult.data ?? []).map((offer) => String(offer.id))
    const templateIds = (templatesResult.data ?? []).map((template) => String(template.id))
    const authUserIds = (appUsersResult.data ?? [])
      .map((user) => (user.auth_user_id ? String(user.auth_user_id) : ""))
      .filter(Boolean)

    const [
      maintenanceResult,
      ticketHistoryResult,
      ticketCommentsResult,
      serviceFormFieldValuesResult,
      offerItemsResult,
      templateFieldsResult,
      authUsers,
    ] = await Promise.all([
      machineIds.length > 0
        ? auth.admin.from("machine_maintenance_records").select("*").eq("company_id", companyId).in("machine_id", machineIds)
        : Promise.resolve({ data: [], error: null }),
      ticketIds.length > 0
        ? auth.admin.from("ticket_status_history").select("*").eq("company_id", companyId).in("ticket_id", ticketIds)
        : Promise.resolve({ data: [], error: null }),
      ticketIds.length > 0
        ? auth.admin.from("ticket_comments").select("*").eq("company_id", companyId).in("ticket_id", ticketIds)
        : Promise.resolve({ data: [], error: null }),
      serviceFormIds.length > 0
        ? auth.admin.from("service_form_field_values").select("*").in("service_form_id", serviceFormIds)
        : Promise.resolve({ data: [], error: null }),
      offerIds.length > 0
        ? auth.admin.from("offer_items").select("*").in("offer_id", offerIds)
        : Promise.resolve({ data: [], error: null }),
      templateIds.length > 0
        ? auth.admin.from("pdf_template_fields").select("*").in("template_id", templateIds)
        : Promise.resolve({ data: [], error: null }),
      getAuthUsersSnapshot(auth.admin, authUserIds),
    ])

    for (const result of [
      maintenanceResult,
      ticketHistoryResult,
      ticketCommentsResult,
      serviceFormFieldValuesResult,
      offerItemsResult,
      templateFieldsResult,
    ]) {
      if (result.error) {
        return NextResponse.json(
          { error: localizeErrorMessage(result.error.message, "Firma yedegi icin iliskili veriler okunamadi.") },
          { status: 500 }
        )
      }
    }

    const companyName = String(
      settingsResult.data?.company_name ??
        companyResult.data?.name ??
        companyResult.data?.company_name ??
        "firma"
    ).trim()

    const backupPayload = {
      version: 1,
      backup_type: "company_full_backup",
      exported_at: new Date().toISOString(),
      company_id: companyId,
      exported_by_app_user_id: auth.appUserId,
      company: companyResult.data ?? null,
      system_settings: settingsResult.data ?? null,
      app_users: appUsersResult.data ?? [],
      auth_users: authUsers,
      customers: customersResult.data ?? [],
      machines: machinesResult.data ?? [],
      machine_maintenance_records: maintenanceResult.data ?? [],
      tickets: ticketsResult.data ?? [],
      ticket_status_history: ticketHistoryResult.data ?? [],
      ticket_comments: ticketCommentsResult.data ?? [],
      service_forms: serviceFormsResult.data ?? [],
      service_form_field_values: serviceFormFieldValuesResult.data ?? [],
      offers: offersResult.data ?? [],
      offer_items: offerItemsResult.data ?? [],
      inventory_items: inventoryItemsResult.data ?? [],
      inventory_movements: inventoryMovementsResult.data ?? [],
      dashboard_calendar_events: calendarEventsResult.data ?? [],
      pdf_templates: templatesResult.data ?? [],
      pdf_template_fields: templateFieldsResult.data ?? [],
      activity_logs: logsResult.data ?? [],
    }

    const backupFileName = `${new Date().toISOString().slice(0, 10)}-${slugify(companyName) || "firma"}-${companyId}.noxo-company-backup.json`
    const upload = await uploadJsonBackupToGoogleDrive(backupFileName, backupPayload)

    await writeActivityLogSafe(auth.admin, {
      companyId,
      userId: auth.appUserId,
      moduleName: "master",
      actionName: "company_backup_uploaded",
      recordType: "company_backup",
      recordId: companyId,
      detail: {
        companyName,
        fileName: backupFileName,
        driveFileId: upload.id,
      },
    })

    return NextResponse.json({ success: true, fileId: upload.id, webViewLink: upload.webViewLink ?? null })
  } catch (error) {
    return NextResponse.json(
      {
        error: localizeErrorMessage(
          error instanceof Error ? error.message : null,
          "Firma yedegi olusturulamadi."
        ),
      },
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
    return { response: NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 }) }
  }

  const { data: freshUser, error: freshUserError } = await admin.auth.admin.getUserById(user.id)

  if (freshUserError || !freshUser.user) {
    return {
      response: NextResponse.json(
        { error: localizeErrorMessage(freshUserError?.message, "Kullanici yetkileri okunamadi.") },
        { status: 500 }
      ),
    }
  }

  if (!isMasterUser({ role: freshUser.user.app_metadata?.role, email: freshUser.user.email ?? user.email ?? null })) {
    return { response: NextResponse.json({ error: "Master yetkisi gerekli." }, { status: 403 }) }
  }

  const { data: appUser } = await admin.from("app_users").select("id").eq("auth_user_id", user.id).maybeSingle()

  return { admin, appUserId: appUser?.id ? String(appUser.id) : null }
}

async function getAuthUsersSnapshot(admin: ReturnType<typeof createAdminClient>, authUserIds: string[]) {
  const snapshots = []

  for (const authUserId of authUserIds) {
    const { data, error } = await admin.auth.admin.getUserById(authUserId)
    if (error || !data.user) continue

    snapshots.push({
      id: data.user.id,
      email: data.user.email ?? null,
      phone: data.user.phone ?? null,
      created_at: data.user.created_at ?? null,
      updated_at: data.user.updated_at ?? null,
      last_sign_in_at: data.user.last_sign_in_at ?? null,
      user_metadata: data.user.user_metadata ?? {},
      app_metadata: data.user.app_metadata ?? {},
    })
  }

  return snapshots
}
