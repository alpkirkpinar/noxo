const MOJIBAKE_REPLACEMENTS: Array<[string, string]> = [
  ["Ä±", "ı"],
  ["Ä°", "İ"],
  ["Ã¼", "ü"],
  ["Ãœ", "Ü"],
  ["Ã¶", "ö"],
  ["Ã–", "Ö"],
  ["Ã§", "ç"],
  ["Ã‡", "Ç"],
  ["ÅŸ", "ş"],
  ["Å", "Ş"],
  ["ÄŸ", "ğ"],
  ["Ä", "Ğ"],
];

function normalizeMessage(value: string) {
  let normalized = value.trim();

  for (const [from, to] of MOJIBAKE_REPLACEMENTS) {
    normalized = normalized.split(from).join(to);
  }

  return normalized;
}

export function localizeErrorMessage(message?: string | null, fallback = "İşlem tamamlanamadı.") {
  const normalized = normalizeMessage(message || "");
  if (!normalized) return fallback;

  const lower = normalized.toLocaleLowerCase("tr-TR");

  if (lower.includes("invalid login credentials")) return "E-posta veya şifre hatalı.";
  if (lower.includes("email not confirmed")) return "E-posta adresi henüz doğrulanmamış.";
  if (lower.includes("user already registered")) return "Bu e-posta adresi zaten kayıtlı.";
  if (lower.includes("email rate limit exceeded")) return "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.";
  if (lower.includes("jwt") && lower.includes("expired")) return "Oturum süresi dolmuş. Lütfen yeniden giriş yapın.";
  if (lower.includes("invalid jwt")) return "Oturum doğrulanamadı. Lütfen yeniden giriş yapın.";
  if (lower.includes("unauthorized")) return "Bu işlem için giriş yapmanız gerekiyor.";
  if (lower.includes("forbidden")) return "Bu işlem için yetkiniz yok.";
  if (lower.includes("permission denied")) return "Bu işlem için yetkiniz yok.";
  if (lower.includes("row-level security")) return "Bu işlem için yetkiniz yok.";
  if (lower.includes("network request failed")) return "Ağ bağlantısı kurulamadı. Lütfen tekrar deneyin.";
  if (lower.includes("failed to fetch")) return "Sunucuya ulaşılamadı. Lütfen tekrar deneyin.";
  if (lower.includes("duplicate key value violates unique constraint")) return "Bu kayıt zaten mevcut.";
  if (lower.includes("violates foreign key constraint")) return "Bu kayıt başka kayıtlarla ilişkili olduğu için işlem yapılamadı.";
  if (lower.includes("null value in column")) return "Zorunlu alanlardan biri boş bırakıldı.";
  if (lower.includes("relation") && lower.includes("does not exist")) return "Sistemde beklenen veri yapısı bulunamadı.";
  if (lower.includes("column") && lower.includes("does not exist")) return "Sistemde beklenen alan bulunamadı.";
  if (lower.includes("could not find the") && lower.includes("column")) return "Sistemde beklenen alan bulunamadı.";
  if (lower.includes("no rows found")) return "Kayıt bulunamadı.";
  if (lower.includes("json object requested, multiple") || lower.includes("json object requested, multiple (or no) rows returned")) {
    return "Kayıt bulunamadı veya birden fazla kayıt bulundu.";
  }
  if (lower.includes("invalid input syntax for type uuid")) return "Geçersiz kayıt kimliği gönderildi.";
  if (lower.includes("malformed uuid")) return "Geçersiz kayıt kimliği gönderildi.";
  if (lower.includes("bucket") && lower.includes("not found")) return "Dosya deposu bulunamadı.";
  if (lower.includes("object not found")) return "Dosya bulunamadı.";
  if (lower.includes("company_id")) return "Şirket bilgisi bulunamadı.";
  if (lower.includes("not found")) return "Kayıt bulunamadı.";
  if (lower.includes("failed")) return fallback;

  return normalized;
}
