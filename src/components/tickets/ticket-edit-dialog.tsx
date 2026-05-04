"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TicketPriority = "low" | "medium" | "high" | "critical" | null;

type CustomerItem = {
  id: string;
  company_name: string;
};

type MachineItem = {
  id: string;
  customer_id: string;
  machine_name: string;
  serial_number: string | null;
};

type Props = {
  ticketId: string;
  initialTitle: string;
  initialDescription: string | null;
  initialPriority: TicketPriority;
  initialCustomerId: string | null;
  initialMachineId: string | null;
  customers: CustomerItem[];
  machines: MachineItem[];
  canEdit?: boolean;
};

export default function TicketEditDialog({
  ticketId,
  initialTitle,
  initialDescription,
  initialPriority,
  initialCustomerId,
  initialMachineId,
  customers,
  machines,
  canEdit = true,
}: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [machineId, setMachineId] = useState(initialMachineId ?? "");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [priority, setPriority] = useState<TicketPriority>(initialPriority ?? "medium");
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");

  const filteredMachines = useMemo(() => {
    if (!customerId) return [];
    return machines.filter((machine) => machine.customer_id === customerId);
  }, [customerId, machines]);

  function resetForm() {
    setCustomerId(initialCustomerId ?? "");
    setMachineId(initialMachineId ?? "");
    setTitle(initialTitle);
    setDescription(initialDescription ?? "");
    setPriority(initialPriority ?? "medium");
    setErrorText("");

    if (!canEdit) {
      setErrorText("Ticket düzenleme yetkiniz yok.");
      return;
    }
  }

  async function handleSave() {
    setErrorText("");

    if (!title.trim()) {
      setErrorText("Başlık zorunludur.");
      return;
    }

    setSaving(true);

    const response = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        description,
        priority,
        customerId,
        machineId,
      }),
    });
    const data = await response.json();

    setSaving(false);

    if (!response.ok) {
      setErrorText(data?.error || "Ticket güncellenemedi.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Düzenle
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Ticket Düzenle</h2>
                <p className="mt-1 text-sm text-slate-500">Başlık, açıklama ve önceliği güncelle</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                ×
              </button>
            </div>

            <div className="grid gap-5 px-6 py-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Müşteri</label>
                <select
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    setMachineId("");
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                >
                  <option value="">Müşteri seçin</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Makine</label>
                <select
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  disabled={!customerId}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                >
                  <option value="">Makine seçin</option>
                  {filteredMachines.map((machine) => (
                    <option key={machine.id} value={machine.id}>
                      {machine.machine_name} {machine.serial_number ? `(${machine.serial_number})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Başlık</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Öncelik</label>
                <select
                  value={priority ?? "medium"}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                >
                  <option value="low">Düşük</option>
                  <option value="medium">Orta</option>
                  <option value="high">Yüksek</option>
                  <option value="critical">Kritik</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Açıklama</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[160px] w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              {errorText ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 md:col-span-2">
                  {errorText}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                Kapat
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
