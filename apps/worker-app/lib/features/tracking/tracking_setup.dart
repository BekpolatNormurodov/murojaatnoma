import 'package:app_core/app_core.dart';
import 'package:flutter/foundation.dart';
import 'package:worker_app/features/tracking/background_tracking.dart';
import 'package:worker_app/features/tracking/device_status.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';
import 'package:worker_app/injection.dart';

/// Android'da (real backend) mustaqil fon kuzatuvi va majburiy sozlash
/// ekranini yoqadi. Testlar va mock rejimda chaqirilmaydi.
void enableBackgroundTracking() {
  if (AppConfig.useMock || defaultTargetPlatform != TargetPlatform.android) {
    return;
  }
  ForegroundServiceTracking.configure();
  final probe = DeviceProbe();
  getIt<LocationTrackingService>().background = ForegroundServiceTracking();
  getIt.registerSingleton<DeviceStatusReporter>(
    DeviceStatusReporter(getIt<DioClient>().dio, probe),
  );
}
