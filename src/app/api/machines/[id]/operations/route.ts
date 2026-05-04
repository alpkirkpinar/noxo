import { NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/authz";
import { normalizeDateOnly } from "@/lib/machines";
import { PERMISSIONS } from "@/lib/permissions";
import { isMissingRelationError } from "@/lib/supabase-errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const OPERATION_TYPES = new Set(["Tamir", "Parca Degisimi", "Ayar", "Kontrol", "Diger"]);

export async function POST(request: Request, context: RouteContext) {
  const auth = await getServerIdentity(PERMISSIONS.machineEdit);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  const performedAt =
    normalizeDateOnly(String(body?.performed_at ?? "").trim()) ?? new Date().toISOString().slice(0, 10);
  const operationTypeRaw = String(body?.operation_type ?? "").trim();
  const operationType = OPERATION_TYPES.has(operationTypeRaw) ? operationTypeRaw : "Diger";
  const note = String(body?.note ?? "").trim();

  if (!note) {
    return NextResponse.json({ error: "Islem notu zorunludur." }, { status: 400 });
  }

  const { data: machine, error: machineError } = await auth.supabase
    .from("machines")
    .select("id")
    .eq("id", id)
    .eq("company_id", auth.identity.companyId)
    .single();

  if (machineError || !machine) {
    return NextResponse.json({ error: "Makine bulunamadi." }, { status: 404 });
  }

  const { error } = await auth.supabase.from("machine_maintenance_records").insert({
    company_id: auth.identity.companyId,
    machine_id: id,
    performed_by: auth.identity.appUserId,
    performed_at: performedAt,
    next_maintenance_date: null,
    maintenance_notes: `Islem: ${operationType}\n${note}`,
    maintenance_scope_items: [],
  });

  if (error) {
    if (isMissingRelationError(error.message, "machine_maintenance_records")) {
      return NextResponse.json(
        { error: "Gecmis kayit tablosu henuz olusturulmamis. Supabase migration calistirilmali." },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
