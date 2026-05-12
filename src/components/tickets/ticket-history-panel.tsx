"use client";

import { useLayoutEffect, useRef, useState } from "react";

type TicketStatus =
  | "new"
  | "assigned"
  | "investigating"
  | "waiting_offer"
  | "waiting_parts"
  | "in_progress"
  | "completed"
  | "cancelled";

type TicketHistoryItem = {
  id: string;
  new_status: TicketStatus;
  changed_at: string;
  note: string | null;
  changer:
    | {
        full_name: string | null;
      }
    | {
        full_name: string | null;
      }[]
    | null;
};

type TicketHistoryPanelProps = {
  history: TicketHistoryItem[];
};

const PAGE_SIZE = 5;
const SLOT_CLASS_NAME = "min-h-[7.5rem] rounded-2xl border border-slate-200 bg-slate-50 p-4";

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

export default function TicketHistoryPanel({ history }: TicketHistoryPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousTopRef = useRef<number | null>(null);
  const [startIndex, setStartIndex] = useState(0);
  const visibleHistory = history.slice(startIndex, startIndex + PAGE_SIZE);
  const emptySlotCount = PAGE_SIZE - visibleHistory.length;
  const canGoBack = startIndex > 0;
  const canGoForward = startIndex + PAGE_SIZE < history.length;

  useLayoutEffect(() => {
    if (previousTopRef.current === null) {
      return;
    }

    const nextTop = panelRef.current?.getBoundingClientRect().top;
    if (typeof nextTop === "number") {
      window.scrollBy(0, previousTopRef.current - nextTop);
    }

    previousTopRef.current = null;
  }, [startIndex]);

  function handlePageChange(nextStartIndex: number) {
    previousTopRef.current = panelRef.current?.getBoundingClientRect().top ?? null;
    setStartIndex(nextStartIndex);
  }

  return (
    <div ref={panelRef} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Durum Geçmişi</h2>

        {history.length > PAGE_SIZE ? (
          <div className="flex items-center gap-2">
            {canGoBack ? (
              <button
                type="button"
                onClick={() => handlePageChange(Math.max(0, startIndex - PAGE_SIZE))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                aria-label="Önceki durum geçmişi kayıtları"
              >
                ←
              </button>
            ) : null}

            {canGoForward ? (
              <button
                type="button"
                onClick={() => handlePageChange(startIndex + PAGE_SIZE)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                aria-label="Sonraki durum geçmişi kayıtları"
              >
                →
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {visibleHistory.map((item) => {
          const changer = Array.isArray(item.changer) ? item.changer[0] : item.changer;

          return (
            <div key={item.id} className={SLOT_CLASS_NAME}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{statusLabel(item.new_status)}</div>
                <div className="text-xs text-slate-500">{new Date(item.changed_at).toLocaleString("tr-TR")}</div>
              </div>

              <div className="mt-2 text-sm text-slate-600">Değiştiren: {changer?.full_name ?? "-"}</div>

              {item.note ? <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.note}</div> : null}
            </div>
          );
        })}

        {Array.from({ length: emptySlotCount }).map((_, index) => (
          <div
            key={`empty-slot-${startIndex + index}`}
            aria-hidden="true"
            className={`${SLOT_CLASS_NAME} border-dashed bg-slate-50/60`}
          >
            {history.length === 0 && index === 0 ? <div className="text-sm text-slate-400">Geçmiş kayıt yok.</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
