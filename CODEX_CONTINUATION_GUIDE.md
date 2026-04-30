# Codex Continuation Guide

Bu dosya, `noxo` ve sibling repo `C:\Users\Alperen\noxo-mobile` üzerinde kaldigim yeri hizli toparlamak icin tutulur.

## Genel Durum

- Web repo: `C:\Users\Alperen\noxo`
- Mobile repo: `C:\Users\Alperen\noxo-mobile`
- Kullanici acik talimati: `MOBILE_PROGRESS.md` dosyasini guncelleme.
- Form ve teklif akislari artik orijinal siteye gitmiyor; mobile UI tarafinda ilerleniyor.
- Form editorde hedef davranis: sablon PDF ustunde dogrudan alanlara tiklayarak doldurma.

## Form Editor Son Durum

- Mobile form editor artik `react-native-pdf` kullaniyor.
- Ana dosya:
  - `C:\Users\Alperen\noxo-mobile\src\components\forms\service-form-editor-screen.tsx`
- Akis:
  - PDF native viewer ile render ediliyor.
  - `pdf_template_fields` koordinatlari overlay olarak PDF ustune yerlestiriliyor.
  - `text`, `textarea`, `number`, `date`, `time`, `select`, `checkbox`, `signature`, `serial_number` alanlari destekleniyor.
  - Imza `react-native-signature-canvas` modalinda aliniyor.
- Create route secili template ile acilabiliyor:
  - `C:\Users\Alperen\noxo-mobile\app\forms\create.tsx`
  - `C:\Users\Alperen\noxo-mobile\app\forms\template\[templateId].tsx`

## Mobile Native Build Notlari

- `react-native-pdf` Expo Go'da calismaz.
- Bu nedenle `expo-dev-client` eklendi.
- Ilgili dosyalar:
  - `C:\Users\Alperen\noxo-mobile\app\_layout.tsx`
  - `C:\Users\Alperen\noxo-mobile\eas.json`
- Android native proje prebuild ile olustu:
  - `C:\Users\Alperen\noxo-mobile\android`

## Android Toolchain Durumu

- JDK olarak Android Studio bundled JBR kullaniliyor:
  - `C:\Program Files\Android\Android Studio\jbr`
- `android/gradle.properties` icinde:
  - `org.gradle.java.home=C:/Program Files/Android/Android Studio/jbr`
  - bellek ayarlari build'i gecirecek sekilde artirildi
- Android SDK yolu kullanici profilinde yoktu, bu makinede `Administrator` altinda bulundu:
  - `C:\Users\Administrator\AppData\Local\Android\Sdk`
- Bu nedenle local-only dosya eklendi:
  - `C:\Users\Alperen\noxo-mobile\android\local.properties`
- `local.properties` zaten gitignore'da; commit etmeye gerek yok.

## Son Basarili Native Durum

- Dev client APK uretildi:
  - `C:\Users\Alperen\noxo-mobile\android\app\build\outputs\apk\debug\app-debug.apk`
- APK emulator'a kuruldu.
- `adb reverse tcp:8082 tcp:8082` ayarlandi.
- Metro dev-client modunda `8082` portunda calisiyor.
- Log:
  - `C:\Users\Alperen\noxo-mobile\expo-dev-client.log`

## Tekrar Calismak Icin

Mobile repo icinde:

```powershell
npx expo start --dev-client --port 8082
```

Gerekirse emulator icin:

```powershell
C:\Users\Administrator\AppData\Local\Android\Sdk\platform-tools\adb.exe reverse tcp:8082 tcp:8082
```

Uygulamayi emulator'da acmak icin:

```powershell
C:\Users\Administrator\AppData\Local\Android\Sdk\platform-tools\adb.exe shell monkey -p com.anonymous.noxomobile -c android.intent.category.LAUNCHER 1
```

## Sonraki Mantikli Isler

- Form editor icinde alan UX'ini iyilestir:
  - `date` ve `time` icin native picker
  - `signature` preview'ini bitmap olarak alan icinde goster
  - uzun `textarea` alanlarinda daha iyi metin sigdirma
- PDF export tarafini mobile'daki yeni degerlerle birebir kontrol et.
- Gerekirse `select` alanlari icin customer-machine-ticket bagliligini daha akilli filtrele.

## Dikkat Edilecekler

- `noxo` repo icinde Next.js ile ilgili degisiklik yaparken `AGENTS.md` talimatina uy: ilgili `node_modules/next/dist/docs/` dokumanini once oku.
- Kullanici istemedikce `MOBILE_PROGRESS.md` dosyasina dokunma.
- Sibling repo `C:\Users\Alperen\noxo-mobile` uzerinde degisiklik yaparken mevcut kullanici degisikliklerini geri alma.
