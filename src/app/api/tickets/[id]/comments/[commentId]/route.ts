import { NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/authz";
import { localizeErrorMessage } from "@/lib/error-messages";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  const auth = await getServerIdentity(PERMISSIONS.tickets);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, commentId } = await context.params;

  const { data: comment, error: commentError } = await auth.supabase
    .from("ticket_comments")
    .select("id, created_by")
    .eq("id", commentId)
    .eq("ticket_id", id)
    .eq("company_id", auth.identity.companyId)
    .single();

  if (commentError || !comment) {
    return NextResponse.json({ error: "Yorum bulunamadı." }, { status: 404 });
  }

  const canDelete =
    comment.created_by === auth.identity.appUserId || hasPermission(auth.identity, PERMISSIONS.ticketDelete);

  if (!canDelete) {
    return NextResponse.json({ error: "Bu yorumu silme yetkiniz yok." }, { status: 403 });
  }

  const { error } = await auth.supabase
    .from("ticket_comments")
    .delete()
    .eq("id", commentId)
    .eq("ticket_id", id)
    .eq("company_id", auth.identity.companyId);

  if (error) {
    return NextResponse.json({ error: localizeErrorMessage(error.message, "Yorum silinemedi.") }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
