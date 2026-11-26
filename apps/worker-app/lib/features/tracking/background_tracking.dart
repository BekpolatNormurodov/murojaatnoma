import 'package:app_core/app_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/features/tracking/tracking_task.dart';

/// Ilovadan MUSTAQIL ishlaydigan kuzatuv: ilova oynasi surib yopilsa, tizim
/// jarayonni o'ldirsa, telefon o'chib yonsa yoki ilova yangilansa ham davom
/// etadi.
abstract class BackgroundTracking {
  /// [ownerId] nomidan xizmatni ishga tushiradi (ishlayotgan bo'lsa ham
  /// xavfsiz). `false` — tizim xizmatni boshlashga ruxsat bermadi.
  Future<bool> start(String ownerId);

  Future<void> stop();
}

/// Android foreground-service (`flutter_foreground_task`) ustidagi
/// implementatsiya. Xizmat alohida Dart isolate'da ishlaydi, shuning uchun
/// unga kerakli hamma narsa `SharedPreferences` orqali beriladi.
class ForegroundServiceTracking implements BackgroundTracking {
  /// Nomidan kuzatilayotgan xodim — bo'sh bo'lsa xizmat o'zini to'xtatadi.
  static const String ownerKey = 'tracking_owner_v1';
  static const String apiBaseKey = 'tracking_api_base_v1';

  static const int _serviceId = 4101;

  /// Xizmat shuncha vaqtda bir oqim tirikligini va telefon holatini
  /// tekshiradi (masalan GPS qayta yoqilgan bo'lsa kuzatuvni tiklaydi).
  static const int _watchdogMs = 30000;

  static const String title = 'Joylashuv kuzatuvi';
  static const String runningText = 'Joylashuvingiz yuborilmoqda';
  static const NotificationIcon icon = NotificationIcon(
    metaDataName: 'uz.gov.hokimiyat.worker_app.TRACKING_ICON',
  );

  /// Shu jarayonda xizmat ilova ochiq turganda (qayta) boshlanganmi.
  bool _startedFromApp = false;

  static void configure() {
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'location_tracking',
        channelName: title,
        channelDescription: 'Joylashuv yuborilayotgan paytda ko‘rinadi',
        onlyAlertOnce: true,
      ),
      iosNotificationOptions: const IOSNotificationOptions(),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(_watchdogMs),
        autoRunOnBoot: true,
        autoRunOnMyPackageReplaced: true,
        allowWifiLock: true,
        stopWithTask: false,
      ),
    );
  }

  @override
  Future<bool> start(String ownerId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(ownerKey, ownerId);
      await prefs.setString(apiBaseKey, AppConfig.apiBaseUrl);
      configure();
      if (await FlutterForegroundTask.isRunningService) {
        if (_startedFromApp) return true;
        // Telefon yonganda yoki yangilanishdan keyin FONDA boshlangan
        // xizmatga Android to'liq joylashuv huquqini bermaydi — ilova
        // ochilishi bilan uni bir marta qayta boshlaymiz.
        final restart = await FlutterForegroundTask.restartService();
        _startedFromApp = restart is ServiceRequestSuccess;
        return true;
      }
      final result = await FlutterForegroundTask.startService(
        serviceId: _serviceId,
        serviceTypes: const [ForegroundServiceTypes.location],
        notificationTitle: title,
        notificationText: runningText,
        notificationIcon: icon,
        callback: startTrackingTask,
      );
      if (result is ServiceRequestFailure) {
        debugPrint('[tracking] service: ${result.error}');
        return false;
      }
      _startedFromApp = true;
      return true;
    } on Object catch (error) {
      debugPrint('[tracking] service: $error');
      return false;
    }
  }

  @override
  Future<void> stop() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(ownerKey);
      if (await FlutterForegroundTask.isRunningService) {
        await FlutterForegroundTask.stopService();
      }
    } on Object catch (error) {
      debugPrint('[tracking] stop: $error');
    }
  }
}
