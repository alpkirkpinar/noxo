"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAINTENANCE_SCOPE_OPTIONS } from "@/lib/maintenance-options";

type Props = {
  machineId: string;
  canEdit: boolean;
  defaultPerformedAt: string;
  maintenanceAvailable?: boolean;
};

export default function MachineMaintenancePanel({
  machineId,
  canEdit,
  defaultPerformedAt,
  maintenanceAvailable = true,
}: Props) {
  const router = useRouter();
  const [performedAt, setPerformedAt] = useState(defaultPerformedAt);
  const [selectedScopeItems, setSelectedScopeItems] = useState<string[]>([]);
  const [operationPerformedAt, setOperationPerformedAt] = useState(defaultPerformedAt);
  const [operationType, setOperationType] = useState("Tamir");
  const [operationNote, setOperationNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [operationSaving, setOperationSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  function toggleScopeItem(item: string) {
    setSelectedScopeItems((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item]
    );
  }

  async function handleSubmit() {
    if (!canEdit) {
      setErrorText("Bu işlem için yetkiniz yok.");
      return;
    }

    setSaving(true);
    setErrorText("");
    setSuccessText("");

    const response = await fetch("/api/machines/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [machineId],
        performed_at: performedAt,
        maintenance_scope_items: selectedScopeItems,
      }),
    });

    const result = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setErrorText(result.error ?? "Bakım bilgisi güncellenemedi.");
      return;
    }

    setSuccessText("Bakım kaydı oluşturuldu.");
    setSelectedScopeItems([]);
    router.refresh();
  }

  async function handleOperationSubmit() {
    if (!canEdit) {
      setErrorText("Bu işlem için yetkiniz yok.");
      return;
    }

    if (!operationNote.trim()) {
      setErrorText("İşlem notu zorunludur.");
      return;
    }

    setOperationSaving(true);
    setErrorText("");
    setSuccessText("");

    const response = await fetch(`/api/machines/${machineId}/operations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        performed_at: operationPerformedAt,
        operation_type: operationType,
        note: operationNote,
      }),
    });

    const result = await response.json().catch(() => ({}));
    setOperationSaving(false);

    if (!response.ok) {
      setErrorText(result.error ?? "İşlem kaydı oluşturulamadı.");
      return;
    }

    setSuccessText("İşlem kaydı oluşturuldu.");
    setOperationType("Tamir");
    setOperationNote("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Bakım İşlemleri</h2>

      <div className="space-y-4">
        {!maintenanceAvailable ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-400">
            Bakım kayıt tablosu henüz oluşturulmamış. Bu alanı kullanmak için son migration uygulanmalı.
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Bakım Tarihi</label>
          <input
            type="date"
            value={performedAt}
            onChange={(event) => setPerformedAt(event.target.value)}
            disabled={!maintenanceAvailable}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Uygulanan Bakım Kapsamı</label>
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            {MAINTENANCE_SCOPE_OPTIONS.map((item) => (
              <label key={item} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={selectedScopeItems.includes(item)}
                  onChange={() => toggleScopeItem(item)}
                  disabled={!maintenanceAvailable}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>

        {errorText ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/30 dark:text-red-400">
            {errorText}
          </div>
        ) : null}

        {successText ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/30 dark:text-emerald-400">
            {successText}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving || !canEdit || !maintenanceAvailable}
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-600"
        >
          {saving ? "Kaydediliyor..." : "Bakım Yapıldı"}
        </button>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">İşlem Gir</h3>

          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">İşlem Tarihi</label>
              <input
                type="date"
                value={operationPerformedAt}
                onChange={(event) => setOperationPerformedAt(event.target.value)}
                disabled={!maintenanceAvailable}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">İşlem Türü</label>
              <select
                value={operationType}
                onChange={(event) => setOperationType(event.target.value)}
                disabled={!maintenanceAvailable}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-400"
              >
                <option value="Tamir">Tamir</option>
                <option value="Parca Degisimi">Parça Değişimi</option>
                <option value="Ayar">Ayar</option>
                <option value="Kontrol">Kontrol</option>
                <option value="Diger">Diğer</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Açıklama</label>
              <textarea
                value={operationNote}
                onChange={(event) => setOperationNote(event.target.value)}
                disabled={!maintenanceAvailable}
                rows={4}
                placeholder="Yapılan tamir, parça değişimi veya işlem detayı"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-400"
              />
            </div>

            <button
              type="button"
              onClick={() => void handleOperationSubmit()}
              disabled={operationSaving || !canEdit || !maintenanceAvailable}
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {operationSaving ? "Kaydediliyor..." : "İşlemi Kaydet"}
            </button>
          </div>
        </div>

        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("noxo:notification", {
                  detail: { message: "Pdf oluşturuluyor lütfen bekleyin" },
                })
              );
              
              const anchor = document.createElement("a");
              anchor.href = `/api/machines/${machineId}/maintenance-certificate`;
              anchor.target = "_blank";
              document.body.appendChild(anchor);
              anchor.click();
              anchor.remove();
            }}
            disabled={!maintenanceAvailable}
            className={`inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700`}
          >
            Bakım Sertifikası PDF
          </button>
        </div>
      </div>
    </div>
  );
}
