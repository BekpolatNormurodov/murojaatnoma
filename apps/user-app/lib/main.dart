import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:user_app/app/app.dart';
import 'package:user_app/core/notifications/notification_service.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/face/domain/repositories/face_repository.dart';
import 'package:user_app/features/pin/domain/repositories/pin_repository.dart';
import 'package:user_app/features/registration/domain/repositories/registration_repository.dart';
import 'package:user_app/injection.dart';

/// Ilovani ishga tushiruvchi umumiy bootstrap.
///
/// Har bir flavor entrypointi (`main_dev.dart`, `main_prod.dart`, va shu
/// fayldagi standart `main()`) avval `AppConfig.init(...)` chaqirib flavor
/// va mock rejimni belgilaydi, so'ng shu funksiyani chaqiradi.
Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  await configureDependencies();
  await _restoreSession();
  unawaited(_initNotifications());
  runApp(const UserApp());
}

/// Mahalliy bildirishnomalar plaginini ishga tushiradi — `runApp()`ni
/// TO'SMASLIGI uchun ataylab `await`SIZ (`unawaited`) chaqiriladi va
/// ichkarida allaqachon to'liq himoyalangan (`NotificationService.init()`
/// hech qachon `throw` qilmaydi), shuning uchun bu yerdagi `try/catch` —
/// ikki qavatli qo'shimcha kafolat: bildirishnoma xizmati muvaffaqiyatsiz
/// bo'lsa ham ilova ishga tushishi HECH QACHON to'xtamaydi.
Future<void> _initNotifications() async {
  try {
    await getIt<NotificationService>().init();
  } on Object {
    // Jim o'tkazib yuboriladi — bildirishnomalar shunchaki ishlamaydi.
  }
}

/// Saqlangan auth sessiyasini (agar bor bo'lsa) tiklaydi — shu tufayli
/// avval kirgan fuqaro keyingi safar ilovani ochganda `/login`ga
/// QAYTARILMAYDI (`runApp()`dan OLDIN — splash `resolveAuthRedirect`ni
/// birinchi baholaganda holat allaqachon to'g'ri bo'ladi, hech qanday
/// `/login` "milt etishi" yo'q).
///
/// Autentifikatsiya tiklangan bo'lsa, ro'yxatdan o'tish (shaxsiy
/// ma'lumotlar), yuz ro'yxatdan o'tkazish VA PIN o'rnatilgan-
/// o'rnatilmaganligi holatini ham (mavjud profil/shablon/xesh orqali)
/// tiklaydi — aks holda `resolveAuthRedirect` allaqachon to'liq sozlangan
/// fuqaroni har safar keraksiz qayta `/register`/`/face/onboarding`/
/// `/pin/set`ga yo'naltirar edi. `markPinAlreadySet()` (`markPinSet()`dan
/// FARQLI) ATAYLAB ishlatiladi: `pinUnlocked` `false`da qoladi — sessiya
/// baribir `/pin/unlock`da to'xtaydi (bu — auto-login'ning qulf-bosqichi,
/// qarang: `redirect_policy.dart`). Bu muvofiqlashtirish ATAYLAB
/// `AuthCubit`ning O'ZIDA EMAS, shu yerda (ilova ildizida) — Auth,
/// Registration, Face va Pin qatlamlari bir-biriga bog'liq bo'lib
/// qolmasligi uchun (`worker_app`dagi bir xil naqsh, bir xil sabab bilan).
///
/// Har bir keyingi bosqich FAQAT oldingisi allaqachon `true` bo'lsa
/// tekshiriladi (auth → registered → faceEnrolled → pinSet) — bu aynan
/// `resolveAuthRedirect`ning qat'iy tartibiga mos: masalan hali ro'yxatdan
/// o'tilmagan bo'lsa, yuz holatini tekshirishning ma'nosi yo'q (foydalanuvchi
/// baribir avval `/register`ni ko'radi).
Future<void> _restoreSession() async {
  final authCubit = getIt<AuthCubit>();
  await authCubit.restore();
  if (!authCubit.state.isAuthenticated) return;

  try {
    final profileResult = await getIt<RegistrationRepository>().getProfile();
    profileResult.fold((_) {}, (profile) {
      if (profile != null) authCubit.markRegistered();
    });
  } on Object {
    // Profilni tiklab bo'lmasa — jim o'tkazib yuboriladi (foydalanuvchi
    // shunchaki `/register`ni ko'radi, ilova hech qachon qulamaydi).
  }

  if (!authCubit.state.registered) return;

  try {
    final templateResult = await getIt<FaceRepository>().getTemplate();
    templateResult.fold((_) {}, (template) {
      if (template != null) authCubit.markFaceEnrolled();
    });
  } on Object {
    // Yuz holatini tiklab bo'lmasa — jim o'tkazib yuboriladi (foydalanuvchi
    // shunchaki `/face/onboarding`ni ko'radi, ilova hech qachon qulamaydi).
  }

  if (!authCubit.state.faceEnrolled) return;

  try {
    final hasPinResult = await getIt<PinRepository>().hasPin();
    hasPinResult.fold((_) {}, (hasPin) {
      if (hasPin) authCubit.markPinAlreadySet();
    });
  } on Object {
    // PIN holatini tiklab bo'lmasa — jim o'tkazib yuboriladi (foydalanuvchi
    // shunchaki `/pin/set`ni ko'radi, ilova hech qachon qulamaydi).
  }
}

/// Flavor ko'rsatilmagan standart entrypoint (`flutter run`) — dev flavor +
/// mock rejimda ishga tushadi, xuddi `main_dev.dart` kabi.
void main() {
  AppConfig.init(flavor: AppFlavor.dev, useMock: true);
  bootstrap();
}
