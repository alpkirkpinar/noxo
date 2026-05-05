"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TicketStatus =
  | "new"
  | "assigned"
  | "investigating"
  | "waiting_offer"
  | "waiting_parts"
  | "in_progress"
  | "completed"
  | "cancelled";

type Props = {
  ticketId: string;
  changedBy: string;
  currentStatus: TicketStatus;
  latestStatusNote?: string | null;
  canUpdateStatus?: boolean;
};

const ORDER: TicketStatus[] = [
  "new",
  "assigned",
  "investigating",
  "waiting_offer",
  "waiting_parts",
  "in_progress",
  "completed",
];

function statusLabel(status: TicketStatus) {
  switch (status) {
    case "new":
      return "Yeni";
    case "assigned":
      return "Atandı";
    case "investigating":
      return "İnceleniyor";
    case "waiting_offer":
      return "Teklif Bekleniyor";
    case "waiting_parts":
      return "Parça Bekleniyor";
    case "in_progress":
      return "İşlemde";
    case "completed":
      return "Tamamlandı";
    case "cancelled":
      return "İptal Edildi";
    default:
      return status;
  }
}

export default function TicketStatusForm({
  ticketId,
  changedBy,
  currentStatus,
  latestStatusNote = null,
  canUpdateStatus = true,
}: Props) {
  const router = useRouter();

  const [status, setStatus] = useState<TicketStatus>(currentStatus);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");

  const currentIndex = useMemo(() => ORDER.indexOf(status), [status]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setErrorText("");

    if (!canUpdateStatus) {
      setSaving(false);
      setErrorText("Ticket durum güncelleme yetkiniz yok.");
      return;
    }

    const response = await fetch(`/api/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        changedBy,
        status,
        note,
      }),
    });
    const data = await response.json();

    setSaving(false);

    if (!response.ok) {
      setErrorText(data?.error || "Ticket durumu güncellenemedi.");
      return;
    }

    setNote("");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Ticket Durum Akışı</h2>
        <p className="mt-1 text-sm text-slate-500">Ticket sürecini kontrollü şekilde ilerlet</p>
      </div>

      <div className="mb-5 overflow-x-auto">
        <div className="flex min-w-[760px] items-center gap-2">
          {ORDER.map((item, index) => {
            const isDone = index < currentIndex;
            const isCurrent = item === status;

            return (
              <div key={item} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStatus(item)}
                  className={[
                    "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                    isCurrent
                      ? "border-slate-900 bg-slate-900 text-white"
                      : isDone
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {statusLabel(item)}
                </button>

                {index < ORDER.length - 1 ? (
                  <div className={["h-[2px] w-8", index < currentIndex ? "bg-emerald-400" : "bg-slate-200"].join(" ")} />
                ) : null}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setStatus("cancelled")}
            className={[
              "ml-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
              status === "cancelled"
                ? "border-rose-600 bg-rose-600 text-white"
                : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
            ].join(" ")}
          >
            İptal Et
          </button>
        </div>
      </div>

      {errorText ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorText}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-medium text-slate-700">Seçili Durum</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{statusLabel(status)}</div>
          {latestStatusNote ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Son Durum Notu</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{latestStatusNote}</div>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Durum Notu</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Bu değişiklik için kısa bir açıklama yazın"
            className="min-h-[120px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : "Durumu Güncelle"}
          </button>
        </div>
      </form>
    </div>
  );
}
