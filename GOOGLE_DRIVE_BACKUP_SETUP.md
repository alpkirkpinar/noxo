# Google Drive Backup Kurulumu (Kişisel Hesaplar İçin)

Bu doküman, kişisel `@gmail.com` hesaplarında kota sorununa takılmadan Google Drive yedeği alabilmek için gereken OAuth2 kurulumunu açıklar.

## Gerekenler

Google tarafında 3 ana bileşen gerekir:
1. Google Cloud Projesi ve Google Drive API etkinleştirmesi.
2. OAuth 2.0 Client ID (Web Application).
3. Refresh Token (Kullanıcı adına sürekli erişim için).

## 1. Google Drive API ve Proje
1. `https://console.cloud.google.com/` adresine git ve proje oluştur.
2. `APIs & Services > Library` kısmından **Google Drive API**'yi bul ve **Enable** et.

## 2. OAuth Consent Screen (Zorunlu)
1. `APIs & Services > OAuth consent screen` kısmına gir.
2. **User Type:** External seç.
3. App name, User support email ve Developer contact info alanlarını doldur.
4. "Scopes" aşamasında **Add or Remove Scopes** diyerek `.../auth/drive.file` kapsamını ekle.
5. "Test users" kısmına kendi `@gmail.com` adresini ekle (Zorunlu!).

## 3. OAuth Client ID Oluşturma
1. `APIs & Services > Credentials` kısmına gir.
2. **Create Credentials > OAuth client ID** seç.
3. **Application type:** Web application seç.
4. **Name:** Noxo Backup.
5. **Authorized redirect URIs:** `https://developers.google.com/oauthplayground` ekle.
6. Oluşturduktan sonra size verilen **Client ID** ve **Client Secret** değerlerini kopyalayın.

## 4. Refresh Token Alma (OAuth Playground)
1. `https://developers.google.com/oauthplayground` adresine git.
2. Sağ üstteki **ayarlar (çark)** simgesine tıkla.
3. **Use your own OAuth credentials** kutusunu işaretle.
4. Kendi **Client ID** ve **Client Secret** bilgilerini buraya gir.
5. Sol listeden `Drive API v3` altındaki `https://www.googleapis.com/auth/drive.file` scope'unu seç.
6. **Authorize APIs** butonuna tıkla ve Google hesabınla giriş yap.
7. Gelen uyarıda "Advanced" diyerek uygulamana izin ver.
8. **Step 2 (Exchange authorization code for tokens)** kısmında **Exchange authorization code for tokens** butonuna tıkla.
9. Altta çıkan **Refresh Token** değerini kopyala.

## 5. .env.local Ayarları

Eski değişkenleri silin ve bunları ekleyin:

```env
GOOGLE_DRIVE_CLIENT_ID=senin-client-id.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=senin-client-secret
GOOGLE_DRIVE_REFRESH_TOKEN=senin-refresh-token
GOOGLE_DRIVE_FOLDER_ID=yedek_klasor_id
```

## Önemli Notlar
- Bu yöntemle dosyalar doğrudan sizin kotanızı kullanır, Servis Hesabı hatası almazsınız.
- Uygulama "Testing" modunda olduğu için Refresh Token 7 gün sonra geçersiz kalabilir. Bunu önlemek için Cloud Console'da OAuth Consent Screen sayfasında uygulamayı **"Publish App"** diyerek yayına alabilirsiniz (Onay gerekmez).

## Kod Referansı
- API: `src/app/api/customers/[id]/backup/route.ts`
- Drive Helper: `src/lib/google-drive.ts`
