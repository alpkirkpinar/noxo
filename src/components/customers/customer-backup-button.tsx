"use client";

import { useState } from "react";

type Props = {
  customerId: string;
};

export default function CustomerBackupButton({ customerId }: Props) {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  async function handleBackup() {
    setLoading(true);
    setErrorText("");
    setSuccessText("");

    const response = await fetch(`/api/customers/${customerId}/backup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setErrorText(result.error ?? "Yedekleme tamamlanamadı.");
      return;
    }

    setSuccessText("Yedek Google Drive'a yüklendi.");
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => void handleBackup()}
        disabled={loading}
        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? "Yedekleniyor..." : "Drive Yedeği"}
      </button>
      {errorText ? <div className="text-right text-xs text-red-600">{errorText}</div> : null}
      {successText ? <div className="text-right text-xs text-emerald-700">{successText}</div> : null}
    </div>
  );
}
