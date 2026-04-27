# Google Drive Backup Kurulumu

Bu doküman, müşteri detay ekranındaki `Drive Yedeği` butonunun çalışması için gereken Google Drive kurulumunu açıklar.

## Amaç

Uygulama, müşteriye ait ilişkili verileri JSON yedeği olarak üretir ve Google Drive içindeki belirli bir klasöre yükler.

Yedek butonu burada kullanılır:
- `Dashboard > Müşteriler > [Müşteri Detayı] > Drive Yedeği`

Yedek dosyası uzantısı:
- `.noxo-customer-backup.json`

## Gerekenler

Google tarafında 3 şey gerekir:

1. Bir Google Cloud projesi
2. Google Drive API etkinleştirmesi
3. Bir servis hesabı

Sonra servis hesabını, `nortechtr@gmail.com` hesabındaki hedef Drive klasörüne editör olarak eklemek gerekir.

## 1. Google Cloud projesi oluştur

1. `https://console.cloud.google.com/` adresine git.
2. Yeni bir proje oluştur.
3. Proje adını örneğin `noxo-backup` yap.

## 2. Google Drive API aç

1. Google Cloud projesinde `APIs & Services > Library` bölümüne gir.
2. `Google Drive API` ara.
3. `Enable` ile etkinleştir.

## 3. Servis hesabı oluştur

1. `IAM & Admin > Service Accounts` bölümüne gir.
2. `Create Service Account` seç.
3. Örnek ad:
   - `noxo-drive-backup`
4. Oluşturmayı tamamla.

## 4. Servis hesabı anahtarı üret

1. Oluşturduğun servis hesabına gir.
2. `Keys` sekmesine geç.
3. `Add Key > Create new key > JSON` seç.
4. JSON dosyasını indir.

Bu JSON içinden şu iki alan gerekir:
- `client_email`
- `private_key`

## 5. Google Drive klasörü hazırla

1. `nortechtr@gmail.com` ile Google Drive’a giriş yap.
2. Yedekler için bir klasör oluştur.
   - Örnek: `Noxo Customer Backups`
3. Klasörü aç.
4. URL’den klasör id’sini kopyala.

Örnek klasör URL’si:

```text
https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
```

Bu örnekte klasör id:

```text
1AbCdEfGhIjKlMnOpQrStUvWxYz
```

## 6. Servis hesabını klasöre yetkilendir

1. Drive klasöründe `Paylaş` seç.
2. Servis hesabının `client_email` değerini ekle.
   - Örnek: `noxo-drive-backup@project-id.iam.gserviceaccount.com`
3. Yetkiyi `Editor` ver.

Bu adım zorunlu. Paylaşım yapılmazsa uygulama dosya yükleyemez.

## 7. .env.local ayarları

`.env.local` içine aşağıdaki değerleri ekle:

```env
GOOGLE_DRIVE_CLIENT_EMAIL=noxo-drive-backup@your-project.iam.gserviceaccount.com
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nABCDEF...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
```

## Önemli notlar

- `GOOGLE_DRIVE_PRIVATE_KEY` tek satır olmalı.
- Satır sonları gerçek yeni satır değil, `\n` şeklinde yazılmalı.
- Değer başındaki ve sonundaki çift tırnak korunmalı.

## JSON dosyasından örnek eşleme

İndirdiğin servis hesabı JSON dosyasında buna benzer alanlar olur:

```json
{
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "....",
  "private_key": "-----BEGIN PRIVATE KEY-----\nABC...\n-----END PRIVATE KEY-----\n",
  "client_email": "noxo-drive-backup@your-project.iam.gserviceaccount.com",
  "client_id": "...."
}
```

Buradan şu eşlemeyi yap:

- `client_email` -> `GOOGLE_DRIVE_CLIENT_EMAIL`
- `private_key` -> `GOOGLE_DRIVE_PRIVATE_KEY`

## 8. Uygulamayı yeniden başlat

`.env.local` güncellendikten sonra dev sunucuyu yeniden başlat.

## 9. Test

1. `master` kullanıcı ile giriş yap.
2. `Dashboard > Müşteriler > bir müşteri detayı` aç.
3. `Drive Yedeği` butonuna tıkla.
4. Başarılıysa ekranda başarı mesajı görünür.
5. Google Drive klasöründe yeni `.noxo-customer-backup.json` dosyası oluşur.

## Yedek içeriği

Şu veriler dahil edilir:

- müşteri
- makineler
- makine bakım kayıtları
- ticketlar
- ticket yorumları
- ticket durum geçmişi
- servis formları
- servis form değerleri
- teklifler
- teklif kalemleri

## Sorun giderme

### `Google Drive erişim anahtarı alınamadı`

Sebep:
- servis hesabı anahtarı yanlış
- private key bozuk
- Drive API açık değil

Kontrol:
- `GOOGLE_DRIVE_CLIENT_EMAIL`
- `GOOGLE_DRIVE_PRIVATE_KEY`
- Google Drive API enabled mı

### `Google Drive yedeği yüklenemedi`

Sebep:
- klasör id yanlış
- servis hesabının klasöre erişimi yok

Kontrol:
- `GOOGLE_DRIVE_FOLDER_ID`
- klasör paylaşımı editor yetkisi

### `Bu yedekleme işlemi yalnızca master kullanıcı için açıktır`

Sebep:
- oturumdaki kullanıcı master değil

Kontrol:
- `master` kullanıcı ile giriş yap

## Kod referansı

- API: [src/app/api/customers/[id]/backup/route.ts](/abs/path/C:/Users/Alperen/noxo/src/app/api/customers/[id]/backup/route.ts:1)
- Drive helper: [src/lib/google-drive.ts](/abs/path/C:/Users/Alperen/noxo/src/lib/google-drive.ts:1)
- Buton: [src/components/customers/customer-backup-button.tsx](/abs/path/C:/Users/Alperen/noxo/src/components/customers/customer-backup-button.tsx:1)
