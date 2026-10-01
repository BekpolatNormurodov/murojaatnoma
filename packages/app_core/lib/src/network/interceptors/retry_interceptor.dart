import 'dart:math';

import 'package:app_core/src/network/interceptors/idempotency_interceptor.dart';
import 'package:app_core/src/network/network_status.dart';
import 'package:dio/dio.dart';

/// Vaqtinchalik tarmoq/server xatolarida so'rovni avtomatik qayta yuboradi
/// (eksponensial kutish + jitter): 0.8s → 2s → 4.5s.
///
/// Qayta yuboriladi:
///  * GET/HEAD — doim (o'qish xavfsiz);
///  * yozuvlar — faqat `Idempotency-Key` bo'lsa (server takrorni bir marta
///    bajaradi) va tana qayta yuborilishi mumkin bo'lsa (FormData klonlanadi).
/// Sabablar: timeout, ulanish xatosi, 408/429/502/503/504.
/// `extra['noRetry'] = true` — o'chirish.
class RetryInterceptor extends Interceptor {
  RetryInterceptor(this._dio, {this.maxRetries = 3});

  final Dio _dio;
  final int maxRetries;

  /// Ichki (qayta) urinish belgisi — boshqa interceptorlar ham tekshiradi.
  static const String innerFlag = '__retry_inner__';
  static const String _inner = innerFlag;
  static const List<Duration> _delays = [
    Duration(milliseconds: 800),
    Duration(seconds: 2),
    Duration(milliseconds: 4500),
  ];
  static final Random _rng = Random();

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final options = err.requestOptions;
    // Ichki (qayta) urinishlarning xatosini tashqi tsikl o'zi boshqaradi.
    if (options.extra[_inner] == true ||
        options.extra['noRetry'] == true ||
        !_retryable(err)) {
      handler.next(err);
      return;
    }

    var last = err;
    for (var attempt = 0; attempt < maxRetries; attempt++) {
      await Future<void>.delayed(_delayFor(attempt, last));
      final retryOptions = _cloneForRetry(options);
      if (retryOptions == null) break;
      try {
        final response = await _dio.fetch<dynamic>(retryOptions);
        handler.resolve(response);
        return;
      } on DioException catch (e) {
        last = e;
        if (!_retryable(e)) break;
      }
    }
    // Pass on the last error but with the ORIGINAL request options: the
    // inner attempt's options carry the retry flag, and the offline-cache
    // fallback downstream deliberately ignores inner attempts.
    handler.next(last.copyWith(requestOptions: options));
  }

  bool _retryable(DioException e) {
    final method = e.requestOptions.method.toUpperCase();
    final isRead = method == 'GET' || method == 'HEAD';
    final hasKey = e.requestOptions.headers.containsKey(
      IdempotencyInterceptor.header,
    );
    if (!isRead && !hasKey) return false;
    if (NetworkStatus.isConnectivityError(e)) return true;
    final status = e.response?.statusCode;
    return status == 408 ||
        status == 429 ||
        status == 502 ||
        status == 503 ||
        status == 504;
  }

  Duration _delayFor(int attempt, DioException e) {
    // 429/503: server "Retry-After" desa — unga amal qilamiz (≤10s).
    final retryAfter = int.tryParse(
      e.response?.headers.value('retry-after') ?? '',
    );
    if (retryAfter != null && retryAfter > 0) {
      return Duration(seconds: min(retryAfter, 10));
    }
    final base = _delays[min(attempt, _delays.length - 1)];
    final jitter = 0.8 + _rng.nextDouble() * 0.4; // ±20%
    return base * jitter;
  }

  RequestOptions? _cloneForRetry(RequestOptions o) {
    Object? data = o.data;
    if (data is FormData) {
      data = data.clone();
    } else if (data is Stream) {
      return null; // oqimni qayta yuborib bo'lmaydi
    }
    return o.copyWith(data: data, extra: {...o.extra, _inner: true});
  }
}
