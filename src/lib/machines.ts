export function normalizeDateOnly(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const [datePart] = text.split("T");
  const [year, month, day] = datePart.split("-").map(Number);

  if (!year || !month || !day) return null;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString().slice(0, 10);
}

export function addDaysToDate(dateText: string, days: number) {
  const normalized = normalizeDateOnly(dateText);
  if (!normalized) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function getMachineMaintenanceBaseDate(input: {
  lastMaintenanceDate?: string | null;
  installationDate?: string | null;
}) {
  return normalizeDateOnly(input.lastMaintenanceDate) ?? normalizeDateOnly(input.installationDate);
}

export function computeNextMaintenanceDate(input: {
  maintenancePeriodDays?: number | null;
  lastMaintenanceDate?: string | null;
  installationDate?: string | null;
}) {
  const periodDays = Number(input.maintenancePeriodDays ?? 0);
  if (periodDays <= 0) return null;

  const baseDate = getMachineMaintenanceBaseDate(input);
  if (!baseDate) return null;

  return addDaysToDate(baseDate, periodDays);
}
