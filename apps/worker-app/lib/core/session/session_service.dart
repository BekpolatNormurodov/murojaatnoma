import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:worker_app/core/notifications/fcm_service.dart';
import 'package:worker_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:worker_app/features/face/data/datasources/face_local_data_source.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';
import 'package:worker_app/injection.dart';

/// Xodim ilovasidan TO'LIQ chiqish. Har qadam alohida himoyalangan va
/// vaqt bilan cheklangan — sekin/yo'q internetda ham chiqish 5-6 soniyadan
/// oshmaydi va hech qachon xato bilan to'xtamaydi.
///
/// Ilgari faqat lokal tokenlar o'chirilardi:
///  * FCM qurilma tokeni serverda qolib, telefon oldingi xodimning
///    qo'ng'iroq/xabar push'larini olaverardi;
///  * refresh token serverda 30 kun amal qilardi;
///  * yuborilmagan lokatsiya navbati keyingi xodim tokeni bilan ketardi;
///  * yuz shabloni qolib, keyingi xodim "ro'yxatdan o'tgan" ko'rinardi;
///  * oflayn kesh oldingi foydalanuvchi ma'lumotini ko'rsatardi.
class SessionService {
  Future<void> logout() async {
    final tracking = getIt<LocationTrackingService>();
    await _safe(tracking.stop());
    await _safe(tracking.clearOutbox());
    if (!AppConfig.useMock) {
      // Token hali bor paytida (auth bilan) qurilma tokenini o'chiramiz.
      await _safe(getIt<FcmService>().clearToken(), seconds: 4);
    }
    await _safe(AuthInterceptor.endSession(getIt<DioClient>().dio), seconds: 6);
    await _safe(getIt<AuthRepository>().logout());
    await _safe(getIt<FaceLocalDataSource>().clear());
  }

  static Future<void> _safe(Future<void> f, {int seconds = 3}) async {
    try {
      await f.timeout(Duration(seconds: seconds));
    } on Object {
      // Chiqish hech qachon to'xtamasin.
    }
  }
}
