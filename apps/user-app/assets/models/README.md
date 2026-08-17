# `assets/models/` — yuzni tanish modeli

## Holat: PLACEHOLDER (real model EMAS)

`mobilefacenet.tflite` hozircha bir necha baytli matnli fayl — u haqiqiy
TensorFlow Lite modeli **EMAS**. U faqat quyidagilarni **yashil** saqlash uchun
mavjud:

- `flutter pub get` / `flutter analyze` (asset deklaratsiyasi `pubspec.yaml`da
  mavjud bo'lishi kerak, muqobil fayl bo'lmasa xato beradi)
- `flutter test` (unit/widget testlar)
- `flutter build ...` (asset bundle qurilishi)

Qurilmada **haqiqiy on-device yuzni tanish inference'i ishlashi uchun**, shu
aniq yo'lga (`assets/models/mobilefacenet.tflite`) haqiqiy MobileFaceNet TFLite
modeli qo'yilishi **SHART**.

Fuqaro ilovasida bu model faqat identity ENROLLMENT (bir martalik yuz
ro'yxatdan o'tkazish, `/face/onboarding`) uchun ishlatiladi — kunlik
tekshiruv (verify/check-in) yo'q, keyingi tashriflar PIN bilan qulflanadi
(qarang: `lib/features/pin/`).

## Talablar (real model uchun)

| Xususiyat | Qiymat |
|---|---|
| Format | TensorFlow Lite (`.tflite`) |
| Kirish (input) | `112×112` RGB rasm — `kFaceInputSize` (`lib/core/constants/face_constants.dart`) |
| Chiqish (output) | 128 yoki 192 o'lchamli embedding vektor — `kFaceEmbeddingSize` (default `192`, real modelga qarab moslanadi) |
| Litsenziya | OFL (Open Font License) yoki Apache-2.0 — davlat/tijorat loyihasida erkin foydalanishga ruxsat beruvchi litsenziyalardan biri bo'lishi shart |

Tanlangan modelning haqiqiy chiqish o'lchamiga qarab
`lib/core/constants/face_constants.dart` dagi `kFaceEmbeddingSize`ni
(128 yoki 192) yangilang.

## Nega placeholder bilan ham build/test yashil qoladi

`FaceEmbedder.load()` modelni yuklash xatosini **ushlaydi** va [isFallback]ni
`true`ga o'rnatadi — [embed] esa haqiqiy piksellardan hisoblangan,
deterministik "idrok" (perceptual) embeddingga o'tadi. Shu tufayli enrollment
oqimi HECH QACHON "model xatosi"ga tiqilib qolmaydi; haqiqiy `.tflite`
qo'yilgach, keyingi `load()` avtomatik ravishda haqiqiy modelga o'tadi.

Build, `flutter analyze`, unit/widget testlar placeholder fayl bilan ham
**yashil** qoladi — chunki **birorta ham test interpreter'ni yuklamaydi**:
sof `FaceEmbedder.l2normalize(...)` va fallback-embedding testlari model
kerak emas. Faqat qurilmada kameradan real kadr olib inference chaqirilganda,
model formati yaroqsizligi sababli fallback rejimiga o'tadi — bu real model
qo'yilmaguncha kutilgan holat (worker-app bilan bir xil naqsh, qarang:
`worker-app/assets/models/README.md`).

## Real modelni joylashtirish tartibi

1. Litsenziyasi mos (OFL yoki Apache-2.0) MobileFaceNet `.tflite` faylini
   toping va litsenziya shartlarini tasdiqlang.
2. Uni aynan shu nom va yo'l bilan ushbu placeholder o'rniga qo'ying:
   `assets/models/mobilefacenet.tflite`.
3. Modelning haqiqiy kirish/chiqish o'lchamlarini tekshiring; kerak bo'lsa
   `kFaceInputSize` / `kFaceEmbeddingSize` konstantalarini moslang.
4. `flutter clean && flutter pub get`, so'ng qurilmada (simulyator emas —
   kamera kerak) qayta test qiling.
