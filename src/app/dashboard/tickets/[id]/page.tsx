import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import TicketStatusForm from "@/components/tickets/ticket-status-form";
import TicketCommentForm from "@/components/tickets/ticket-comment-form";
import TicketCommentDeleteButton from "@/components/tickets/ticket-comment-delete-button";
import TicketEditDialog from "@/components/tickets/ticket-edit-dialog";
import { getDashboardContext } from "@/lib/dashboard-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

type TicketStatus =
  | "new"
  | "assigned"
  | "investigating"
  | "waiting_offer"
  | "waiting_parts"
  | "in_progress"
  | "completed"
  | "cancelled";

type PageProps = {
  params: Promise<{ id: string }>;
};

function statusLabel(status: TicketStatus) {
  switch (status) {
    case "new":
      return "Yeni";
    case "assigned":
      return "Atandı";
    case "investigating":
      return "İnceleniyor";
    case "waiting_offer":
      return "Teklif Bekleniyor";
    case "waiting_parts":
      return "Parça Bekleniyor";
    case "in_progress":
      return "İşlemde";
    case "completed":
      return "Tamamlandı";
    case "cancelled":
      return "İptal Edildi";
    default:
      return status;
  }
}

function priorityLabel(priority: string | null) {
  switch (priority) {
    case "low":
      return "Düşük";
    case "medium":
      return "Orta";
    case "high":
      return "Yüksek";
    case "critical":
      return "Kritik";
    default:
      return "-";
  }
}

function statusBadgeClass(status: TicketStatus) {
  switch (status) {
    case "new":
      return "bg-blue-100 text-blue-700";
    case "assigned":
      return "bg-indigo-100 text-indigo-700";
    case "investigating":
      return "bg-amber-100 text-amber-700";
    case "waiting_offer":
      return "bg-orange-100 text-orange-700";
    case "waiting_parts":
      return "bg-yellow-100 text-yellow-700";
    case "in_progress":
      return "bg-sky-100 text-sky-700";
    case "completed":
      return "bg-emerald-100 text-emerald-700";
    case "cancelled":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

async function getPageData(ticketId: string) {
  const { supabase, user, appUser, identity } = await getDashboardContext();

  if (!user) {
    redirect("/login");
  }

  if (!appUser?.id || !appUser.company_id) {
    throw new Error("Uygulama kullanıcısı bulunamadı.");
  }

  const canEdit = hasPermission(identity, PERMISSIONS.ticketEdit);

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select(`
      id,
      ticket_no,
      title,
      description,
      status,
      priority,
      opened_at,
      created_at,
      updated_at,
      closed_at,
      customer_id,
      machine_id,
      customers(company_name, contact_name),
      machines(machine_name, serial_number),
      opened_by_user:app_users!tickets_opened_by_fkey(full_name),
      assigned_to_user:app_users!tickets_assigned_to_fkey(full_name)
    `)
    .eq("id", ticketId)
    .eq("company_id", appUser.company_id)
    .single();

  if (ticketError) {
    notFound();
  }

  const [commentsResult, historyResult, customersResult, machinesResult] = await Promise.all([
    supabase
      .from("ticket_comments")
      .select(`
        id,
        comment_text,
        is_internal,
        created_at,
        created_by,
        creator:app_users!ticket_comments_created_by_fkey(full_name)
      `)
      .eq("ticket_id", ticketId)
      .eq("company_id", appUser.company_id)
      .order("created_at", { ascending: false }),

    supabase
      .from("ticket_status_history")
      .select(`
        id,
        old_status,
        new_status,
        changed_at,
        note,
        changed_by,
        changer:app_users!ticket_status_history_changed_by_fkey(full_name)
      `)
      .eq("ticket_id", ticketId)
      .eq("company_id", appUser.company_id)
      .order("changed_at", { ascending: false }),

    canEdit
      ? supabase
          .from("customers")
          .select("id, company_name")
          .eq("company_id", appUser.company_id)
          .eq("is_active", true)
          .order("company_name", { ascending: true })
      : Promise.resolve({ data: [], error: null }),

    canEdit
      ? supabase
          .from("machines")
          .select("id, customer_id, machine_name, serial_number")
          .eq("company_id", appUser.company_id)
          .order("machine_name", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (commentsResult.error) {
    throw new Error(commentsResult.error.message);
  }

  if (historyResult.error) {
    throw new Error(historyResult.error.message);
  }

  if (customersResult.error) {
    throw new Error(customersResult.error.message);
  }

  if (machinesResult.error) {
    throw new Error(machinesResult.error.message);
  }

  return {
    appUser,
    permissionIdentity: identity,
    ticket,
    comments: commentsResult.data ?? [],
    history: historyResult.data ?? [],
    customers: customersResult.data ?? [],
    machines: machinesResult.data ?? [],
  };
}

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { appUser, permissionIdentity, ticket, comments, history, customers, machines } = await getPageData(id);
  const canEdit = hasPermission(permissionIdentity, PERMISSIONS.ticketEdit);
  const canUpdateStatus = canEdit;
  const canComment = canEdit;
  const latestStatusNote = history.find((item) => item.note?.trim())?.note?.trim() ?? null;

  const customer = Array.isArray(ticket.customers) ? ticket.customers[0] : ticket.customers;
  const machine = Array.isArray(ticket.machines) ? ticket.machines[0] : ticket.machines;
  const openedByUser = Array.isArray(ticket.opened_by_user) ? ticket.opened_by_user[0] : ticket.opened_by_user;
  const assignedToUser = Array.isArray(ticket.assigned_to_user) ? ticket.assigned_to_user[0] : ticket.assigned_to_user;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900" data-topbar-title>
            {ticket.ticket_no}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{ticket.title}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/tickets"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Geri
          </Link>

          {canEdit ? (
            <TicketEditDialog
              ticketId={ticket.id}
              initialTitle={ticket.title}
              initialDescription={ticket.description}
              initialPriority={ticket.priority}
              initialCustomerId={ticket.customer_id}
              initialMachineId={ticket.machine_id}
              customers={customers}
              machines={machines}
              canEdit={canEdit}
            />
          ) : null}
        </div>
      </div>

      {canUpdateStatus ? (
        <TicketStatusForm
          ticketId={ticket.id}
          changedBy={appUser.id}
          currentStatus={ticket.status}
          latestStatusNote={latestStatusNote}
          canUpdateStatus={canUpdateStatus}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(ticket.status)}`}>
                {statusLabel(ticket.status)}
              </span>
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {priorityLabel(ticket.priority)}
              </span>
            </div>

            <h2 className="mt-5 text-lg font-semibold text-slate-900">Ticket Bilgileri</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Müşteri</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{customer?.company_name ?? "-"}</div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Makine</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{machine?.machine_name ?? "-"}</div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Seri No</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{machine?.serial_number ?? "-"}</div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">İlgili Kişi</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{customer?.contact_name ?? "-"}</div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Açan Kullanıcı</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{openedByUser?.full_name ?? "-"}</div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Atanan Kullanıcı</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{assignedToUser?.full_name ?? "-"}</div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Açılış Tarihi</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {ticket.opened_at ? new Date(ticket.opened_at).toLocaleString("tr-TR") : "-"}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Son Güncelleme</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {ticket.updated_at ? new Date(ticket.updated_at).toLocaleString("tr-TR") : "-"}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="text-xs uppercase tracking-wide text-slate-500">Açıklama</div>
              <div className="mt-2 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {ticket.description ?? "-"}
              </div>
            </div>
          </div>

          {canComment ? (
            <TicketCommentForm
              ticketId={ticket.id}
              companyId={appUser.company_id}
              createdBy={appUser.id}
              canComment={canComment}
            />
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Durum Geçmişi</h2>

            <div className="mt-4 space-y-3">
              {history.length === 0 ? (
                <div className="text-sm text-slate-500">Geçmiş kayıt yok.</div>
              ) : (
                history.map((item) => {
                  const changer = Array.isArray(item.changer) ? item.changer[0] : item.changer;

                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{statusLabel(item.new_status)}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(item.changed_at).toLocaleString("tr-TR")}
                        </div>
                      </div>

                      <div className="mt-2 text-sm text-slate-600">Değiştiren: {changer?.full_name ?? "-"}</div>

                      {item.note ? <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.note}</div> : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Yorumlar</h2>

            <div className="mt-4 space-y-3">
              {comments.length === 0 ? (
                <div className="text-sm text-slate-500">Henüz yorum yok.</div>
              ) : (
                comments.map((comment) => {
                  const creator = Array.isArray(comment.creator) ? comment.creator[0] : comment.creator;

                  return (
                    <div key={comment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{creator?.full_name ?? "-"}</div>
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-slate-500">
                            {new Date(comment.created_at).toLocaleString("tr-TR")}
                          </div>
                          {comment.created_by === appUser.id ? (
                            <TicketCommentDeleteButton ticketId={ticket.id} commentId={comment.id} />
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{comment.comment_text}</div>

                      {comment.is_internal ? (
                        <div className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          İç Not
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
