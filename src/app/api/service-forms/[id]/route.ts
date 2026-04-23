import { NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await getServerIdentity(PERMISSIONS.serviceFormDelete);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;

  const { error: deleteValuesError } = await auth.supabase
    .from("service_form_field_values")
    .delete()
    .eq("service_form_id", id);

  if (deleteValuesError) {
    return NextResponse.json({ error: deleteValuesError.message }, { status: 500 });
  }

  const { error: deleteFormError } = await auth.supabase
    .from("service_forms")
    .delete()
    .eq("id", id)
    .eq("company_id", auth.identity.companyId);

  if (deleteFormError) {
    return NextResponse.json({ error: deleteFormError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
