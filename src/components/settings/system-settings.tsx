"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  companyId: string;
  initialCompanyName: string;
  initialLogoUrl: string;
};

export default function SystemSettings({
  companyId,
  initialCompanyName,
  initialLogoUrl,
}: Props) {
  const supabase = createClient();

  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  function resetMessages() {
    setErrorText("");
    setSuccessText("");
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

      const { data } = supabase.storage
        .from("public-assets")
        .getPublicUrl(fileName);

      setLogoUrl(data.publicUrl);
      setSuccessText("Logo yüklendi. Kaydet butonuna bas.");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Logo yüklenemedi.");
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
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "company_id",
      }
    );

    setSaving(false);

    if (error) {
      setErrorText(error.message);
      return;
    }

    setSuccessText("Sistem ayarları kaydedildi.");
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Şirket Adı
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Şirket adı"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Şirket Logosu
            </label>

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

              <p className="mt-2 text-xs text-slate-500">
                PNG, JPG, JPEG, WEBP, SVG desteklenir.
              </p>
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
          <div className="mb-2 text-sm font-medium text-slate-700">Logo Önizleme</div>

          <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Şirket logosu"
                className="max-h-[180px] max-w-full object-contain"
              />
            ) : (
              <div className="text-sm text-slate-400">Henüz logo yüklenmedi</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}