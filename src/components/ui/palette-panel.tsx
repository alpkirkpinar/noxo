"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type PaletteField = {
  key: string;
  label: string;
  group: string;
};

const STORAGE_KEY = "noxo-live-palette";

const fields: PaletteField[] = [
  { group: "Ana Palet", key: "--brand-navy", label: "Koyu mavi" },
  { group: "Ana Palet", key: "--brand-blue", label: "Mavi" },
  { group: "Ana Palet", key: "--brand-orange", label: "Turuncu" },
  { group: "Ana Palet", key: "--brand-orange-deep", label: "Canlı turuncu" },
  { group: "Ana Palet", key: "--brand-black", label: "Siyah" },
  { group: "Yazı", key: "--foreground", label: "Genel yazı" },
  { group: "Yazı", key: "--theme-slate-900", label: "Başlık" },
  { group: "Yazı", key: "--theme-slate-700", label: "Gövde" },
  { group: "Yazı", key: "--theme-slate-500", label: "İkincil yazı" },
  { group: "Yüzey", key: "--brand-page-start", label: "Sayfa başlangıç" },
  { group: "Yüzey", key: "--brand-page-mid", label: "Sayfa orta" },
  { group: "Yüzey", key: "--brand-page-end", label: "Sayfa bitiş" },
  { group: "Yüzey", key: "--brand-border", label: "Kenarlık" },
  { group: "Mavi Ölçek", key: "--theme-blue-50", label: "Çok açık" },
  { group: "Mavi Ölçek", key: "--theme-blue-100", label: "Açık" },
  { group: "Mavi Ölçek", key: "--theme-blue-500", label: "Ana" },
  { group: "Mavi Ölçek", key: "--theme-blue-700", label: "Koyu" },
  { group: "Mavi Ölçek", key: "--theme-blue-900", label: "En koyu" },
  { group: "Turuncu Ölçek", key: "--theme-amber-50", label: "Yumuşak zemin" },
  { group: "Turuncu Ölçek", key: "--theme-amber-100", label: "Rozet zemin" },
  { group: "Turuncu Ölçek", key: "--theme-amber-500", label: "Turuncu ana" },
  { group: "Turuncu Ölçek", key: "--theme-amber-700", label: "Turuncu metin" },
  { group: "Canlı Turuncu Ölçek", key: "--theme-orange-50", label: "Yumuşak zemin" },
  { group: "Canlı Turuncu Ölçek", key: "--theme-orange-100", label: "Rozet zemin" },
  { group: "Canlı Turuncu Ölçek", key: "--theme-orange-500", label: "Canlı ana" },
  { group: "Canlı Turuncu Ölçek", key: "--theme-orange-700", label: "Canlı metin" },
];

function normalizeHex(value: string) {
  const withHash = value.trim().startsWith("#") ? value.trim() : `#${value.trim()}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toUpperCase() : null;
}

function readCurrentPalette() {
  if (typeof window === "undefined") return {};

  const styles = window.getComputedStyle(document.documentElement);
  return Object.fromEntries(
    fields.map((field) => [field.key, styles.getPropertyValue(field.key).trim()])
  );
}

function applyPalette(values: Record<string, string>) {
  Object.entries(values).forEach(([key, value]) => {
    if (/^--(?:brand|theme|foreground)/.test(key) && normalizeHex(value)) {
      document.documentElement.style.setProperty(key, normalizeHex(value) ?? value);
    }
  });
}

function withGeneratedScales(values: Record<string, string>) {
  const navy = normalizeHex(values["--brand-navy"] ?? "") ?? "#021F59";
  const blue = normalizeHex(values["--brand-blue"] ?? "") ?? "#035AA6";
  const orange = normalizeHex(values["--brand-orange"] ?? "") ?? "#F28705";
  const orangeDeep = normalizeHex(values["--brand-orange-deep"] ?? "") ?? "#F25C05";

  return {
    ...values,
    "--theme-blue-50": "#EAF4FF",
    "--theme-blue-100": "#D4EAFF",
    "--theme-blue-200": "#A8D2FA",
    "--theme-blue-300": "#75B7EE",
    "--theme-blue-400": "#3792D4",
    "--theme-blue-500": blue,
    "--theme-blue-700": blue,
    "--theme-blue-900": navy,
    "--theme-amber-50": "#FFF5E6",
    "--theme-amber-100": "#FFE8BF",
    "--theme-amber-200": "#FFD389",
    "--theme-amber-300": "#FFBD52",
    "--theme-amber-400": "#F8A324",
    "--theme-amber-500": orange,
    "--theme-amber-700": orange,
    "--theme-orange-50": "#FFF0E8",
    "--theme-orange-100": "#FFDCC9",
    "--theme-orange-200": "#FFBB9A",
    "--theme-orange-300": "#FF9866",
    "--theme-orange-400": "#FB7633",
    "--theme-orange-500": orangeDeep,
    "--theme-orange-700": orangeDeep,
  };
}

export function PaletteBootScript() {
  const script = `
try {
  var raw = localStorage.getItem("${STORAGE_KEY}");
  if (raw) {
    var values = JSON.parse(raw);
    Object.keys(values).forEach(function (key) {
      if (/^--[a-z0-9-]+$/.test(key) && /^#[0-9a-fA-F]{6}$/.test(values[key])) {
        document.documentElement.style.setProperty(key, values[key]);
      }
    });
  }
} catch {}
`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export default function PalettePanel() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");

  const groupedFields = useMemo(() => {
    return fields.reduce<Record<string, PaletteField[]>>((acc, field) => {
      acc[field.group] = [...(acc[field.group] ?? []), field];
      return acc;
    }, {});
  }, []);

  useEffect(() => {
    const current = readCurrentPalette();
    let stored: Record<string, string> = {};

    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {}

    const next = { ...current, ...stored };
    setValues(next);
    applyPalette(next);
  }, []);

  function updateColor(key: string, nextValue: string) {
    const normalized = normalizeHex(nextValue);
    setValues((prev) => ({ ...prev, [key]: normalized ?? nextValue }));
  }

  function handleHexChange(key: string, event: ChangeEvent<HTMLInputElement>) {
    updateColor(key, event.target.value);
  }

  function applyAndSave(nextValues = values) {
    const clean = Object.fromEntries(
      Object.entries(nextValues)
        .map(([key, value]) => [key, normalizeHex(value) ?? ""])
        .filter(([, value]) => value)
    );

    applyPalette(clean);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean, null, 2));
    setValues((prev) => ({ ...prev, ...clean }));
    setMessage("Uygulandı");
    window.setTimeout(() => setMessage(""), 1600);
  }

  function pullCurrent() {
    const current = readCurrentPalette();
    setValues(current);
    setMessage("Mevcut renkler çekildi");
    window.setTimeout(() => setMessage(""), 1600);
  }

  async function exportPalette() {
    const payload = JSON.stringify(values, null, 2);
    setImportText(payload);

    try {
      await navigator.clipboard.writeText(payload);
      setMessage("JSON kopyalandı");
    } catch {
      setMessage("JSON çıktı alanına yazıldı");
    }

    window.setTimeout(() => setMessage(""), 1600);
  }

  function importPalette() {
    try {
      const parsed = JSON.parse(importText) as Record<string, string>;
      const clean = Object.fromEntries(
        Object.entries(parsed)
          .filter(([key]) => fields.some((field) => field.key === key))
          .map(([key, value]) => [key, normalizeHex(String(value)) ?? ""])
          .filter(([, value]) => value)
      );

      setValues((prev) => ({ ...prev, ...clean }));
      applyAndSave({ ...values, ...clean });
      setMessage("Import edildi");
    } catch {
      setMessage("JSON okunamadı");
    }

    window.setTimeout(() => setMessage(""), 1600);
  }

  function resetPalette() {
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute("style");
    const current = readCurrentPalette();
    setValues(current);
    setMessage("Sıfırlandı");
    window.setTimeout(() => setMessage(""), 1600);
  }

  function generateFromBase() {
    const next = withGeneratedScales(values);
    setValues(next);
    applyAndSave(next);
    setMessage("Ana paletten ölçek üretildi");
    window.setTimeout(() => setMessage(""), 1600);
  }

  return (
    <div className="fixed bottom-4 left-4 z-[2147482000] text-slate-900">
      {open ? (
        <div className="mb-3 max-h-[78dvh] w-[min(420px,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <div>
              <div className="text-sm font-bold">Renk Paleti</div>
              <div className="text-xs text-slate-500">Değiştir, uygula, localhost’ta anında gör</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Kapat
            </button>
          </div>

          <div className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <button type="button" onClick={() => applyAndSave()} className="rounded-md bg-[#F25C05] px-3 py-2 text-xs font-bold text-white">
                Uygula
              </button>
              <button type="button" onClick={generateFromBase} className="rounded-md bg-[#035AA6] px-3 py-2 text-xs font-bold text-white">
                Ölçek Üret
              </button>
              <button type="button" onClick={pullCurrent} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                Mevcut
              </button>
              <button type="button" onClick={exportPalette} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                Export
              </button>
              <button type="button" onClick={resetPalette} className="rounded-md border border-orange-200 px-3 py-2 text-xs font-bold text-orange-700 hover:bg-orange-50">
                Sıfırla
              </button>
            </div>

            {message ? <div className="rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{message}</div> : null}

            {Object.entries(groupedFields).map(([group, groupFields]) => (
              <details key={group} className="rounded-lg border border-slate-200" open={group === "Ana Palet" || group === "Yazı"}>
                <summary className="cursor-pointer px-3 py-2 text-sm font-bold">{group}</summary>
                <div className="grid gap-2 px-3 pb-3">
                  {groupFields.map((field) => {
                    const value = normalizeHex(values[field.key] ?? "") ?? "#000000";

                    return (
                      <label key={field.key} className="grid grid-cols-[34px_minmax(0,1fr)_92px] items-center gap-2">
                        <input
                          type="color"
                          value={value}
                          onChange={(event) => updateColor(field.key, event.target.value)}
                          className="h-8 w-8 rounded-md border-0 p-0"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold">{field.label}</span>
                          <span className="block truncate text-[11px] text-slate-500">{field.key}</span>
                        </span>
                        <input
                          value={values[field.key] ?? ""}
                          onChange={(event) => handleHexChange(field.key, event)}
                          className="h-8 rounded-md border border-slate-300 px-2 text-xs font-semibold uppercase text-slate-900"
                        />
                      </label>
                    );
                  })}
                </div>
              </details>
            ))}

            <div>
              <div className="mb-2 text-xs font-bold text-slate-600">Import / Export JSON</div>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                spellCheck={false}
                className="h-28 w-full resize-y rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900"
              />
              <button type="button" onClick={importPalette} className="mt-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
                Import Et ve Uygula
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full bg-[#F25C05] px-4 py-3 text-sm font-bold text-white shadow-[0_16px_40px_rgba(15,23,42,0.28)] hover:bg-[#D94D04]"
      >
        Renkler
      </button>
    </div>
  );
}
