export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef3f8] px-4 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-md">
        <img
          src="/noxo-logo.png"
          alt="noxo"
          className="mb-6 h-14 w-14 rounded-xl"
        />
        <h1 className="text-xl font-semibold">Çevrimdışı mod</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          İnternet bağlantısı yok. Daha önce açtığınız sayfalar ve okunmuş bazı
          veriler kullanılabilir; yeni kayıt, güncelleme ve dosya işlemleri için
          bağlantı gerekir.
        </p>
      </section>
    </main>
  );
}
