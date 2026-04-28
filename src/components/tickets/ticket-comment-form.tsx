"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  companyId: string;
  ticketId: string;
  createdBy: string;
  canComment?: boolean;
};

export default function TicketCommentForm({
  companyId,
  ticketId,
  createdBy,
  canComment = true,
}: Props) {
  const router = useRouter();

  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setErrorText("");

    if (!canComment) {
      setSaving(false);
      setErrorText("Ticket yorum ekleme yetkiniz yok.");
      return;
    }

    if (!commentText.trim()) {
      setSaving(false);
      setErrorText("Yorum alanı zorunludur.");
      return;
    }

    const response = await fetch(`/api/tickets/${ticketId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyId,
        createdBy,
        commentText,
      }),
    });
    const data = await response.json();

    setSaving(false);

    if (!response.ok) {
      setErrorText(data?.error || "Yorum eklenemedi.");
      return;
    }

    setCommentText("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Yorum Ekle</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="İç not yazın..."
          className="min-h-[120px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-400 dark:focus:border-blue-400"
        />

        {errorText ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorText}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Kaydediliyor..." : "Yorum Ekle"}
        </button>
      </form>
    </div>
  );
}

