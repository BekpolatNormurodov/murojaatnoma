import 'dart:convert';

import 'package:battery_plus/battery_plus.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';

/// Telefonning joylashuv yubora olish holati.
@immutable
class DeviceStatus {
  const DeviceStatus({
    required this.gpsEnabled,
    required this.permission,
    required this.batteryExempt,
    this.battery,
    this.appVersion,
    this.device,
  });

  /// `always` | `whileInUse` | `denied`.
  static const String always = 'always';
  static const String whileInUse = 'whileInUse';
  static const String denied = 'denied';

  final bool gpsEnabled;
  final String permission;
  final bool batteryExempt;
  final int? battery;
  final String? appVersion;
  final String? device;

  /// Uzluksiz kuzatuv uchun hamma shart bajarilgan.
  bool get ready => gpsEnabled && permission == always && batteryExempt;

  /// Xodimga ko'rsatiladigan birinchi muammo; hammasi joyida bo'lsa `null`.
  String? get problem {
    if (!gpsEnabled) return 'GPS o‘chiq — yoqing';
    if (permission == denied) return 'Joylashuvga ruxsat bering';
    if (permission != always) return 'Joylashuvga «Doim» ruxsat bering';
    if (!batteryExempt) return 'Batareya cheklovini olib tashlang';
    return null;
  }

  Map<String, dynamic> toJson({required bool tracking}) => {
    'gpsEnabled': gpsEnabled,
    'permission': permission,
    'batteryExempt': batteryExempt,
    'tracking': tracking,
    if (battery != null) 'battery': battery,
    if (appVersion != null) 'appVersion': appVersion,
    if (device != null) 'device': device,
  };
}

/// Holatni qurilmadan o'qiydi (hech qachon ruxsat oynasi ochmaydi).
class DeviceProbe {
  String? _appVersion;
  String? _device;

  Future<DeviceStatus> read() async {
    final permission = await Geolocator.checkPermission();
    return DeviceStatus(
      gpsEnabled: await Geolocator.isLocationServiceEnabled(),
      permission: switch (permission) {
        LocationPermission.always => DeviceStatus.always,
        LocationPermission.whileInUse => DeviceStatus.whileInUse,
        _ => DeviceStatus.denied,
      },
      batteryExempt: await Permission.ignoreBatteryOptimizations.isGranted,
      battery: await batteryLevel(),
      appVersion: _appVersion ??= await _readVersion(),
      device: _device ??= await _readDevice(),
    );
  }

  Future<int?> batteryLevel() async {
    try {
      final level = await Battery().batteryLevel;
      return level >= 0 && level <= 100 ? level : null;
    } on Object {
      return null;
    }
  }

  Future<String?> _readVersion() async {
    try {
      final info = await PackageInfo.fromPlatform();
      return '${info.version}+${info.buildNumber}';
    } on Object {
      return null;
    }
  }

  Future<String?> _readDevice() async {
    try {
      if (defaultTargetPlatform != TargetPlatform.android) return null;
      final info = await DeviceInfoPlugin().androidInfo;
      final name =
          '${info.manufacturer} ${info.model} (Android ${info.version.release})';
      return name.length > 120 ? name.substring(0, 120) : name;
    } on Object {
      return null;
    }
  }
}

/// Holatni `POST /locations/device-status`ga yuboradi — o'zgarganda darhol,
/// o'zgarmasa [every] oralig'ida.
class DeviceStatusReporter {
  DeviceStatusReporter(
    this._dio,
    this._probe, {
    this.every = const Duration(minutes: 5),
    DateTime Function() now = DateTime.now,
  }) : _now = now;

  final Dio _dio;
  final DeviceProbe _probe;
  final Duration every;
  final DateTime Function() _now;

  String? _sent;
  DateTime? _sentAt;

  /// O'qilgan holatni qaytaradi; o'qib bo'lmasa `null`. Hech qachon throw
  /// qilmaydi.
  Future<DeviceStatus?> report({required bool tracking}) async {
    final DeviceStatus status;
    try {
      status = await _probe.read();
    } on Object catch (error) {
      debugPrint('[device-status] read: $error');
      return null;
    }
    // Batareya foizi har safar o'zgaradi — "o'zgarish" hisoblanmaydi.
    final signature = jsonEncode(
      status.toJson(tracking: tracking)..remove('battery'),
    );
    final at = _sentAt;
    if (signature == _sent && at != null && _now().difference(at) < every) {
      return status;
    }
    try {
      await _dio.post<dynamic>(
        '/locations/device-status',
        data: status.toJson(tracking: tracking),
      );
      _sent = signature;
      _sentAt = _now();
    } on Object catch (error) {
      debugPrint('[device-status] send: $error');
    }
    return status;
  }
}
