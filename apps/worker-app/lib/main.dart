import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:worker_app/app/app.dart';
import 'package:worker_app/core/network/worker_auth_interceptor.dart';
import 'package:worker_app/core/notifications/fcm_service.dart';
import 'package:worker_app/core/notifications/notification_service.dart';
import 'package:worker_app/core/realtime/realtime_socket_service.dart';
import 'package:worker_app/core/session/session_bootstrap.dart';
import 'package:worker_app/core/session/session_service.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/chat/data/chat_outbox.dart';
import 'package:worker_app/features/calls/domain/entities/call.dart';
import 'package:worker_app/features/calls/presentation/bloc/call_cubit.dart';
import 'package:worker_app/features/tracking/tracking_setup.dart';
import 'package:worker_app/firebase_options.dart';
import 'package:worker_app/injection.dart';

/// Ilovani ishga tushiruvchi umumiy bootstrap.
///
/// Har bir flavor entrypointi (`main_dev.dart`, `main_prod.dart`, va shu
/// fayldagi standart `main()`) avval `AppConfig.init(...)` chaqirib flavor
/// va mock rejimni belgilaydi, so'ng shu funksiyani chaqiradi.
///
/// [systemServices] `false` — mahalliy bildirishnoma va push (FCM)
/// ishga tushirilmaydi (integration testlar: tizim ruxsat oynasi ochilmasin,
/// Google serverlariga so'rov ketmasin). Standart — yoqilgan.
Future<void> bootstrap({bool systemServices = true}) async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  // DI'dan oldin: birinchi so'rovdan boshlab telefon ma'lumoti ketadi.
  if (systemServices && !AppConfig.useMock) await ClientHeaders.load();
  await configureDependencies();
  // Tizim ruxsatlari va fon xizmati — faqat haqiqiy ishga tushirishda.
  if (systemServices) {
    enableBackgroundTracking();
    _enableUpdateCheck();
  }
  // Server sessiyani rad etsa — qo'lda chiqish bilan BIR XIL toza chiqish.
  // Obuna HAR QANDAY tarmoq so'rovidan OLDIN: aks holda erta kelgan xabar
  // yo'qolib, ilova "kirgan, lekin tokensiz" holatda qolardi.
  WorkerAuthInterceptor.sessionExpired.listen((_) {
    if (!getIt<AuthCubit>().state.isAuthenticated) return;
    unawaited(SessionService().signOut(remote: false));
  });
  await _restoreSession();
  if (systemServices) {
    unawaited(_initNotifications());
    unawaited(_initPush());
  }
  // Oldingi seansda yuborilmay qolgan chat xabarlarini yuboramiz.
  if (!AppConfig.useMock && getIt<AuthCubit>().state.isAuthenticated) {
    unawaited(getIt<ChatOutbox>().flush());
  }
  _initRealtime();
  runApp(const WorkerApp());
}

/// Saytda yangiroq APK bo'lsa taklif qilinadi (faqat real Android).
void _enableUpdateCheck() {
  if (AppConfig.useMock || defaultTargetPlatform != TargetPlatform.android) {
    return;
  }
  UpdateChecker.instance = UpdateChecker(appKey: 'worker');
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
    NetworkStatus.instance.onReconnect.listen((_) {
      if (authCubit.state.isAuthenticated) unawaited(socket.connect());
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
    // Obuna `init()`dan OLDIN — ruxsat oynasi/sekin tarmoq paytida
    // kirilsa ham qurilma tokeni ro'yxatdan o'tadi.
    var workerId = getIt<AuthCubit>().state.session?.workerId;
    getIt<AuthCubit>().stream.listen((state) {
      final next = state.isAuthenticated ? state.session?.workerId : null;
      if (next != null && next != workerId) {
        unawaited(getIt<FcmService>().syncToken());
      }
      workerId = next;
    });
    await getIt<FcmService>().init();
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
      // Chiqilgan qurilmada eski push bosilsa — e'tiborsiz.
      if (!getIt<AuthCubit>().state.isAuthenticated) return;
      unawaited(getIt<RealtimeSocketService>().connect());
      unawaited(
        getIt<CallCubit>().showFromPush(
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
/// QAYTARILMAYDI (`runApp()`dan OLDIN).
///
/// Yuz ro'yxatdan o'tkazish holati (shablon egasi bo'yicha) va admin "yuz
/// majburiy" sozlamasi ham shu yerda tiklanadi. Yuz ro'yxatdan o'tmagan
/// bo'lsa sozlama qisqa (3 s) kutiladi — aks holda xodim bir lahza majburiy
/// enroll ekranini ko'rib qolardi. Hech qachon throw qilmaydi.
Future<void> _restoreSession() async {
  final authCubit = getIt<AuthCubit>();
  await authCubit.restore();
  final workerId = authCubit.state.session?.workerId;
  if (!authCubit.state.isAuthenticated || workerId == null) return;

  final cached = cachedFaceRequired();
  if (cached != null) authCubit.setFaceRequired(isRequired: cached);
  if (await syncFaceOwner(workerId)) authCubit.markFaceEnrolled();

  final pending = refreshFaceRequired();
  if (authCubit.state.faceEnrolled || cached == false) {
    unawaited(pending);
  } else {
    await pending.timeout(const Duration(seconds: 3), onTimeout: () {});
  }
}

/// Flavor ko'rsatilmagan standart entrypoint (`flutter run`) — dev flavor +
/// mock rejimda ishga tushadi, xuddi `main_dev.dart` kabi.
void main() {
  AppConfig.init(flavor: AppFlavor.dev, useMock: true);
  bootstrap();
}
