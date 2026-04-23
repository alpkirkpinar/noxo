"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CompactFilterActionBar from "@/components/ui/compact-filter-action-bar";

type Customer = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean;
  created_at: string;
  machine_count: number;
};

type Props = {
  customers: Customer[];
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
};

type SortKey =
  | "company_name"
  | "contact_name"
  | "phone"
  | "email"
  | "city"
  | "machine_count"
  | "created_at";

type SortDirection = "asc" | "desc";

type ContextMenuState = {
  x: number;
  y: number;
  customerId: string;
};

function compareValues(a: string | number, b: string | number, direction: SortDirection) {
  const aNum = Number(a);
  const bNum = Number(b);

  const bothNumeric =
    String(a).trim() !== "" &&
    String(b).trim() !== "" &&
    !Number.isNaN(aNum) &&
    !Number.isNaN(bNum);

  let result = 0;

  if (bothNumeric) {
    result = aNum - bNum;
  } else {
    result = String(a).localeCompare(String(b), "tr", { sensitivity: "base" });
  }

  return direction === "asc" ? result : -result;
}

function sortIndicator(active: boolean, direction: SortDirection) {
  if (!active) return "";
  return direction === "asc" ? " ↑" : " ↓";
}

export default function CustomerList({ customers, permissions }: Props) {
  const router = useRouter();
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState("");
  const [localCustomers, setLocalCustomers] = useState(customers);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setLocalCustomers(customers);
  }, [customers]);

  const rows = useMemo(() => {
    let filtered = [...localCustomers];

    if (search.trim()) {
      const q = search.toLocaleLowerCase("tr-TR");

      filtered = filtered.filter((customer) =>
        [
          customer.company_name,
          customer.contact_name ?? "",
          customer.phone ?? "",
          customer.email ?? "",
          customer.city ?? "",
          customer.country ?? "",
          customer.machine_count,
        ]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(q)
      );
    }

    filtered.sort((left, right) => {
      const leftValue =
        sortKey === "company_name"
          ? left.company_name
          : sortKey === "contact_name"
          ? left.contact_name ?? ""
          : sortKey === "phone"
          ? left.phone ?? ""
          : sortKey === "email"
          ? left.email ?? ""
          : sortKey === "city"
          ? left.city ?? ""
          : sortKey === "machine_count"
          ? left.machine_count
          : left.created_at;

      const rightValue =
        sortKey === "company_name"
          ? right.company_name
          : sortKey === "contact_name"
          ? right.contact_name ?? ""
          : sortKey === "phone"
          ? right.phone ?? ""
          : sortKey === "email"
          ? right.email ?? ""
          : sortKey === "city"
          ? right.city ?? ""
          : sortKey === "machine_count"
          ? right.machine_count
          : right.created_at;

      return compareValues(leftValue, rightValue, sortDirection);
    });

    return filtered;
  }, [localCustomers, search, sortKey, sortDirection]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function startSelection(customerId: string) {
    setSelectionMode(true);
    setSelectedIds([customerId]);
    setContextMenu(null);
  }

  function toggleCustomerSelection(customerId: string) {
    setSelectedIds((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId]
    );
  }

  function toggleVisibleSelection() {
    const visibleIds = rows.map((customer) => customer.id);
    const visibleIdSet = new Set(visibleIds);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((prev) =>
      allVisibleSelected ? prev.filter((id) => !visibleIdSet.has(id)) : Array.from(new Set([...prev, ...visibleIds]))
    );
  }

  async function deleteCustomers(customerIds: string[]) {
    if (!permissions.canDelete) return;
    if (customerIds.length === 0) return;

    const confirmed = window.confirm(`${customerIds.length} müşteri silinsin mi?`);
    if (!confirmed) return;

    for (const customerId of customerIds) {
      const response = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
      if (!response.ok) return;
    }

    setLocalCustomers((prev) => prev.filter((customer) => !customerIds.includes(customer.id)));
    setSelectedIds([]);
    setSelectionMode(false);
    setContextMenu(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <CompactFilterActionBar className="!p-3 sm:!p-5">
          <div className="min-w-0 flex-1">
            <label className="sr-only">Ara</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Firma, ilgili kişi, telefon, e-posta..."
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 sm:h-11"
            />
          </div>

          <div
            className={`grid w-full gap-2 sm:w-auto sm:grid-flow-col sm:auto-cols-max sm:grid-cols-none ${
              permissions.canCreate ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
          <div className="flex h-10 min-w-0 flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 px-2 shadow-sm sm:h-11 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Toplam
            </div>
              <div className="text-base font-semibold leading-tight text-slate-900 sm:text-lg">{localCustomers.length}</div>
          </div>
          {permissions.canCreate ? (
            <Link
              href="/dashboard/customers/new"
              className="flex h-10 min-w-0 items-center justify-center rounded-xl bg-slate-900 px-2 text-xs font-medium text-white transition hover:bg-slate-800 sm:h-11 sm:px-4 sm:text-sm"
            >
              Yeni
            </Link>
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
          {permissions.canDelete ? (
            <button
              type="button"
              onClick={() => void deleteCustomers(selectedIds)}
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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                {selectionMode ? (
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && rows.every((customer) => selectedIds.includes(customer.id))}
                      onChange={toggleVisibleSelection}
                      aria-label="Görünen kayıtları seç"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                ) : null}
                <th className="cursor-pointer px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-200" onClick={() => toggleSort("company_name")}>
                  Firma{sortIndicator(sortKey === "company_name", sortDirection)}
                </th>
                <th className="cursor-pointer px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-200" onClick={() => toggleSort("contact_name")}>
                  İlgili Kişi{sortIndicator(sortKey === "contact_name", sortDirection)}
                </th>
                <th className="cursor-pointer px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-200" onClick={() => toggleSort("phone")}>
                  Telefon{sortIndicator(sortKey === "phone", sortDirection)}
                </th>
                <th className="cursor-pointer px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-200" onClick={() => toggleSort("email")}>
                  E-posta{sortIndicator(sortKey === "email", sortDirection)}
                </th>
                <th className="cursor-pointer px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-200" onClick={() => toggleSort("city")}>
                  Şehir{sortIndicator(sortKey === "city", sortDirection)}
                </th>
                <th className="cursor-pointer px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-200" onClick={() => toggleSort("machine_count")}>
                  Makine{sortIndicator(sortKey === "machine_count", sortDirection)}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Durum</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={selectionMode ? 8 : 7} className="px-4 py-12 text-center text-sm text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                rows.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => {
                      if (selectionMode) {
                        toggleCustomerSelection(customer.id);
                        return;
                      }

                      router.push(`/dashboard/customers/${customer.id}`);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        customerId: customer.id,
                      });
                    }}
                    className="cursor-pointer border-b border-slate-200 last:border-b-0 transition-all duration-150 hover:bg-slate-200/80 hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]"
                  >
                    {selectionMode ? (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(customer.id)}
                          onChange={() => toggleCustomerSelection(customer.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`${customer.company_name} seç`}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{customer.company_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{customer.contact_name ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{customer.phone ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{customer.email ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{customer.city ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{customer.machine_count}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={
                          customer.is_active
                            ? "inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                            : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                        }
                      >
                        {customer.is_active ? "Aktif" : "Pasif"}
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
            onClick={() => startSelection(contextMenu.customerId)}
            className="block w-full border-b border-slate-100 px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            Seç
          </button>

          <button
            type="button"
            onClick={() => {
              router.push(`/dashboard/customers/${contextMenu.customerId}`);
              setContextMenu(null);
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            Detayı Aç
          </button>

          {permissions.canEdit ? (
            <button
              type="button"
              onClick={() => {
                router.push(`/dashboard/customers/${contextMenu.customerId}/edit`);
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
              onClick={() => void deleteCustomers([contextMenu.customerId])}
              className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-100"
            >
              Sil
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
