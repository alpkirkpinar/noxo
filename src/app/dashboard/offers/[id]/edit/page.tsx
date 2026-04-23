"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CurrencyCode = "TRY" | "USD" | "EUR";

type InventoryItem = {
  id: string;
  item_code: string;
  item_name: string;
  description?: string | null;
  unit?: string | null;
  unit_price?: number | null;
  currency?: string | null;
  currency_code?: string | null;
};

type CustomerRow = {
  id: string;
  company_name: string;
  customer_code: string;
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

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyOfferRow(): OfferRow {
  return {
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
  };
}

function normalizeCurrency(value?: string | null): CurrencyCode {
  if (value === "USD" || value === "EUR") return value;
  return "TRY";
}

function toNumber(value: string | number | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");
  const num = Number(normalized);
  return Number.isNaN(num) ? 0 : num;
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

export default function OfferEditPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const offerId = params.id;

  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const [offerNo, setOfferNo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [offerDate, setOfferDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [status, setStatus] = useState("draft");
  const [salesRep, setSalesRep] = useState("");
  const [salesRepEmail, setSalesRepEmail] = useState("");
  const [salesRepPhone, setSalesRepPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<OfferRow[]>([emptyOfferRow()]);

  const [showNewPartModal, setShowNewPartModal] = useState(false);
  const [pendingNewItemRowId, setPendingNewItemRowId] = useState<string | null>(null);
  const [newPartForm, setNewPartForm] = useState<NewPartFormState>(emptyNewPartForm);
  const [activeSuggestionRowId, setActiveSuggestionRowId] = useState<string | null>(null);

  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const itemCodeInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function resetMessages() {
    setErrorText("");
    setSuccessText("");
  }

  async function initialize() {
    setLoading(true);
    resetMessages();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorText("KullanÄ±cÄ± bulunamadÄ±.");
      setLoading(false);
      return;
    }

    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select("company_id")
      .eq("auth_user_id", user.id)
      .single();

    if (appUserError || !appUser?.company_id) {
      setErrorText(appUserError?.message || "company_id bulunamadÄ±.");
      setLoading(false);
      return;
    }

    setCompanyId(appUser.company_id);

    const [
      { data: offer, error: offerError },
      { data: items, error: itemsError },
      { data: customersData, error: customersError },
      { data: inventoryData, error: inventoryError },
    ] = await Promise.all([
      supabase
        .from("offers")
        .select(`
          id,
          offer_no,
          customer_id,
          offer_date,
          valid_until,
          currency_code,
          status,
          subtotal,
          discount_total,
          tax_total,
          grand_total,
          notes
        `)
        .eq("company_id", appUser.company_id)
        .eq("id", offerId)
        .single(),
      supabase
        .from("offer_items")
        .select(`
          id,
          inventory_item_id,
          item_code,
          item_name,
          description,
          quantity,
          unit,
          unit_price,
          line_total
        `)
        .eq("company_id", appUser.company_id)
        .eq("offer_id", offerId)
        .order("created_at", { ascending: true }),
      supabase
        .from("customers")
        .select("id, company_name, customer_code")
        .eq("company_id", appUser.company_id)
        .eq("is_active", true)
        .order("company_name", { ascending: true }),
      supabase
        .from("inventory_items")
        .select(`
          id,
          item_code,
          item_name,
          description,
          unit,
          unit_price,
          currency,
          currency_code
        `)
        .eq("company_id", appUser.company_id)
        .order("item_code", { ascending: true }),
    ]);

    if (offerError || !offer) {
      setErrorText(offerError?.message || "Teklif bulunamadÄ±.");
      setLoading(false);
      return;
    }

    if (itemsError) {
      setErrorText(itemsError.message);
      setLoading(false);
      return;
    }

    if (customersError) {
      setErrorText(customersError.message);
      setLoading(false);
      return;
    }

    if (inventoryError) {
      setErrorText(inventoryError.message);
      setLoading(false);
      return;
    }

    setOfferNo(offer.offer_no ?? "");
    setCustomerId(offer.customer_id ?? "");
    setOfferDate(offer.offer_date ?? "");
    setValidUntil(offer.valid_until ?? "");
    setStatus(offer.status ?? "draft");
    const noteLines = String(offer.notes ?? "").split("\n");
    const extractedSalesRep = noteLines.find((line) => line.startsWith("Satış Temsilcisi:")) ?? "";
    const extractedEmail = noteLines.find((line) => line.startsWith("E-mail:")) ?? "";
    const extractedPhone = noteLines.find((line) => line.startsWith("Telefon:")) ?? "";
    const filteredNotes = noteLines
      .filter(
        (line) =>
          !line.startsWith("Satış Temsilcisi:") &&
          !line.startsWith("E-mail:") &&
          !line.startsWith("Telefon:")
      )
      .join("\n")
      .trim();

    setSalesRep(extractedSalesRep.replace("Satış Temsilcisi:", "").trim());
    setSalesRepEmail(extractedEmail.replace("E-mail:", "").trim());
    setSalesRepPhone(extractedPhone.replace("Telefon:", "").trim());
    setNotes(
      filteredNotes ||
        "- Teklife KDV dahil değildir.\n- Ödeme : Siparişte %100\n- Döviz çevriminde ödeme tarihindeki TCMB döviz satış kuru esas alınacaktır.\n- Fiyatımız yatırım teşvik kapsamında 0 KDV'li faturalama için geçerli değildir.\n- Aksi belirtilmedikçe ürün tekliflerimize mühendislik, programlama çalışmaları dahil değildir."
    );
    setCustomers((customersData ?? []) as CustomerRow[]);
    setInventoryItems((inventoryData ?? []) as InventoryItem[]);

    const loadedRows: OfferRow[] =
      (items ?? []).length > 0
        ? (items ?? []).map((item) => {
            const inventoryMatch = (inventoryData ?? []).find(
              (inv) => inv.id === item.inventory_item_id || inv.item_code === item.item_code
            );
            const basePrice = Number(inventoryMatch?.unit_price ?? item.unit_price ?? 0);
            const offerUnitPrice = Number(item.unit_price ?? 0);
            const multiplier = basePrice > 0 ? offerUnitPrice / basePrice : 1;

            return {
              id: item.id,
              item_id: item.inventory_item_id ?? inventoryMatch?.id ?? null,
              item_code: item.item_code ?? "",
              item_name: item.item_name ?? "",
              description: item.description ?? "",
              quantity: String(item.quantity ?? 1),
              multiplier: String(Number(multiplier.toFixed(4))),
              unit: item.unit ?? "pcs",
              base_unit_price: basePrice,
              offer_unit_price: offerUnitPrice,
              currency: normalizeCurrency(offer.currency_code),
              line_total: Number(item.line_total ?? 0),
            };
          })
        : [emptyOfferRow()];

    setRows(loadedRows);
    setLoading(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      void initialize();
    });
  }, []);

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

  function getSuggestions(input: string) {
    const normalized = input.trim().toLocaleLowerCase("tr-TR");
    if (!normalized) return [];

    return inventoryItems
      .filter((item) => item.item_code.toLocaleLowerCase("tr-TR").startsWith(normalized))
      .slice(0, 8);
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
          description: row.description || item.description || "",
          unit: item.unit?.trim() || "pcs",
          base_unit_price: Number(item.unit_price ?? 0),
          currency: normalizeCurrency(item.currency ?? item.currency_code),
        });
      })
    );

    setActiveSuggestionRowId(null);
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

    setPendingNewItemRowId(rowId);
    setNewPartForm({
      ...emptyNewPartForm,
      item_code: code.toUpperCase(),
      description: row.description || "",
    });
    setShowNewPartModal(true);
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

  function getSubtotal() {
    return Number(rows.reduce((sum, row) => sum + Number(row.line_total || 0), 0).toFixed(2));
  }

  async function handleCreateInventoryItem() {
    resetMessages();

    if (!newPartForm.item_code.trim()) {
      setErrorText("ParÃ§a kodu zorunludur.");
      return;
    }

    if (!newPartForm.item_name.trim()) {
      setErrorText("ParÃ§a adÄ± zorunludur.");
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
      item_name: newPartForm.item_name.trim(),
      current_stock: toNumber(newPartForm.current_stock),
      min_stock: newPartForm.min_stock.trim() ? toNumber(newPartForm.min_stock) : null,
      category: newPartForm.brand.trim() || null,
      description: newPartForm.description.trim() || null,
      unit_price: newPartForm.unit_price.trim() ? toNumber(newPartForm.unit_price) : null,
      currency: normalizeCurrency(newPartForm.currency),
      is_active: true,
    };

    const { data, error } = await supabase
      .from("inventory_items")
      .insert(payload)
      .select(`
        id,
        item_code,
        item_name,
        description,
        unit,
        unit_price,
        currency,
        currency_code
      `)
      .single();

    if (error || !data) {
      setSaving(false);
      setErrorText(error?.message || "ParÃ§a eklenemedi.");
      return;
    }

    await supabase.from("inventory_movements").insert({
      company_id: companyId,
      inventory_item_id: data.id,
      movement_type: "create",
      quantity: payload.current_stock,
      unit_cost: payload.unit_price,
      note: "Teklif dÃ¼zenleme ekranÄ±ndan yeni parÃ§a eklendi",
    });

    const normalizedItem = data as InventoryItem;
    setInventoryItems((prev) => [normalizedItem, ...prev]);

    if (pendingNewItemRowId) {
      applyInventoryItemToRow(pendingNewItemRowId, normalizedItem);
    }

    setSaving(false);
    setShowNewPartModal(false);
    setPendingNewItemRowId(null);
    setNewPartForm(emptyNewPartForm);
    setSuccessText("Yeni parÃ§a depoya eklendi.");
  }

  async function handleSave() {
    resetMessages();

    if (!customerId) {
      setErrorText("MÃ¼ÅŸteri seÃ§imi zorunludur.");
      return;
    }

    const validRows = rows.filter(
      (row) => row.item_code.trim() && row.item_name.trim() && toNumber(row.quantity) > 0
    );

    if (validRows.length === 0) {
      setErrorText("En az bir geÃ§erli satÄ±r olmalÄ±.");
      return;
    }

    if (saving) return;
    setSaving(true);

    const subtotal = getSubtotal();
    const discountTotal = 0;
    const taxTotal = 0;
    const grandTotal = subtotal - discountTotal + taxTotal;
    const currencyCode = validRows[0]?.currency ?? "TRY";

    const mergedNotes = [
      salesRep.trim() ? `Satış Temsilcisi: ${salesRep.trim()}` : "",
      salesRepEmail.trim() ? `E-mail: ${salesRepEmail.trim()}` : "",
      salesRepPhone.trim() ? `Telefon: ${salesRepPhone.trim()}` : "",
      notes.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    const { error: updateError } = await supabase
      .from("offers")
      .update({
        offer_no: offerNo.trim(),
        customer_id: customerId,
        offer_date: offerDate,
        valid_until: validUntil || null,
        currency_code: currencyCode,
        status,
        subtotal,
        discount_total: discountTotal,
        tax_total: taxTotal,
        grand_total: grandTotal,
        notes: mergedNotes || null,
      })
      .eq("company_id", companyId)
      .eq("id", offerId);

    if (updateError) {
      setSaving(false);
      setErrorText(updateError.message);
      return;
    }

    const { error: deleteItemsError } = await supabase
      .from("offer_items")
      .delete()
      .eq("company_id", companyId)
      .eq("offer_id", offerId);

    if (deleteItemsError) {
      setSaving(false);
      setErrorText(deleteItemsError.message);
      return;
    }

    const payload = validRows.map((row) => ({
      company_id: companyId,
      offer_id: offerId,
      inventory_item_id: row.item_id,
      item_code: row.item_code.trim() || null,
      item_name: row.item_name.trim(),
      description: row.description.trim() || null,
      quantity: toNumber(row.quantity),
      unit: row.unit.trim() || "pcs",
      unit_price: Number(row.offer_unit_price ?? 0),
      discount_rate: 0,
      tax_rate: 0,
    }));

    const { error: insertError } = await supabase.from("offer_items").insert(payload);

    setSaving(false);

    if (insertError) {
      setErrorText(insertError.message);
      return;
    }

    setSuccessText("Teklif gÃ¼ncellendi.");
    router.push(`/dashboard/offers/${offerId}`);
    router.refresh();
  }

  const subtotal = useMemo(() => getSubtotal(), [rows]);

  if (loading) {
    return <div className="text-sm text-slate-600">YÃ¼kleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Teklif DÃ¼zenle</h1>
          <p className="mt-1 text-sm text-slate-500">{offerNo || "Teklif"}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/dashboard/offers/${offerId}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Geri DÃ¶n
          </Link>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : "DeÄŸiÅŸiklikleri Kaydet"}
          </button>
        </div>
      </div>

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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Teklif No</label>
          <input
            type="text"
            value={offerNo}
            onChange={(e) => setOfferNo(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">MÃ¼ÅŸteri</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
          >
            <option value="">MÃ¼ÅŸteri seÃ§in</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.company_name} ({customer.customer_code})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Teklif Tarihi</label>
          <input
            type="date"
            value={offerDate}
            onChange={(e) => setOfferDate(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">GeÃ§erlilik Tarihi</label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Satış Temsilcisi</label>
          <input
            type="text"
            value={salesRep}
            onChange={(e) => setSalesRep(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Temsilci E-mail</label>
          <input
            type="email"
            value={salesRepEmail}
            onChange={(e) => setSalesRepEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Temsilci Telefon</label>
          <input
            type="text"
            value={salesRepPhone}
            onChange={(e) => setSalesRepPhone(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <label className="text-sm font-medium text-slate-700">Notlar</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[140px] w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1450px] w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ParÃ§a Kodu</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ParÃ§a AdÄ±</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">AÃ§Ä±klama</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Adet</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Ã‡arpan</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Birim</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Depo Fiyat</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Teklif Fiyat</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Para Birimi</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">SatÄ±r ToplamÄ±</th>
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
                          ref={(el) => {
                            itemCodeInputRefs.current[row.id] = el;
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
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
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
                        className="min-h-[78px] min-w-[280px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
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
                        className="w-[90px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
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
                        Sil
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={addRow}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          + SatÄ±r Ekle
        </button>

        <div className="text-right">
          <div className="text-sm text-slate-500">Ara Toplam</div>
          <div className="text-2xl font-semibold text-slate-900">
            {formatCurrency(subtotal, rows[0]?.currency ?? "TRY")}
          </div>
        </div>
      </div>

      {showNewPartModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Yeni ParÃ§a Ekle</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Girilen kod depoda bulunamadÄ±. ParÃ§ayÄ± Ã¶nce depoya ekleyelim.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowNewPartModal(false)}
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
              >
                âœ•
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">ParÃ§a Kodu</label>
                <input
                  type="text"
                  value={newPartForm.item_code}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, item_code: e.target.value.toUpperCase() }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">ParÃ§a AdÄ±</label>
                <input
                  type="text"
                  value={newPartForm.item_name}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, item_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Stok</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newPartForm.current_stock}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, current_stock: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Min. Stok</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newPartForm.min_stock}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, min_stock: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Marka</label>
                <input
                  type="text"
                  value={newPartForm.brand}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, brand: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Birim Fiyat</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newPartForm.unit_price}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, unit_price: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Para Birimi</label>
                <select
                  value={newPartForm.currency}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, currency: normalizeCurrency(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                >
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">AÃ§Ä±klama</label>
                <textarea
                  value={newPartForm.description}
                  onChange={(e) => setNewPartForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-[110px] w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowNewPartModal(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                VazgeÃ§
              </button>

              <button
                type="button"
                onClick={() => void handleCreateInventoryItem()}
                disabled={saving}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Kaydediliyor..." : "ParÃ§ayÄ± Depoya Ekle"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
