import 'dart:async';
import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:path_provider/path_provider.dart';
import 'package:worker_app/core/notifications/fcm_service.dart';
import 'package:worker_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/calls/presentation/bloc/call_cubit.dart';
import 'package:worker_app/features/calls/presentation/bloc/meeting_cubit.dart';
import 'package:worker_app/features/chat/data/chat_outbox.dart';
import 'package:worker_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';
import 'package:worker_app/injection.dart';

/// Xodim ilovasidan TO'LIQ chiqish. Har qadam alohida himoyalangan va vaqt
/// bilan cheklangan — sekin/yo'q internetda ham chiqish hech qachon xato
/// bilan to'xtamaydi.
///
///  * faol qo'ng'iroq/yig'ilish tugatiladi (mikrofon/kamera yopiladi);
///  * qo'lda chiqishda yuborilmagan lokatsiyalar avval yuboriladi; o'tmagani
///    egasi bilan saqlanib qoladi va faqat SHU xodim qayta kirsa ketadi;
///  * FCM qurilma tokeni serverdan o'chiriladi va lokal bekor qilinadi;
///  * tokenlar, sessiya, oflayn kesh, chat navbati, skan kadrlari o'chadi.
///    Yuz shabloni egasi bilan saqlanadi — boshqa xodim kirganda o'chadi.
///
/// Navigatsiya shu yerda EMAS — `AuthNavigationHost` bajaradi.
class SessionService {
  static Future<void>? _running;

  /// Qo'lda chiqish (profil yoki yuz ro'yxati ekranidagi "Chiqish").
  Future<void> logout() => signOut(remote: true);

  /// [remote] `false` — sessiya serverda allaqachon rad etilgan: tarmoqdagi
  /// qadamlar o'tkazib yuboriladi. Bir vaqtda faqat bitta chiqish bajariladi.
  Future<void> signOut({required bool remote}) =>
      _running ??= _signOut(remote: remote).whenComplete(() => _running = null);

  Future<void> _signOut({required bool remote}) async {
    _endLiveSessions();
    if (remote) {
      if (getIt.isRegistered<LocationTrackingService>()) {
        await _safe(getIt<LocationTrackingService>().flush, seconds: 4);
      }
      if (!AppConfig.useMock && getIt.isRegistered<FcmService>()) {
        // Token hali bor paytida (auth bilan) qurilma tokenini o'chiramiz.
        await _safe(() => getIt<FcmService>().clearToken(), seconds: 4);
      }
      if (getIt.isRegistered<DioClient>()) {
        await _safe(
          () => AuthInterceptor.endSession(getIt<DioClient>().dio),
          seconds: 6,
        );
      }
    }
    await clearLocal();
    _resetState();
  }

  /// Qo'ng'iroq/yig'ilish socket uzilishidan va tokenlar o'chishidan OLDIN
  /// yopiladi.
  void _endLiveSessions() {
    try {
      if (getIt.isRegistered<CallCubit>()) getIt<CallCubit>().endSession();
    } on Object {
      // Chiqish hech qachon to'xtamasin.
    }
    try {
      if (getIt.isRegistered<MeetingCubit>()) {
        getIt<MeetingCubit>().endSession();
      }
    } on Object {
      // Chiqish hech qachon to'xtamasin.
    }
  }

  /// Qurilmadagi sessiyaga tegishli ma'lumotlarni o'chiradi.
  Future<void> clearLocal() async {
    if (getIt.isRegistered<LocationTrackingService>()) {
      final tracking = getIt<LocationTrackingService>();
      await _safe(tracking.stop);
      // `AuthCubit` hali eski sessiyada — egasiz nuqtalarga ega yoziladi.
      await _safe(tracking.claimOutbox);
    }
    if (getIt.isRegistered<ChatOutbox>()) {
      // Yuborilmagan chat xabarlari keyingi foydalanuvchi nomidan ketmasin.
      await _safe(getIt<ChatOutbox>().clear);
    }
    if (getIt.isRegistered<AuthRepository>()) {
      await _safe(() => getIt<AuthRepository>().logout());
    }
    await _safe(ResponseCache.instance.clear);
    await _safe(_deleteScanFrames, seconds: 2);
    if (!AppConfig.useMock && getIt.isRegistered<FcmService>()) {
      // Server tokenni o'chira olmagan bo'lsa ham (oflayn / muddati o'tgan
      // sessiya) telefon oldingi xodimning push'larini olmasin.
      await _safe(() => getIt<FcmService>().invalidateLocalToken());
    }
  }

  Future<void> _deleteScanFrames() async {
    final docs = await getApplicationDocumentsDirectory();
    final folder = Directory('${docs.path}/attendance');
    if (folder.existsSync()) await folder.delete(recursive: true);
  }

  /// Global (lazy singleton) holatlarni tozalaydi. `AuthCubit.reset()`
  /// OXIRIDA: u router redirect'ini va `AuthNavigationHost`ni ishga tushiradi.
  void _resetState() {
    if (getIt.isRegistered<NotificationsCubit>()) {
      try {
        getIt<NotificationsCubit>().clear();
      } on Object {
        // Hech qachon to'xtamasin.
      }
    }
    if (getIt.isRegistered<AuthCubit>()) {
      final auth = getIt<AuthCubit>();
      if (!auth.isClosed) auth.reset();
    }
  }

  static Future<void> _safe(
    Future<void> Function() run, {
    int seconds = 3,
  }) async {
    try {
      await run().timeout(Duration(seconds: seconds));
    } on Object {
      // Chiqish hech qachon to'xtamasin.
    }
  }
}
