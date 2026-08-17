import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Xodim joylashuvini serverga UZLUKSIZ yuboradi (`POST /locations`) va
/// internet yo'q paytda hisobotlarni qurilmada saqlab turadi (outbox), aloqa
/// tiklanganda ularni `POST /locations/batch` orqali oqizib yuboradi.
///
/// Faqat foreground kuzatuv (geolocator position stream). [start] ni bir necha
/// bor chaqirish xavfsiz — allaqachon ishlayotgan bo'lsa hech nima qilmaydi.
class LocationTrackingService {
  LocationTrackingService(this._dio);

  final Dio _dio;

  static const String _outboxKey = 'location_outbox_v1';
  static const int _distanceFilterMeters = 15;
  static const int _maxBuffer = 500;
  static const Duration _flushInterval = Duration(seconds: 30);

  StreamSubscription<Position>? _positionSub;
  Timer? _flushTimer;
  bool _running = false;
  Object? _lastError;

  bool get isRunning => _running;

  /// Oxirgi kuzatilgan xato (diagnostika uchun).
  Object? get lastError => _lastError;

  /// Ruxsatni tekshiradi/so'raydi va joylashuv oqimini boshlaydi. Joylashuv
  /// xizmati yoki ruxsat mavjud bo'lmasa `false` qaytaradi.
  Future<bool> start() async {
    if (_running) return true;
    if (!await _ensurePermission()) return false;

    _running = true;
    _positionSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: _distanceFilterMeters,
      ),
    ).listen(
      _onPosition,
      onError: (Object error) {
        _lastError = error;
      },
      cancelOnError: false,
    );

    _flushTimer = Timer.periodic(_flushInterval, (_) => _flushOutbox());

    // Birinchi hisobotni darhol yuboramiz — admin xaritasi harakatni
    // kutmasdan yonadi.
    unawaited(_reportCurrent());

    return true;
  }

  Future<void> stop() async {
    _running = false;
    await _positionSub?.cancel();
    _positionSub = null;
    _flushTimer?.cancel();
    _flushTimer = null;
  }

  Future<void> _reportCurrent() async {
    try {
      final current = await Geolocator.getCurrentPosition();
      await _onPosition(current);
    } on Object catch (error) {
      _lastError = error;
    }
  }

  Future<bool> _ensurePermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  Future<void> _onPosition(Position position) async {
    final report = _toReport(position);
    try {
      await _dio.post<dynamic>('/locations', data: report);
      // Muvaffaqiyatli yuborish = onlayn bo'ldik — bufernikini oqizamiz.
      await _flushOutbox();
    } on Object catch (error) {
      _lastError = error;
      await _enqueue(report);
    }
  }

  Map<String, dynamic> _toReport(Position p) {
    return <String, dynamic>{
      'latitude': p.latitude,
      'longitude': p.longitude,
      'accuracy': p.accuracy,
      if (p.speed >= 0) 'speed': p.speed,
      if (p.heading >= 0) 'heading': p.heading,
      'source': 'FOREGROUND',
      'recordedAt': p.timestamp.toUtc().toIso8601String(),
    };
  }

  Future<void> _enqueue(Map<String, dynamic> report) async {
    final prefs = await SharedPreferences.getInstance();
    final buffer = (prefs.getStringList(_outboxKey) ?? <String>[])
      ..add(jsonEncode(report));
    while (buffer.length > _maxBuffer) {
      buffer.removeAt(0);
    }
    await prefs.setStringList(_outboxKey, buffer);
  }

  Future<void> _flushOutbox() async {
    final prefs = await SharedPreferences.getInstance();
    final buffer = prefs.getStringList(_outboxKey) ?? <String>[];
    if (buffer.isEmpty) return;

    final items = buffer
        .map((e) => jsonDecode(e) as Map<String, dynamic>)
        .toList(growable: false);
    try {
      await _dio.post<dynamic>(
        '/locations/batch',
        data: <String, dynamic>{'items': items},
      );
      await prefs.remove(_outboxKey);
    } on Object catch (error) {
      // Hali offline — buferni keyingi urinish uchun saqlab qolamiz.
      _lastError = error;
    }
  }
}
