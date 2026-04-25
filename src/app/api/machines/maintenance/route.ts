import { NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/authz";
import { addDaysToDate, normalizeDateOnly } from "@/lib/machines";
import { normalizeMaintenanceScopeItems } from "@/lib/maintenance-options";
import { PERMISSIONS } from "@/lib/permissions";
import { isMissingRelationError } from "@/lib/supabase-errors";

export async function POST(request: Request) {
  const auth = await getServerIdentity(PERMISSIONS.machineEdit);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const ids = Array.isArray(body?.ids) ? body.ids.map((id) => String(id).trim()).filter(Boolean) : [];
  const performedAt =
    normalizeDateOnly(String(body?.performed_at ?? "").trim()) ?? new Date().toISOString().slice(0, 10);
  const maintenanceScopeItems = normalizeMaintenanceScopeItems(body?.maintenance_scope_items);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Bakim icin makine secilmedi." }, { status: 400 });
  }

  const { data: machines, error: fetchError } = await auth.supabase
    .from("machines")
    .select("id, maintenance_period_days")
    .eq("company_id", auth.identity.companyId)
    .in("id", ids);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  for (const machine of machines ?? []) {
    const periodDays = Number(machine.maintenance_period_days ?? 0);
    const nextMaintenanceDate = periodDays > 0 ? addDaysToDate(performedAt, periodDays) : null;

    const { error: updateError } = await auth.supabase
      .from("machines")
      .update({
        last_maintenance_date: performedAt,
        next_maintenance_date: nextMaintenanceDate,
      })
      .eq("id", machine.id)
      .eq("company_id", auth.identity.companyId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { error: insertError } = await auth.supabase.from("machine_maintenance_records").insert({
      company_id: auth.identity.companyId,
      machine_id: machine.id,
      performed_by: auth.identity.appUserId,
      performed_at: performedAt,
      next_maintenance_date: nextMaintenanceDate,
      maintenance_notes: null,
      maintenance_scope_items: maintenanceScopeItems,
    });

    if (insertError) {
      if (isMissingRelationError(insertError.message, "machine_maintenance_records")) {
        return NextResponse.json(
          { error: "Bakım kayıt tablosu henüz oluşturulmamış. Supabase migration çalıştırılmalı." },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    updated: machines?.length ?? 0,
    performed_at: performedAt,
  });
}
