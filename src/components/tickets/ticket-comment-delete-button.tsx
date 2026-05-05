"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

type Props = {
  ticketId: string;
  commentId: string;
};

export default function TicketCommentDeleteButton({ ticketId, commentId }: Props) {
  const router = useRouter();
  const confirmDialog = useConfirmDialog();
  const [deleting, setDeleting] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function handleDelete() {
    setErrorText("");

    const confirmed = await confirmDialog.confirm({
      title: "Yorumu Sil",
      message: "Bu yorum silinecek.",
    });

    if (!confirmed) return;

    setDeleting(true);

    const response = await fetch(`/api/tickets/${ticketId}/comments/${commentId}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));

    setDeleting(false);

    if (!response.ok) {
      setErrorText(data?.error || "Yorum silinemedi.");
      return;
    }

    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={deleting}
        className="text-xs font-medium text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {deleting ? "Siliniyor..." : "Sil"}
      </button>

      {errorText ? <div className="mt-2 w-full text-xs text-rose-600">{errorText}</div> : null}
      {confirmDialog.dialog}
    </>
  );
}
