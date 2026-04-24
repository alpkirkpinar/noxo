"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CompactFilterActionBar from "@/components/ui/compact-filter-action-bar";
import MachineForm from "@/components/machines/machine-form";
import { useDismissFloatingLayer } from "@/hooks/use-dismiss-floating-layer";
import { useTouchContextMenu } from "@/hooks/use-touch-context-menu";

type MachineListItem = {
  id: string;
  machine_code: string;
  machine_name: string;
  customer_name: string | null;
  brand_model: string;
  serial_number: string | null;
  maintenance_period_days: number | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  status: string | null;
};

type SortField =
  | "machine_code"
  | "machine_name"
  | "customer_name"
  | "brand_model"
  | "serial_number"
  | "next_maintenance_date"
  | "status";

type SortOrder = "asc" | "desc";

type Props = {
  initialMachines: MachineListItem[];
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
  companyId: string;
  customers: Array<{
    id: string;
    company_name: string;
    customer_code?: string | null;
  }>;
};

type ContextMenuState = {
  x: number;
  y: number;
  machineId: string;
};

function statusLabel(status: string | null) {
  switch (status) {
    case "active":
      return "Aktif";
    case "inactive":
      return "Pasif";
    case "in_service":
      return "Serviste";
    case "scrapped":
      return "Hurda";
    default:
      return "-";
  }
}

function statusBadgeClass(status: string | null) {
  switch (status) {
    case "active":
      return "bg-green-50 text-green-700 ring-green-200";
    case "inactive":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "in_service":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "scrapped":
      return "bg-red-50 text-red-700 ring-red-200";
    default:
      return "bg-gray-50 text-gray-700 ring-gray-200";
  }
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLocaleLowerCase("tr-TR");
}

function statusRank(status: string | null) {
  switch (status) {
    case "active":
      return 1;
    case "in_service":
      return 2;
    case "inactive":
      return 3;
    case "scrapped":
      return 4;
    default:
      return 999;
  }
}

function compareValues(a: MachineListItem, b: MachineListItem, sort: SortField) {
  switch (sort) {
    case "machine_code":
      return normalizeText(a.machine_code).localeCompare(normalizeText(b.machine_code), "tr");
    case "machine_name":
      return normalizeText(a.machine_name).localeCompare(normalizeText(b.machine_name), "tr");
    case "customer_name":
      return normalizeText(a.customer_name).localeCompare(normalizeText(b.customer_name), "tr");
    case "brand_model":
      return normalizeText(a.brand_model).localeCompare(normalizeText(b.brand_model), "tr");
    case "serial_number":
      return normalizeText(a.serial_number).localeCompare(normalizeText(b.serial_number), "tr");
    case "next_maintenance_date":
      return (
        new Date(a.next_maintenance_date ?? "9999-12-31").getTime() -
        new Date(b.next_maintenance_date ?? "9999-12-31").getTime()
      );
    case "status":
      return statusRank(a.status) - statusRank(b.status);
    default:
      return 0;
  }
}

function sortIndicator(active: boolean, direction: SortOrder) {
  if (!active) return "";
  return direction === "asc" ? " ↑" : " ↓";
}

function parseLocalDate(value: string | null) {
  if (!value) return null;

  const [datePart] = value.split("T");
  const parts = datePart.split("-").map(Number);

  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function maintenanceProgress(machine: MachineListItem) {
  const nextDate = parseLocalDate(machine.next_maintenance_date);
  if (!nextDate) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  const today = startOfToday();
  const daysRemaining = Math.ceil((nextDate.getTime() - today.getTime()) / dayMs);

  let startDate = parseLocalDate(machine.last_maintenance_date);

  if (!startDate && machine.maintenance_period_days && machine.maintenance_period_days > 0) {
    startDate = new Date(nextDate);
    startDate.setDate(nextDate.getDate() - machine.maintenance_period_days);
  }

  if (!startDate || startDate >= nextDate) {
    startDate = new Date(nextDate);
    startDate.setDate(nextDate.getDate() - 30);
  }

  const totalDays = Math.max(1, Math.ceil((nextDate.getTime() - startDate.getTime()) / dayMs));
  const elapsedDays = Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / dayMs));
  const percent = daysRemaining < 0 ? 100 : Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

  return {
    percent,
    daysRemaining,
  };
}

function maintenanceBarClass(percent: number, daysRemaining: number) {
  if (daysRemaining < 0 || percent >= 90) return "bg-red-600";
  if (percent >= 70) return "bg-orange-500";
  if (percent >= 45) return "bg-amber-500";
  return "bg-emerald-500";
}

function maintenanceBarTrackClass(percent: number, daysRemaining: number) {
  if (daysRemaining < 0 || percent >= 90) return "bg-red-100";
  if (percent >= 70) return "bg-orange-100";
  if (percent >= 45) return "bg-amber-100";
  return "bg-emerald-100";
}

function MaintenanceDueIndicator({ machine, fullWidth = false }: { machine: MachineListItem; fullWidth?: boolean }) {
  if (!machine.next_maintenance_date) return <span>-</span>;

  const progress = maintenanceProgress(machine);

  return (
    <div className="space-y-1.5">
      <div>{new Date(machine.next_maintenance_date).toLocaleDateString("tr-TR")}</div>
      {progress ? (
        <div
          role="progressbar"
          aria-label="Bakım tarihi yaklaşma oranı"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          className={`${fullWidth ? "w-full" : "w-32"} h-2 overflow-hidden rounded-full ${maintenanceBarTrackClass(
            progress.percent,
            progress.daysRemaining
          )}`}
          title={
            progress.daysRemaining < 0
              ? `${Math.abs(progress.daysRemaining)} gün gecikmiş`
              : `${progress.daysRemaining} gün kaldı`
          }
        >
          <div
            className={`h-full rounded-full transition-all ${maintenanceBarClass(
              progress.percent,
              progress.daysRemaining
            )}`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export default function MachinesListClient({ initialMachines, permissions, companyId, customers }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialMachines);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortField>("machine_code");
  const [sortDirection, setSortDirection] = useState<SortOrder>("asc");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const { activeId, bindRow, shouldSuppressClick } = useTouchContextMenu((machineId, x, y) => {
    setContextMenu({ x, y, machineId });
  });
  useDismissFloatingLayer([contextMenuRef], () => setContextMenu(null));

  useEffect(() => {
    setRows(initialMachines);
  }, [initialMachines]);

  function toggleSort(key: SortField) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function startSelection(machineId: string) {
    setSelectionMode(true);
    setSelectedIds([machineId]);
    setContextMenu(null);
  }

  function toggleMachineSelection(machineId: string) {
    setSelectedIds((prev) =>
      prev.includes(machineId) ? prev.filter((id) => id !== machineId) : [...prev, machineId]
    );
  }

  function toggleVisibleSelection() {
    const visibleIds = filteredRows.map((machine) => machine.id);
    const visibleIdSet = new Set(visibleIds);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((prev) =>
      allVisibleSelected ? prev.filter((id) => !visibleIdSet.has(id)) : Array.from(new Set([...prev, ...visibleIds]))
    );
  }

  async function deleteMachine(machineId: string) {
    setErrorText("");
    setSuccessText("");

    if (!permissions.canDelete) {
      setErrorText("Makine silme yetkiniz yok.");
      setContextMenu(null);
      return;
    }

    const confirmed = window.confirm("Bu makine silinsin mi?");
    if (!confirmed) return;

    const response = await fetch(`/api/machines/${machineId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setErrorText(
        String(result.error ?? "").includes("foreign key")
          ? "Makine bağlı kayıtlardan dolayı silinemedi. Önce ticket veya form bağlantılarını temizle."
          : result.error ?? "Makine silinemedi."
      );
      return;
    }

    setRows((prev) => prev.filter((row) => row.id !== machineId));
    setContextMenu(null);
    setSuccessText("Makine silindi.");
    router.refresh();
  }

  async function bulkDeleteMachines(machineIds: string[]) {
    if (machineIds.length === 0) {
      setErrorText("Silmek için en az bir makine seçin.");
      return;
    }

    const confirmed = window.confirm(`${machineIds.length} makine silinsin mi?`);
    if (!confirmed) return;

    for (const machineId of machineIds) {
      const response = await fetch(`/api/machines/${machineId}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorText(result.error ?? "Seçili makineler silinemedi.");
        return;
      }
    }

    setRows((prev) => prev.filter((row) => !machineIds.includes(row.id)));
    setSelectedIds([]);
    setSelectionMode(false);
    setContextMenu(null);
    setSuccessText("Seçili makineler silindi.");
    router.refresh();
  }

  async function markMaintenanceDone(machineIds: string[]) {
    if (!permissions.canEdit) {
      setErrorText("Makine düzenleme yetkiniz yok.");
      return;
    }

    if (machineIds.length === 0) {
      setErrorText("Bakım için en az bir makine seçin.");
      return;
    }

    const response = await fetch("/api/machines/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: machineIds }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setErrorText(result.error ?? "Bakım bilgisi güncellenemedi.");
      return;
    }

    setSelectedIds([]);
    setSelectionMode(false);
    setContextMenu(null);
    setSuccessText("Bakım yapıldı olarak işaretlendi.");
    router.refresh();
  }

  const filteredRows = useMemo(() => {
    let data = [...rows];

    if (search.trim()) {
      const q = search.toLocaleLowerCase("tr-TR");
      data = data.filter((row) =>
        [
          row.machine_code,
          row.machine_name,
          row.customer_name ?? "",
          row.brand_model,
          row.serial_number ?? "",
          row.status ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(q)
      );
    }

    if (statusFilter) {
      data = data.filter((row) => row.status === statusFilter);
    }

    data.sort((a, b) => compareValues(a, b, sortKey));

    if (sortDirection === "desc") {
      data.reverse();
    }

    return data;
  }, [rows, search, statusFilter, sortKey, sortDirection]);

  const totalCount = rows.length;
  const activeCount = rows.filter((row) => row.status === "active" || row.status === "in_service").length;
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

      <CompactFilterActionBar className="!p-3 sm:!p-5">
          <div className="min-w-0 flex-1">
            <label className="sr-only">Ara</label>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Makine adı, kod veya seri no ara"
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 sm:h-11"
            />
          </div>

          <div className="w-full sm:w-44">
            <label className="sr-only">Durum</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm sm:h-11"
            >
              <option value="">Tümü</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
              <option value="in_service">Serviste</option>
              <option value="scrapped">Hurda</option>
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
                onClick={() => setShowCreateModal(true)}
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
          <button type="button" onClick={toggleVisibleSelection} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Görünenleri Seç / Bırak
          </button>
          {permissions.canEdit ? (
            <button type="button" onClick={() => void markMaintenanceDone(selectedIds)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
              Bakım Yapıldı
            </button>
          ) : null}
          {permissions.canDelete ? (
            <button type="button" onClick={() => void bulkDeleteMachines(selectedIds)} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100">
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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                {selectionMode ? (
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={filteredRows.length > 0 && filteredRows.every((machine) => selectedIds.includes(machine.id))}
                      onChange={toggleVisibleSelection}
                      aria-label="Görünen kayıtları seç"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                ) : null}
                <th className={sortableHeaderClass} onClick={() => toggleSort("machine_code")}>
                  Makine Kodu{sortIndicator(sortKey === "machine_code", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("machine_name")}>
                  Makine Adı{sortIndicator(sortKey === "machine_name", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("customer_name")}>
                  Müşteri{sortIndicator(sortKey === "customer_name", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("brand_model")}>
                  Marka / Model{sortIndicator(sortKey === "brand_model", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("serial_number")}>
                  Seri No{sortIndicator(sortKey === "serial_number", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("next_maintenance_date")}>
                  Sonraki Bakım{sortIndicator(sortKey === "next_maintenance_date", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("status")}>
                  Durum{sortIndicator(sortKey === "status", sortDirection)}
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={selectionMode ? 8 : 7} className="px-4 py-12 text-center text-sm text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredRows.map((machine) => (
                  <tr
                    key={machine.id}
                    onClick={() => {
                      if (shouldSuppressClick()) return;

                      if (selectionMode) {
                        toggleMachineSelection(machine.id);
                        return;
                      }

                      router.push(`/dashboard/machines/${machine.id}`);
                    }}
                    {...bindRow(machine.id)}
                    className={`cursor-pointer border-b border-slate-200 last:border-b-0 transition-all duration-150 hover:bg-slate-200/80 hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] ${
                      activeId === machine.id ? "bg-slate-300/90 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.14)]" : ""
                    }`}
                  >
                    {selectionMode ? (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(machine.id)}
                          onChange={() => toggleMachineSelection(machine.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`${machine.machine_code} seç`}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{machine.machine_code}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{machine.machine_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{machine.customer_name ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{machine.brand_model}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{machine.serial_number ?? "-"}</td>
                    <td className="min-w-40 px-4 py-3 text-sm text-slate-700">
                      <MaintenanceDueIndicator machine={machine} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClass(machine.status)}`}
                      >
                        {statusLabel(machine.status)}
                      </span>
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
          className="context-menu-layer fixed min-w-[220px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            onClick={() => startSelection(contextMenu.machineId)}
            className="block w-full border-b border-slate-100 px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            Seç
          </button>

          {permissions.canEdit ? (
            <button
              type="button"
              onClick={() => void markMaintenanceDone([contextMenu.machineId])}
              className="block w-full px-4 py-2.5 text-left text-sm text-emerald-700 transition-colors hover:bg-emerald-50"
            >
              Bakım Yapıldı
            </button>
          ) : null}

          {permissions.canEdit ? (
            <button
              type="button"
              onClick={() => {
                router.push(`/dashboard/machines/${contextMenu.machineId}/edit`);
                setContextMenu(null);
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
            >
              Düzenle
            </button>
          ) : null}

          {permissions.canDelete ? (
            <button
              type="button"
              onClick={() => void deleteMachine(contextMenu.machineId)}
              className="block w-full px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-100"
            >
              Sil
            </button>
          ) : null}
        </div>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/35 p-2 sm:p-4">
          <div className="my-4 w-full max-w-5xl rounded-2xl bg-white p-4 shadow-xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Yeni Makine</h2>
                <p className="mt-1 text-sm text-slate-500">Yeni makine kaydı oluşturun</p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <MachineForm
              companyId={companyId}
              customers={customers}
              mode="create"
              hideCard
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
