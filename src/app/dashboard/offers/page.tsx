"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import CompactFilterActionBar from "@/components/ui/compact-filter-action-bar";
import { useDismissFloatingLayer } from "@/hooks/use-dismiss-floating-layer";
import { useTouchContextMenu } from "@/hooks/use-touch-context-menu";

type CurrencyCode = "TRY" | "USD" | "EUR";

type InventoryItem = {
  id: string;
  company_id: string;
  item_code: string;
  item_name: string;
  description?: string | null;
  category?: string | null;
  unit?: string | null;
  min_stock?: number | null;
  current_stock: number;
  unit_price?: number | null;
  currency?: CurrencyCode | null;
  currency_code?: string | null;
  created_at?: string | null;
};

type CustomerRow = {
  id: string;
  company_name: string;
  customer_code: string;
  is_active: boolean;
};

type OfferRow = {
  id: string;
  item_id: string | null;
  item_code: string;
  item_name: string;
  description: string;
  quantity: string;
  multiplier: string;
  unit: string;
  base_unit_price: number;
  offer_unit_price: number;
  currency: CurrencyCode;
  line_total: number;
};

type OfferPrefillItem = {
  item_id: string;
  item_code: string;
  item_name: string;
  description?: string | null;
  unit?: string | null;
  unit_price?: number | null;
  currency?: string | null;
};

type OfferListRow = {
  id: string;
  offer_no?: string | null;
  customer_id?: string | null;
  offer_date?: string | null;
  valid_until?: string | null;
  currency_code?: string | null;
  status?: string | null;
  subtotal?: number | null;
  discount_total?: number | null;
  tax_total?: number | null;
  grand_total?: number | null;
  created_at?: string | null;
};

type SalesRepDefaults = {
  fullName: string;
  email: string;
  phone: string;
};

type NewPartFormState = {
  item_code: string;
  item_name: string;
  current_stock: string;
  min_stock: string;
  unit_price: string;
  currency: CurrencyCode;
  brand: string;
  description: string;
};

type SortKey =
  | "offer_no"
  | "customer_name"
  | "offer_date"
  | "valid_until"
  | "status"
  | "grand_total";

type SortDirection = "asc" | "desc";

type ContextMenuState = {
  x: number;
  y: number;
  offerId: string;
};

const TR = {
  newOffer: "+ Yeni Teklif",
  search: "Ara",
  searchPlaceholder: "Teklif no, müşteri...",
  totalOffers: "Toplam Teklif",
  offerNo: "Teklif No",
  customer: "Müşteri",
  offerDate: "Teklif Tarihi",
  validUntil: "Geçerlilik",
  total: "Toplam",
  loading: "Yükleniyor...",
  noRecords: "Kayıt bulunamadı.",
  newOfferTitle: "Yeni Fiyat Teklifi",
  newOfferDesc: "Parça kodu gir, depodan otomatik doldur, çarpan ile teklif fiyatını hesapla",
  customerSelect: "Müşteri seçin",
  validityDate: "Geçerlilik Tarihi",
  notesLabel: "Açıklama Notları",
  itemCode: "Parça Kodu",
  itemName: "Parça Adı",
  description: "Açıklama",
  quantity: "Adet",
  multiplier: "Çarpan",
  unit: "Birim",
  stockUnitPrice: "Depo Birim Fiyat",
  offerUnitPrice: "Teklif Birim Fiyat",
  currency: "Para Birimi",
  lineTotal: "Satır Toplamı",
  codePlaceholder: "Kod yazın",
  delete: "Sil",
  addRow: "+ Satır Ekle",
  subtotal: "Ara Toplam",
  cancel: "Vazgeç",
  saveOffer: "Teklifi Kaydet",
  saving: "Kaydediliyor...",
  newPartTitle: "Yeni Parça Ekle",
  newPartDesc: "Girilen kod depoda bulunamadı. Parçayı önce depoya ekleyelim.",
  itemCodeRequired: "Parça kodu zorunludur.",
  itemNameRequired: "Parça adı zorunludur.",
  stockRequired: "Stok zorunludur.",
  companyRequired: "company_id bulunamadı.",
  itemCreateFailed: "Parça eklenemedi.",
  itemCreatedFromOffer: "Teklif ekranından yeni parça eklendi",
  itemAddedToStock: "Yeni parça depoya eklendi.",
  addPartToStock: "Parçayı Depoya Ekle",
  customerRequired: "Müşteri seçimi zorunludur.",
  validOfferRowRequired: "En az bir geçerli teklif satırı ekleyin.",
  salesRepPrefix: "Satış Temsilcisi:",
  offerCreated: "Teklif oluşturuldu:",
  openDetail: "Detayı Aç",
  edit: "Düzenle",
  pdfDownload: "PDF İndir",
  deleteConfirm: "Bu teklifi silmek istediğine emin misin?",
  offerDeleted: "Teklif silindi.",
};

const DEFAULT_NOTES = [
  "- Teklife KDV dahil değildir.",
  "- Ödeme : Siparişte %100",
  "- Döviz çevriminde ödeme tarihindeki TCMB döviz satış kuru esas alınacaktır.",
  "- Fiyatımız yatırım teşvik kapsamında 0 KDV'li faturalama için geçerli değildir.",
  "- Aksi belirtilmedikçe ürün tekliflerimize mühendislik, programlama çalışmaları dahil değildir.",
].join("\n");

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const emptyOfferRow = (): OfferRow => ({
  id: createClientId(),
  item_id: null,
  item_code: "",
  item_name: "",
  description: "",
  quantity: "1",
  multiplier: "1",
  unit: "pcs",
  base_unit_price: 0,
  offer_unit_price: 0,
  currency: "TRY",
  line_total: 0,
});

const emptyNewPartForm: NewPartFormState = {
  item_code: "",
  item_name: "",
  current_stock: "",
  min_stock: "",
  unit_price: "",
  currency: "TRY",
  brand: "",
  description: "",
};

function toNumber(value: string | number | null | undefined) {
  const normalized = String(value ?? "")
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
  const safeValue = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue);
}

function isIosDevice() {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  return /iPad|iPhone|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent));
}

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

function generateOfferNo() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const random = String(Math.floor(Math.random() * 900) + 100);
  return `Q${yy}${month}${day}${random}`;
}

function offerRowFromPrefillItem(item: OfferPrefillItem): OfferRow {
  return recalcOfferRow({
    ...emptyOfferRow(),
    item_id: item.item_id,
    item_code: item.item_code,
    item_name: item.item_name,
    description: item.description ?? "",
    unit: item.unit?.trim() || "pcs",
    base_unit_price: Number(item.unit_price ?? 0),
    currency: normalizeCurrency(item.currency),
  });
}

function recalcOfferRow(row: OfferRow): OfferRow {
  const quantity = toNumber(row.quantity);
  const multiplier = toNumber(row.multiplier);
  const offerUnitPrice = Number((row.base_unit_price * multiplier).toFixed(2));
  const lineTotal = Number((quantity * offerUnitPrice).toFixed(2));

  return {
    ...row,
    offer_unit_price: offerUnitPrice,
    line_total: lineTotal,
  };
}

function sortIndicator(active: boolean, direction: SortDirection) {
  if (!active) return "";
  return direction === "asc" ? " ↑" : " ↓";
}

export default function OffersPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [companyId, setCompanyId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [offers, setOffers] = useState<OfferListRow[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("offer_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [showNewOfferModal, setShowNewOfferModal] = useState(false);
  const [showNewPartModal, setShowNewPartModal] = useState(false);

  const [offerNo, setOfferNo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [offerDate, setOfferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().slice(0, 10);
  });
  const [salesRep, setSalesRep] = useState("");
  const [salesRepEmail, setSalesRepEmail] = useState("");
  const [salesRepPhone, setSalesRepPhone] = useState("");
  const [salesRepDefaults, setSalesRepDefaults] = useState<SalesRepDefaults>({
    fullName: "",
    email: "",
    phone: "",
  });
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [rows, setRows] = useState<OfferRow[]>([emptyOfferRow()]);

  const [activeSuggestionRowId, setActiveSuggestionRowId] = useState<string | null>(null);
  const [pendingNewItemRowId, setPendingNewItemRowId] = useState<string | null>(null);

  const [newPartForm, setNewPartForm] = useState<NewPartFormState>(emptyNewPartForm);

  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canPdf: false,
    canCreateStock: false,
  });

  const itemCodeInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const { activeId, bindRow, shouldSuppressClick } = useTouchContextMenu((offerId, x, y) => {
    setContextMenu({ x, y, offerId });
  });
  useDismissFloatingLayer([contextMenuRef], () => setContextMenu(null));

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;

    if (searchParams.get("new") === "1") {
      openNewOfferModal();
      router.replace("/dashboard/offers");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router, loading, permissions.canCreate]);

  async function initialize() {
    setLoading(true);
    setErrorText("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorText("Kullanıcı bulunamadı.");
      setLoading(false);
      return;
    }

    const permissionIdentity = {
      permissions: Array.isArray(user.app_metadata?.permissions)
        ? user.app_metadata.permissions.map(String)
        : [],
      role: typeof user.app_metadata?.role === "string" ? user.app_metadata.role : null,
      super_user: user.app_metadata?.super_user === true,
    };

    setPermissions({
      canCreate: hasPermission(permissionIdentity, PERMISSIONS.offerCreate),
      canEdit: hasPermission(permissionIdentity, PERMISSIONS.offerEdit),
      canDelete: hasPermission(permissionIdentity, PERMISSIONS.offerDelete),
      canPdf: hasPermission(permissionIdentity, PERMISSIONS.offerPdf),
      canCreateStock: hasPermission(permissionIdentity, PERMISSIONS.stockCreate),
    });

    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select("company_id, full_name, email, phone")
      .eq("auth_user_id", user.id)
      .single();

    if (appUserError || !appUser?.company_id) {
      setErrorText(appUserError?.message || TR.companyRequired);
      setLoading(false);
      return;
    }

    const resolvedCompanyId = appUser.company_id;
    setCompanyId(resolvedCompanyId);
    setSalesRepDefaults({
      fullName: String(appUser.full_name ?? "").trim(),
      email: String(appUser.email ?? user.email ?? "").trim(),
      phone: String(appUser.phone ?? "").trim(),
    });

    const [
      { data: inventoryData, error: inventoryError },
      { data: customerData, error: customerError },
      { data: offersData, error: offersError },
    ] = await Promise.all([
      supabase
        .from("inventory_items")
        .select(`
          id,
          company_id,
          item_code,
          item_name,
          description,
          category,
          unit,
          min_stock,
          current_stock,
          unit_price,
          currency,
          currency_code,
          created_at
        `)
        .eq("company_id", resolvedCompanyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("customers")
        .select("id, company_name, customer_code, is_active")
        .eq("company_id", resolvedCompanyId)
        .eq("is_active", true)
        .order("company_name", { ascending: true }),
      supabase
        .from("offers")
        .select(`
          id,
          customer_id,
          offer_no,
          offer_date,
          valid_until,
          currency_code,
          status,
          subtotal,
          discount_total,
          tax_total,
          grand_total,
          created_at
        `)
        .eq("company_id", resolvedCompanyId)
        .order("created_at", { ascending: false }),
    ]);

    if (inventoryError) {
      setErrorText(inventoryError.message);
      setLoading(false);
      return;
    }

    if (customerError) {
      setErrorText(customerError.message);
      setLoading(false);
      return;
    }

    if (offersError) {
      setErrorText(offersError.message);
      setLoading(false);
      return;
    }

    setInventoryItems(
      ((inventoryData ?? []).map((item) => ({
        ...item,
        currency: normalizeCurrency(item.currency ?? item.currency_code),
      })) as InventoryItem[])
    );

    setCustomers((customerData ?? []) as CustomerRow[]);
    setOffers((offersData ?? []) as OfferListRow[]);
    setLoading(false);
  }

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

  function openNewOfferModal() {
    if (!permissions.canCreate) {
      setErrorText("Teklif oluşturma yetkiniz yok.");
      return;
    }

    resetMessages();
    setOfferNo(generateOfferNo());
    setCustomerId("");
    setOfferDate(new Date().toISOString().slice(0, 10));

    const date = new Date();
    date.setDate(date.getDate() + 14);
    setValidUntil(date.toISOString().slice(0, 10));

    setSalesRep(salesRepDefaults.fullName);
    setSalesRepEmail(salesRepDefaults.email);
    setSalesRepPhone(salesRepDefaults.phone);
    setNotes(DEFAULT_NOTES);
    const prefillRows = (() => {
      if (typeof window === "undefined") return null;

      const raw = window.localStorage.getItem("noxo_offer_prefill_items");
      if (!raw) return null;

      window.localStorage.removeItem("noxo_offer_prefill_items");

      try {
        const items = JSON.parse(raw) as OfferPrefillItem[];
        const validItems = Array.isArray(items)
          ? items.filter((item) => item.item_id && item.item_code && item.item_name)
          : [];

        return validItems.length > 0 ? validItems.map(offerRowFromPrefillItem) : null;
      } catch {
        return null;
      }
    })();

    setRows(prefillRows ?? [emptyOfferRow()]);
    setActiveSuggestionRowId(null);
    setPendingNewItemRowId(null);
    setShowNewOfferModal(true);
  }

  function closeNewOfferModal() {
    setShowNewOfferModal(false);
    setActiveSuggestionRowId(null);
    setPendingNewItemRowId(null);
  }

  function openNewPartModal(prefillCode: string, rowId: string) {
    if (!permissions.canCreateStock) {
      setErrorText("Stok kartı oluşturma yetkiniz yok.");
      return;
    }

    resetMessages();
    setPendingNewItemRowId(rowId);
    setNewPartForm({
      ...emptyNewPartForm,
      item_code: prefillCode.trim().toUpperCase(),
      currency: "TRY",
    });
    setShowNewPartModal(true);
  }

  function closeNewPartModal() {
    setShowNewPartModal(false);
    setNewPartForm(emptyNewPartForm);
    setPendingNewItemRowId(null);
  }

  function getSuggestions(input: string) {
    const normalized = input.trim().toLocaleLowerCase("tr-TR");
    if (!normalized) return [];

    return inventoryItems
      .filter((item) => item.item_code.toLocaleLowerCase("tr-TR").startsWith(normalized))
      .slice(0, 8);
  }

  function recalcRow(row: OfferRow): OfferRow {
    const quantity = toNumber(row.quantity);
    const multiplier = toNumber(row.multiplier);
    const offerUnitPrice = Number((row.base_unit_price * multiplier).toFixed(2));
    const lineTotal = Number((quantity * offerUnitPrice).toFixed(2));

    return {
      ...row,
      offer_unit_price: offerUnitPrice,
      line_total: lineTotal,
    };
  }

  function applyInventoryItemToRow(rowId: string, item: InventoryItem) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;

        return recalcRow({
          ...row,
          item_id: item.id,
          item_code: item.item_code,
          item_name: item.item_name,
          description: item.description ?? "",
          unit: item.unit?.trim() || "pcs",
          base_unit_price: Number(item.unit_price ?? 0),
          currency: normalizeCurrency(item.currency ?? item.currency_code),
        });
      })
    );

    setActiveSuggestionRowId(null);
  }

  function updateRow(rowId: string, patch: Partial<OfferRow>) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        return recalcRow({ ...row, ...patch });
      })
    );
  }

  function addRow() {
    const row = emptyOfferRow();
    setRows((prev) => [...prev, row]);

    setTimeout(() => {
      itemCodeInputRefs.current[row.id]?.focus();
    }, 0);
  }

  function removeRow(rowId: string) {
    setRows((prev) => {
      if (prev.length === 1) return [emptyOfferRow()];
      return prev.filter((row) => row.id !== rowId);
    });
  }

  function handleItemCodeChange(rowId: string, value: string) {
    const upper = value.toUpperCase();

    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;

        const exactItem = inventoryItems.find(
          (item) => item.item_code.toLocaleLowerCase("tr-TR") === upper.toLocaleLowerCase("tr-TR")
        );

        if (exactItem) {
          return recalcRow({
            ...row,
            item_id: exactItem.id,
            item_code: exactItem.item_code,
            item_name: exactItem.item_name,
            description: exactItem.description ?? "",
            unit: exactItem.unit?.trim() || "pcs",
            base_unit_price: Number(exactItem.unit_price ?? 0),
            currency: normalizeCurrency(exactItem.currency ?? exactItem.currency_code),
          });
        }

        return recalcRow({
          ...row,
          item_id: null,
          item_code: upper,
          item_name: "",
          description: "",
          unit: "pcs",
          base_unit_price: 0,
          currency: "TRY",
        });
      })
    );

    setActiveSuggestionRowId(upper.trim() ? rowId : null);
  }

  function tryResolveRowCode(rowId: string) {
    const row = rows.find((x) => x.id === rowId);
    if (!row) return;

    const code = row.item_code.trim();
    if (!code) return;

    const exactItem = inventoryItems.find(
      (item) => item.item_code.toLocaleLowerCase("tr-TR") === code.toLocaleLowerCase("tr-TR")
    );

    if (exactItem) {
      applyInventoryItemToRow(rowId, exactItem);
      return;
    }

    openNewPartModal(code, rowId);
  }

  async function handleCreateInventoryItem() {
    resetMessages();

    if (!permissions.canCreateStock) {
      setErrorText("Stok kartı oluşturma yetkiniz yok.");
      return;
    }

    if (!newPartForm.item_code.trim()) {
      setErrorText(TR.itemCodeRequired);
      return;
    }

    if (!newPartForm.item_name.trim()) {
      setErrorText(TR.itemNameRequired);
      return;
    }

    if (!newPartForm.current_stock.trim()) {
      setErrorText(TR.stockRequired);
      return;
    }

    if (!companyId) {
      setErrorText(TR.companyRequired);
      return;
    }

    if (saving) return;
    setSaving(true);

    const payload = {
      company_id: companyId,
      item_code: newPartForm.item_code.trim(),
      item_name: newPartForm.item_name.trim(),
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
      body: JSON.stringify({
        ...payload,
        note: TR.itemCreatedFromOffer,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.item) {
      setSaving(false);
      setErrorText(result.error || TR.itemCreateFailed);
      return;
    }

    const data = result.item as InventoryItem;

    const normalizedItem = {
      ...data,
      currency: normalizeCurrency(data.currency ?? data.currency_code),
    } as InventoryItem;

    setInventoryItems((prev) => [normalizedItem, ...prev]);

    if (pendingNewItemRowId) {
      applyInventoryItemToRow(pendingNewItemRowId, normalizedItem);
    }

    setSaving(false);
    setShowNewPartModal(false);
    setNewPartForm(emptyNewPartForm);
    setPendingNewItemRowId(null);
    setSuccessText(TR.itemAddedToStock);
    router.refresh();
  }

  function getSubtotal() {
    return Number(rows.reduce((sum, row) => sum + Number(row.line_total || 0), 0).toFixed(2));
  }

  function getCustomerName(id: string | null | undefined) {
    if (!id) return "-";
    return customers.find((customer) => customer.id === id)?.company_name ?? "-";
  }

  async function handleSaveOffer() {
    resetMessages();

    if (!permissions.canCreate) {
      setErrorText("Teklif oluşturma yetkiniz yok.");
      return;
    }

    if (!companyId) {
      setErrorText(TR.companyRequired);
      return;
    }

    if (!customerId) {
      setErrorText(TR.customerRequired);
      return;
    }

    const validRows = rows.filter(
      (row) => row.item_code.trim() && row.item_name.trim() && toNumber(row.quantity) > 0
    );

    if (validRows.length === 0) {
      setErrorText(TR.validOfferRowRequired);
      return;
    }

    if (saving) return;
    setSaving(true);

    const finalOfferNo = offerNo.trim() || generateOfferNo();

    const safeNotes = [
      salesRep.trim() ? `${TR.salesRepPrefix} ${salesRep.trim()}` : "",
      salesRepEmail.trim() ? `E-mail: ${salesRepEmail.trim()}` : "",
      salesRepPhone.trim() ? `Telefon: ${salesRepPhone.trim()}` : "",
      notes.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offer_no: finalOfferNo,
        customer_id: customerId,
        offer_date: offerDate,
        valid_until: validUntil || null,
        notes: safeNotes || null,
        rows: validRows,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.offer) {
      setSaving(false);
      setErrorText(result.error || "Teklif kaydedilemedi.");
      return;
    }

    const insertedOffer = result.offer as OfferListRow;

    setOffers((prev) => [insertedOffer as OfferListRow, ...prev]);
    setSaving(false);
    closeNewOfferModal();
    setSuccessText(`${TR.offerCreated} ${finalOfferNo}`);
    router.refresh();
  }

  async function handleDeleteOffer(offerId: string) {
    resetMessages();
    setContextMenu(null);

    if (!permissions.canDelete) {
      setErrorText("Teklif silme yetkiniz yok.");
      return;
    }

    const confirmed = window.confirm(TR.deleteConfirm);
    if (!confirmed) return;

    if (saving) return;
    setSaving(true);

    const response = await fetch(`/api/offers/${offerId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));

    setSaving(false);

    if (!response.ok) {
      setErrorText(result.error ?? "Teklif silinemedi.");
      return;
    }

    setOffers((prev) => prev.filter((offer) => offer.id !== offerId));
    setSuccessText(TR.offerDeleted);
    router.refresh();
  }

  function startSelection(offerId: string) {
    setSelectionMode(true);
    setSelectedIds([offerId]);
    setContextMenu(null);
  }

  function toggleOfferSelection(offerId: string) {
    setSelectedIds((prev) =>
      prev.includes(offerId) ? prev.filter((id) => id !== offerId) : [...prev, offerId]
    );
  }

  function toggleVisibleSelection() {
    const visibleIds = filteredOffers.map((offer) => offer.id);
    const visibleIdSet = new Set(visibleIds);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((prev) =>
      allVisibleSelected ? prev.filter((id) => !visibleIdSet.has(id)) : Array.from(new Set([...prev, ...visibleIds]))
    );
  }

  function downloadOfferPdf(offerId: string) {
    const anchor = document.createElement("a");
    anchor.href = `/dashboard/offers/${offerId}/pdf/file`;
    if (isIosDevice()) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function bulkDownloadPdf() {
    if (selectedIds.length === 0) {
      setErrorText("PDF indirmek için en az bir teklif seçin.");
      return;
    }

    selectedIds.forEach((offerId, index) => {
      window.setTimeout(() => downloadOfferPdf(offerId), index * 250);
    });
  }

  async function bulkDeleteOffers() {
    if (selectedIds.length === 0) {
      setErrorText("Silmek için en az bir teklif seçin.");
      return;
    }

    const confirmed = window.confirm(`${selectedIds.length} teklif silinsin mi?`);
    if (!confirmed) return;

    for (const offerId of selectedIds) {
      const response = await fetch(`/api/offers/${offerId}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorText(result.error ?? "Seçili teklifler silinemedi.");
        return;
      }
    }

    setOffers((prev) => prev.filter((offer) => !selectedIds.includes(offer.id)));
    setSelectedIds([]);
    setSelectionMode(false);
    setSuccessText("Seçili teklifler silindi.");
    router.refresh();
  }

  const filteredOffers = (() => {
    let data = [...offers];

    if (search.trim()) {
      const q = search.toLocaleLowerCase("tr-TR");
      data = data.filter((offer) =>
        [
          offer.offer_no ?? "",
          getCustomerName(offer.customer_id),
          offer.status ?? "",
          offer.currency_code ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(q)
      );
    }

    data.sort((left, right) => {
      const leftValue =
        sortKey === "offer_no"
          ? left.offer_no ?? ""
          : sortKey === "customer_name"
          ? getCustomerName(left.customer_id)
          : sortKey === "offer_date"
          ? left.offer_date ?? ""
          : sortKey === "valid_until"
          ? left.valid_until ?? ""
          : sortKey === "grand_total"
          ? left.grand_total ?? 0
          : left.status ?? "";

      const rightValue =
        sortKey === "offer_no"
          ? right.offer_no ?? ""
          : sortKey === "customer_name"
          ? getCustomerName(right.customer_id)
          : sortKey === "offer_date"
          ? right.offer_date ?? ""
          : sortKey === "valid_until"
          ? right.valid_until ?? ""
          : sortKey === "grand_total"
          ? right.grand_total ?? 0
          : right.status ?? "";

      return compareValues(leftValue, rightValue, sortDirection);
    });

    return data;
  })();

  const subtotal = getSubtotal();
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
          <label className="sr-only">{TR.search}</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={TR.searchPlaceholder}
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 sm:h-11"
          />
        </div>

        <div
          className={`grid w-full gap-2 sm:w-auto sm:grid-flow-col sm:auto-cols-max sm:grid-cols-none ${
            permissions.canCreate ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          <div className="flex h-10 min-w-0 flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 px-2 shadow-sm sm:h-11 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
            <div className="truncate text-[10px] font-medium uppercase leading-tight text-slate-500 sm:text-[11px]">
              {TR.total}
            </div>
            <div className="text-base font-semibold leading-tight text-slate-900 sm:text-lg">{offers.length}</div>
          </div>

          {permissions.canCreate ? (
          <button
            type="button"
            onClick={openNewOfferModal}
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
          {permissions.canPdf ? (
            <button type="button" onClick={bulkDownloadPdf} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              PDF İndir
            </button>
          ) : null}
          {permissions.canDelete ? (
            <button type="button" onClick={() => void bulkDeleteOffers()} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100">
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
                      checked={filteredOffers.length > 0 && filteredOffers.every((offer) => selectedIds.includes(offer.id))}
                      onChange={toggleVisibleSelection}
                      aria-label="Görünen kayıtları seç"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                ) : null}
                <th className={sortableHeaderClass} onClick={() => toggleSort("offer_no")}>
                  {TR.offerNo}{sortIndicator(sortKey === "offer_no", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("customer_name")}>
                  {TR.customer}{sortIndicator(sortKey === "customer_name", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("offer_date")}>
                  {TR.offerDate}{sortIndicator(sortKey === "offer_date", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("valid_until")}>
                  {TR.validUntil}{sortIndicator(sortKey === "valid_until", sortDirection)}
                </th>
                <th className={sortableHeaderClass} onClick={() => toggleSort("grand_total")}>
                  {TR.total}{sortIndicator(sortKey === "grand_total", sortDirection)}
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={selectionMode ? 6 : 5} className="px-4 py-12 text-center text-sm text-slate-500">
                    {TR.loading}
                  </td>
                </tr>
              ) : filteredOffers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                    {TR.noRecords}
                  </td>
                </tr>
              ) : (
                filteredOffers.map((offer) => (
                  <tr
                    key={offer.id}
                    onClick={() => {
                      if (shouldSuppressClick()) return;

                      if (selectionMode) {
                        toggleOfferSelection(offer.id);
                        return;
                      }

                      router.push(`/dashboard/offers/${offer.id}`);
                    }}
                    {...bindRow(offer.id)}
                    className={`cursor-pointer border-b border-slate-200 last:border-b-0 transition-all duration-150 hover:bg-slate-200/80 hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] ${
                      activeId === offer.id ? "bg-slate-300/90 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.14)]" : ""
                    }`}
                  >
                    {selectionMode ? (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(offer.id)}
                          onChange={() => toggleOfferSelection(offer.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`${offer.offer_no ?? "Teklif"} seç`}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{offer.offer_no ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{getCustomerName(offer.customer_id)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {offer.offer_date ? new Date(offer.offer_date).toLocaleDateString("tr-TR") : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {offer.valid_until ? new Date(offer.valid_until).toLocaleDateString("tr-TR") : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {formatCurrency(offer.grand_total ?? 0, normalizeCurrency(offer.currency_code))}
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
            onClick={() => startSelection(contextMenu.offerId)}
            className="block w-full border-b border-slate-100 px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            Seç
          </button>

          <button
            type="button"
            onClick={() => {
              router.push(`/dashboard/offers/${contextMenu.offerId}`);
              setContextMenu(null);
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            {TR.openDetail}
          </button>

          {permissions.canEdit ? (
          <button
            type="button"
            onClick={() => {
              router.push(`/dashboard/offers/${contextMenu.offerId}/edit`);
              setContextMenu(null);
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            {TR.edit}
          </button>
          ) : null}

          {permissions.canPdf ? (
          <button
            type="button"
            onClick={() => {
              if (isIosDevice()) {
                window.open(`/dashboard/offers/${contextMenu.offerId}/pdf/file`, "_blank", "noopener,noreferrer");
              } else {
                window.location.href = `/dashboard/offers/${contextMenu.offerId}/pdf/file`;
              }
              setContextMenu(null);
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            {TR.pdfDownload}
          </button>
          ) : null}

          {permissions.canDelete ? (
          <button
            type="button"
            onClick={() => void handleDeleteOffer(contextMenu.offerId)}
            className="block w-full px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-100"
          >
            {TR.delete}
          </button>
          ) : null}
        </div>
      ) : null}

      {showNewOfferModal ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/30 p-2 sm:items-center sm:p-4">
          <div className="my-2 max-h-[calc(100dvh-1rem)] w-full max-w-7xl overflow-y-auto overflow-x-hidden rounded-2xl bg-white p-4 shadow-xl sm:my-4 sm:max-h-[90vh] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{TR.newOfferTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">{TR.newOfferDesc}</p>
              </div>

              <button
                type="button"
                onClick={closeNewOfferModal}
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <label className="text-sm font-medium text-slate-700">{TR.offerNo}</label>
                <input
                  type="text"
                  value={offerNo}
                  onChange={(e) => setOfferNo(e.target.value)}
                  className="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="min-w-0 space-y-2">
                <label className="text-sm font-medium text-slate-700">{TR.customer}</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                >
                  <option value="">{TR.customerSelect}</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company_name} ({customer.customer_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0 space-y-2">
                <label className="text-sm font-medium text-slate-700">{TR.offerDate}</label>
                <input
                  type="date"
                  value={offerDate}
                  onChange={(e) => setOfferDate(e.target.value)}
                  className="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="min-w-0 space-y-2">
                <label className="text-sm font-medium text-slate-700">{TR.validityDate}</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="min-w-0 space-y-2">
                <label className="text-sm font-medium text-slate-700">Satış Temsilcisi</label>
                <input
                  type="text"
                  value={salesRep}
                  onChange={(e) => setSalesRep(e.target.value)}
                  className="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="min-w-0 space-y-2">
                <label className="text-sm font-medium text-slate-700">Temsilci E-mail</label>
                <input
                  type="email"
                  value={salesRepEmail}
                  onChange={(e) => setSalesRepEmail(e.target.value)}
                  className="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="min-w-0 space-y-2">
                <label className="text-sm font-medium text-slate-700">Temsilci Telefon</label>
                <input
                  type="text"
                  value={salesRepPhone}
                  onChange={(e) => setSalesRepPhone(e.target.value)}
                  className="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="min-w-0 space-y-2 lg:col-span-2">
                <label className="text-sm font-medium text-slate-700">{TR.notesLabel}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[140px] min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-[1400px] w-full">
                  <thead className="border-b bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.itemCode}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.itemName}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.description}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.quantity}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.multiplier}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.unit}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.stockUnitPrice}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.offerUnitPrice}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.currency}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{TR.lineTotal}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700"></th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => {
                      const suggestions =
                        activeSuggestionRowId === row.id ? getSuggestions(row.item_code) : [];
                      const hasSuggestionList =
                        activeSuggestionRowId === row.id &&
                        row.item_code.trim() &&
                        suggestions.length > 0;

                      return (
                        <tr key={row.id} className="border-b border-slate-100 last:border-b-0 align-top">
                          <td className="px-4 py-3 text-sm">
                            <div className="relative min-w-[180px]">
                              <input
                                ref={(element) => {
                                  itemCodeInputRefs.current[row.id] = element;
                                }}
                                type="text"
                                value={row.item_code}
                                onChange={(e) => handleItemCodeChange(row.id, e.target.value)}
                                onFocus={() => setActiveSuggestionRowId(row.id)}
                                onBlur={() => {
                                  window.setTimeout(() => {
                                    setActiveSuggestionRowId((current) => (current === row.id ? null : current));
                                    tryResolveRowCode(row.id);
                                  }, 180);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    tryResolveRowCode(row.id);
                                  }
                                }}
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                                placeholder={TR.codePlaceholder}
                              />

                              {hasSuggestionList ? (
                                <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                                  {suggestions.map((item) => (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => applyInventoryItemToRow(row.id, item)}
                                      className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                                    >
                                      <div className="text-sm font-medium text-slate-900">{item.item_code}</div>
                                      <div className="text-xs text-slate-500">{item.item_name}</div>
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-sm text-slate-700">{row.item_name || "-"}</td>

                          <td className="px-4 py-3 text-sm">
                            <textarea
                              value={row.description}
                              onChange={(e) => updateRow(row.id, { description: e.target.value })}
                              className="min-h-[76px] min-w-[260px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                            />
                          </td>

                          <td className="px-4 py-3 text-sm">
                            <input
                              type="text"
                              inputMode="decimal"
                              min="0"
                              step="1"
                              value={row.quantity}
                              onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                              className="w-[90px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                            />
                          </td>

                          <td className="px-4 py-3 text-sm">
                            <input
                              type="text"
                              inputMode="decimal"
                              min="0"
                              value={row.multiplier}
                              onChange={(e) => updateRow(row.id, { multiplier: e.target.value })}
                              className="w-[100px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                            />
                          </td>

                          <td className="px-4 py-3 text-sm">
                            <input
                              type="text"
                              value={row.unit}
                              onChange={(e) => updateRow(row.id, { unit: e.target.value })}
                              className="w-[100px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                            />
                          </td>

                          <td className="px-4 py-3 text-sm text-slate-700">
                            {formatCurrency(row.base_unit_price, row.currency)}
                          </td>

                          <td className="px-4 py-3 text-sm text-slate-700">
                            {formatCurrency(row.offer_unit_price, row.currency)}
                          </td>

                          <td className="px-4 py-3 text-sm text-slate-700">{row.currency}</td>

                          <td className="px-4 py-3 text-sm font-medium text-slate-900">
                            {formatCurrency(row.line_total, row.currency)}
                          </td>

                          <td className="px-4 py-3 text-sm">
                            <button
                              type="button"
                              onClick={() => removeRow(row.id)}
                              className="rounded-xl border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50"
                            >
                              {TR.delete}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={addRow}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {TR.addRow}
              </button>

              <div className="text-right">
                <div className="text-sm text-slate-500">{TR.subtotal}</div>
                <div className="text-2xl font-semibold text-slate-900">
                  {formatCurrency(subtotal, rows[0]?.currency ?? "TRY")}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeNewOfferModal}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {TR.cancel}
              </button>

              <button
                type="button"
                onClick={handleSaveOffer}
                disabled={saving}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? TR.saving : TR.saveOffer}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showNewPartModal ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:items-center sm:p-4">
          <div className="my-2 flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:my-4 sm:max-h-[calc(100dvh-2rem)]">
            <div className="mb-5 flex items-start justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{TR.newPartTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">{TR.newPartDesc}</p>
              </div>

              <button
                type="button"
                onClick={closeNewPartModal}
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{TR.itemCode}</label>
                <input
                  type="text"
                  value={newPartForm.item_code}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, item_code: e.target.value.toUpperCase() }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{TR.itemName}</label>
                <input
                  type="text"
                  value={newPartForm.item_name}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, item_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Stok</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newPartForm.current_stock}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, current_stock: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Min. Stok</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newPartForm.min_stock}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, min_stock: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Marka</label>
                <input
                  type="text"
                  value={newPartForm.brand}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, brand: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Birim Fiyat</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newPartForm.unit_price}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, unit_price: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{TR.currency}</label>
                <select
                  value={newPartForm.currency}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, currency: normalizeCurrency(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base sm:text-sm"
                >
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">{TR.description}</label>
                <textarea
                  value={newPartForm.description}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-[110px] w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base sm:text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeNewPartModal}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {TR.cancel}
              </button>

              <button
                type="button"
                onClick={handleCreateInventoryItem}
                disabled={saving}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? TR.saving : TR.addPartToStock}
              </button>
            </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
