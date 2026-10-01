import 'dart:math';

import 'package:dio/dio.dart';

/// Har yozuv so'roviga (POST/PUT/PATCH/DELETE) noyob `Idempotency-Key`
/// qo'shadi. [RetryInterceptor] qayta yuborganda XUDDI SHU kalit ketadi —
/// backend (`IdempotencyInterceptor`) bir xil kalitli so'rovni bir marta
/// bajaradi. Shu tufayli sekin internetda "yuborildimi?" noaniqligida qayta
/// urinish ikkinchi murojaat/xabar/keldi yaratmaydi.
class IdempotencyInterceptor extends Interceptor {
  static const String header = 'Idempotency-Key';
  static final Random _rng = Random.secure();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    const writes = {'POST', 'PUT', 'PATCH', 'DELETE'};
    if (writes.contains(options.method.toUpperCase()) &&
        !options.headers.containsKey(header)) {
      options.headers[header] = newKey();
    }
    handler.next(options);
  }

  /// UUID v4 shaklidagi tasodifiy kalit.
  static String newKey() {
    final b = List<int>.generate(16, (_) => _rng.nextInt(256));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    String hex(int i) => b[i].toRadixString(16).padLeft(2, '0');
    final s = List.generate(16, hex).join();
    return '${s.substring(0, 8)}-${s.substring(8, 12)}-${s.substring(12, 16)}-'
        '${s.substring(16, 20)}-${s.substring(20)}';
  }
}
