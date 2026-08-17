import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';

// Himoyalanmagan/har doim ruxsat etilgan manzillar — pastdagi shartlarda
// qayta-qayta yozmaslik uchun bitta joyda nomlangan.
const _splash = '/splash';
const _login = '/login';
const _otp = '/otp';
const _register = '/register';
const _faceOnboarding = '/face/onboarding';
const _pinSet = '/pin/set';
const _pinUnlock = '/pin/unlock';
const _home = '/home';

/// Auth/ro'yxatdan-o'tish/yuz/PIN holatiga asoslangan redirect qarori —
/// GoRouter, `BuildContext` yoki boshqa Flutter widget infratuzilmasidan
/// MUSTAQIL sof funksiya. Shu tufayli butun (holat × joriy manzil)
/// matritsasi haqiqiy qurilma/router qurmasdan, to'liq unit-testlanadi —
/// qarang: `test/app/router/redirect_policy_test.dart`.
///
/// Faza 3 to'liq oqimi (`worker_app/app/router/redirect_policy.dart`dagi
/// yuz-ro'yxatdan-o'tkazish bosqichi naqshini davom ettiradi, shaxsiy
/// ma'lumotlar (`/register`) VA PIN-qulf bosqichlari bilan kengaytirilgan):
///
/// ```text
/// !isAuthenticated              -> /login   (telefon/SMS oqimi)
/// authenticated && !registered  -> /register (shaxsiy ma'lumotlar, bir marta)
/// authenticated && registered && !faceEnrolled -> /face/onboarding (identity, bir marta)
/// authenticated && registered && faceEnrolled && !pinSet -> /pin/set (yaratish+tasdiqlash)
/// authenticated && registered && faceEnrolled && pinSet && !pinUnlocked -> /pin/unlock
/// authenticated && registered && faceEnrolled && pinSet && pinUnlocked -> /home + tablar
/// ```
///
/// `pinUnlocked` SESSIYA-ICHI (in-memory, `AuthState`) bayroq: har bir
/// sovuq ishga tushirishda `false`dan boshlanadi (`registered`/
/// `faceEnrolled`/`pinSet` esa PERSISTENT — qurilmadan bootstrap paytida
/// tiklanadi, qarang: `main.dart`). Shu tufayli avval to'liq sozlangan
/// fuqaro ilovani qayta ochganda — sessiya AVTO-TIKLANADI (`/login`ga
/// QAYTARILMAYDI), lekin baribir `/pin/unlock`da to'xtatiladi
/// (`registered`/`faceEnrolled`/`pinSet` allaqachon `true`, faqat
/// `pinUnlocked` `false` — aynan shu "qulf"ning o'zi).
///
/// Qaytadigan qiymat: `null` — joriy manzilda qolish (redirect YO'Q); aks
/// holda — yo'naltiriladigan yangi manzil.
///
/// **Loop xavfsizligi**: har bir bosqich QAT'IY tartibda tekshiriladi
/// (auth → register → face → pin-set → pin-unlock) va FAQAT ikki
/// natijadan birini qaytaradi — "joriy manzil shu bosqich uchun to'g'ri
/// manzil" (`null`) yoki "shu bosqichning YAGONA to'g'ri manzili".
/// Bayroqlar (`isAuthenticated`/`registered`/`faceEnrolled`/`pinSet`/
/// `pinUnlocked`) ikkita chaqiruv orasida o'zgarmagani uchun — YANGI
/// manzil bilan qayta baholanganda XUDDI SHU bosqich yana ishga tushadi va
/// endi `location == <shu bosqich manzili>` bo'lgani uchun `null`
/// qaytaradi. Har bir (holat, manzil) jufti shuning uchun FAQAT bitta
/// hopdan keyin barqarorlashadi (hech qachon uchinchi manzilga
/// sakramaydi) — bu xossa test faylida BUTUN (holat × har bir manzil)
/// matritsa uchun tekshiriladi.
String? resolveAuthRedirect({
  required AuthState authState,
  required String location,
}) {
  // `/splash` — `BrandSplash`ning o'zi (`onFinished`) taxminan bir necha
  // soniyadan keyin `/home`ga o'tishga "urinadi"; shu payt YANGI manzil
  // ushbu funksiyaga qayta uzatiladi va pastdagi shartlar bilan haqiqiy
  // joyga yo'naltiriladi. Shu oraliqda hech qanday avtomatik redirect
  // bo'lmasligi kerak — aks holda splash animatsiyasi kesilib qoladi.
  if (location == _splash) return null;

  const authFlowLocations = {_login, _otp};

  if (!authState.isAuthenticated) {
    // Auth oqimining o'zida (login/otp) qolishga ruxsat — aks holda har
    // qanday himoyalangan manzil (`/home`, shell tablari, `/register`,
    // `/face/*`, `/pin/*`, `/pay`, `/applications/*`, `/reports` va h.k.)
    // dan `/login`ga qaytariladi. `/login` YANGI manzil sifatida qayta
    // baholanganda `authFlowLocations.contains('/login')` — `null` —
    // barqarorlashadi.
    return authFlowLocations.contains(location) ? null : _login;
  }

  if (!authState.registered) {
    // Autentifikatsiya bor, lekin shaxsiy ma'lumotlar hali
    // to'ldirilmagan — FAQAT `/register`da qolishga ruxsat (login/otp/
    // face/pin manzillari ham BU YERGA qaytariladi). `/face/onboarding`dan
    // OLDIN tekshiriladi — shu tufayli ro'yxatdan o'tish HAR DOIM yuz/PIN
    // bosqichlaridan oldin yakunlanadi.
    return location == _register ? null : _register;
  }

  if (!authState.faceEnrolled) {
    // Autentifikatsiya bor, lekin yuz hali ro'yxatdan o'tmagan — FAQAT
    // `/face/onboarding`da qolishga ruxsat (login/otp/pin manzillari ham
    // BU YERGA qaytariladi).
    return location == _faceOnboarding ? null : _faceOnboarding;
  }

  if (!authState.pinSet) {
    // Yuz ro'yxatdan o'tgan, lekin PIN hali o'rnatilmagan — FAQAT
    // `/pin/set`da qolishga ruxsat.
    return location == _pinSet ? null : _pinSet;
  }

  if (!authState.pinUnlocked) {
    // Hammasi sozlangan (yuz + PIN), lekin JORIY sessiya hali qulflangan
    // (sovuq ishga tushirish/auto-login) — FAQAT `/pin/unlock`da qolishga
    // ruxsat. Bu aynan auto-login'ning qulf-bosqichi: `/home`ga yoki
    // boshqa HAR QANDAY himoyalangan manzilga to'g'ridan-to'g'ri o'tish
    // MUMKIN EMAS, toki to'g'ri PIN kiritilmaguncha.
    return location == _pinUnlock ? null : _pinUnlock;
  }

  // To'liq sozlangan (auth + ro'yxat + yuz + PIN + joriy sessiya ochilgan):
  // auth-oqimi manzillariga qaytib kelsa (masalan orqaga tugmasi/eski
  // chuqur havola) — `/home`ga. Boshqa har qanday manzil (shu jumladan
  // `/register`, `/face/onboarding`, `/pin/set`, `/pin/unlock` — masalan
  // kelajakda profildan "ma'lumotlarni tahrirlash"/"PIN o'zgartirish" kabi
  // qayta tashrif uchun ATAYLAB man qilinmagan, xuddi `worker_app`ning
  // `/face/enroll` bilan bir xil sabab bilan) ruxsat etiladi.
  return authFlowLocations.contains(location) ? _home : null;
}
