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
    <div className="rounded-xl border bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold">Yorum Ekle</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="İç not yazın..."
          className="min-h-[120px] w-full rounded-lg border px-3 py-2 text-sm"
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

