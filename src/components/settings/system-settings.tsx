"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  companyId: string;
  initialCompanyName: string;
  initialLogoUrl: string;
  initialWebsiteUrl: string;
  initialPhone: string;
  initialAddress: string;
  initialMaintenanceApproverName: string;
  initialMaintenanceApproverTitle: string;
  canManageApprover: boolean;
};

export default function SystemSettings({
  companyId,
  initialCompanyName,
  initialLogoUrl,
  initialWebsiteUrl,
  initialPhone,
  initialAddress,
  initialMaintenanceApproverName,
  initialMaintenanceApproverTitle,
  canManageApprover,
}: Props) {
  const supabase = createClient();

  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl);
  const [phone, setPhone] = useState(initialPhone);
  const [address, setAddress] = useState(initialAddress);
  const [maintenanceApproverName, setMaintenanceApproverName] = useState(
    initialMaintenanceApproverName
  );
  const [maintenanceApproverTitle, setMaintenanceApproverTitle] = useState(
    initialMaintenanceApproverTitle
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  function resetMessages() {
    setErrorText("");
    setSuccessText("");
  }

  function isMissingSettingsContactColumn(message: string) {
    return (
      message.includes("website_url") ||
      message.includes("phone") ||
      message.includes("address")
    );
  }

  async function handleLogoUpload(file: File) {
    resetMessages();
    setUploading(true);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const safeExt = ext === "jpg" ? "jpeg" : ext;
      const fileName = `company-logos/${companyId}/${Date.now()}.${safeExt}`;

      const { error: uploadError } = await supabase.storage
        .from("public-assets")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        setErrorText(uploadError.message);
        setUploading(false);
        return;
      }

      const { data } = supabase.storage.from("public-assets").getPublicUrl(fileName);

      setLogoUrl(data.publicUrl);
      setSuccessText("Logo yuklendi. Kaydet butonuna bas.");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Logo yuklenemedi.");
    }

    setUploading(false);
  }

  async function handleSave() {
    resetMessages();
    setSaving(true);

    const { error } = await supabase.from("system_settings").upsert(
      {
        company_id: companyId,
        company_name: companyName.trim() || null,
        logo_url: logoUrl.trim() || null,
        website_url: websiteUrl.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        maintenance_approver_name: maintenanceApproverName.trim() || null,
        maintenance_approver_title: maintenanceApproverTitle.trim() || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "company_id",
      }
    );

    setSaving(false);

    if (error) {
      setErrorText(
        isMissingSettingsContactColumn(error.message)
          ? "Yeni sirket iletisim alanlari veritabaninda henuz olusmamis. Once son migration'i uygulayin."
          : error.message
      );
      return;
    }

    setSuccessText("Sistem ayarlari kaydedildi.");
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Sirket Adi</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Sirket adi"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Sirket Logosu</label>

            <div className="rounded-2xl border border-dashed border-slate-300 p-4">
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleLogoUpload(file);
                  }
                }}
                className="block w-full text-sm text-slate-700"
              />

              <p className="mt-2 text-xs text-slate-500">PNG, JPG, JPEG, WEBP, SVG desteklenir.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Teklif PDF Alt Bilgisi</h2>
              <p className="mt-1 text-xs text-slate-500">
                Bu bilgiler fiyat teklifi PDF dosyalarinin alt bilgisinde gosterilir.
              </p>
              {!canManageApprover ? (
                <p className="mt-2 text-xs text-amber-700">
                  Bu alanlari yalnizca admin kullanicilar degistirebilir.
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Internet Sitesi</label>
                <input
                  type="text"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  disabled={!canManageApprover}
                  placeholder="Ornek: https://www.ornek.com"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Telefon Numarasi</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!canManageApprover}
                  placeholder="Ornek: +90 555 000 00 00"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">Adres</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={!canManageApprover}
                placeholder="Sirket adresi"
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Bakim Onaylayani</h2>
              <p className="mt-1 text-xs text-slate-500">
                Bakim sertifikalarindaki onaylayan imza alaninda bu bilgiler kullanilir.
              </p>
              {!canManageApprover ? (
                <p className="mt-2 text-xs text-amber-700">
                  Bu alanlari yalnizca admin kullanicilar degistirebilir.
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Isim Soyisim</label>
                <input
                  type="text"
                  value={maintenanceApproverName}
                  onChange={(e) => setMaintenanceApproverName(e.target.value)}
                  disabled={!canManageApprover}
                  placeholder="Ornek: Ahmet Yilmaz"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Unvan</label>
                <input
                  type="text"
                  value={maintenanceApproverTitle}
                  onChange={(e) => setMaintenanceApproverTitle(e.target.value)}
                  disabled={!canManageApprover}
                  placeholder="Ornek: Teknik Mudur"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100"
                />
              </div>
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

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || uploading}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-slate-700">Logo Onizleme</div>

          <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Sirket logosu" className="max-h-[180px] max-w-full object-contain" />
            ) : (
              <div className="text-sm text-slate-400">Henuz logo yuklenmedi</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
