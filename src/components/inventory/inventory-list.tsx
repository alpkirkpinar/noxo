"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useDismissFloatingLayer } from "@/hooks/use-dismiss-floating-layer";
import { useTouchContextMenu } from "@/hooks/use-touch-context-menu";

type CurrencyCode = "TRY" | "USD" | "EUR";

type InventoryRow = {
  id: string;
  company_id: string;
  warehouse_id?: string | null;
  item_code: string;
  manufacturer_code?: string | null;
  item_name: string;
  description?: string | null;
  category?: string | null;
  unit?: string | null;
  cost_price?: number | null;
  sale_price?: number | null;
  min_stock?: number | null;
  current_stock: number;
  currency_code?: string | null;
  location_text?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  unit_price?: number | null;
  currency?: CurrencyCode | null;
};

type MovementRow = {
  id: string;
  movement_type: string;
  quantity: number;
  unit_cost: number | null;
  note: string | null;
  created_at: string;
  inventory_item_id?: string;
  inventory_items?: {
    item_code?: string | null;
    item_name?: string | null;
  } | null;
};

type Props = {
  companyId: string;
  items: InventoryRow[];
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canStockIn: boolean;
    canStockOut: boolean;
    canImport: boolean;
    canExport: boolean;
  };
};

type SortKey =
  | "item_name"
  | "item_code"
  | "manufacturer_code"
  | "description"
  | "category"
  | "unit_price"
  | "currency"
  | "current_stock"
  | "min_stock";

type SortDirection = "asc" | "desc";

type NewPartFormState = {
  item_code: string;
  manufacturer_code: string;
  item_name: string;
  unit: string;
  current_stock: string;
  min_stock: string;
  unit_price: string;
  currency: CurrencyCode;
  brand: string;
  description: string;
};

type StockMoveFormState = {
  item_code: string;
  quantity: string;
};

type EditFormState = {
  item_code: string;
  manufacturer_code: string;
  item_name: string;
  unit: string;
  current_stock: string;
  min_stock: string;
  unit_price: string;
  currency: CurrencyCode;
  brand: string;
  description: string;
};

type ContextMenuState = {
  x: number;
  y: number;
  itemId: string;
};

type CsvImportMode = "append" | "overwrite";

const emptyNewPartForm: NewPartFormState = {
  item_code: "",
  manufacturer_code: "",
  item_name: "",
  unit: "adet",
  current_stock: "",
  min_stock: "",
  unit_price: "",
  currency: "TRY",
  brand: "",
  description: "",
};

const emptyStockMoveForm: StockMoveFormState = {
  item_code: "",
  quantity: "",
};

const emptyEditForm: EditFormState = {
  item_code: "",
  manufacturer_code: "",
  item_name: "",
  unit: "adet",
  current_stock: "",
  min_stock: "",
  unit_price: "",
  currency: "TRY",
  brand: "",
  description: "",
};

function compareValues(a: string | number, b: string | number, dir: SortDirection) {
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

  return dir === "asc" ? result : -result;
}

function toNumber(value: string) {
  const normalized = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");
  const num = Number(normalized);
  return Number.isNaN(num) ? 0 : num;
}

function normalizeCurrency(value?: string | null): CurrencyCode {
  if (value === "USD" || value === "EUR") return value;
  return "TRY";
}

function formatCurrency(value?: number | null, currency: CurrencyCode = "TRY") {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value?: number | null, minimumFractionDigits = 0) {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits,
    maximumFractionDigits: 2,
  }).format(value);
}

function movementTypeLabel(value: string) {
  switch (value) {
    case "create":
      return "Yeni Parça";
    case "import":
      return "İçe Aktarım";
    case "stock_in":
    case "in":
    case "entry":
    case "increase":
      return "Parça Girişi";
    case "stock_out":
    case "out":
    case "exit":
    case "decrease":
      return "Parça Çıkışı";
    case "update":
      return "Düzenleme";
    case "adjustment":
      return "Düzeltme";
    default:
      return value;
  }
}

function countDelimiter(line: string, delimiter: "," | ";") {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      count += 1;
    }
  }

  return count;
}

function detectCsvDelimiter(line: string): "," | ";" {
  return countDelimiter(line, ";") > countDelimiter(line, ",") ? ";" : ",";
}

function parseCsvLine(line: string, delimiter: "," | ";" = ",") {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result.map((x) => x.replace(/^"|"$/g, "").trim());
}

function isInventoryCsvHeader(cols: string[]) {
  const normalized = cols.map((col) => normalizeCsvHeaderValue(col));

  return (
    normalized.includes("parça kodu") ||
    normalized.includes("parca kodu") ||
    normalized.includes("item_code") ||
    normalized.includes("item code")
  );
}

function normalizeCsvHeaderValue(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\./g, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

const CSV_FIELD_ALIASES: Record<string, string[]> = {
  item_code: ["parça kodu", "parca kodu", "item code", "item_code", "stok kodu", "ürün kodu", "urun kodu"],
  manufacturer_code: [
    "üretici kodu",
    "uretici kodu",
    "üretici parça kodu",
    "uretici parca kodu",
    "manufacturer code",
    "manufacturer_code",
    "vendor code",
  ],
  item_name: ["parça adı", "parca adi", "parça adi", "parca adı", "item name", "item_name", "ürün adı", "urun adi"],
  category: ["marka", "kategori", "category"],
  description: ["açıklama", "aciklama", "description", "not"],
  unit: ["birim", "unit"],
  unit_price: ["birim fiyat", "fiyat", "unit price", "unit_price"],
  currency: ["para birimi", "döviz", "doviz", "currency"],
  current_stock: ["stok", "mevcut stok", "current stock", "current_stock"],
  min_stock: ["min stok", "min. stok", "minimum stok", "minimum stock", "min_stock"],
};

function buildCsvHeaderIndex(cols: string[]) {
  const indexMap = new Map<string, number>();

  cols.forEach((col, index) => {
    const normalized = normalizeCsvHeaderValue(col);

    Object.entries(CSV_FIELD_ALIASES).forEach(([field, aliases]) => {
      if (!indexMap.has(field) && aliases.includes(normalized)) {
        indexMap.set(field, index);
      }
    });
  });

  return indexMap;
}

function getCsvValue(cols: string[], headerIndex: Map<string, number> | null, field: string, fallbackIndex: number) {
  if (headerIndex?.has(field)) {
    return cols[headerIndex.get(field) ?? -1] ?? "";
  }

  return cols[fallbackIndex] ?? "";
}

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes(";") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export default function InventoryList({ companyId, items, permissions }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [allItems, setAllItems] = useState<InventoryRow[]>(
    items.map((item) => ({
      ...item,
      currency: normalizeCurrency(item.currency ?? item.currency_code),
    }))
  );

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("item_name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [showNewPartModal, setShowNewPartModal] = useState(false);
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showItemHistoryModal, setShowItemHistoryModal] = useState(false);
  const [showGeneralHistoryModal, setShowGeneralHistoryModal] = useState(false);
  const [showImportModeModal, setShowImportModeModal] = useState(false);

  const [newPartForm, setNewPartForm] = useState<NewPartFormState>(emptyNewPartForm);
  const [stockInForm, setStockInForm] = useState<StockMoveFormState>(emptyStockMoveForm);
  const [stockOutForm, setStockOutForm] = useState<StockMoveFormState>(emptyStockMoveForm);
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [itemHistoryTitle, setItemHistoryTitle] = useState("");
  const [itemHistoryRows, setItemHistoryRows] = useState<MovementRow[]>([]);
  const [generalHistoryRows, setGeneralHistoryRows] = useState<MovementRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingImportItems, setPendingImportItems] = useState<Array<Record<string, unknown>>>([]);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const { activeId, bindRow, shouldSuppressClick } = useTouchContextMenu((itemId, x, y) => {
    setContextMenu({ x, y, itemId });
  });
  useDismissFloatingLayer([contextMenuRef], () => setContextMenu(null));
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const codeListId = "inventory-item-codes";

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
    const availableIds = new Set(allItems.map((item) => item.id));
    queueMicrotask(() => {
      setSelectedIds((prev) => prev.filter((id) => availableIds.has(id)));
    });
  }, [allItems]);

  function resetMessages() {
    setErrorText("");
    setSuccessText("");
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function openNewPartModal() {
    if (!permissions.canCreate) {
      setErrorText("Stok kartı oluşturma yetkiniz yok.");
      return;
    }

    resetMessages();
    setNewPartForm(emptyNewPartForm);
    setShowNewPartModal(true);
  }

  function closeNewPartModal() {
    setShowNewPartModal(false);
    setNewPartForm(emptyNewPartForm);
  }

  function openStockInModal() {
    if (!permissions.canStockIn) {
      setErrorText("Stok giriş yetkiniz yok.");
      return;
    }

    resetMessages();
    setStockInForm(emptyStockMoveForm);
    setShowStockInModal(true);
  }

  function closeStockInModal() {
    setShowStockInModal(false);
    setStockInForm(emptyStockMoveForm);
  }

  function openStockOutModal() {
    if (!permissions.canStockOut) {
      setErrorText("Stok çıkış yetkiniz yok.");
      return;
    }

    resetMessages();
    setStockOutForm(emptyStockMoveForm);
    setShowStockOutModal(true);
  }

  function closeStockOutModal() {
    setShowStockOutModal(false);
    setStockOutForm(emptyStockMoveForm);
  }

  function openEditModal(itemId: string) {
    if (!permissions.canEdit) {
      setErrorText("Stok kartı düzenleme yetkiniz yok.");
      setContextMenu(null);
      return;
    }

    const item = allItems.find((x) => x.id === itemId);
    if (!item) return;

    resetMessages();
    setEditingItemId(itemId);
    setEditForm({
      item_code: item.item_code,
      manufacturer_code: item.manufacturer_code ?? "",
      item_name: item.item_name,
      unit: item.unit?.trim() || "adet",
      current_stock: String(item.current_stock ?? ""),
      min_stock: item.min_stock != null ? String(item.min_stock) : "",
      unit_price: item.unit_price != null ? String(item.unit_price) : "",
      currency: normalizeCurrency(item.currency ?? item.currency_code),
      brand: item.category ?? "",
      description: item.description ?? "",
    });
    setShowEditModal(true);
    setContextMenu(null);
  }

  function closeEditModal() {
    setShowEditModal(false);
    setEditingItemId(null);
    setEditForm(emptyEditForm);
  }

  async function openItemHistoryModal(itemId: string) {
    const item = allItems.find((x) => x.id === itemId);
    if (!item) return;

    resetMessages();
    setItemHistoryTitle(`${item.item_name} (${item.item_code})`);
    setItemHistoryRows([]);
    setShowItemHistoryModal(true);
    setLoadingHistory(true);

    const { data, error } = await supabase
      .from("inventory_movements")
      .select("id, movement_type, quantity, unit_cost, note, created_at, inventory_item_id")
      .eq("company_id", companyId)
      .eq("inventory_item_id", itemId)
      .order("created_at", { ascending: false });

    setLoadingHistory(false);

    if (error) {
      setErrorText(error.message);
      return;
    }

    setItemHistoryRows((data ?? []) as MovementRow[]);
    setContextMenu(null);
  }

  function closeItemHistoryModal() {
    setShowItemHistoryModal(false);
    setItemHistoryTitle("");
    setItemHistoryRows([]);
  }

  async function openGeneralHistoryModal() {
    resetMessages();
    setGeneralHistoryRows([]);
    setShowGeneralHistoryModal(true);
    setLoadingHistory(true);

    const { data, error } = await supabase
      .from("inventory_movements")
      .select("id, movement_type, quantity, unit_cost, note, created_at, inventory_item_id")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    setLoadingHistory(false);

    if (error) {
      setErrorText(error.message);
      return;
    }

    setGeneralHistoryRows(
      ((data ?? []) as MovementRow[]).map((movement) => {
        const item = allItems.find((row) => row.id === movement.inventory_item_id);

        return {
          ...movement,
          inventory_items: item
            ? {
                item_code: item.item_code,
                item_name: item.item_name,
              }
            : null,
        };
      })
    );
  }

  function closeGeneralHistoryModal() {
    setShowGeneralHistoryModal(false);
    setGeneralHistoryRows([]);
  }

  async function handleCreateItem() {
    resetMessages();

    if (!permissions.canCreate) {
      setErrorText("Stok kartı oluşturma yetkiniz yok.");
      return;
    }

    if (!newPartForm.item_code.trim()) {
      setErrorText("Parça kodu zorunludur.");
      return;
    }

    if (!newPartForm.item_name.trim()) {
      setErrorText("Parça adı zorunludur.");
      return;
    }

    if (!newPartForm.current_stock.trim()) {
      setErrorText("Stok zorunludur.");
      return;
    }

    if (saving) return;
    setSaving(true);

    const payload = {
      company_id: companyId,
      item_code: newPartForm.item_code.trim(),
      manufacturer_code: newPartForm.manufacturer_code.trim() || null,
      item_name: newPartForm.item_name.trim(),
      unit: newPartForm.unit.trim() || "adet",
      current_stock: toNumber(newPartForm.current_stock),
      min_stock: newPartForm.min_stock.trim() ? toNumber(newPartForm.min_stock) : null,
      category: newPartForm.brand.trim() || null,
      description: newPartForm.description.trim() || null,
      unit_price: newPartForm.unit_price.trim() ? toNumber(newPartForm.unit_price) : null,
      currency: normalizeCurrency(newPartForm.currency),
      is_active: true,
    };

    const response = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    setSaving(false);

    if (!response.ok) {
      setErrorText(result.error ?? "Parça eklenemedi.");
      return;
    }

    const data = result.item as InventoryRow;

    setAllItems((prev) => [
      {
        ...data,
        currency: normalizeCurrency(data.currency ?? data.currency_code),
      } as InventoryRow,
      ...prev,
    ]);

    closeNewPartModal();
    setSuccessText("Parça eklendi.");
    router.refresh();
  }

  async function handleStockIn() {
    resetMessages();

    if (!permissions.canStockIn) {
      setErrorText("Stok giriş yetkiniz yok.");
      return;
    }

    if (!stockInForm.item_code.trim()) {
      setErrorText("Parça kodu zorunludur.");
      return;
    }

    if (!stockInForm.quantity.trim()) {
      setErrorText("Adet zorunludur.");
      return;
    }

    const qty = toNumber(stockInForm.quantity);
    if (qty <= 0) {
      setErrorText("Geçerli bir adet girin.");
      return;
    }

    const item = allItems.find(
      (x) => x.item_code.toLocaleLowerCase("tr-TR") === stockInForm.item_code.trim().toLocaleLowerCase("tr-TR")
    );

    if (!item) {
      setErrorText("Parça kodu bulunamadı.");
      return;
    }

    if (saving) return;
    setSaving(true);

    const response = await fetch(`/api/inventory/${item.id}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "in", quantity: qty }),
    });
    const result = await response.json().catch(() => ({}));

    setSaving(false);

    if (!response.ok) {
      setErrorText(result.error ?? "Parça girişi işlenemedi.");
      return;
    }

    const data = result.item as InventoryRow;

    setAllItems((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? ({ ...data, currency: normalizeCurrency(data.currency ?? data.currency_code) } as InventoryRow)
          : row
      )
    );

    closeStockInModal();
    setSuccessText("Parça girişi işlendi.");
    router.refresh();
  }

  async function handleStockOut() {
    resetMessages();

    if (!permissions.canStockOut) {
      setErrorText("Stok çıkış yetkiniz yok.");
      return;
    }

    if (!stockOutForm.item_code.trim()) {
      setErrorText("Parça kodu zorunludur.");
      return;
    }

    if (!stockOutForm.quantity.trim()) {
      setErrorText("Adet zorunludur.");
      return;
    }

    const qty = toNumber(stockOutForm.quantity);
    if (qty <= 0) {
      setErrorText("Geçerli bir adet girin.");
      return;
    }

    const item = allItems.find(
      (x) => x.item_code.toLocaleLowerCase("tr-TR") === stockOutForm.item_code.trim().toLocaleLowerCase("tr-TR")
    );

    if (!item) {
      setErrorText("Parça kodu bulunamadı.");
      return;
    }

    if (qty > Number(item.current_stock ?? 0)) {
      setErrorText("Çıkış adedi mevcut stoktan büyük olamaz.");
      return;
    }

    if (saving) return;
    setSaving(true);

    const response = await fetch(`/api/inventory/${item.id}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "out", quantity: qty }),
    });
    const result = await response.json().catch(() => ({}));

    setSaving(false);

    if (!response.ok) {
      setErrorText(result.error ?? "Parça çıkışı işlenemedi.");
      return;
    }

    const data = result.item as InventoryRow;

    setAllItems((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? ({ ...data, currency: normalizeCurrency(data.currency ?? data.currency_code) } as InventoryRow)
          : row
      )
    );

    closeStockOutModal();
    setSuccessText("Parça çıkışı işlendi.");
    router.refresh();
  }

  async function handleEditItem() {
    resetMessages();

    if (!editingItemId) return;

    if (!permissions.canEdit) {
      setErrorText("Stok kartı düzenleme yetkiniz yok.");
      return;
    }

    if (!editForm.item_code.trim()) {
      setErrorText("Parça kodu zorunludur.");
      return;
    }

    if (!editForm.item_name.trim()) {
      setErrorText("Parça adı zorunludur.");
      return;
    }

    if (!editForm.current_stock.trim()) {
      setErrorText("Stok zorunludur.");
      return;
    }

    if (saving) return;
    setSaving(true);

    const payload = {
      item_code: editForm.item_code.trim(),
      manufacturer_code: editForm.manufacturer_code.trim() || null,
      item_name: editForm.item_name.trim(),
      unit: editForm.unit.trim() || "adet",
      current_stock: toNumber(editForm.current_stock),
      min_stock: editForm.min_stock.trim() ? toNumber(editForm.min_stock) : null,
      category: editForm.brand.trim() || null,
      description: editForm.description.trim() || null,
      unit_price: editForm.unit_price.trim() ? toNumber(editForm.unit_price) : null,
      currency: normalizeCurrency(editForm.currency),
    };

    const response = await fetch(`/api/inventory/${editingItemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    setSaving(false);

    if (!response.ok) {
      setErrorText(result.error ?? "Parça güncellenemedi.");
      return;
    }

    const data = result.item as InventoryRow;

    setAllItems((prev) =>
      prev.map((item) =>
        item.id === editingItemId
          ? ({ ...data, currency: normalizeCurrency(data.currency ?? data.currency_code) } as InventoryRow)
          : item
      )
    );

    closeEditModal();
    setSuccessText("Parça güncellendi.");
    router.refresh();
  }

  async function handleDeleteItem(itemId: string) {
    if (!permissions.canDelete) {
      setErrorText("Stok kartı silme yetkiniz yok.");
      setContextMenu(null);
      return;
    }

    if (saving) return;
    setSaving(true);

    const response = await fetch(`/api/inventory/${itemId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));

    setSaving(false);

    if (!response.ok) {
      setErrorText(result.error ?? "Parça silinemedi.");
      return;
    }

    setAllItems((prev) => prev.filter((item) => item.id !== itemId));
    setContextMenu(null);
    setSuccessText("Parça silindi.");
    router.refresh();
  }

  function toggleItemSelection(itemId: string) {
    setSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  }

  function toggleVisibleSelection() {
    const visibleIds = rows.map((item) => item.id);
    const visibleIdSet = new Set(visibleIds);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleIdSet.has(id));
      }

      return Array.from(new Set([...prev, ...visibleIds]));
    });
  }

  async function handleBulkDelete() {
    resetMessages();

    if (!permissions.canDelete) {
      setErrorText("Stok kartı silme yetkiniz yok.");
      return;
    }

    if (selectedIds.length === 0) {
      setErrorText("Silmek için en az bir parça seçin.");
      return;
    }

    const confirmed = window.confirm(`${selectedIds.length} parça silinsin mi?`);
    if (!confirmed) return;

    if (saving) return;
    setSaving(true);

    const response = await fetch("/api/inventory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    });
    const result = await response.json().catch(() => ({}));

    setSaving(false);

    if (!response.ok) {
      setErrorText(result.error ?? "Seçili parçalar silinemedi.");
      return;
    }

    const selectedIdSet = new Set(selectedIds);
    setAllItems((prev) => prev.filter((item) => !selectedIdSet.has(item.id)));
    setSelectedIds([]);
    setSuccessText(`${result.deleted ?? selectedIds.length} parça silindi.`);
    router.refresh();
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    resetMessages();

    if (!permissions.canImport) {
      setErrorText("CSV import yetkiniz yok.");
      e.target.value = "";
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorText("Sadece .csv dosyası import edilebilir.");
      e.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter((x) => x.trim() !== "");

      if (lines.length === 0) {
        setErrorText("CSV içinde veri bulunamadı.");
        e.target.value = "";
        return;
      }

      const delimiter = detectCsvDelimiter(lines[0]);
      const firstRow = parseCsvLine(lines[0], delimiter);
      const hasHeader = isInventoryCsvHeader(firstRow);
      const headerIndex = hasHeader ? buildCsvHeaderIndex(firstRow) : null;
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const importedItems = dataLines
        .map((line) => parseCsvLine(line, delimiter))
        .filter((cols) => cols.some((x) => x !== ""))
        .map((cols) => {
          const usesNewPositionalOrder = !headerIndex && cols.length >= 10;

          const itemCode = getCsvValue(cols, headerIndex, "item_code", 0);
          const manufacturerCode = usesNewPositionalOrder
            ? cols[1] ?? ""
            : getCsvValue(cols, headerIndex, "manufacturer_code", -1);
          const itemName = usesNewPositionalOrder
            ? cols[2] ?? ""
            : getCsvValue(cols, headerIndex, "item_name", 1);
          const category = usesNewPositionalOrder
            ? cols[3] ?? ""
            : getCsvValue(cols, headerIndex, "category", 2);
          const description = usesNewPositionalOrder
            ? cols[4] ?? ""
            : getCsvValue(cols, headerIndex, "description", 3);
          const unit = usesNewPositionalOrder
            ? cols[5] ?? "adet"
            : getCsvValue(cols, headerIndex, "unit", 4);
          const unitPrice = usesNewPositionalOrder
            ? cols[6] ?? ""
            : getCsvValue(cols, headerIndex, "unit_price", 5);
          const currency = usesNewPositionalOrder
            ? cols[7] ?? "TRY"
            : getCsvValue(cols, headerIndex, "currency", 6);
          const currentStock = usesNewPositionalOrder
            ? cols[8] ?? "0"
            : getCsvValue(cols, headerIndex, "current_stock", 7);
          const minStock = usesNewPositionalOrder
            ? cols[9] ?? ""
            : getCsvValue(cols, headerIndex, "min_stock", 8);

          return {
            company_id: companyId,
            item_code: itemCode,
            manufacturer_code: manufacturerCode.trim() || null,
            item_name: itemName,
            category: category.trim() || null,
            description: description.trim() || null,
            unit: unit.trim() || "adet",
            unit_price: unitPrice.trim() ? toNumber(unitPrice) : null,
            currency: normalizeCurrency(currency),
            current_stock: toNumber(currentStock),
            min_stock: minStock.trim() ? toNumber(minStock) : null,
            is_active: true,
          };
        })
        .filter((item) => item.item_code.trim() && item.item_name.trim());

      if (!importedItems.length) {
        setErrorText("Geçerli satır bulunamadı.");
        e.target.value = "";
        return;
      }

      setPendingImportItems(importedItems);
      setShowImportModeModal(true);
    } catch {
      setErrorText("CSV okunamadı.");
    }

    e.target.value = "";
  }

  async function handleConfirmCsvImport(importMode: CsvImportMode) {
    resetMessages();

    if (!permissions.canImport) {
      setErrorText("CSV import yetkiniz yok.");
      return;
    }

    if (pendingImportItems.length === 0) {
      setErrorText("İçe aktarılacak kayıt bulunamadı.");
      setShowImportModeModal(false);
      return;
    }

    if (saving) return;
    setSaving(true);

    const response = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "import", importMode, items: pendingImportItems }),
    });
    const result = await response.json().catch(() => ({}));

    setSaving(false);

    if (!response.ok) {
      setErrorText(result.error ?? "CSV import yapılamadı.");
      return;
    }

    const data = ((result.items ?? []) as InventoryRow[]).map((item) => ({
      ...item,
      currency: normalizeCurrency(item.currency ?? item.currency_code),
    })) as InventoryRow[];

    setAllItems((prev) => {
      if (importMode === "append") {
        return [...data, ...prev];
      }

      const importedIdSet = new Set(data.map((item) => item.id));
      const importedCodeSet = new Set(data.map((item) => item.item_code));
      const remainingItems = prev.filter(
        (item) => !importedIdSet.has(item.id) && !importedCodeSet.has(item.item_code)
      );

      return [...data, ...remainingItems];
    });

    setPendingImportItems([]);
    setShowImportModeModal(false);
    setSuccessText(`${data.length} kayıt içe aktarıldı.`);
    router.refresh();
  }

  function closeImportModeModal() {
    setShowImportModeModal(false);
    setPendingImportItems([]);
  }

  function exportInventoryItems(exportItems: InventoryRow[]) {
    if (!permissions.canExport) {
      setErrorText("CSV export yetkiniz yok.");
      return;
    }

    if (exportItems.length === 0) {
      setErrorText("Export edilecek kayıt bulunamadı.");
      return;
    }

    const headers = [
      "Parça Kodu",
      "Üretici Kodu",
      "Parça Adı",
      "Marka",
      "Açıklama",
      "Birim",
      "Birim Fiyat",
      "Para Birimi",
      "Stok",
      "Min. Stok",
    ];

    const lines = exportItems.map((item) =>
      [
        csvEscape(item.item_code),
        csvEscape(item.manufacturer_code ?? ""),
        csvEscape(item.item_name),
        csvEscape(item.category ?? ""),
        csvEscape(item.description ?? ""),
        csvEscape(item.unit ?? ""),
        csvEscape(item.unit_price == null ? "" : formatNumber(item.unit_price, 2)),
        csvEscape(item.currency ?? item.currency_code ?? "TRY"),
        csvEscape(formatNumber(item.current_stock)),
        csvEscape(item.min_stock == null ? "" : formatNumber(item.min_stock)),
      ].join(",")
    );

    const csvContent = "\uFEFF" + [headers.join(","), ...lines].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "depo-export.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleCsvExport() {
    exportInventoryItems(rows);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleAddToOffer(itemIds: string | string[]) {
    const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
    const idSet = new Set(ids);
    const selectedItems = allItems.filter((item) => idSet.has(item.id));

    if (selectedItems.length === 0) {
      setErrorText("Fiyat teklifine eklemek için en az bir parça seçin.");
      return;
    }

    window.localStorage.setItem(
      "noxo_offer_prefill_items",
      JSON.stringify(
        selectedItems.map((item) => ({
          item_id: item.id,
          item_code: item.item_code,
          item_name: item.item_name,
          description: item.description ?? "",
          unit: item.unit ?? "adet",
          unit_price: item.unit_price ?? 0,
          currency: item.currency ?? item.currency_code ?? "TRY",
        }))
      )
    );

    setContextMenu(null);
    setSelectedIds([]);
    setSelectionMode(false);
    router.push("/dashboard/offers?new=1");
  }

  const rows = (() => {
    let filtered = [...allItems];

    if (search.trim()) {
      const q = search.toLocaleLowerCase("tr-TR");

      filtered = filtered.filter((row) => {
        const text = [
          row.item_name,
          row.item_code,
          row.manufacturer_code ?? "",
          row.description ?? "",
          row.category ?? "",
          row.unit_price ?? "",
          row.currency ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("tr-TR");

        return text.includes(q);
      });
    }

    if (stockFilter === "low") {
      filtered = filtered.filter(
        (row) => (row.min_stock ?? 0) > 0 && Number(row.current_stock ?? 0) <= Number(row.min_stock ?? 0)
      );
    }

    if (stockFilter === "out") {
      filtered = filtered.filter((row) => Number(row.current_stock ?? 0) <= 0);
    }

    filtered.sort((left, right) => {
      const leftValue =
        sortKey === "item_name"
          ? left.item_name
          : sortKey === "item_code"
          ? left.item_code
          : sortKey === "manufacturer_code"
          ? left.manufacturer_code ?? ""
          : sortKey === "description"
          ? left.description ?? ""
          : sortKey === "category"
          ? left.category ?? ""
          : sortKey === "currency"
          ? left.currency ?? "TRY"
          : sortKey === "unit_price"
          ? left.unit_price ?? 0
          : sortKey === "current_stock"
          ? left.current_stock
          : left.min_stock ?? 0;

      const rightValue =
        sortKey === "item_name"
          ? right.item_name
          : sortKey === "item_code"
          ? right.item_code
          : sortKey === "manufacturer_code"
          ? right.manufacturer_code ?? ""
          : sortKey === "description"
          ? right.description ?? ""
          : sortKey === "category"
          ? right.category ?? ""
          : sortKey === "currency"
          ? right.currency ?? "TRY"
          : sortKey === "unit_price"
          ? right.unit_price ?? 0
          : sortKey === "current_stock"
          ? right.current_stock
          : right.min_stock ?? 0;

      return compareValues(leftValue, rightValue, sortDirection);
    });

    return filtered;
  })();

  const sortableHeaderClass =
    "cursor-pointer whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-300";

  return (
    <>
      <datalist id={codeListId}>
        {allItems.map((item) => (
          <option key={item.id} value={item.item_code}>
            {item.item_name}
          </option>
        ))}
      </datalist>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleCsvImport}
        className="hidden"
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {permissions.canCreate ? (
            <button
              type="button"
              onClick={openNewPartModal}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Yeni Parça Ekle
            </button>
            ) : null}

            {permissions.canStockIn ? (
            <button
              type="button"
              onClick={openStockInModal}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Parça Girişi
            </button>
            ) : null}

            {permissions.canStockOut ? (
            <button
              type="button"
              onClick={openStockOutModal}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Parça Çıkışı
            </button>
            ) : null}

            <button
              type="button"
              onClick={openGeneralHistoryModal}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Genel Geçmiş
            </button>

            {permissions.canImport ? (
            <button
              type="button"
              onClick={handleImportClick}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Import CSV
            </button>
            ) : null}

            {permissions.canExport ? (
            <button
              type="button"
              onClick={handleCsvExport}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </button>
            ) : null}
          </div>

          <div className="text-xs text-slate-500">
            CSV kolon sırası: Parça Kodu, Üretici Kodu, Parça Adı, Marka, Açıklama, Birim, Birim Fiyat, Para Birimi, Stok, Min. Stok
          </div>
        </div>

        {selectionMode ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-800">
              {selectedIds.length} kayıt seçildi
            </div>

            <button
              type="button"
              onClick={toggleVisibleSelection}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Görünenleri Seç / Bırak
            </button>

            <button
              type="button"
              onClick={() => handleAddToOffer(selectedIds)}
              disabled={selectedIds.length === 0}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Fiyat Teklifine Ekle
            </button>

            {permissions.canDelete ? (
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={selectedIds.length === 0 || saving}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Seçilileri Sil
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

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Ara</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Parça adı, parça kodu, açıklama..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Stok Durumu</label>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              >
                <option value="">Tümü</option>
                <option value="low">Kritik Stok</option>
                <option value="out">Stokta Yok</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  {selectionMode ? (
                    <th className="w-12 px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && rows.every((item) => selectedIds.includes(item.id))}
                        onChange={toggleVisibleSelection}
                        aria-label="Görünen kayıtları seç"
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </th>
                  ) : null}
                  <th className={sortableHeaderClass} onClick={() => toggleSort("item_code")}>Parça Kodu</th>
                  <th className={sortableHeaderClass} onClick={() => toggleSort("manufacturer_code")}>Üretici Kodu</th>
                  <th className={sortableHeaderClass} onClick={() => toggleSort("item_name")}>Parça Adı</th>
                  <th className={sortableHeaderClass} onClick={() => toggleSort("category")}>Marka</th>
                  <th className={sortableHeaderClass} onClick={() => toggleSort("description")}>Açıklama</th>
                  <th className={sortableHeaderClass}>Birim</th>
                  <th className={sortableHeaderClass} onClick={() => toggleSort("unit_price")}>Birim Fiyat</th>
                  <th className={sortableHeaderClass} onClick={() => toggleSort("currency")}>Para Birimi</th>
                  <th className={sortableHeaderClass} onClick={() => toggleSort("current_stock")}>Stok</th>
                  <th className={sortableHeaderClass} onClick={() => toggleSort("min_stock")}>Min. Stok</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={selectionMode ? 11 : 10} className="px-4 py-12 text-center text-sm text-slate-500">
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                ) : (
                  rows.map((item) => {
                    const isLowStock =
                      (item.min_stock ?? 0) > 0 &&
                      Number(item.current_stock ?? 0) <= Number(item.min_stock ?? 0);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          if (shouldSuppressClick()) return;

                          if (selectionMode) {
                            toggleItemSelection(item.id);
                          }
                        }}
                        {...bindRow(item.id)}
                        className={`border-b border-slate-100 last:border-b-0 transition-colors hover:bg-slate-300 ${
                          activeId === item.id ? "bg-slate-300/90 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.14)]" : ""
                        }`}
                      >
                        {selectionMode ? (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(item.id)}
                              onChange={() => toggleItemSelection(item.id)}
                              onClick={(event) => event.stopPropagation()}
                              aria-label={`${item.item_code} seç`}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.item_code}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.manufacturer_code ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.item_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.category ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.description ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.unit ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {formatCurrency(item.unit_price, normalizeCurrency(item.currency ?? item.currency_code))}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.currency ?? item.currency_code ?? "TRY"}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={isLowStock ? "font-semibold text-red-600" : "text-slate-900"}>
                            {formatNumber(item.current_stock)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(item.min_stock)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showImportModeModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-slate-900">CSV Import</h2>
              <p className="mt-1 text-sm text-slate-500">
                {pendingImportItems.length} kayıt bulundu. Mevcut parça kodlarıyla eşleşen kayıtlar için işlem seçin.
              </p>
            </div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => handleConfirmCsvImport("append")}
                disabled={saving}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block text-base font-semibold text-slate-900">Üzerine Ekle</span>
                <span className="mt-1 block text-sm font-normal text-slate-500">
                  CSV satırlarını yeni kayıt olarak ekler.
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmCsvImport("overwrite")}
                disabled={saving}
                className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-3 text-left text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block text-base font-semibold">Üzerine Yaz</span>
                <span className="mt-1 block text-sm font-normal text-white/70">
                  Aynı parça kodu varsa günceller, yoksa yeni kayıt ekler.
                </span>
              </button>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={closeImportModeModal}
                disabled={saving}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="context-menu-layer fixed min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            onClick={() => {
              setSelectionMode(true);
              setSelectedIds([contextMenu.itemId]);
              setContextMenu(null);
            }}
            className="block w-full border-b border-slate-100 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Seç
          </button>

          {permissions.canEdit ? (
          <button
            type="button"
            onClick={() => openEditModal(contextMenu.itemId)}
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Düzenle
          </button>
          ) : null}
          <button
            type="button"
            onClick={() => openItemHistoryModal(contextMenu.itemId)}
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Parça Geçmişi
          </button>
          <button
            type="button"
            onClick={() => handleAddToOffer(contextMenu.itemId)}
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Fiyat teklifine ekle
          </button>
          {permissions.canDelete ? (
          <button
            type="button"
            onClick={() => handleDeleteItem(contextMenu.itemId)}
            className="block w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Sil
          </button>
          ) : null}
        </div>
      ) : null}

      {showNewPartModal ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-2 sm:items-center sm:p-4">
          <div className="my-2 flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:my-4 sm:max-h-[calc(100dvh-2rem)]">
            <div className="mb-5 flex items-start justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-6">
              <h2 className="text-xl font-semibold text-slate-900">Yeni Parça Ekle</h2>
              <button type="button" onClick={closeNewPartModal} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">×</button>
            </div>

            <div className="overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Parça Kodu</label>
                <input type="text" value={newPartForm.item_code} onChange={(e) => setNewPartForm((prev) => ({ ...prev, item_code: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Üretici Kodu</label>
                <input type="text" value={newPartForm.manufacturer_code} onChange={(e) => setNewPartForm((prev) => ({ ...prev, manufacturer_code: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Parça Adı</label>
                <input type="text" value={newPartForm.item_name} onChange={(e) => setNewPartForm((prev) => ({ ...prev, item_name: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Birim</label>
                <input type="text" value={newPartForm.unit} onChange={(e) => setNewPartForm((prev) => ({ ...prev, unit: e.target.value }))} placeholder="adet, saat, takım..." className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Stok</label>
                <input type="text" inputMode="decimal" value={newPartForm.current_stock} onChange={(e) => setNewPartForm((prev) => ({ ...prev, current_stock: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Min. Stok</label>
                <input type="text" inputMode="decimal" value={newPartForm.min_stock} onChange={(e) => setNewPartForm((prev) => ({ ...prev, min_stock: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Marka</label>
                <input type="text" value={newPartForm.brand} onChange={(e) => setNewPartForm((prev) => ({ ...prev, brand: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Birim Fiyat</label>
                <input type="text" inputMode="decimal" value={newPartForm.unit_price} onChange={(e) => setNewPartForm((prev) => ({ ...prev, unit_price: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Para Birimi</label>
                <select value={newPartForm.currency} onChange={(e) => setNewPartForm((prev) => ({ ...prev, currency: normalizeCurrency(e.target.value) }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Açıklama</label>
                <textarea value={newPartForm.description} onChange={(e) => setNewPartForm((prev) => ({ ...prev, description: e.target.value }))} className="min-h-[110px] w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeNewPartModal} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Vazgeç</button>
              <button type="button" onClick={handleCreateItem} disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
            </div>
          </div>
        </div>
      ) : null}

      {showStockInModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="text-xl font-semibold text-slate-900">Parça Girişi</h2>
              <button type="button" onClick={closeStockInModal} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">×</button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Parça Kodu</label>
                <input type="text" list={codeListId} value={stockInForm.item_code} onChange={(e) => setStockInForm((prev) => ({ ...prev, item_code: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" placeholder="Parça kodu seçin veya yazın" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Adet</label>
                <input type="text" inputMode="decimal" value={stockInForm.quantity} onChange={(e) => setStockInForm((prev) => ({ ...prev, quantity: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeStockInModal} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Vazgeç</button>
              <button type="button" onClick={handleStockIn} disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showStockOutModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="text-xl font-semibold text-slate-900">Parça Çıkışı</h2>
              <button type="button" onClick={closeStockOutModal} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">×</button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Parça Kodu</label>
                <input type="text" list={codeListId} value={stockOutForm.item_code} onChange={(e) => setStockOutForm((prev) => ({ ...prev, item_code: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" placeholder="Parça kodu seçin veya yazın" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Adet</label>
                <input type="text" inputMode="decimal" value={stockOutForm.quantity} onChange={(e) => setStockOutForm((prev) => ({ ...prev, quantity: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeStockOutModal} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Vazgeç</button>
              <button type="button" onClick={handleStockOut} disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showEditModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="text-xl font-semibold text-slate-900">Parça Düzenle</h2>
              <button type="button" onClick={closeEditModal} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">×</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Parça Kodu</label>
                <input type="text" value={editForm.item_code} onChange={(e) => setEditForm((prev) => ({ ...prev, item_code: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Üretici Kodu</label>
                <input type="text" value={editForm.manufacturer_code} onChange={(e) => setEditForm((prev) => ({ ...prev, manufacturer_code: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Parça Adı</label>
                <input type="text" value={editForm.item_name} onChange={(e) => setEditForm((prev) => ({ ...prev, item_name: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Birim</label>
                <input type="text" value={editForm.unit} onChange={(e) => setEditForm((prev) => ({ ...prev, unit: e.target.value }))} placeholder="adet, saat, takım..." className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Stok</label>
                <input type="text" inputMode="decimal" value={editForm.current_stock} onChange={(e) => setEditForm((prev) => ({ ...prev, current_stock: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Min. Stok</label>
                <input type="text" inputMode="decimal" value={editForm.min_stock} onChange={(e) => setEditForm((prev) => ({ ...prev, min_stock: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Marka</label>
                <input type="text" value={editForm.brand} onChange={(e) => setEditForm((prev) => ({ ...prev, brand: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Birim Fiyat</label>
                <input type="text" inputMode="decimal" value={editForm.unit_price} onChange={(e) => setEditForm((prev) => ({ ...prev, unit_price: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Para Birimi</label>
                <select value={editForm.currency} onChange={(e) => setEditForm((prev) => ({ ...prev, currency: normalizeCurrency(e.target.value) }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Açıklama</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))} className="min-h-[110px] w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeEditModal} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Vazgeç</button>
              <button type="button" onClick={handleEditItem} disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showItemHistoryModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Parça Geçmişi</h2>
                <p className="mt-1 text-sm text-slate-500">{itemHistoryTitle}</p>
              </div>

              <button type="button" onClick={closeItemHistoryModal} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">×</button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="border-b bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Tarih</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">İşlem</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Adet</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Birim Maliyet</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Not</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingHistory ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">Yükleniyor...</td>
                      </tr>
                    ) : itemHistoryRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">Kayıt bulunamadı.</td>
                      </tr>
                    ) : (
                      itemHistoryRows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-4 py-3 text-sm text-slate-700">{new Date(row.created_at).toLocaleString("tr-TR")}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{movementTypeLabel(row.movement_type)}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(row.quantity)}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.unit_cost ?? "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.note ?? "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showGeneralHistoryModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-6xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Genel Geçmiş</h2>
                <p className="mt-1 text-sm text-slate-500">Tüm parçaların giriş/çıkış hareketleri</p>
              </div>

              <button type="button" onClick={closeGeneralHistoryModal} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">×</button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="border-b bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Tarih</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Parça Kodu</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Parça Adı</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">İşlem</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Adet</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Birim Maliyet</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Not</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingHistory ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">Yükleniyor...</td>
                      </tr>
                    ) : generalHistoryRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">Kayıt bulunamadı.</td>
                      </tr>
                    ) : (
                      generalHistoryRows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-4 py-3 text-sm text-slate-700">{new Date(row.created_at).toLocaleString("tr-TR")}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.inventory_items?.item_code ?? "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.inventory_items?.item_name ?? "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{movementTypeLabel(row.movement_type)}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(row.quantity)}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.unit_cost ?? "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.note ?? "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}


