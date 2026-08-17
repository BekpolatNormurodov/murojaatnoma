import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';

// Himoyalanmagan/har doim ruxsat etilgan manzillar — pastdagi shartlarda
// qayta-qayta yozmaslik uchun bitta joyda nomlangan.
const _splash = '/splash';
const _login = '/login';
const _otp = '/otp';
const _faceEnroll = '/face/enroll';
const _home = '/home';

/// Auth/face-enrollment holatiga asoslangan redirect qarori — GoRouter,
/// `BuildContext` yoki boshqa Flutter widget infratuzilmasidan MUSTAQIL sof
/// funksiya. Shu tufayli butun (auth holati × joriy manzil) matritsasi
/// haqiqiy qurilma/router qurmasdan, to'liq unit-testlanadi — qarang:
/// `test/app/router/redirect_policy_test.dart`.
///
/// Qaytadigan qiymat: `null` — joriy manzilda qolish (redirect YO'Q); aks
/// holda — yo'naltiriladigan yangi manzil.
///
/// **Loop xavfsizligi**: har bir (holat, manzil) jufti FAQAT bitta yangi
/// manzilga olib keladi va shu YANGI manzil bilan ushbu funksiya qayta
/// chaqirilganda har doim `null` bilan "joylashib qoladi" (hech qachon
/// uchinchi manzilga sakramaydi) — quyidagi har bir tarmoq shu xususiyat
/// bilan izohlangan, va test faylida BUTUN matritsa uchun tekshiriladi.
String? resolveAuthRedirect({
  required AuthState authState,
  required String location,
}) {
  // `/splash` — `BrandSplash`ning o'zi (`onFinished`) taxminan 2500ms dan
  // keyin `/home`ga o'tishga "urinadi"; shu payt YANGI manzil ushbu
  // funksiyaga qayta uzatiladi va pastdagi shartlar bilan haqiqiy joyga
  // yo'naltiriladi. Shu oraliqda hech qanday avtomatik redirect
  // bo'lmasligi kerak — aks holda splash animatsiyasi kesilib qoladi yoki
  // (agar `refreshListenable` shu payt o'qigan bo'lsa) foydalanuvchi hali
  // ko'rmagan ekrandan sakrab ketadi.
  if (location == _splash) return null;

  const authFlowLocations = {_login, _otp};

  if (!authState.isAuthenticated) {
    // Auth oqimining o'zida (login/otp) qolishga ruxsat — aks holda har
    // qanday himoyalangan manzil (`/home`, shell tablari, `/face/*`) dan
    // `/login`ga qaytariladi. `/login` YANGI manzil sifatida qayta
    // baholanganda `authFlowLocations.contains('/login')` — `null` —
    // barqarorlashadi.
    return authFlowLocations.contains(location) ? null : _login;
  }

  if (!authState.faceEnrolled) {
    // Autentifikatsiya bor, lekin yuz hali ro'yxatdan o'tmagan — FAQAT
    // `/face/enroll`da qolishga ruxsat (login/otp manzillari ham
    // BUYERGA qaytariladi — ular endi keraksiz). Boshqa YANGI manzil
    // sifatida qayta baholanganda `location == _faceEnroll` — `null` —
    // barqarorlashadi.
    return location == _faceEnroll ? null : _faceEnroll;
  }

  // To'liq autentifikatsiyalangan + yuz ro'yxatdan o'tgan: auth-oqimi
  // manzillariga qaytib kelsa (masalan orqaga tugmasi/eski chuqur havola)
  // — `/home`ga. Boshqa har qanday manzil (shu jumladan barcha shell
  // tablari, `/face/checkin`, hatto `/face/enroll` — qayta ro'yxatdan
  // o'tishni istasa deb, ATAYLAB man qilinmagan) ruxsat etiladi.
  return authFlowLocations.contains(location) ? _home : null;
}
