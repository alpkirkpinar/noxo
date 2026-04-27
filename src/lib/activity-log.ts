import type { createAdminClient } from "@/lib/supabase/admin"

type AdminClient = ReturnType<typeof createAdminClient>

type ActivityLogInput = {
  companyId: string
  userId: string | null
  moduleName: string
  actionName: string
  recordType: string
  recordId: string
  detail?: Record<string, unknown> | null
}

export async function writeActivityLog(admin: AdminClient, input: ActivityLogInput) {
  await admin.from("activity_logs").insert({
    company_id: input.companyId,
    user_id: input.userId,
    module_name: input.moduleName,
    action_name: input.actionName,
    record_type: input.recordType,
    record_id: input.recordId,
    detail: input.detail ? JSON.stringify(input.detail) : null,
  })
}

export async function writeActivityLogSafe(admin: AdminClient, input: ActivityLogInput) {
  try {
    await writeActivityLog(admin, input)
  } catch {
    // Log write failures should not block the primary action.
  }
}
