"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CustomerInitialValues = {
  id?: string;
  company_name?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  tax_office?: string | null;
  tax_number?: string | null;
  notes?: string | null;
  is_active?: boolean | null;
};

type Props = {
  companyId: string;
  createdBy?: string;
  initialValues?: CustomerInitialValues;
  mode: "create" | "edit";
  canSubmit?: boolean;
  onCancel?: () => void;
  cancelHref?: string;
  hideCard?: boolean;
};

export default function CustomerForm({
  companyId,
  createdBy,
  initialValues,
  mode,
  canSubmit = true,
  onCancel,
  cancelHref,
  hideCard = false,
}: Props) {
  const router = useRouter();
  const labelClassName = "text-sm font-medium text-slate-700";
  const inputClassName =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500";

  const [companyName, setCompanyName] = useState(initialValues?.company_name ?? "");
  const [contactName, setContactName] = useState(initialValues?.contact_name ?? "");
  const [phone, setPhone] = useState(initialValues?.phone ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [address, setAddress] = useState(initialValues?.address ?? "");
  const [city, setCity] = useState(initialValues?.city ?? "");
  const [country, setCountry] = useState(initialValues?.country ?? "Türkiye");
  const [taxOffice, setTaxOffice] = useState(initialValues?.tax_office ?? "");
  const [taxNumber, setTaxNumber] = useState(initialValues?.tax_number ?? "");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [isActive, setIsActive] = useState(initialValues?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorText("");

    if (!canSubmit) {
      setErrorText("Bu işlem için yetkiniz yok.");
      return;
    }

    if (!companyName.trim()) {
      setErrorText("Firma adı zorunludur.");
      return;
    }

    setSaving(true);

    const payload = {
      company_id: companyId,
      company_name: companyName.trim(),
      contact_name: contactName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      country: country.trim() || null,
      tax_office: taxOffice.trim() || null,
      tax_number: taxNumber.trim() || null,
      notes: notes.trim() || null,
      is_active: isActive,
      ...(mode === "create" ? { created_by: createdBy ?? null } : {}),
    };

    const response = await fetch(
      mode === "create" ? "/api/customers" : `/api/customers/${initialValues?.id}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const result = await response.json().catch(() => ({}));

    setSaving(false);

    if (!response.ok) {
      setErrorText(result.error ?? "Müşteri kaydedilemedi.");
      return;
    }

    const nextId = result.customer?.id ?? initialValues?.id;
    router.push(`/dashboard/customers/${nextId}`);
    router.refresh();
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label className={labelClassName}>Firma Adı</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={inputClassName}
            placeholder="Örnek: ABC Elektronik"
            required
          />
        </div>

        <div className="space-y-2">
          <label className={labelClassName}>İlgili Kişi</label>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className={inputClassName}
            placeholder="Örnek: Ahmet Yılmaz"
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <label className={labelClassName}>Telefon</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClassName} />
        </div>

        <div className="space-y-2">
          <label className={labelClassName}>E-posta</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClassName} />
        </div>

        <div className="space-y-2">
          <label className={labelClassName}>Vergi Dairesi</label>
          <input type="text" value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} className={inputClassName} />
        </div>

        <div className="space-y-2">
          <label className={labelClassName}>Vergi No</label>
          <input type="text" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} className={inputClassName} />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="space-y-2 md:col-span-2">
          <label className={labelClassName}>Adres</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClassName} />
        </div>

        <div className="grid gap-5 md:grid-cols-2 md:col-span-1">
          <div className="space-y-2">
            <label className={labelClassName}>Şehir</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClassName} />
          </div>

          <div className="space-y-2">
            <label className={labelClassName}>Ülke</label>
            <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className={inputClassName} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className={labelClassName}>Notlar</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`${inputClassName} min-h-[120px]`}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Aktif müşteri
      </label>

      {errorText ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorText}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Vazgeç
          </button>
        ) : cancelHref ? (
          <button
            type="button"
            onClick={() => router.push(cancelHref)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Vazgeç
          </button>
        ) : null}

        <button
          type="submit"
          disabled={saving || !canSubmit}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Kaydediliyor..." : mode === "create" ? "Müşteri Oluştur" : "Müşteriyi Güncelle"}
        </button>
      </div>
    </form>
  );

  if (hideCard) return formContent;

  return <div className="rounded-xl border border-slate-200 bg-white p-6">{formContent}</div>;
}
