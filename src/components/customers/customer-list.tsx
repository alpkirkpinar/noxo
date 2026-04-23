"use client";

import { useMemo, useRef, useState } from "react";
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
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const rows = useMemo(() => {
    let filtered = [...customers];

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
  }, [customers, search, sortKey, sortDirection]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  return (
    <div className="space-y-6">
      <CompactFilterActionBar>
          <div className="min-w-0 flex-1">
            <label className="sr-only">Ara</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Firma, ilgili kişi, telefon, e-posta..."
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div className="flex h-11 shrink-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 shadow-sm">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Toplam Müşteri
            </div>
            <div className="text-lg font-semibold text-slate-900">{customers.length}</div>
          </div>
          {permissions.canCreate ? (
            <Link
              href="/dashboard/customers/new"
              className="flex h-11 shrink-0 items-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Yeni Müşteri
            </Link>
          ) : null}
      </CompactFilterActionBar>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b bg-slate-50">
              <tr>
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
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                rows.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
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
        </div>
      ) : null}
    </div>
  );
}
