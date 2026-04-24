"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
  const labelClass = "mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200";

  const [machineCode, setMachineCode] = useState(initialValues?.machine_code ?? "");
  const [customerId, setCustomerId] = useState(initialValues?.customer_id ?? "");
  const [machineName, setMachineName] = useState(initialValues?.machine_name ?? "");
  const [brand, setBrand] = useState(initialValues?.brand ?? "");
  const [model, setModel] = useState(initialValues?.model ?? "");
  const [serialNumber, setSerialNumber] = useState(initialValues?.serial_number ?? "");
  const [installationDate, setInstallationDate] = useState(dateValue(initialValues?.installation_date));
  const [warrantyEndDate, setWarrantyEndDate] = useState(dateValue(initialValues?.warranty_end_date));
  const [maintenancePeriodDays, setMaintenancePeriodDays] = useState(
    initialValues?.maintenance_period_days ? String(initialValues.maintenance_period_days) : ""
  );
  const [lastMaintenanceDate, setLastMaintenanceDate] = useState(dateValue(initialValues?.last_maintenance_date));
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState(dateValue(initialValues?.next_maintenance_date));
  const [locationText, setLocationText] = useState(initialValues?.location_text ?? "");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [status, setStatus] = useState(initialValues?.status ?? "active");
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      setErrorText("Bu işlem için yetkiniz yok.");
      return;
    }

    setSaving(true);
    setErrorText("");

    const payload = {
      company_id: companyId,
      customer_id: customerId || null,
      machine_code: machineCode.trim() || (isEdit ? null : `MAC-${Date.now()}`),
      machine_name: machineName.trim(),
      brand: brand.trim() || null,
      model: model.trim() || null,
      serial_number: serialNumber.trim() || null,
      installation_date: installationDate || null,
      warranty_end_date: warrantyEndDate || null,
      maintenance_period_days: Number(maintenancePeriodDays) || null,
      last_maintenance_date: lastMaintenanceDate || null,
      next_maintenance_date: nextMaintenanceDate || null,
      location_text: locationText.trim() || null,
      notes: notes.trim() || null,
      status: status || "active",
    };

    if (!payload.machine_name) {
      setErrorText("Makine adı zorunludur.");
      setSaving(false);
      return;
    }

    const response = await fetch(isEdit && initialValues?.id ? `/api/machines/${initialValues.id}` : "/api/machines", {
      method: isEdit && initialValues?.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    setSaving(false);

    if (!response.ok) {
      setErrorText(result.error ?? "Makine kaydedilemedi.");
      return;
    }

    const nextId = result.machine?.id ?? initialValues?.id;
    router.push(nextId ? `/dashboard/machines/${nextId}` : "/dashboard/machines");
    router.refresh();
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorText ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {errorText}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
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

        <div>
          <label className={labelClass}>Makine Kodu</label>
          <input className={inputClass} value={machineCode} onChange={(event) => setMachineCode(event.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Makine Adı</label>
          <input className={inputClass} value={machineName} onChange={(event) => setMachineName(event.target.value)} required />
        </div>

        <div>
          <label className={labelClass}>Seri No</label>
          <input className={inputClass} value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Marka</label>
          <input className={inputClass} value={brand} onChange={(event) => setBrand(event.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Model</label>
          <input className={inputClass} value={model} onChange={(event) => setModel(event.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Durum</label>
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
            <option value="in_service">Serviste</option>
            <option value="scrapped">Hurda</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Bakım Periyodu (gün)</label>
          <input className={inputClass} type="number" min="0" value={maintenancePeriodDays} onChange={(event) => setMaintenancePeriodDays(event.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Kurulum Tarihi</label>
          <input className={inputClass} type="date" value={installationDate} onChange={(event) => setInstallationDate(event.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Garanti Bitiş</label>
          <input className={inputClass} type="date" value={warrantyEndDate} onChange={(event) => setWarrantyEndDate(event.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Son Bakım</label>
          <input className={inputClass} type="date" value={lastMaintenanceDate} onChange={(event) => setLastMaintenanceDate(event.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Sonraki Bakım</label>
          <input className={inputClass} type="date" value={nextMaintenanceDate} onChange={(event) => setNextMaintenanceDate(event.target.value)} />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>Konum</label>
          <input className={inputClass} value={locationText} onChange={(event) => setLocationText(event.target.value)} />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>Notlar</label>
          <textarea className={`${inputClass} min-h-28 resize-y`} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Vazgeç
          </button>
        ) : cancelHref ? (
          <button
            type="button"
            onClick={() => router.push(cancelHref)}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Vazgeç
          </button>
        ) : null}

        <button
          type="submit"
          disabled={saving || !canSubmit}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </form>
  );

  if (hideCard) return formContent;

  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">{formContent}</div>;
}
