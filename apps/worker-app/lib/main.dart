import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:worker_app/app/app.dart';
import 'package:worker_app/core/notifications/notification_service.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/face/domain/repositories/face_repository.dart';
import 'package:worker_app/injection.dart';

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
  runApp(const WorkerApp());
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
/// avval kirgan ishchi keyingi safar ilovani ochganda `/login`ga
/// QAYTARILMAYDI (`AuthCubit.restore()`, `runApp()`dan OLDIN — splash
/// `resolveAuthRedirect`ni birinchi baholaganda holat allaqachon to'g'ri
/// bo'ladi, hech qanday `/login` "milt etishi" yo'q).
///
/// Autentifikatsiya tiklangan bo'lsa, yuz ro'yxatdan o'tkazish holatini
/// ham (mavjud shablon orqali) tiklaydi — aks holda `resolveAuthRedirect`
/// allaqachon ro'yxatdan o'tgan ishchini har safar keraksiz qayta
/// `/face/enroll`ga yo'naltirar edi. Bu muvofiqlashtirish ATAYLAB
/// `AuthCubit`ning O'ZIDA EMAS, shu yerda (ilova ildizida) — Auth va Face
/// qatlamlari bir-biriga bog'liq bo'lib qolmasligi uchun.
Future<void> _restoreSession() async {
  final authCubit = getIt<AuthCubit>();
  await authCubit.restore();
  if (!authCubit.state.isAuthenticated) return;

  try {
    final templateResult = await getIt<FaceRepository>().getTemplate();
    templateResult.fold((_) {}, (template) {
      if (template != null) authCubit.markFaceEnrolled();
    });
  } on Object {
    // Yuz holatini tiklab bo'lmasa — jim o'tkazib yuboriladi (foydalanuvchi
    // shunchaki `/face/enroll`ni ko'radi, ilova hech qachon qulamaydi).
  }
}

/// Flavor ko'rsatilmagan standart entrypoint (`flutter run`) — dev flavor +
/// mock rejimda ishga tushadi, xuddi `main_dev.dart` kabi.
void main() {
  AppConfig.init(flavor: AppFlavor.dev, useMock: true);
  bootstrap();
}
