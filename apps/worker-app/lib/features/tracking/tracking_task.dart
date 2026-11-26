import 'dart:async';
import 'dart:ui';

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/core/network/worker_auth_interceptor.dart';
import 'package:worker_app/features/tracking/background_tracking.dart';
import 'package:worker_app/features/tracking/device_status.dart';
import 'package:worker_app/features/tracking/field_alerts.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';

/// Fon xizmatining kirish nuqtasi — alohida isolate'da chaqiriladi.
@pragma('vm:entry-point')
void startTrackingTask() {
  FlutterForegroundTask.setTaskHandler(TrackingTaskHandler());
}

/// Fon isolate'ida kuzatuvni yuritadi: GPS oqimi, oflayn bufer, tokenni
/// yangilash va telefon holatini serverga bildirish.
class TrackingTaskHandler extends TaskHandler {
  LocationTrackingService? _tracking;
  DeviceStatusReporter? _status;
  FieldAlerts? _alerts;
  String? _owner;
  String? _notificationText;
  bool _busy = false;

  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    WidgetsFlutterBinding.ensureInitialized();
    DartPluginRegistrant.ensureInitialized();
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final base = prefs.getString(ForegroundServiceTracking.apiBaseKey);
    if (base == null) {
      await FlutterForegroundTask.stopService();
      return;
    }
    final dio = Dio(
      BaseOptions(
        baseUrl: base,
        contentType: 'application/json',
        connectTimeout: const Duration(seconds: 15),
        sendTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 20),
      ),
    );
    // Sessiya tugaganini ASOSIY ilova hal qiladi — fon xizmati tokenlarni
    // o'chirmaydi, aks holda ilova "kirgan, lekin tokensiz" qolardi.
    dio.interceptors.add(WorkerAuthInterceptor(clearOnExpire: false));
    final probe = DeviceProbe();
    _status = DeviceStatusReporter(dio, probe);
    _alerts = FieldAlerts(dio, LocalAlertSender().show);
    _tracking = LocationTrackingService(
      dio,
      ownerId: () => _owner,
      batteryLevel: probe.batteryLevel,
      // Doimiy bildirishnomani shu xizmatning o'zi ko'rsatadi.
      ownNotification: false,
      source: 'BACKGROUND',
    );
    await _check();
  }

  @override
  void onRepeatEvent(DateTime timestamp) => unawaited(_check());

  /// Egasi borligini, oqim tirikligini va telefon holatini tekshiradi.
  Future<void> _check() async {
    final tracking = _tracking;
    if (tracking == null || _busy) return;
    _busy = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.reload();
      _owner = prefs.getString(ForegroundServiceTracking.ownerKey);
      if (_owner == null ||
          prefs.getString(AuthInterceptor.refreshTokenKey) == null) {
        await tracking.stop();
        await FlutterForegroundTask.stopService();
        return;
      }
      // GPS o'chirib yoqilgan yoki ruxsat qaytarilgan bo'lsa shu yerda
      // tiklanadi; ishlayotgan bo'lsa hech nima qilmaydi.
      await tracking.start(prompt: false);
      final status = await _status?.report(tracking: tracking.isRunning);
      await _notify(status?.problem ?? ForegroundServiceTracking.runningText);
      await _alerts?.check(problem: status?.problem);
    } on Object catch (error) {
      debugPrint('[tracking-task] $error');
    } finally {
      _busy = false;
    }
  }

  Future<void> _notify(String text) async {
    if (text == _notificationText) return;
    _notificationText = text;
    await FlutterForegroundTask.updateService(
      notificationTitle: ForegroundServiceTracking.title,
      notificationText: text,
      notificationIcon: ForegroundServiceTracking.icon,
    );
  }

  @override
  Future<void> onDestroy(DateTime timestamp, bool isTimeout) async {
    await _tracking?.stop();
  }
}
