"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { computeNextMaintenanceDate } from "@/lib/machines";

type CustomerItem = {
  id: string;
  company_name: string;
  customer_code?: string | null;
};

type MachineInitialValues = {
  id?: string;
  machine_code?: string | null;
  customer_id?: string | null;
  machine_name?: string | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  installation_date?: string | null;
  warranty_end_date?: string | null;
  maintenance_period_days?: number | null;
  last_maintenance_date?: string | null;
  next_maintenance_date?: string | null;
  location_text?: string | null;
  notes?: string | null;
  status?: string | null;
};

type Props = {
  companyId: string;
  createdBy?: string;
  customers: CustomerItem[];
  mode?: "create" | "edit";
  initialValues?: MachineInitialValues;
  canSubmit?: boolean;
  onCancel?: () => void;
  cancelHref?: string;
  hideCard?: boolean;
};

function dateValue(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
}

export default function MachineForm({
  companyId,
  customers,
  mode = "create",
  initialValues,
  canSubmit = true,
  onCancel,
  cancelHref,
  hideCard = false,
}: Props) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const inputClass =
    "min-w-0 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-400";
  const labelClass = "mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300";

  // ... (existing state)

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorText ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/30 dark:text-red-400">
          {errorText}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <label className={labelClass}>Müşteri</label>
          <select className={inputClass} value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Müşteri seç</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.company_name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className={labelClass}>Makine Kodu</label>
          <input className={inputClass} value={machineCode} onChange={(event) => setMachineCode(event.target.value)} />
        </div>

        <div className="min-w-0">
          <label className={labelClass}>Makine Adı</label>
          <input className={inputClass} value={machineName} onChange={(event) => setMachineName(event.target.value)} required />
        </div>

        <div className="min-w-0">
          <label className={labelClass}>Seri No</label>
          <input className={inputClass} value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} />
        </div>

        <div className="min-w-0">
          <label className={labelClass}>Marka</label>
          <input className={inputClass} value={brand} onChange={(event) => setBrand(event.target.value)} />
        </div>

        <div className="min-w-0">
          <label className={labelClass}>Model</label>
          <input className={inputClass} value={model} onChange={(event) => setModel(event.target.value)} />
        </div>

        <div className="min-w-0">
          <label className={labelClass}>Durum</label>
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
            <option value="in_service">Serviste</option>
            <option value="scrapped">Hurda</option>
          </select>
        </div>

        <div className="min-w-0">
          <label className={labelClass}>Bakım Periyodu (gün)</label>
          <input
            className={inputClass}
            type="number"
            min="0"
            value={maintenancePeriodDays}
            onChange={(event) => setMaintenancePeriodDays(event.target.value)}
          />
        </div>

        <div className="min-w-0">
          <label className={labelClass}>Kurulum Tarihi</label>
          <div className="relative">
            <input className={inputClass} type="date" value={installationDate} onChange={(event) => setInstallationDate(event.target.value)} />
            {installationDate && (
              <button
                type="button"
                onClick={() => setInstallationDate("")}
                className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <label className={labelClass}>Garanti Bitiş</label>
          <div className="relative">
            <input className={inputClass} type="date" value={warrantyEndDate} onChange={(event) => setWarrantyEndDate(event.target.value)} />
            {warrantyEndDate && (
              <button
                type="button"
                onClick={() => setWarrantyEndDate("")}
                className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <label className={labelClass}>Son Bakım</label>
          <div className="relative">
            <input className={inputClass} type="date" value={lastMaintenanceDate} onChange={(event) => setLastMaintenanceDate(event.target.value)} />
            {lastMaintenanceDate && (
              <button
                type="button"
                onClick={() => setLastMaintenanceDate("")}
                className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <label className={labelClass}>Sonraki Bakım</label>
          <input className={inputClass} type="date" value={dateValue(computedNextMaintenanceDate)} readOnly />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Sonraki bakım tarihi bakım periyodu ile son bakım veya kurulum tarihine göre hesaplanır.
          </p>
        </div>

        <div className="min-w-0 md:col-span-2">
          <label className={labelClass}>Konum</label>
          <input className={inputClass} value={locationText} onChange={(event) => setLocationText(event.target.value)} />
        </div>

        <div className="min-w-0 md:col-span-2">
          <label className={labelClass}>Notlar</label>
          <textarea className={`${inputClass} min-h-28 resize-y`} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Vazgeç
          </button>
        ) : cancelHref ? (
          <button
            type="button"
            onClick={() => router.push(cancelHref)}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Vazgeç
          </button>
        ) : null}

        <button
          type="submit"
          disabled={saving || !canSubmit}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </form>
  );

  if (hideCard) return formContent;

  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">{formContent}</div>;
}
