"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CustomerItem = {
  id: string;
  company_name: string;
};

type MachineItem = {
  id: string;
  customer_id: string;
  machine_name: string;
  machine_code: string;
};

type EmployeeItem = {
  id: string;
  full_name: string;
};

type Props = {
  companyId: string;
  openedBy: string;
  customers: CustomerItem[];
  machines: MachineItem[];
  employees: EmployeeItem[];
  onCancel?: () => void;
  onSuccess?: () => void;
  submitLabel?: string;
  compact?: boolean;
  canCreate?: boolean;
};

type TicketPriority = "low" | "medium" | "high" | "critical";

export default function NewTicketForm({
  companyId,
  openedBy,
  customers,
  machines,
  employees,
  onCancel,
  onSuccess,
  submitLabel = "Ticket Oluştur",
  compact = false,
  canCreate = true,
}: Props) {
  const router = useRouter();

  const [customerId, setCustomerId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  const filteredMachines = useMemo(() => {
    if (!customerId) return [];
    return machines.filter((machine) => machine.customer_id === customerId);
  }, [machines, customerId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorText("");

    if (!canCreate) {
      setErrorText("Ticket oluşturma yetkiniz yok.");
      return;
    }

    if (!customerId) {
      setErrorText("Müşteri seçmek zorunludur.");
      return;
    }

    if (!title.trim()) {
      setErrorText("Başlık zorunludur.");
      return;
    }

    setSubmitting(true);

    const response = await fetch("/api/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyId,
        openedBy,
        customerId,
        machineId,
        assignedTo,
        title,
        description,
        priority,
      }),
    });
    const data = await response.json();

    setSubmitting(false);

    if (!response.ok) {
      setErrorText(data?.error || "Ticket oluşturulamadı.");
      return;
    }

    if (onSuccess) {
      onSuccess();
    } else {
      router.push("/dashboard/tickets");
    }

    router.refresh();
  }

  return (
    <div className={compact ? "" : "rounded-xl border bg-white p-6"}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Müşteri</label>
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setMachineId("");
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              required
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
            <label className="text-sm font-medium">Makine</label>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              disabled={!customerId}
            >
              <option value="">Makine seçin</option>
              {filteredMachines.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.machine_name} {machine.machine_code ? `(${machine.machine_code})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Başlık</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Örnek: Konveyör sensör sorunu"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Öncelik</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="low">Düşük</option>
              <option value="medium">Orta</option>
              <option value="high">Yüksek</option>
              <option value="critical">Kritik</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Atanan Kullanıcı</label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Atanmadı</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Açıklama</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[140px] w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Ticket detaylarını yazın..."
          />
        </div>

        {errorText ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorText}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Vazgeç
            </button>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Oluşturuluyor..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
