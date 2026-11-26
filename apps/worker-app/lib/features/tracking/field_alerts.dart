import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Ovozli bildirishnoma ko'rsatish (testlarda almashtiriladi).
typedef ShowAlert = Future<void> Function(int id, String title, String body);

/// Fon xizmati beradigan eslatmalar — internetdagi push'siz, qurilmaning
/// o'zida:
///  * ish vaqtida kuzatuvga xalaqit beradigan sozlama (GPS, ruxsat,
///    batareya) — ovozli ogohlantirish, tuzatilmaguncha [repeatEvery]da bir;
///  * ish kuni oxirida bugungi hisobot yuborilmagan bo'lsa — kuniga bir marta.
class FieldAlerts {
  FieldAlerts(this._dio, this._show, {DateTime Function() now = DateTime.now})
    : _now = now;

  static const int problemId = 4201;
  static const int reportId = 4202;
  static const Duration repeatEvery = Duration(minutes: 30);

  /// Standart ish vaqti (server standarti bilan bir xil).
  static const int workStartMinute = 9 * 60;
  static const int workEndMinute = 18 * 60;

  /// Hisobot eslatmasi 17:00 dan kech soat 21:00 gacha beriladi.
  static const int reportFromMinute = 17 * 60;
  static const int reportUntilMinute = 21 * 60;

  static const String reportDayKey = 'field_alert_report_day';

  final Dio _dio;
  final ShowAlert _show;
  final DateTime Function() _now;

  String? _problem;
  DateTime? _problemAt;
  DateTime? _reportCheckedAt;

  static bool _workday(DateTime t) =>
      t.weekday != DateTime.saturday && t.weekday != DateTime.sunday;

  static int _minute(DateTime t) => t.hour * 60 + t.minute;

  /// Har tekshiruvda chaqiriladi. Hech qachon throw qilmaydi.
  Future<void> check({required String? problem}) async {
    try {
      await _warn(problem);
      await _remindReport();
    } on Object catch (error) {
      debugPrint('[alerts] $error');
    }
  }

  Future<void> _warn(String? problem) async {
    if (problem == null) {
      _problem = null;
      return;
    }
    final now = _now();
    final minute = _minute(now);
    if (!_workday(now) || minute < workStartMinute || minute >= workEndMinute) {
      return;
    }
    final at = _problemAt;
    if (problem == _problem && at != null && now.difference(at) < repeatEvery) {
      return;
    }
    await _show(problemId, 'Joylashuv yuborilmayapti', problem);
    _problem = problem;
    _problemAt = now;
  }

  Future<void> _remindReport() async {
    final now = _now();
    final minute = _minute(now);
    if (!_workday(now) ||
        minute < reportFromMinute ||
        minute >= reportUntilMinute) {
      return;
    }
    final day =
        '${now.year}-${'${now.month}'.padLeft(2, '0')}-'
        '${'${now.day}'.padLeft(2, '0')}';
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getString(reportDayKey) == day) return;
    final checked = _reportCheckedAt;
    if (checked != null && now.difference(checked) < repeatEvery) return;
    _reportCheckedAt = now;

    final response = await _dio.get<dynamic>(
      '/daily-reports/my',
      queryParameters: const {'days': 1},
    );
    if (!_sentOn(response.data, day)) {
      await _show(
        reportId,
        'Kunlik hisobot',
        'Bugungi hisobot hali yuborilmadi — ishingizni yozib yuboring.',
      );
    }
    await prefs.setString(reportDayKey, day);
  }

  static bool _sentOn(Object? data, String day) =>
      data is List && data.any((r) => r is Map && r['day'] == day);
}

/// Qurilmadagi ovozli bildirishnoma.
class LocalAlertSender {
  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  bool _ready = false;

  Future<void> show(int id, String title, String body) async {
    if (!_ready) {
      await _plugin.initialize(
        const InitializationSettings(
          android: AndroidInitializationSettings('@drawable/ic_stat_notify'),
        ),
      );
      _ready = true;
    }
    await _plugin.show(
      id,
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'field_alerts',
          'Ish ogohlantirishlari',
          channelDescription: 'Joylashuv va kunlik hisobot eslatmalari',
          importance: Importance.max,
          priority: Priority.high,
        ),
      ),
    );
  }
}
