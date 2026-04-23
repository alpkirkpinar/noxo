"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CompactFilterActionBar from "@/components/ui/compact-filter-action-bar";

type MachineListItem = {
  id: string;
  machine_code: string;
  machine_name: string;
  customer_name: string | null;
  brand_model: string;
  serial_number: string | null;
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

export default function MachinesListClient({ initialMachines, permissions }: Props) {
  const router = useRouter();
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const [rows, setRows] = useState(initialMachines);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortField>("machine_code");
  const [sortDirection, setSortDirection] = useState<SortOrder>("asc");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  useEffect(() => {
    setRows(initialMachines);
  }, [initialMachines]);

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

  function toggleSort(key: SortField) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
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

      <CompactFilterActionBar>
          <div className="min-w-0 flex-1">
            <label className="sr-only">Ara</label>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Makine adı, kod veya seri no ara"
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div className="w-full sm:w-44">
            <label className="sr-only">Durum</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
            >
              <option value="">Tümü</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
              <option value="in_service">Serviste</option>
              <option value="scrapped">Hurda</option>
            </select>
          </div>

          <div className="flex h-11 shrink-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 shadow-sm">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Toplam Makine</div>
            <div className="text-lg font-semibold text-slate-900">{totalCount}</div>
          </div>

          <div className="flex h-11 shrink-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 shadow-sm">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Aktif Makine</div>
            <div className="text-lg font-semibold text-slate-900">{activeCount}</div>
          </div>

          {permissions.canCreate ? (
            <button
              type="button"
              onClick={() => router.push("/dashboard/machines/new")}
              className="flex h-11 shrink-0 items-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Yeni Makine
            </button>
          ) : null}
      </CompactFilterActionBar>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b bg-slate-50">
              <tr>
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
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredRows.map((machine) => (
                  <tr
                    key={machine.id}
                    onClick={() => router.push(`/dashboard/machines/${machine.id}`)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setContextMenu({
                        x: event.clientX,
                        y: event.clientY,
                        machineId: machine.id,
                      });
                    }}
                    className="cursor-pointer border-b border-slate-200 last:border-b-0 transition-all duration-150 hover:bg-slate-200/80 hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{machine.machine_code}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{machine.machine_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{machine.customer_name ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{machine.brand_model}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{machine.serial_number ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {machine.next_maintenance_date
                        ? new Date(machine.next_maintenance_date).toLocaleDateString("tr-TR")
                        : "-"}
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
    </div>
  );
}
