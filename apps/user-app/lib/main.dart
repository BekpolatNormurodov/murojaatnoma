import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:user_app/app/app.dart';
import 'package:user_app/core/constants/api_constants.dart';
import 'package:user_app/core/notifications/notification_service.dart';
import 'package:user_app/core/session/logout_service.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/injection.dart';

/// Ilovani ishga tushiruvchi umumiy bootstrap.
///
/// Har bir flavor entrypointi (`main_dev.dart`, `main_prod.dart`, va shu
/// fayldagi standart `main()`) avval `AppConfig.init(...)` chaqirib flavor
/// va mock rejimni belgilaydi, so'ng shu funksiyani chaqiradi.
///
/// [systemServices] `false` — mahalliy bildirishnomalar ishga tushirilmaydi
/// (integration testlarda tizim ruxsat oynasi ochilmasin). Standart — yoqilgan.
Future<void> bootstrap({bool systemServices = true}) async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  await configureDependencies();
  await _restoreSession();
  if (systemServices) unawaited(_initNotifications());
  // Server sessiyani rad etsa (refresh 401) — "Chiqish" tugmasi bilan AYNAN
  // bir xil to'liq chiqish: saqlangan sessiya, bildirishnomalar, popuplar
  // tozalanadi va `/login`ga o'tiladi (ilgari faqat `reset()` edi — keyingi
  // ishga tushishda fuqaro tokensiz "kirgan" holatda qotib qolardi).
  AuthInterceptor.sessionExpired.listen(
    (_) => unawaited(getIt<LogoutService>().logout()),
  );
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

/// Saqlangan auth sessiyasini (agar bor bo'lsa) onboarding holati bilan
/// birga tiklaydi — `runApp()`dan OLDIN, shunda `/login` "milt etmaydi".
/// Profil/yuz/PIN tiklash `OnboardingRestorer`da (yangi OTP kirishda ham
/// xuddi shu yo'l ishlaydi).
Future<void> _restoreSession() => getIt<AuthCubit>().restore();

/// Flavor ko'rsatilmagan standart entrypoint (`flutter run`) — dev flavor +
/// mock rejimda ishga tushadi, xuddi `main_dev.dart` kabi.
void main() {
  AppConfig.init(flavor: AppFlavor.dev, useMock: true, apiBaseUrl: kApiBaseUrl);
  bootstrap();
}
