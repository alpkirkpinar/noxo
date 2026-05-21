import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gizlilik Politikası | noxo",
  description: "noxo uygulaması gizlilik politikası",
};

const sections = [
  {
    title: "Toplanan veriler",
    body: [
      "noxo, servis operasyonlarını yürütmek için kullanıcı hesabına, müşteri kayıtlarına, servis formlarına, tekliflere, makine ve envanter bilgilerine ait verileri işleyebilir.",
      "Uygulama; ad soyad, e-posta adresi, telefon numarası, şirket bilgileri, adres bilgileri, servis notları, teklif detayları, imza veya belge içerikleri gibi kullanıcılar tarafından girilen operasyonel verileri saklayabilir.",
      "Uygulama bildirim gönderebilmek için cihaz bildirim iznini isteyebilir. noxo konum izni kullanmaz.",
    ],
  },
  {
    title: "Verilerin kullanım amacı",
    body: [
      "Veriler; kullanıcı girişini sağlamak, servis taleplerini takip etmek, teklif ve servis formları oluşturmak, müşteri ve makine kayıtlarını yönetmek, raporlama yapmak ve uygulama güvenliğini sağlamak için kullanılır.",
      "Bildirimler; servis, teklif, planlama veya operasyon süreçleriyle ilgili kullanıcıya bilgi vermek amacıyla kullanılır.",
    ],
  },
  {
    title: "Veri paylaşımı",
    body: [
      "noxo, kullanıcı verilerini satış veya reklam amacıyla üçüncü taraflarla paylaşmaz.",
      "Uygulama altyapısı, kimlik doğrulama, veritabanı, dosya saklama, e-posta veya benzeri teknik hizmetler için gerekli hizmet sağlayıcılarla çalışabilir. Bu paylaşım yalnızca uygulamanın çalışması için gerekli teknik kapsamla sınırlıdır.",
      "Yasal bir zorunluluk bulunması halinde yetkili kurumlarla bilgi paylaşılabilir.",
    ],
  },
  {
    title: "Veri saklama ve silme",
    body: [
      "Operasyonel kayıtlar, hizmetin sunulması, yasal yükümlülükler ve iş sürekliliği için gerekli olduğu sürece saklanır.",
      "Kullanıcılar hesapları veya kendileriyle ilgili veriler için erişim, düzeltme veya silme talebinde bulunabilir. Silme talepleri, yasal saklama yükümlülükleri ve aktif hizmet kayıtları dikkate alınarak değerlendirilir.",
    ],
  },
  {
    title: "Güvenlik",
    body: [
      "noxo, yetkisiz erişim, kayıp, kötüye kullanım ve izinsiz değişikliğe karşı makul teknik ve idari güvenlik önlemleri uygular.",
      "Kullanıcılar hesap şifrelerini gizli tutmaktan ve hesaplarında gerçekleşen işlemlerden sorumludur.",
    ],
  },
  {
    title: "Çocukların gizliliği",
    body: [
      "noxo iş ve servis operasyonları için geliştirilmiş bir uygulamadır. Uygulama çocuklara yönelik değildir ve bilerek çocuklardan kişisel veri toplamaz.",
    ],
  },
  {
    title: "İletişim",
    body: [
      "Gizlilik politikası veya kişisel veri talepleri için noxo yöneticisiyle iletişime geçebilirsiniz.",
      "İletişim e-posta adresi: info@noxo.com.tr",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 border-b border-slate-200 pb-6">
          <Link
            href="/login"
            className="mb-6 inline-flex text-sm font-medium text-slate-600 transition hover:text-slate-950"
          >
            noxo
          </Link>
          <p className="mb-3 text-sm font-semibold uppercase tracking-normal text-slate-500">
            Gizlilik Politikası
          </p>
          <h1 className="text-3xl font-bold tracking-normal text-slate-950 sm:text-4xl">
            noxo Gizlilik Politikası
          </h1>
          <p className="mt-4 text-sm text-slate-600">Son güncelleme: 22 Mayıs 2026</p>
        </header>

        <section className="mb-8 space-y-4 text-base leading-7 text-slate-700">
          <p>
            Bu gizlilik politikası, noxo web ve Android uygulamasının
            (paket adı: com.nortech.noxo) kullanımı sırasında işlenen veriler
            hakkında bilgi verir. noxo, servis, teklif, müşteri, makine,
            envanter ve saha operasyon yönetimi için kullanılan bir iş
            uygulamasıdır.
          </p>
          <p>
            Uygulamayı kullanarak bu politikada açıklanan veri işleme
            uygulamalarını kabul etmiş olursunuz. Bu sayfa,
            https://noxo.com.tr/privacy-policy adresinde herkese açık olarak
            yayınlanır.
          </p>
        </section>

        <div className="space-y-7">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 text-xl font-semibold tracking-normal text-slate-950">
                {section.title}
              </h2>
              <div className="space-y-3 text-base leading-7 text-slate-700">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-500">
          Bu politika gerekli durumlarda güncellenebilir. Güncel sürüm her
          zaman bu sayfada yayınlanır.
        </footer>
      </div>
    </main>
  );
}
