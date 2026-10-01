import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Ilovaning REAL internet holati — telefonning Wi-Fi/mobil belgisi emas,
/// balki API'ga haqiqiy so'rovlar natijasi asosida.
enum NetworkQuality {
  /// So'rovlar normal ishlayapti.
  online,

  /// Ishlayapti, lekin juda sekin (javob > [NetworkStatus.slowThreshold]).
  slow,

  /// Oxirgi so'rovlar ulanish xatosi bilan tugadi — server yetib bo'lmaydi.
  offline,
}

/// Global tarmoq holati (singleton). Interceptorlar har javob/xatoda
/// [reportSuccess]/[reportFailure] chaqiradi; UI ([NetworkBanner]) va
/// offline kesh shu holatga qaraydi.
///
/// Oflayn bo'lganda har [_probeInterval]da `/health`ga yengil so'rov
/// yuboradi — internet qaytishi bilan avtomatik `online`ga o'tadi va
/// [onReconnect] tinglovchilari (chat outbox, ro'yxatlarni yangilash) ishga
/// tushadi.
class NetworkStatus {
  NetworkStatus._();

  /// Yagona instansiya.
  static final NetworkStatus instance = NetworkStatus._();

  /// Shundan sekin javob — "sekin internet".
  static const Duration slowThreshold = Duration(milliseconds: 3500);
  static const Duration _probeInterval = Duration(seconds: 8);

  /// Joriy holat (UI uchun).
  final ValueNotifier<NetworkQuality> quality = ValueNotifier<NetworkQuality>(
    NetworkQuality.online,
  );

  final StreamController<void> _reconnects = StreamController.broadcast();

  /// `offline` → `online`/`slow` o'tishida bir marta signal beradi.
  Stream<void> get onReconnect => _reconnects.stream;

  /// Server bilan bog'lanib bo'lmayaptimi.
  bool get isOffline => quality.value == NetworkQuality.offline;

  String? _probeBaseUrl;
  Timer? _probeTimer;
  int _slowStreak = 0;

  /// Probe uchun API manzili (`DioClient` o'rnatadi).
  // ignore: use_setters_to_change_properties
  void configure({required String baseUrl}) => _probeBaseUrl = baseUrl;

  /// Muvaffaqiyatli javob (har qanday HTTP status — server yetib bordi).
  void reportSuccess(Duration latency) {
    final wasOffline = isOffline;
    if (latency > slowThreshold) {
      _slowStreak++;
    } else {
      _slowStreak = 0;
    }
    // Bitta sekin javob emas — ketma-ket 2 tasi "sekin" degani.
    _set(_slowStreak >= 2 ? NetworkQuality.slow : NetworkQuality.online);
    if (wasOffline) {
      _stopProbe();
      _reconnects.add(null);
    }
  }

  /// Ulanish darajasidagi xato (timeout / DNS / socket).
  void reportFailure() {
    _set(NetworkQuality.offline);
    _startProbe();
  }

  void _set(NetworkQuality q) {
    if (quality.value != q) quality.value = q;
  }

  void _startProbe() {
    if (_probeTimer != null || _probeBaseUrl == null) return;
    final probe = Dio(
      BaseOptions(
        baseUrl: _probeBaseUrl!,
        connectTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
      ),
    );
    _probeTimer = Timer.periodic(_probeInterval, (_) async {
      final sw = Stopwatch()..start();
      try {
        await probe.get<dynamic>('/health');
        reportSuccess(sw.elapsed);
      } on DioException catch (e) {
        if (e.response != null) reportSuccess(sw.elapsed);
      } on Object {
        // still offline
      }
    });
  }

  void _stopProbe() {
    _probeTimer?.cancel();
    _probeTimer = null;
  }

  /// Xato ulanish darajasidami (server javobi YO'Q) — offline belgisi.
  static bool isConnectivityError(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.connectionError:
        return true;
      case DioExceptionType.unknown:
        return e.response == null && e.error != null;
      // ignore: no_default_cases
      default:
        return false;
    }
  }
}
