# Hokimiyat mobil ekotizimi — Dizayn spetsifikatsiyasi

**Sana:** 2026-07-23
**Muallif:** Bekpolat Normurodov (+ Claude)
**Status:** Tasdiqlangan (implementatsiyaga tayyor)

---

## 1. Umumiy ma'lumot

Mavjud `goverment-system` monorepo'sida uchta app bor: `web-admin` (React/TS, domen manbai), `worker-app` va `user-app` (ikkalasi Flutter). Ushbu spec ikkala **Flutter** app'ni "ideal" darajaga olib chiqadi:

- **worker-app (Xodim)** — asosiy deliverable. Bosh feature: **yuzni real skanerlab, geofence ichida turib davomatni tasdiqlash**. Qo'shimcha: murojaatlarni bajarish (rasm/video/izoh), ichki chat, xarita+breadcrumb, analitika, oylik hisobot, profil/sozlamalar.
- **user-app (Fuqaro)** — paritet + polish: bir xil splash/dizayn/lokalizatsiya/theme, haqiqiy xarita va media biriktirish.

**Personalar:** worker-app = dala/idora xodimi (web-admin `Worker` modeli). user-app = fuqaro (web-admin `AppUser` modeli).

### Tasdiqlangan qarorlar
1. Mavjud `worker-app`'ni **qayta shakllantirish** (suyagini saqlab): dizayn tizimi, clean-arch, auth shabloni, geofence, image_picker qoladi; Vazifalar/Hududlar/Bonus → Davomat/Murojaat/Chat/Xarita/Analitika bilan almashtiriladi.
2. Yuz — **to'liq real**: ML Kit face detection + aktiv liveness + on-device **MobileFaceNet (TFLite)** embedding, kosinus o'xshashlik **≥ 0.7**. Mock rejimida ham chin.
3. Xarita — **flutter_map (OpenStreetMap)**, API key kerak emas, yengil.
4. Backend — **mock-first + API kontrakti**: `_use_mock=true` (prod+test), har bir data source aniq API seam bilan; real backend keyingi faza.

### Non-goals (YAGNI)
- web-admin'ni o'zgartirish (faqat domen/dizayn manbai sifatida o'qiladi).
- Fuqaro (user-app) uchun yuz check-in — yuz faqat xodim davomati uchun.
- Real backend serverini ushbu faza'da qurish (faqat kontrakt + Dio seam; implementatsiya Faza 4).
- Background (fon) lokatsiya kuzatuvi 1-fazada emas — belgilangan kelajak ishi.
- Video konferensiya (Zoom uslubi) mobil'da — web-admin'da bor, mobil'da hozircha yo'q (kelajak).

---

## 2. Arxitektura

### 2.1 Shared package strategiyasi
Dizayn tizimi va core primitivlarni takrorlamaslik uchun ikkita local package ajratiladi (path dependency):

```
goverment-system/
├── packages/
│   ├── app_ui/        # ranglar, shrift, theme (light+dark), splash, umumiy widgetlar
│   │   └── lib/src/{theme, widgets, splash}
│   └── app_core/      # config (_use_mock/flavor), l10n (uz/ru), network, error, usecase, utils
│       └── lib/src/{config, l10n, network, error, usecase, format}
├── worker-app/        # pubspec: app_ui + app_core (path: ../packages/*)
├── user-app/          # pubspec: app_ui + app_core (path: ../packages/*)
└── web-admin/
```

- Monorepo boshqaruvi uchun `melos` (ixtiyoriy, lekin tavsiya). Minimal holatda oddiy path dependency yetarli.
- `app_ui` va `app_core` mustaqil test qilinadi (o'z `test/` bilan).

### 2.2 Clean architecture (har app ichida)
Mavjud konvensiya saqlanadi (user-app/worker-app'da allaqachon bor):

```
lib/
├── main_dev.dart / main_prod.dart      # flavor entrypoint'lar (_use_mock ni o'rnatadi)
├── main.dart                            # umumiy bootstrap
├── injection.dart                       # get_it (manual DI)
├── app/{app.dart, router/, shell/}
└── features/<feature>/
    ├── data/{datasources/, models/, repositories/}
    ├── domain/{entities/, repositories/, usecases/}
    └── presentation/{bloc/ (cubit), pages/, widgets/}
```

- **State:** `flutter_bloc` — Cubit + Equatable state + `enum <X>Status` + `copyWith`.
- **Xatoliklar:** `dartz` `Either<Failure, T>`; `core/error` (exceptions→failures).
- **DI:** `get_it` — `registerSingleton`(prefs/secure), `registerLazySingleton`(DioClient/datasource/repo/usecase), `registerFactory`(cubit).
- **Routing:** `go_router` + `StatefulShellRoute.indexedStack` + custom fade transitions.
- **Modellar:** entity `extends Equatable`; model `extends Entity` + qo'lda `fromJson`/`toJson` (codegen yo'q — mavjud uslubga mos).

### 2.3 Flavor / `_use_mock`
```dart
// app_core/lib/src/config/app_config.dart
enum AppFlavor { dev, test, prod }
class AppConfig {
  static late AppFlavor flavor;
  static late bool useMock;      // dev/test => true, prod => (backend tayyor bo'lguncha true)
  static late String apiBaseUrl;
}
```
- `main_dev.dart` → `useMock=true`; `main_prod.dart` → `useMock` kompilyatsiya vaqtida `--dart-define=USE_MOCK=true/false`.
- Har `RemoteDataSource`: `abstract class X` + `XMockImpl` + `XApiImpl`. `injection.dart` `AppConfig.useMock` ga qarab birini ro'yxatga oladi.
- **Muhim:** mock faqat *data* qatlamiga tegishli. Kamera, GPS, yuz detektsiyasi/embedding — har doim real.

### 2.4 Qo'shiladigan paketlar (worker-app)
| Maqsad | Paket |
|---|---|
| Kamera | `camera` |
| Yuz aniqlash | `google_mlkit_face_detection` |
| Embedding (TFLite) | `tflite_flutter` + `assets/models/mobilefacenet.tflite` |
| Xavfsiz saqlash | `flutter_secure_storage` |
| Xarita | `flutter_map` + `latlong2` |
| Grafik | `fl_chart` |
| Video/rasm | `image_picker` (bor), `video_player`, `path_provider` |
| Ovozli xabar | `record` (yoki `flutter_sound`) + `audioplayers` |
| Lokalizatsiya | `flutter_localizations` (sdk) + `intl` (bor), `gen-l10n` |
| Ruxsatlar | `permission_handler` |
| Lint (dev) | `very_good_analysis` |

user-app: `flutter_map`, `latlong2`, `image_picker`, `video_player`, `path_provider`, `geolocator`, l10n, `very_good_analysis`.

---

## 3. Dizayn tizimi (app_ui)

web-admin bilan **1:1 brend**. `src/index.css` tokenlaridan ko'chiriladi.

### 3.1 Ranglar
```dart
// Brand
primary      = #10B981   primaryDark = #059669   primaryDeep = #047857   primaryLight = #D1FAE5
accent       = #3B82F6   accentDark  = #2563EB
// Semantic
success #10B981  warning #F59E0B  danger #EF4444  info #3B82F6
// Light surfaces
canvas #F6F8FB  surface #FFFFFF  surfaceAlt #F9FAFB  line #EAEEF3
ink #0F172A  inkSoft #475569  inkMuted #94A3B8
// Dark surfaces (web-admin .dark)
canvas #0B1220  surface #141C2B  surfaceAlt #1B2536  line #29344A
ink #E6ECF5  inkSoft #9AA8BD  inkMuted #677488
// Gradients
brandGradient = 150° [#064E3B, #047857, #059669, #0D9488]   // splash/login
cardGradient  = [#10B981, #0EA5E9]
glowShadow    = 0 8px 30px rgba(16,185,129,.25)
```

### 3.2 Shrift, radii, shakl
- Shrift: **Inter** (assets bilan yuklanadi; 400/500/600/700/800). `app_text_styles`: h1(28/800), h2(22/700), h3(17/600), body(15/400), bodyStrong(15/600), caption(13), label(13/600), button(15/600).
- Radii: xs 8, sm 12, md 16, lg 20, xl 28. Chip=full, input/button=xl(16), card=2xl(20), sheet/dialog=28.
- Ikona: `iconsax_plus` — `core/constants/app_icons.dart` semantik aliaslar (Linear default, Bold active).

### 3.3 Theme (light + dark)
- `AppTheme.light` (bor) + **`AppTheme.dark`** (yangi). `ColorScheme.light/dark`, AppBar flat, Card 20-radius + border, Input 16-radius.
- `ThemeMode`: light / dark / system. `ThemeCubit` + `shared_preferences` (`app-theme`).

### 3.4 Splash (ikkala app'da bir xil)
- Yashil `brandGradient` fon, oq ShieldTick logo qutisi, pulse ring animatsiyasi, "Hokimiyat" letter-stagger, "Raqamli boshqaruv platformasi" tagline, "© 2026 O'zbekiston Respublikasi".
- `flutter_animate` bilan. ~2.5s, keyin auth holatiga qarab yo'naltiradi.

### 3.5 Lokalizatsiya (app_core)
- `flutter gen-l10n` (ARB): `app_uz.arb` (default), `app_ru.arb`.
- `LocaleCubit` + `shared_preferences` (`app-lang`). `context.l10n.xxx` extension.
- Barcha yangi UI matnlari ARB orqali. `*_META` label'lar uz/ru bilan (rang o'zgarmaydi).

### 3.6 Umumiy widgetlar (app_ui)
Mavjudlarini ko'chiramiz + kengaytiramiz: `AppButton`, `AppTextField`, `AppCard`, `AppChip`/`StatusBadge`, `AppDialog`, `showAppSheet`, `AppAlert`, `EmptyState`, `AppAvatar` (initials fallback), `AppScaffold`, `SectionHeader`.

---

## 4. worker-app — batafsil

### 4.1 Kirish oqimi (auth)
```
Splash
  → sessiya yo'q:  Onboarding(1 ekran) → PhoneInput(+998, 9 raqam) → OtpVerify(4 xona)
                    → sessiya bor, yuz yo'q:  FaceEnrollment → Home
                    → sessiya bor, yuz bor:   FaceLiveness(tezkor) → Home
  → sessiya bor:   FaceLiveness(tezkor) → Home
```
- OTP: user-app'dagi 4-box pattern (demo kod `1111`). `AuthCubit.requestOtp/verifyOtp`.
- Session: `flutter_secure_storage` (token) + `shared_preferences` (worker profil). **JWT tuzatish:** token `auth_token` kalitida saqlanadi (interceptor shu kalitni o'qiydi — mavjud bug tuzatiladi).

### 4.2 Yuz moduli — `features/face/` (BOSH FEATURE)

**Domain:**
- `FaceTemplate { List<double> embedding; DateTime enrolledAt; String workerId; }`
- `LivenessChallenge { blink, turnLeft, turnRight, smile }` (tasodifiy 2–3 tanlanadi)
- `FaceMatchResult { double similarity; bool passed; }` (passed = similarity ≥ 0.7)

**Pipeline:**
1. **Enrollment (birinchi marta):**
   - `camera` (front) + `FaceDetector` (accurate mode, landmarks+classification enabled).
   - Oval overlay + real-time gate: yuz ovalda, frontal (|eulerY|<12°, |eulerZ|<12°), ko'z ochiq (>0.4), yuz kattaligi (bbox kenglik > kadr 0.35), yorug'lik yetarli.
   - Gate 1.5s barqaror bo'lsa → kadr olinadi → 112×112 crop → **MobileFaceNet** → embedding vektori (128/192-d, modelga qarab; L2-norm).
   - Embedding `flutter_secure_storage`'da JSON sifatida shifrlangan saqlanadi. Threshold const `kFaceMatchThreshold = 0.7`.
2. **Liveness (kunlik / kirishda):**
   - Aktiv challenge ketma-ketligi (masalan: "Ko'zingizni pirpiratng" → blink; "Boshingizni o'ngga buring" → eulerY; "Jilmaying" → smile>0.6).
   - Har bosqich frame'lar bo'ylab tasdiqlanadi. Timeout / muvaffaqiyatsizlik → qayta urinish.
   - Passiv qo'shimcha: bir nechta frame'da mikro-harakat (anti-photo).
3. **Match + Check-in:**
   - Liveness o'tgach jonli embedding olinadi → saqlangan template bilan **kosinus o'xshashlik**.
   - `similarity ≥ 0.7` **VA** geofence ichida (`geolocator`, ishxona nuqtasidan ≤ `kGeofenceRadius=150m`) → check-in muvaffaqiyatli.
   - **Screenshot** (yuz kadri) `path_provider` orqali `attendance/<date>.jpg` saqlanadi.
   - `AttendanceDay` yoziladi/yangilanadi: `checkIn`, `insideGeofence=true`, `selfConfirmed=true`, `confirmedAt`.

**Mock rejimi:** kamera/detektsiya/liveness/embedding — **real**. Faqat "server'ga yuborish" mock (lokal saqlash + simulyatsiya). `_use_mock=false` bo'lganda `POST /attendance/check-in` ga embedding hash + screenshot yuboriladi.

**Xavfsizlik (static-security skill):** embedding va screenshot faqat qurilmada shifrlangan; raw yuz rasmi serverga default yuborilmaydi (faqat hash/embedding); ruxsatlar (`permission_handler`) tushuntirish bilan so'raladi.

### 4.3 Navigatsiya (bottom nav, 5 tab)
`StatefulShellRoute.indexedStack` — custom `MainShell` (mavjud animatsiyali nav).

| # | Tab | Route | Mazmun |
|---|-----|-------|--------|
| 1 | **Bosh sahifa** | `/home` | Bugungi davomat holati, katta "Yuz bilan tasdiqlash" CTA, kunlik borish analizi (mini-grafik), ish vaqti, tezkor amallar |
| 2 | **Murojaatlar** | `/requests` | Biriktirilgan `CitizenRequest`lar; status filtr; detal → bajarish (geofence + rasm + video + izoh); SLA muddat (deadline) |
| 3 | **Chat** | `/chat` | Suhbatlar ro'yxati → suhbat; matn/rasm/fayl/ovozli; guruh + shaxsiy |
| 4 | **Xarita** | `/map` | flutter_map: geofence zonasi (doira), yurgan yo'l (polyline breadcrumb), hamkasblar markerlari |
| 5 | **Profil** | `/profile` | Profil, hujjatlar, oylik/bonus, oylik hisobot, analitika, sozlamalar (til/theme), chiqish |

### 4.4 Bosh sahifa (Davomat dashboard)
- Salomlashish header (ism, avatar, sana), bugungi holat kartasi (Keldi/Kelmadi/Kechikdi + vaqt).
- **Katta CTA:** "Yuz bilan tasdiqlash" → yuz check-in oqimi (geofence tekshiruvi bilan). Agar hudud tashqarisida — ogohlantirish.
- Kunlik borish analizi: so'nggi 7/14 kun mini bar (Keldi/Kechikdi/Kelmadi).
- Tezkor: faol murojaatlar soni, o'qilmagan chat, ish soati.

### 4.5 Murojaatlar (Applications)
- Ro'yxat: `CitizenRequest` (title, category, status, priority, address, deadline). Filtr chiplari + status.
- Detal: fuqaro ma'lumoti, joylashuv (mini-map), tavsif, muddat progress.
- **Bajarish oqimi:** geofence tekshiruvi (manzilga yaqinmi) → **rasm** (kamera/galereya) + **video** (yozib olish/tanlash) + **izoh** → status `resolved`. Media `path_provider`'da; mock'da lokal, real'da `POST /requests/{id}/complete` (multipart).

### 4.6 Chat
- `Conversation` (group `Umumiy chat` + har hamkasb/deputy uchun direct). `ChatMessage` (text/image/file/voice, status sent/delivered/read).
- Composer: matn, rasm (image_picker), fayl, **ovozli yozuv** (`record` yoki `flutter_sound`). Mock: simulyatsiya (echo/kechiktirilgan javob + typing indikator). Real: `GET/POST /chat/...` + (kelajakda) WebSocket seam.

### 4.7 Xarita + lokatsiya
- `flutter_map` (OSM tiles). Qatlamlar: ishxona geofence doirasi, joriy joylashuv markeri, **breadcrumb polyline** (app ochiq bo'lganda `geolocator` position stream'idan yig'iladi va lokal saqlanadi), hamkasblar markerlari (mock/real).
- Geofence holati chipi (Ichkarida/Tashqarida). Background kuzatuv — **kelajak (Faza 5)**.

### 4.8 Analitika / Oylik hisobot
- Kunlik/oylik davomat grafiklari (`fl_chart`): ish soati, o'z vaqtida kelish %, kechikish, bajarilgan murojaatlar.
- **Hamkasblar bilan solishtirish** ("boshqa sheriklar"): reyting/ballar bo'yicha ro'yxat.
- **Oylik hisobot** ekrani: oy tanlash → jamlanma (jami soat, kelgan kunlar, kechikish, murojaat, bonus). Eksport (PDF/share) — ixtiyoriy 2-faza.

### 4.9 Profil / Sozlamalar
- Profil: ism, lavozim, hudud, workerId, avatar, reyting/ballar.
- Hujjatlar (`WorkerDocument`), oylik/bonus.
- **Sozlamalar:** til (uz/ru), theme (light/dark/system), bildirishnomalar, yuzni qayta ro'yxatdan o'tkazish, chiqish.

### 4.10 Data modellar (web-admin `types.ts` bilan mos)
`Worker`, `AttendanceDay`, `WorkerDocument`, `CitizenRequest` (+ `deadline` SLA logikasi), `Deputy`, `Conversation`/`ChatMessage`, `NotificationItem`, `District`. Maydon nomlari va enum'lar bir xil; `*_META` (label uz/ru + hex rang) `app_core`/feature const sifatida.

---

## 5. user-app — paritet + polish

- `app_ui`/`app_core`'ga o'tkaziladi: bir xil **splash, dark theme, l10n (uz/ru)**.
- Onboarding + telefon/OTP (bor) → polish; splash qo'shiladi.
- **Murojaatlar:** joylashuv tanlash haqiqiy **flutter_map** (mavjud faux CustomPaint o'rniga); **rasm/video** haqiqiy biriktirish (`image_picker`/video); yuborish → holat kuzatuvi.
- To'lovlar/Home ekranlarini "ideal" polish (bor UI'ni saqlab, tokenlar/komponentlarga o'tkazish).
- Fuqaro–hokimiyat chat (ixtiyoriy, worker chat infratuzilmasini qayta ishlatib).
- **Yuz check-in yo'q** (faqat xodim).

---

## 6. Backend kontrakti (mock-first)

`ApiConstants` + Dio seam. Endpoint'lar (real backend Faza 4):

| Metod | Endpoint | Maqsad |
|---|---|---|
| POST | `/auth/send-otp` | Telefon → SMS kod |
| POST | `/auth/verify` | Kod → JWT + Worker profil |
| GET | `/workers/me` | Joriy xodim profili |
| POST | `/attendance/check-in` | embedding-hash + screenshot + geo → tasdiq |
| GET | `/attendance?from&to` | Davomat tarixi |
| GET | `/requests` | Biriktirilgan murojaatlar |
| POST | `/requests/{id}/complete` | rasm/video/izoh (multipart) → resolved |
| GET | `/chat/conversations` | Suhbatlar |
| GET/POST | `/chat/conversations/{id}/messages` | Xabarlar |
| POST | `/location/ping` | Breadcrumb nuqta (ixtiyoriy) |

Har `*ApiImpl` shu endpoint'ga mos; `*MockImpl` `Future.delayed` + seed data qaytaradi. Modellar `fromJson` shu kontraktga tayyor.

---

## 7. Testlar / sifat

- **Lint:** `very_good_analysis` (ikkala app + packages).
- **Unit:** face match (kosinus, threshold 0.7), geofence masofa, deadline SLA, model `fromJson/toJson`, cubit'lar (`bloc_test`).
- **Widget:** login, OTP, home/davomat, murojaat detal, chat.
- **Golden:** splash, home, yuz ekrani (light+dark).
- `mocktail` bilan repo/datasource mock.

---

## 8. Yetkazish tartibi (fazalar)

- **Faza 0 — Shared poydevor:** `packages/app_ui` (tokenlar, dark theme, Inter, widgetlar, splash) + `packages/app_core` (AppConfig/`_use_mock`, l10n uz/ru, ThemeCubit, LocaleCubit, network/error/usecase). worker-app va user-app path-dependency bilan ulanadi.
- **Faza 1 — worker-app YADRO (bosh feature):** Splash → telefon→OTP → **yuz enrollment + liveness + geofence check-in + davomat dashboard**. Screenshot saqlash. `_use_mock` seam.
- **Faza 2 — worker-app kengligi:** Murojaat (geofence + rasm/video/izoh), Chat (ovozli bilan), Xarita/breadcrumb, Analitika, Oylik hisobot, Profil/Sozlamalar.
- **Faza 3 — user-app paritet:** splash/l10n/dark theme o'tkazish, haqiqiy xarita + media, polish.
- **Faza 4 — Backend:** real API (kontrakt bo'yicha), `_use_mock=false`.
- **Faza 5 (kelajak):** background lokatsiya, mobil video konferensiya, hisobot eksporti.

### Qabul mezonlari (Faza 1)
- Real qurilmada: telefon→OTP→yuz enrollment ishlaydi, embedding qurilmada shifrlangan saqlanadi.
- Kunlik check-in: liveness challenge o'tadi, kosinus ≥0.7 va geofence ichida bo'lsa tasdiqlanadi, screenshot saqlanadi, `AttendanceDay` yoziladi.
- Hudud tashqarisida yoki liveness/match muvaffaqiyatsiz → tegishli xato, tasdiq bo'lmaydi.
- `_use_mock=true` bilan hammasi lokal ishlaydi; scanner real.

---

## 9. Ochiq/kelajak masalalari
- Background (fon) lokatsiya kuzatuvi — ruxsat/batareya murakkabligi (Faza 5).
- MobileFaceNet model asseti manbasi/litsenziyasi tekshiriladi (license-compliance).
- Real SMS provayderi (Eskiz/Play Mobile) — Faza 4.
- WebSocket/real-time chat — Faza 4 seam.

---

## 10. Kengaytirilgan qamrov (2026-07-24 — user talabi)

**Umumiy:** ikkala app IDEAL + smooth animatsiyalar + optimal ishlash. Har feature'ni `flutter analyze` + `flutter test` + kerakli joyda `flutter build` (assemble tekshiruvi) bilan sinaymiz. Jonli qurilma testi user tomonidan (menda emulyator yo'q).

### 10.1 Face moduli — shared (ikkala app)
- Face pipeline (kamera + ML Kit + liveness + MobileFaceNet + oval overlay) **shared package `face_kit`** ga chiqariladi → worker (davomat) va user (identifikatsiya) ishlatadi.
- **Ideal oval forma** eng muhim: silliq oval maska, real-time sifat ranglari, liveness ko'rsatkichlari, animatsion progress.

### 10.2 user-app (Fuqaro) — kengaytirilgan
- Oqim: `Splash → Phone → SMS verify → Face scanner → PIN lock screen → Home`.
- **PIN lock**: 4-6 xonali PIN (yaratish + kirishda), `flutter_secure_storage`; ixtiyoriy biometrika (`local_auth`).
- **Kommunalka to'lovlari**: suv/gaz/elektr/issiqlik/tozalik/internet — ro'yxat, summa, to'lash oqimi (mock), tarix.
- Profil, to'lovlar tarixi, **hisobot** (oylik sarf grafigi).
- **Ariza berish** (murojaat) + **shikoyat/jaloba berish** — kategoriya, tavsif, joylashuv (flutter_map), rasm/video biriktirish, holat kuzatuvi.

### 10.3 worker-app (Xodim) — kengaytirilgan
- **Majlis (Zoom-dek)**: yig'ilishlar ro'yxati, ulanish (kamera/mikrofon lobby), qatnashish, ishtirokchilar gridi, ekran/holat. (mock/simulyatsiya; real WebRTC keyin.)
- **Arizalar**: biriktirilgan + tegishli (hudud/kategoriya) ko'rinishi; detal; **har arizaga ball berish**; bajarishda **hujjat/file/voice/video biriktirish**.
- **Chat**: umumiy / shaxsiy / **guruh**; matn, file, image, **dumaloq video (Telegram-dek circular recorder)**, **voice record (waveform)**, **stikerlar**, o'qildi/yetkazildi.
- **Ish soatlari** + **haftalik davomat** ko'rinishi.
- **Javob so'rash** (rahbariyatdan), **taklif kiritish**.
- **Ball nazorati**: xodim ballari — yaxshi natija → oshadi, yomon/kechikish → tushadi; reyting, hamkasblar bilan solishtirish.
- **Bitta aniq manzil/geofence** belgilash; **tegishli hududda yurish** (breadcrumb + geofence chip).

### 10.4 Texnik qo'shimchalar
- `face_kit` shared package (camera/mlkit/tflite/liveness/oval UI).
- PIN: custom PIN UI + secure storage; biometrika `local_auth` (ixtiyoriy).
- Round video: `camera` + circular clip + qisqa yozuv.
- Voice: `record` + waveform; stikerlar: asset/emoji grid.
- Majlis: mock ishtirokchi grid + kamera preview (real WebRTC — kelajak).
- Smooth animatsiya: `flutter_animate` + Hero + implicit animations, 60fps optimal.

### 10.5 Fazalar (yangilangan)
- **Faza 1** (davom etmoqda): worker face-enrollment + liveness + geofence check-in + davomat dashboard (yadro).
- **Faza 1.5**: `face_kit` ni shared package'ga chiqarish.
- **Faza 2 (kengaytirilgan)** worker breadth: arizalar (attach + ball), chat (round video/voice/stickers/guruh), majlis, ish soatlari + haftalik davomat, javob so'rash, taklif, ball nazorati, xarita/breadcrumb, analitika/hisobot, profil/sozlama.
- **Faza 3 (kengaytirilgan)** user-app: face + PIN + kommunalka + to'lovlar + hisobot + ariza + shikoyat.
- **Faza 4 (backend): TASHLANADI** — mock-first (user talabi bo'yicha).

### 10.6 PREMIUM PRO UI standarti (2026-07-24 — user talabi, BUTUN loyiha uchun majburiy)
Har bir UI task shu sifat darajasiga javob berishi shart:
- **Premium komponent kutubxonasi** (`app_ui` kengaytiriladi, ikkala app qayta ishlatadi):
  - `AppSelect`/dropdown, `AppListTile`, `AppMultiSelect`, `AppSearchField`, `AppFilterSheet`, `AppSegmented`, `AppBottomSheet` (premium), `AppModal`/alert modallar, `AppSkeleton` (shimmer loading), `AppBadge`, `AppTabBar`, `AppBottomNav` (animatsion).
  - **Input masklar** (formatters): telefon (+998 90 123 45 67), karta (0000 0000 0000 0000), sana (KK/OO/YYYY), summa (1 000 000), PIN.
- **Smooth animatsiya**: `flutter_animate` (fade/slide/scale entrance), Hero geçiş, implicit animations, staggered list, 60fps. Har interaktivda haptik.
- **Responsivelik**: `LayoutBuilder`/`MediaQuery`, `SafeArea`, kichik/katta ekran, matn masshtabi; overflow yo'q.
- **Holatlar**: loading (skeleton), empty (`EmptyState`), error (retry) — har ekranda.
- **Premium his**: yumshoq soyalar, glow, gradient aksentlar, 12–28 radii, tinted icon chiplar, depth/elevation, dark mode to'liq.
- **Ideal logika/qoidalar**: har feature aniq business rule'lar bilan (masalan: geofence ichida bo'lmasa tasdiq yo'q; ball hisoblash formulasi; davomat status qoidalari; SLA muddat). Validatsiya + edge-case'lar.

**Reja ta'siri:** `app_ui` premium komponentlar Faza 2 boshida (yoki Faza 1.6) quriladi va barcha feature ekranlari faqat shu komponentlardan foydalanadi (izchillik + premium his).
