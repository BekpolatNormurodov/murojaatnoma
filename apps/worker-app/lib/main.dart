import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:worker_app/app/app.dart';
import 'package:worker_app/core/notifications/fcm_service.dart';
import 'package:worker_app/core/notifications/notification_service.dart';
import 'package:worker_app/core/realtime/realtime_socket_service.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/calls/domain/entities/call.dart';
import 'package:worker_app/features/calls/presentation/bloc/call_cubit.dart';
import 'package:worker_app/features/face/domain/repositories/face_repository.dart';
import 'package:worker_app/firebase_options.dart';
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
  unawaited(_initPush());
  _initRealtime();
  runApp(const WorkerApp());
}

/// Jonli chat socketini (Socket.IO) login holatiga bog'laydi — faqat REAL
/// rejimda (mock'da backend/token yo'q, shuning uchun o'tkazib yuboriladi).
/// `_initPush` bilan bir xil naqsh: login holatini ilova ILDIZIDA kuzatadi
/// (Chat qatlami socket lifecycle'iga bog'lanib qolmaydi) — sessiya
/// autentifikatsiyalanganda `connect()`, chiqilganda `disconnect()`.
/// Butunlay `try/catch` bilan o'ralgan: socket ishga tushmasa ham ilova
/// HECH QACHON qulamaydi (chat oddiygina jonli yangilanmaydi).
void _initRealtime() {
  if (AppConfig.useMock) return;
  try {
    final socket = getIt<RealtimeSocketService>();
    final authCubit = getIt<AuthCubit>();
    if (authCubit.state.isAuthenticated) unawaited(socket.connect());
    authCubit.stream.listen((state) {
      if (state.isAuthenticated) {
        unawaited(socket.connect());
      } else {
        socket.disconnect();
      }
    });
  } on Object {
    // Socket ishga tushmasa — ilova baribir normal ishlaydi.
  }
}

/// Masofaviy push (FCM)ni ishga tushiradi — faqat REAL rejimda (mock'da
/// backend yo'q, shuning uchun o'tkazib yuboriladi). `runApp()`ni TO'SMASLIGI
/// uchun `await`SIZ chaqiriladi va butunlay `try/catch` bilan o'ralgan:
/// Firebase/push ishga tushmasa ham ilova HECH QACHON qulamaydi.
///
/// Login holatini ilova ILDIZIDA kuzatadi (ATAYLAB `AuthCubit`ning o'zida
/// EMAS) — shunda Auth qatlami FCM'ga bog'lanib qolmaydi: har safar sessiya
/// autentifikatsiyalanganda token backendga qayta yuboriladi.
Future<void> _initPush() async {
  if (AppConfig.useMock) return;
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    await getIt<FcmService>().init();

    getIt<AuthCubit>().stream.listen((state) {
      if (state.isAuthenticated) {
        unawaited(getIt<FcmService>().syncToken());
      }
    });
  } on Object {
    // Firebase/push ishga tushmasa — ilova baribir normal ishlaydi.
  }
}

/// Mahalliy bildirishnomalar plaginini ishga tushiradi — `runApp()`ni
/// TO'SMASLIGI uchun ataylab `await`SIZ (`unawaited`) chaqiriladi va
/// ichkarida allaqachon to'liq himoyalangan (`NotificationService.init()`
/// hech qachon `throw` qilmaydi), shuning uchun bu yerdagi `try/catch` —
/// ikki qavatli qo'shimcha kafolat: bildirishnoma xizmati muvaffaqiyatsiz
/// bo'lsa ham ilova ishga tushishi HECH QACHON to'xtamaydi.
Future<void> _initNotifications() async {
  // Kiruvchi qo'ng'iroq bildirishnomasi bosilganda: socketni ulaymiz
  // (idempotent) va qo'ng'iroqni qabul qilamiz. `/call/:id`ga navigatsiya
  // `app.dart`dagi global tinglovchi orqali (holat `incoming`ga o'tishi
  // bilan) amalga oshadi. Mock rejimda socket/backend yo'q — o'tkazamiz.
  final notifications = getIt<NotificationService>()
    ..onIncomingCallTap = (callId, callerName, media) {
      if (AppConfig.useMock) return;
      unawaited(getIt<RealtimeSocketService>().connect());
      unawaited(
        getIt<CallCubit>().acceptFromPush(
          callId: callId,
          callerName: callerName,
          media: CallMedia.fromWire(media),
        ),
      );
    };
  try {
    await notifications.init();
    // Bildirishnoma bosilishi orqali SOVUQ ishga tushirilgan bo'lsa — o'sha
    // qo'ng'iroqni qabul qilamiz (init launch payload'ni ushlab qo'ygan).
    notifications.dispatchLaunchTap();
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
