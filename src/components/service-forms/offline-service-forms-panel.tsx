"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  OFFLINE_SERVICE_FORMS_CHANGED,
  readQueuedOfflineServiceForms,
  syncQueuedOfflineServiceForms,
  type QueuedOfflineServiceForm,
} from "@/lib/offline-service-forms";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("tr-TR");
}

export default function OfflineServiceFormsPanel() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<QueuedOfflineServiceForm[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  function refreshItems() {
    setItems(readQueuedOfflineServiceForms());
  }

  const syncPendingForms = useCallback(async () => {
    if (syncing || (typeof navigator !== "undefined" && navigator.onLine === false)) return;

    setSyncing(true);
    setMessage("");

    try {
      const result = await syncQueuedOfflineServiceForms(supabase);
      refreshItems();

      if (result.synced > 0) {
        setMessage(`${result.synced} çevrimdışı form listeye kaydedildi.`);
        router.refresh();
      } else if (result.errors.length > 0) {
        setMessage(result.errors[0] ?? "Çevrimdışı formlar kaydedilemedi.");
      }
    } finally {
      setSyncing(false);
    }
  }, [router, supabase, syncing]);

  useEffect(() => {
    refreshItems();

    const handleChanged = () => refreshItems();
    const handleOnline = () => {
      void syncPendingForms();
    };

    window.addEventListener(OFFLINE_SERVICE_FORMS_CHANGED, handleChanged);
    window.addEventListener("online", handleOnline);
    void syncPendingForms();

    return () => {
      window.removeEventListener(OFFLINE_SERVICE_FORMS_CHANGED, handleChanged);
      window.removeEventListener("online", handleOnline);
    };
  }, [syncPendingForms]);

  if (items.length === 0 && !message) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
      {items.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="font-semibold">{items.length} form cihazda bekliyor</div>
            <div className="mt-1 text-amber-800">
              İnternet geldiğinde otomatik olarak form listesine kaydedilecek.
            </div>
            <div className="mt-2 space-y-1 text-xs text-amber-800">
              {items.slice(0, 3).map((item) => (
                <div key={item.queue_id} className="truncate">
                  {item.template_name ?? "Servis formu"} · {formatDateTime(item.created_at)}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void syncPendingForms()}
            disabled={syncing}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-amber-900 px-4 text-sm font-medium text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? "Kaydediliyor..." : "Şimdi Kaydet"}
          </button>
        </div>
      ) : null}

      {message ? <div className={items.length > 0 ? "mt-3" : ""}>{message}</div> : null}
    </div>
  );
}
