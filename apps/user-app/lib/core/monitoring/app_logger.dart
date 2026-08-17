import 'package:flutter/foundation.dart';

/// Kichik, bog'liqliksiz logging seam'i.
///
/// Hozircha faqat debug rejimida konsolga chiqaradi (`kDebugMode`);
/// release'da hech narsa qilmaydi (no-op) va hech qachon `throw`
/// qilmaydi. Kelajakda haqiqiy crash/monitoring backend (masalan Sentry
/// yoki Firebase Crashlytics) shu klass ichiga ulanishi mumkin —
/// chaqiruvchi kod (`logError`/`logEvent`) o'zgarmaydi.
class AppLogger {
  const AppLogger();

  /// Kutilmagan xatolik/istisno haqida xabar beradi.
  ///
  /// [error] — tutilgan xato obyekti, [stackTrace] — (mavjud bo'lsa)
  /// tegishli stek izi, [reason] — qo'shimcha kontekst (masalan qaysi
  /// repository/cubit chaqirgani).
  void logError(Object error, StackTrace? stackTrace, {String? reason}) {
    if (!kDebugMode) return;
    final tag = reason != null ? ' ($reason)' : '';
    debugPrint('[AppLogger] ERROR$tag: $error');
    if (stackTrace != null) debugPrint(stackTrace.toString());
  }

  /// Diagnostik/analitika hodisasini qayd etadi (masalan "payment_success",
  /// "request_submitted").
  ///
  /// [data] — hodisaga tegishli qo'shimcha kalit-qiymatlar (ixtiyoriy).
  void logEvent(String name, {Map<String, Object?>? data}) {
    if (!kDebugMode) return;
    debugPrint('[AppLogger] EVENT: $name${data != null ? ' $data' : ''}');
  }
}
