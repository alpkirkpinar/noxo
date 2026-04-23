"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NewTicketForm from "@/components/tickets/new-ticket-form";
import CompactFilterActionBar from "@/components/ui/compact-filter-action-bar";

type TicketStatus =
  | "new"
  | "assigned"
  | "investigating"
  | "waiting_offer"
  | "waiting_parts"
  | "in_progress"
  | "completed"
  | "cancelled";

type TicketPriority = "low" | "medium" | "high" | "critical" | null;

type TicketRow = {
  id: string;
  ticket_no: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  status_changed_at: string;
  customer_name: string | null;
  machine_name: string | null;
  status_note: string | null;
};

type CustomerItem = {
  id: string;
  company_name: string;
};

type MachineItem = {
  id: string;
  customer_id: string;
  machine_name: string;
  machine_code: string;
};

type EmployeeItem = {
  id: string;
  full_name: string;
};

type Props = {
  companyId: string;
  openedBy: string;
  customers: CustomerItem[];
  machines: MachineItem[];
  employees: EmployeeItem[];
  initialTickets: TicketRow[];
  permissions: {
    canCreate: boolean;
    canDelete: boolean;
    canUpdateStatus: boolean;
  };
};

type SortKey =
  | "ticket_no"
  | "title"
  | "customer_name"
  | "machine_name"
  | "status"
  | "priority"
  | "created_at"
  | "status_changed_at";

type SortDirection = "asc" | "desc";

type ContextMenuState = {
  x: number;
  y: number;
  ticketId: string;
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

function priorityLabel(priority: TicketPriority) {
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
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "assigned":
      return "bg-indigo-50 text-indigo-700 ring-indigo-200";
    case "investigating":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "waiting_offer":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "waiting_parts":
      return "bg-yellow-50 text-yellow-700 ring-yellow-200";
    case "in_progress":
      return "bg-sky-50 text-sky-700 ring-sky-200";
    case "completed":
      return "bg-green-50 text-green-700 ring-green-200";
    case "cancelled":
      return "bg-red-50 text-red-700 ring-red-200";
    default:
      return "bg-gray-50 text-gray-700 ring-gray-200";
  }
}

function priorityBadgeClass(priority: TicketPriority) {
  switch (priority) {
    case "low":
      return "bg-gray-50 text-gray-700 ring-gray-200";
    case "medium":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "high":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "critical":
      return "bg-red-50 text-red-700 ring-red-200";
    default:
      return "bg-gray-50 text-gray-700 ring-gray-200";
  }
}

function compareValues(a: string | number, b: string | number, dir: SortDirection) {
  const aNum = Number(a);
  const bNum = Number(b);

  const bothNumeric =
    String(a).trim() !== "" &&
    String(b).trim() !== "" &&
    !Number.isNaN(aNum) &&
    !Number.isNaN(bNum);

  const result = bothNumeric
    ? aNum - bNum
    : String(a).localeCompare(String(b), "tr", { sensitivity: "base" });

  return dir === "asc" ? result : -result;
}

function sortIndicator(active: boolean, direction: SortDirection) {
  if (!active) return "";
  return direction === "asc" ? " ↑" : " ↓";
}

function truncateText(value: string | null | undefined, maxLength = 72) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

export default function TicketsListClient({
  companyId,
  openedBy,
  customers,
  machines,
  employees,
  initialTickets,
  permissions,
}: Props) {
  const router = useRouter();
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const [rows, setRows] = useState<TicketRow[]>(initialTickets);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);

  useEffect(() => {
    setRows(initialTickets);
  }, [initialTickets]);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (contextMenuRef.current && event.target instanceof Node) {
        if (contextMenuRef.current.contains(event.target)) return;
      }
      setContextMenu(null);
    }

    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    if (!showNewTicketModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showNewTicketModal]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function startSelection(ticketId: string) {
    setSelectionMode(true);
    setSelectedIds([ticketId]);
    setContextMenu(null);
  }

  function toggleTicketSelection(ticketId: string) {
    setSelectedIds((prev) =>
      prev.includes(ticketId) ? prev.filter((id) => id !== ticketId) : [...prev, ticketId]
    );
  }

  function toggleVisibleSelection() {
    const visibleIds = filteredRows.map((ticket) => ticket.id);
    const visibleIdSet = new Set(visibleIds);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((prev) =>
      allVisibleSelected ? prev.filter((id) => !visibleIdSet.has(id)) : Array.from(new Set([...prev, ...visibleIds]))
    );
  }

  async function markCompleted(ticketId: string) {
    setErrorText("");
    setSuccessText("");

    if (!permissions.canUpdateStatus) {
      setErrorText("Ticket durum güncelleme yetkiniz yok.");
      setContextMenu(null);
      return;
    }

    const response = await fetch(`/api/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "completed",
        note: "Liste ekranından tamamlandı olarak işaretlendi",
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setErrorText(data?.error || "Ticket durumu güncellenemedi.");
      return;
    }

    setRows((prev) =>
      prev.map((row) =>
        row.id === ticketId
          ? {
              ...row,
              status: "completed",
              status_note: "Liste ekranından tamamlandı olarak işaretlendi",
            }
          : row
      )
    );
    setContextMenu(null);
    setSuccessText("Ticket tamamlandı olarak güncellendi.");
    router.refresh();
  }

  async function deleteTicket(ticketId: string) {
    setErrorText("");
    setSuccessText("");

    if (!permissions.canDelete) {
      setErrorText("Ticket silme yetkiniz yok.");
      setContextMenu(null);
      return;
    }

    const confirmed = window.confirm("Bu ticket silinsin mi?");
    if (!confirmed) return;

    const response = await fetch(`/api/tickets/${ticketId}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok) {
      setErrorText(data?.error || "Ticket silinemedi.");
      return;
    }

    setRows((prev) => prev.filter((row) => row.id !== ticketId));
    setContextMenu(null);
    setSuccessText("Ticket silindi.");
    router.refresh();
  }

  async function bulkMarkCompleted() {
    if (selectedIds.length === 0) {
      setErrorText("İşlem için en az bir ticket seçin.");
      return;
    }

    for (const ticketId of selectedIds) {
      await markCompleted(ticketId);
    }

    setSelectedIds([]);
    setSelectionMode(false);
  }

  async function bulkDeleteTickets() {
    if (selectedIds.length === 0) {
      setErrorText("Silmek için en az bir ticket seçin.");
      return;
    }

    const confirmed = window.confirm(`${selectedIds.length} ticket silinsin mi?`);
    if (!confirmed) return;

    for (const ticketId of selectedIds) {
      const response = await fetch(`/api/tickets/${ticketId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorText(data?.error || "Seçili ticketlar silinemedi.");
        return;
      }
    }

    setRows((prev) => prev.filter((row) => !selectedIds.includes(row.id)));
    setSelectedIds([]);
    setSelectionMode(false);
    setSuccessText("Seçili ticketlar silindi.");
    router.refresh();
  }

  const filteredRows = useMemo(() => {
    let data = [...rows];

    if (search.trim()) {
      const q = search.toLocaleLowerCase("tr-TR");
      data = data.filter((row) =>
        [
          row.ticket_no,
          row.title,
          row.customer_name ?? "",
          row.machine_name ?? "",
          row.status,
          row.priority ?? "",
          row.status_note ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(q)
      );
    }

    if (statusFilter) {
      data = data.filter((row) => row.status === statusFilter);
    }

    if (priorityFilter) {
      data = data.filter((row) => row.priority === priorityFilter);
    }

    data.sort((left, right) => {
      const leftValue =
        sortKey === "ticket_no"
          ? left.ticket_no
          : sortKey === "title"
            ? left.title
            : sortKey === "customer_name"
              ? left.customer_name ?? ""
              : sortKey === "machine_name"
                ? left.machine_name ?? ""
                : sortKey === "status"
                  ? left.status
                  : sortKey === "priority"
          ? left.priority ?? ""
                    : sortKey === "status_changed_at"
                      ? left.status_changed_at
                      : left.created_at;

      const rightValue =
        sortKey === "ticket_no"
          ? right.ticket_no
          : sortKey === "title"
            ? right.title
            : sortKey === "customer_name"
              ? right.customer_name ?? ""
              : sortKey === "machine_name"
                ? right.machine_name ?? ""
                : sortKey === "status"
                  ? right.status
                  : sortKey === "priority"
          ? right.priority ?? ""
                    : sortKey === "status_changed_at"
                      ? right.status_changed_at
                      : right.created_at;

      return compareValues(leftValue, rightValue, sortDirection);
    });

    return data;
  }, [rows, search, statusFilter, priorityFilter, sortKey, sortDirection]);

  const totalCount = rows.length;
  const activeCount = rows.filter((row) => !["completed", "cancelled"].includes(row.status)).length;
  const sortableHeaderClass =
    "cursor-pointer whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200";

  return (
    <div className="space-y-6">
      {errorText ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorText}
        </div>
      ) : null}

      {successText ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successText}
        </div>
      ) : null}

      <CompactFilterActionBar className="relative z-10 elevated-topbar !p-3 sm:!p-5">
          <div className="min-w-0 flex-1">
            <label className="sr-only">Ara</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ticket no, başlık, müşteri..."
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 sm:h-11"
            />
          </div>

          <div className="w-full sm:w-44">
            <label className="sr-only">Durum</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm sm:h-11"
            >
              <option value="">Tümü</option>
              <option value="new">Yeni</option>
              <option value="assigned">Atandı</option>
              <option value="investigating">İnceleniyor</option>
              <option value="waiting_offer">Teklif Bekleniyor</option>
              <option value="waiting_parts">Parça Bekleniyor</option>
              <option value="in_progress">İşlemde</option>
              <option value="completed">Tamamlandı</option>
              <option value="cancelled">İptal Edildi</option>
            </select>
          </div>

          <div className="w-full sm:w-40">
            <label className="sr-only">Öncelik</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm sm:h-11"
            >
              <option value="">Tümü</option>
              <option value="low">Düşük</option>
              <option value="medium">Orta</option>
              <option value="high">Yüksek</option>
              <option value="critical">Kritik</option>
            </select>
          </div>

        <div
          className={`grid w-full gap-2 sm:w-auto sm:grid-flow-col sm:auto-cols-max sm:grid-cols-none ${
            permissions.canCreate ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          <div className="flex h-10 min-w-0 flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 px-2 shadow-sm sm:h-11 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
            <div className="truncate text-[10px] font-medium uppercase leading-tight text-slate-500 sm:text-[11px]">
              Toplam
            </div>
            <div className="text-base font-semibold leading-tight text-slate-900 sm:text-lg">{totalCount}</div>
          </div>

          <div className="flex h-10 min-w-0 flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 px-2 shadow-sm sm:h-11 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
            <div className="truncate text-[10px] font-medium uppercase leading-tight text-slate-500 sm:text-[11px]">
              Aktif
            </div>
            <div className="text-base font-semibold leading-tight text-slate-900 sm:text-lg">{activeCount}</div>
          </div>

          {permissions.canCreate ? (
            <button
              type="button"
              onClick={() => setShowNewTicketModal(true)}
              className="flex h-10 min-w-0 items-center justify-center rounded-xl bg-slate-900 px-2 text-xs font-medium text-white transition hover:bg-slate-800 sm:h-11 sm:px-4 sm:text-sm"
            >
              Yeni
            </button>
          ) : null}
        </div>
      </CompactFilterActionBar>

      {selectionMode ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-800">{selectedIds.length} kayıt seçildi</div>
          <button
            type="button"
            onClick={toggleVisibleSelection}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Görünenleri Seç / Bırak
          </button>
          {permissions.canUpdateStatus ? (
            <button
              type="button"
              onClick={() => void bulkMarkCompleted()}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Tamamlandı İşaretle
            </button>
          ) : null}
          {permissions.canDelete ? (
            <button
              type="button"
              onClick={() => void bulkDeleteTickets()}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Sil
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setSelectionMode(false);
              setSelectedIds([]);
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Seçimi Kapat
          </button>
        </div>
      ) : null}

      <div className="elevated-topbar overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                {selectionMode ? (
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={filteredRows.length > 0 && filteredRows.every((ticket) => selectedIds.includes(ticket.id))}
                      onChange={toggleVisibleSelection}
                      aria-label="Görünen kayıtları seç"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                ) : null}
                <th className={sortableHeaderClass} onClick={() => toggleSort("ticket_no")}>
                  Ticket No{sortIndicator(sortKey === "ticket_no", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("title")}>
                  Başlık{sortIndicator(sortKey === "title", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("customer_name")}>
                  Müşteri{sortIndicator(sortKey === "customer_name", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("machine_name")}>
                  Makine{sortIndicator(sortKey === "machine_name", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("status")}>
                  Durum{sortIndicator(sortKey === "status", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("priority")}>
                  Öncelik{sortIndicator(sortKey === "priority", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("created_at")}>
                  Oluşturma{sortIndicator(sortKey === "created_at", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("status_changed_at")}>
                  Durum Güncelleme{sortIndicator(sortKey === "status_changed_at", sortDirection)}
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={selectionMode ? 9 : 8} className="px-4 py-12 text-center text-sm text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredRows.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => {
                      if (selectionMode) {
                        toggleTicketSelection(ticket.id);
                        return;
                      }

                      router.push(`/dashboard/tickets/${ticket.id}`);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        ticketId: ticket.id,
                      });
                    }}
                    className="cursor-pointer border-b border-slate-200 last:border-b-0 transition-all duration-150 hover:bg-slate-200/80 hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]"
                  >
                    {selectionMode ? (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(ticket.id)}
                          onChange={() => toggleTicketSelection(ticket.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`${ticket.ticket_no} seç`}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{ticket.ticket_no}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="font-medium text-slate-900">{ticket.title}</div>
                      {ticket.status_note ? (
                        <div className="mt-1 max-w-[320px] truncate text-xs text-slate-500">
                          {truncateText(ticket.status_note)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{ticket.customer_name ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{ticket.machine_name ?? "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClass(ticket.status)}`}
                      >
                        {statusLabel(ticket.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${priorityBadgeClass(ticket.priority)}`}
                      >
                        {priorityLabel(ticket.priority)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {new Date(ticket.created_at).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {new Date(ticket.status_changed_at).toLocaleDateString("tr-TR")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="context-menu-layer fixed min-w-[240px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            onClick={() => startSelection(contextMenu.ticketId)}
            className="block w-full border-b border-slate-100 px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            Seç
          </button>

          <button
            type="button"
            onClick={() => {
              router.push(`/dashboard/tickets/${contextMenu.ticketId}`);
              setContextMenu(null);
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            Detayı Aç
          </button>

          {permissions.canUpdateStatus ? (
            <button
              type="button"
              onClick={() => void markCompleted(contextMenu.ticketId)}
              className="block w-full px-4 py-2.5 text-left text-sm text-emerald-700 transition-colors hover:bg-emerald-50"
            >
              Tamamlandı İşaretle
            </button>
          ) : null}

          {permissions.canDelete ? (
            <button
              type="button"
              onClick={() => void deleteTicket(contextMenu.ticketId)}
              className="block w-full px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-100"
            >
              Sil
            </button>
          ) : null}
        </div>
      ) : null}

      {showNewTicketModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Yeni Ticket</h2>
                <p className="mt-1 text-sm text-slate-500">Yeni bir servis kaydı oluşturun</p>
              </div>

              <button
                type="button"
                onClick={() => setShowNewTicketModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-6">
              <NewTicketForm
                companyId={companyId}
                openedBy={openedBy}
                customers={customers}
                machines={machines}
                employees={employees}
                canCreate={permissions.canCreate}
                compact
                onCancel={() => setShowNewTicketModal(false)}
                onSuccess={() => {
                  setShowNewTicketModal(false);
                  setSuccessText("Ticket oluşturuldu.");
                  setErrorText("");
                  router.push("/dashboard/tickets");
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
