"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import CompactFilterActionBar from "@/components/ui/compact-filter-action-bar";

type TemplateField = {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  sort_order?: number | null;
};

type FormRow = {
  id: string;
  form_no: string | null;
  service_date: string | null;
  created_at: string | null;
  customer_name: string;
  machine_name: string;
  values: Record<string, string>;
};

type Props = {
  templateName: string;
  fields: TemplateField[];
  forms: FormRow[];
  columnPreferenceUserId: string;
  backHref?: string;
  newFormHref?: string;
};

type RowContextMenuState = {
  x: number;
  y: number;
  formId: string;
};

type ColumnContextMenuState = {
  x: number;
  y: number;
  columnId: string;
};

type SortDirection = "asc" | "desc";

type BaseColumnId = "form_no" | "customer_name" | "machine_name" | "service_date" | "created_at";

type Column =
  | {
      id: BaseColumnId;
      label: string;
      type: "base";
    }
  | {
      id: string;
      label: string;
      type: "field";
      field: TemplateField;
    };

type ColumnPointerDragState = {
  columnId: string;
  pointerId: number;
  startX: number;
  startY: number;
  lastTargetId: string;
  longPressTimer: number | null;
  contextMenuOpened: boolean;
  moved: boolean;
};

function compareValues(a: string, b: string, dir: SortDirection) {
  const aNum = Number(a);
  const bNum = Number(b);
  const bothNumeric = a.trim() !== "" && b.trim() !== "" && !Number.isNaN(aNum) && !Number.isNaN(bNum);

  let result = 0;

  if (bothNumeric) {
    result = aNum - bNum;
  } else {
    const aDate = Date.parse(a);
    const bDate = Date.parse(b);

    if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) {
      result = aDate - bDate;
    } else {
      result = a.localeCompare(b, "tr", { sensitivity: "base" });
    }
  }

  return dir === "asc" ? result : -result;
}

function sortIndicator(active: boolean, direction: SortDirection) {
  if (!active) return "";
  return direction === "asc" ? " ↑" : " ↓";
}

function truncateText(value: string, maxLength = 32) {
  const text = value.trim();
  if (!text) return "-";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("tr-TR");
}

function mergeColumnOrder(savedOrder: string[], defaultOrder: string[]) {
  const available = new Set(defaultOrder);
  const savedAvailableColumns = savedOrder.filter((id) => available.has(id));
  const newColumns = defaultOrder.filter((id) => !savedAvailableColumns.includes(id));

  return [...savedAvailableColumns, ...newColumns];
}

export default function ServiceFormTemplateList({
  templateName,
  fields,
  forms,
  columnPreferenceUserId,
  backHref,
  newFormHref,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<RowContextMenuState | null>(null);
  const [columnContextMenu, setColumnContextMenu] = useState<ColumnContextMenuState | null>(null);
  const [localForms, setLocalForms] = useState<FormRow[]>(forms);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [useTouchColumnDrag, setUseTouchColumnDrag] = useState(false);
  const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>([]);
  const [hiddenColumnsLoaded, setHiddenColumnsLoaded] = useState(false);
  const [loadedHiddenColumnStorageKey, setLoadedHiddenColumnStorageKey] = useState("");
  const skipNextSortClickRef = useRef(false);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const columnContextMenuRef = useRef<HTMLDivElement | null>(null);
  const columnPointerDragRef = useRef<ColumnPointerDragState | null>(null);
  const columnHeaderRefs = useRef(new Map<string, HTMLTableCellElement>());

  const columns = useMemo<Column[]>(
    () => [
      { id: "form_no", label: "Form No", type: "base" },
      { id: "customer_name", label: "Müşteri", type: "base" },
      { id: "machine_name", label: "Makine", type: "base" },
      { id: "service_date", label: "Servis Tarihi", type: "base" },
      ...fields.map((field) => ({
        id: field.id,
        label: field.field_label,
        type: "field" as const,
        field,
      })),
      { id: "created_at", label: "Oluşturulma", type: "base" },
    ],
    [fields]
  );

  const defaultColumnOrder = useMemo(() => columns.map((column) => column.id), [columns]);
  const columnStorageKey = useMemo(
    () =>
      `service-form-template-list-columns:${columnPreferenceUserId}:${templateName}:${fields.map((field) => field.id).join("|")}`,
    [columnPreferenceUserId, fields, templateName]
  );
  const hiddenColumnStorageKey = useMemo(
    () =>
      `service-form-template-list-hidden-columns:${columnPreferenceUserId}:${templateName}:${fields.map((field) => field.id).join("|")}`,
    [columnPreferenceUserId, fields, templateName]
  );

  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  const orderedColumns = useMemo(() => {
    const order = columnOrder.length > 0 ? columnOrder : defaultColumnOrder;
    const columnsById = new Map(columns.map((column) => [column.id, column]));

    return order.map((id) => columnsById.get(id)).filter((column): column is Column => Boolean(column));
  }, [columnOrder, columns, defaultColumnOrder]);

  const visibleColumns = useMemo(
    () => orderedColumns.filter((column) => !hiddenColumnIds.includes(column.id)),
    [hiddenColumnIds, orderedColumns]
  );

  useEffect(() => {
    let active = true;
    setHiddenColumnsLoaded(false);

    queueMicrotask(() => {
      if (!active) return;

      try {
        const savedOrder = JSON.parse(localStorage.getItem(columnStorageKey) ?? "[]");
        const nextOrder = Array.isArray(savedOrder)
          ? mergeColumnOrder(savedOrder.map(String), defaultColumnOrder)
          : defaultColumnOrder;

        setColumnOrder(nextOrder);
      } catch {
        setColumnOrder(defaultColumnOrder);
      }
    });

    return () => {
      active = false;
    };
  }, [columnStorageKey, defaultColumnOrder]);

  useEffect(() => {
    if (columnOrder.length === 0) return;
    localStorage.setItem(columnStorageKey, JSON.stringify(columnOrder));
  }, [columnOrder, columnStorageKey]);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) return;

      try {
        const available = new Set(defaultColumnOrder);
        const savedHiddenColumns = JSON.parse(localStorage.getItem(hiddenColumnStorageKey) ?? "[]");
        const nextHiddenColumns = Array.isArray(savedHiddenColumns)
          ? savedHiddenColumns.map(String).filter((id) => available.has(id))
          : [];

        setHiddenColumnIds(nextHiddenColumns);
      } catch {
        setHiddenColumnIds([]);
      } finally {
        if (active) {
          setLoadedHiddenColumnStorageKey(hiddenColumnStorageKey);
          setHiddenColumnsLoaded(true);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [defaultColumnOrder, hiddenColumnStorageKey]);

  useEffect(() => {
    if (!hiddenColumnsLoaded || loadedHiddenColumnStorageKey !== hiddenColumnStorageKey) return;
    localStorage.setItem(hiddenColumnStorageKey, JSON.stringify(hiddenColumnIds));
  }, [hiddenColumnIds, hiddenColumnStorageKey, hiddenColumnsLoaded, loadedHiddenColumnStorageKey]);

  useEffect(() => {
    setLocalForms(forms);
  }, [forms]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const updateTouchMode = () => {
      setUseTouchColumnDrag(mediaQuery.matches || navigator.maxTouchPoints > 0);
    };

    updateTouchMode();
    mediaQuery.addEventListener("change", updateTouchMode);

    return () => mediaQuery.removeEventListener("change", updateTouchMode);
  }, []);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (contextMenuRef.current && event.target instanceof Node) {
        if (contextMenuRef.current.contains(event.target)) return;
      }
      if (columnContextMenuRef.current && event.target instanceof Node) {
        if (columnContextMenuRef.current.contains(event.target)) return;
      }
      setContextMenu(null);
      setColumnContextMenu(null);
    }

    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  function toggleSort(key: string) {
    if (skipNextSortClickRef.current) {
      skipNextSortClickRef.current = false;
      return;
    }

    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function moveColumnById(sourceColumnId: string, targetColumnId: string) {
    if (sourceColumnId === targetColumnId) return;

    setColumnOrder((currentOrder) => {
      const order = currentOrder.length > 0 ? currentOrder : defaultColumnOrder;
      const fromIndex = order.indexOf(sourceColumnId);
      const toIndex = order.indexOf(targetColumnId);

      if (fromIndex < 0 || toIndex < 0) return order;

      const nextOrder = [...order];
      const [movedColumn] = nextOrder.splice(fromIndex, 1);
      nextOrder.splice(toIndex, 0, movedColumn);

      return nextOrder;
    });

    skipNextSortClickRef.current = true;
  }

  function moveDraggedColumn(targetColumnId: string) {
    if (!draggedColumnId) return;
    moveColumnById(draggedColumnId, targetColumnId);
  }

  function getColumnLabel(columnId: string) {
    return columns.find((column) => column.id === columnId)?.label ?? "Kolon";
  }

  function clearColumnLongPressTimer() {
    const dragState = columnPointerDragRef.current;
    if (!dragState?.longPressTimer) return;

    window.clearTimeout(dragState.longPressTimer);
    dragState.longPressTimer = null;
  }

  function openColumnContextMenu(columnId: string, x: number, y: number) {
    setContextMenu(null);
    setColumnContextMenu({ x, y, columnId });
  }

  function hideColumn(columnId: string) {
    setColumnContextMenu(null);

    if (visibleColumns.length <= 1 && !hiddenColumnIds.includes(columnId)) {
      setErrorText("En az bir kolon görünür kalmalı.");
      return;
    }

    setHiddenColumnIds((current) => (current.includes(columnId) ? current : [...current, columnId]));

    if (sortKey === columnId) {
      const nextSortColumn = visibleColumns.find((column) => column.id !== columnId);
      setSortKey(nextSortColumn?.id ?? "created_at");
      setSortDirection("asc");
    }
  }

  function showHiddenColumns() {
    setColumnContextMenu(null);
    setHiddenColumnIds([]);
  }

  function setColumnHeaderRef(columnId: string, node: HTMLTableCellElement | null) {
    if (node) {
      columnHeaderRefs.current.set(columnId, node);
      return;
    }

    columnHeaderRefs.current.delete(columnId);
  }

  function findColumnIdAtClientX(clientX: number) {
    let closestColumnId: string | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const column of visibleColumns) {
      const header = columnHeaderRefs.current.get(column.id);
      if (!header) continue;

      const rect = header.getBoundingClientRect();
      if (rect.width <= 0) continue;

      if (clientX >= rect.left && clientX <= rect.right) return column.id;

      const distance = Math.min(Math.abs(clientX - rect.left), Math.abs(clientX - rect.right));
      if (distance < closestDistance) {
        closestDistance = distance;
        closestColumnId = column.id;
      }
    }

    return closestColumnId;
  }

  function handleColumnPointerDown(event: PointerEvent<HTMLTableCellElement>, columnId: string) {
    if (!useTouchColumnDrag || event.pointerType === "mouse" || !event.isPrimary) return;

    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const longPressTimer = window.setTimeout(() => {
      const dragState = columnPointerDragRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId || dragState.moved) return;

      dragState.contextMenuOpened = true;
      openColumnContextMenu(columnId, startX, startY);
    }, 550);

    columnPointerDragRef.current = {
      columnId,
      pointerId: event.pointerId,
      startX,
      startY,
      lastTargetId: columnId,
      longPressTimer,
      contextMenuOpened: false,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleColumnPointerMove(event: PointerEvent<HTMLTableCellElement>) {
    const dragState = columnPointerDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = Math.abs(event.clientX - dragState.startX);
    const deltaY = Math.abs(event.clientY - dragState.startY);

    if (!dragState.moved && deltaX < 8 && deltaY < 8) return;
    clearColumnLongPressTimer();

    if (dragState.contextMenuOpened) return;

    event.preventDefault();
    dragState.moved = true;
    setDraggedColumnId(dragState.columnId);

    const targetColumnId = findColumnIdAtClientX(event.clientX);
    if (!targetColumnId || targetColumnId === dragState.lastTargetId) return;

    moveColumnById(dragState.columnId, targetColumnId);
    dragState.lastTargetId = targetColumnId;
  }

  function handleColumnPointerEnd(event: PointerEvent<HTMLTableCellElement>) {
    const dragState = columnPointerDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    clearColumnLongPressTimer();

    if (dragState.contextMenuOpened) {
      event.preventDefault();
    } else if (dragState.moved) {
      event.preventDefault();
      skipNextSortClickRef.current = true;
    } else {
      toggleSort(dragState.columnId);
    }

    columnPointerDragRef.current = null;
    setDraggedColumnId(null);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function renderCell(row: FormRow, column: Column) {
    if (column.type === "field") {
      return (
        <td
          key={column.id}
          className="max-w-[220px] whitespace-nowrap px-4 py-3 text-sm text-slate-700"
          title={row.values[column.field.id] || "-"}
        >
          {truncateText(row.values[column.field.id] || "-")}
        </td>
      );
    }

    if (column.id === "form_no") {
      return (
        <td key={column.id} className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">
          {row.form_no ?? "Form"}
        </td>
      );
    }

    if (column.id === "customer_name") {
      return (
        <td key={column.id} className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
          {row.customer_name || "-"}
        </td>
      );
    }

    if (column.id === "machine_name") {
      return (
        <td key={column.id} className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
          {row.machine_name || "-"}
        </td>
      );
    }

    if (column.id === "service_date") {
      return (
        <td key={column.id} className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
          {formatDate(row.service_date)}
        </td>
      );
    }

    return (
      <td key={column.id} className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
        {formatDate(row.created_at)}
      </td>
    );
  }

  const rows = useMemo(() => {
    let filtered = [...localForms];

    if (search.trim()) {
      const q = search.toLocaleLowerCase("tr-TR");

      filtered = filtered.filter((row) => {
        const baseText = [
          row.form_no ?? "",
          row.customer_name,
          row.machine_name,
          row.service_date ?? "",
          ...fields.map((field) => row.values[field.id] ?? ""),
        ]
          .join(" ")
          .toLocaleLowerCase("tr-TR");

        return baseText.includes(q);
      });
    }

    filtered.sort((left, right) => {
      const leftValue =
        sortKey === "form_no"
          ? left.form_no ?? ""
          : sortKey === "customer_name"
            ? left.customer_name
            : sortKey === "machine_name"
              ? left.machine_name
              : sortKey === "service_date"
                ? left.service_date ?? ""
                : sortKey === "created_at"
                  ? left.created_at ?? ""
                  : left.values[sortKey] ?? "";

      const rightValue =
        sortKey === "form_no"
          ? right.form_no ?? ""
          : sortKey === "customer_name"
            ? right.customer_name
            : sortKey === "machine_name"
              ? right.machine_name
              : sortKey === "service_date"
                ? right.service_date ?? ""
                : sortKey === "created_at"
                  ? right.created_at ?? ""
                  : right.values[sortKey] ?? "";

      return compareValues(String(leftValue), String(rightValue), sortDirection);
    });

    return filtered;
  }, [fields, localForms, search, sortDirection, sortKey]);

  const sortableHeaderClass =
    "cursor-grab whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 active:cursor-grabbing";

  function handleEdit(formId: string) {
    setContextMenu(null);
    router.push(`/dashboard/service-forms/${formId}`);
  }

  function getFileNameFromDisposition(disposition: string | null) {
    const match = disposition?.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
    if (!match?.[1]) return "servis_formu.pdf";

    try {
      return decodeURIComponent(match[1].replaceAll('"', ""));
    } catch {
      return match[1].replaceAll('"', "");
    }
  }

  async function handleDownloadPdf(formId: string) {
    setContextMenu(null);
    setErrorText("");
    setSuccessText("");
    setDownloadingPdfId(formId);

    try {
      const response = await fetch(`/api/service-forms/${formId}/pdf`);

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? "PDF indirilemedi.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = getFileNameFromDisposition(response.headers.get("Content-Disposition"));
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "PDF indirilemedi.");
    } finally {
      setDownloadingPdfId(null);
    }
  }

  async function handleDelete(formId: string) {
    const confirmed = window.confirm("Servis formu silinsin mi?");
    if (!confirmed) return;

    setErrorText("");
    setSuccessText("");
    setContextMenu(null);

    const response = await fetch(`/api/service-forms/${formId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setErrorText(result.error ?? "Servis formu silinemedi.");
      return;
    }

    setLocalForms((prev) => prev.filter((form) => form.id !== formId));
    setSuccessText("Servis formu silindi.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <CompactFilterActionBar>
        <div className="min-w-0 flex-1">
          <label className="sr-only">Ara</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`${templateName} içinde ara`}
            className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
          />
        </div>

        <div className="flex h-11 shrink-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 shadow-sm">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Toplam Kayıt</div>
          <div className="text-lg font-semibold text-slate-900">{rows.length}</div>
        </div>

        {backHref || newFormHref ? (
          <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
            {backHref ? (
              <Link
                href={backHref}
                className="flex h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Geri
              </Link>
            ) : null}

            {newFormHref ? (
              <Link
                href={newFormHref}
                className="flex h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Yeni Form
              </Link>
            ) : null}
          </div>
        ) : null}
      </CompactFilterActionBar>

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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                {visibleColumns.map((column) => (
                  <th
                    key={column.id}
                    ref={(node) => setColumnHeaderRef(column.id, node)}
                    data-column-id={column.id}
                    draggable={!useTouchColumnDrag}
                    className={`${sortableHeaderClass} select-none ${draggedColumnId === column.id ? "bg-slate-200" : ""}`}
                    style={{
                      touchAction: "none",
                      WebkitTouchCallout: "none",
                      WebkitUserSelect: "none",
                      userSelect: "none",
                    }}
                    onClick={() => {
                      if (useTouchColumnDrag) return;
                      toggleSort(column.id);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openColumnContextMenu(column.id, event.clientX, event.clientY);
                    }}
                    onPointerDown={(event) => handleColumnPointerDown(event, column.id)}
                    onPointerMove={handleColumnPointerMove}
                    onPointerUp={handleColumnPointerEnd}
                    onPointerCancel={handleColumnPointerEnd}
                    onDragStart={(event) => {
                      if (useTouchColumnDrag) {
                        event.preventDefault();
                        return;
                      }
                      setDraggedColumnId(column.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", column.id);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      moveDraggedColumn(column.id);
                    }}
                    onDragEnd={() => setDraggedColumnId(null)}
                    title="Kolonu taşımak için sürükleyin"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="text-slate-400" aria-hidden="true">
                        ::
                      </span>
                      <span>
                        {column.label}
                        {sortIndicator(sortKey === column.id, sortDirection)}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-sm text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/dashboard/service-forms/${row.id}`)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setColumnContextMenu(null);
                      setContextMenu({
                        x: event.clientX,
                        y: event.clientY,
                        formId: row.id,
                      });
                    }}
                    className="cursor-pointer border-b border-slate-200 last:border-b-0 transition-all duration-150 hover:bg-slate-200/80 hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]"
                  >
                    {visibleColumns.map((column) => renderCell(row, column))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {columnContextMenu ? (
        <div
          ref={columnContextMenuRef}
          className="context-menu-layer fixed min-w-[230px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"
          style={{ left: columnContextMenu.x, top: columnContextMenu.y }}
        >
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {getColumnLabel(columnContextMenu.columnId)}
          </div>
          <button
            type="button"
            onClick={() => hideColumn(columnContextMenu.columnId)}
            disabled={visibleColumns.length <= 1}
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
          >
            Kolonu Gizleme
          </button>
          <button
            type="button"
            onClick={showHiddenColumns}
            disabled={hiddenColumnIds.length === 0}
            className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
          >
            Gizlenenleri Göster
          </button>
        </div>
      ) : null}

      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="context-menu-layer fixed min-w-[220px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            onClick={() => handleEdit(contextMenu.formId)}
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            Düzenle
          </button>
          <button
            type="button"
            onClick={() => handleDownloadPdf(contextMenu.formId)}
            disabled={downloadingPdfId === contextMenu.formId}
            className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            {downloadingPdfId === contextMenu.formId ? "Hazırlanıyor..." : "PDF İndir"}
          </button>
          <button
            type="button"
            onClick={() => handleDelete(contextMenu.formId)}
            className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            Sil
          </button>
        </div>
      ) : null}
    </div>
  );
}
