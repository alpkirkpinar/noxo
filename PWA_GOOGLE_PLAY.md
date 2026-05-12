# noxo PWA / Google Play Notlari

Bu klasor, orijinal `C:\Users\Alperen\noxo` reposunun `pwa-google-play` branch'ine bagli git worktree alanidir.

## Mevcut Durum

- Next.js App Router manifest eklendi: `src/app/manifest.ts`
- Service worker eklendi: `public/sw.js`
- Service worker kayit bileseni eklendi: `src/components/pwa-service-worker.tsx`
- Cevrimdisi fallback ekrani eklendi: `src/app/offline/page.tsx`
- 192x192 ve 512x512 PWA ikonlari eklendi: `public/noxo-icon-192.png`, `public/noxo-icon-512.png`

## Orijinal Web Degisikliklerini Alma

Orijinal web surumu `main` branch'inde kalir. Bu PWA branch'ine son web degisikliklerini almak icin:

```powershell
cd C:\Users\Alperen\noxo-pwa
git merge main
```

Cakisma olursa PWA dosyalarini koruyup web degisikliklerini uyarlamak gerekir.

## Offline Davranis

- Statik dosyalar cache-first calisir.
- Sayfa gecisleri network-first calisir; baglanti yoksa daha once cachelenen sayfa veya `/offline` doner.
- `GET /api/*` istekleri network-first cachelenir; baglanti yoksa daha once okunmus cevap doner.
- `POST`, `PATCH`, `DELETE` islemleri offline kuyruklanmaz. Yeni kayit/guncelleme/silme icin internet gerekir.

## Google Play Yolu

Google Play'e web sitesini acan app olarak yayinlamak icin en temiz yol Trusted Web Activity'dir.

1. Bu PWA branch'ini HTTPS calisan bir domaine deploy et.
2. Chrome Lighthouse ile PWA installability kontrolu yap.
3. Bubblewrap veya Android Studio TWA template ile Android paketini uret.
4. Web domainine `/.well-known/assetlinks.json` ekle.
5. Google Play Console'da Android App Bundle (`.aab`) olarak yayinla.
