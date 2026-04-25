export const MAINTENANCE_SCOPE_OPTIONS = [
  "Genel Temizlik",
  "Eksenlerin Yağlanması",
  "Filtre Temizliği",
  "Oring ve Conta değişimi",
  "Filtre Değişimi",
  "Makine Kalibrasyonları",
  "Test Üretimi",
] as const;

export function normalizeMaintenanceScopeItems(value: unknown) {
  if (!Array.isArray(value)) return [];

  const allowed = new Set<string>(MAINTENANCE_SCOPE_OPTIONS);
  return Array.from(new Set(value.map(String).filter((item) => allowed.has(item))));
}
