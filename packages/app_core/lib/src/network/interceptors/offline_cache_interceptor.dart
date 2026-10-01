import 'dart:convert';

import 'package:app_core/src/network/cache/response_cache.dart';
import 'package:app_core/src/network/interceptors/retry_interceptor.dart';
import 'package:app_core/src/network/network_status.dart';
import 'package:dio/dio.dart';

/// GET javoblarini diskka yozadi va internet yo'q bo'lganda o'shani
/// qaytaradi — barcha ekranlar (murojaatlar, chat, oylik, yangiliklar…)
/// HAR BIRIGA alohida kod yozmasdan oflayn ochiladi.
///
/// Strategiya:
///  * Onlayn: tarmoq → muvaffaqiyatli javob keshga yoziladi.
///  * Tarmoq xatosi (timeout/ulanish): kesh bo'lsa — keshdagi javob
///    (`extra['fromCache']=true`, `extra['cachedAt']`).
///  * Allaqachon oflayn ([NetworkStatus.isOffline]) va kesh bor: 20 soniya
///    timeout kutmasdan DARHOL keshdan; probe internetni qaytarganda yana
///    tarmoqdan olinadi.
/// Kalit = metod + to'liq URL + foydalanuvchi (JWT `sub`) — boshqa
/// foydalanuvchining keshi hech qachon ko'rinmaydi.
/// `extra['noCache'] = true` — o'chirish.
class OfflineCacheInterceptor extends Interceptor {
  OfflineCacheInterceptor({ResponseCache? cache})
    : _cache = cache ?? ResponseCache.instance;

  final ResponseCache _cache;
  static const String _started = '__net_started__';

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    options.extra[_started] = DateTime.now().millisecondsSinceEpoch;
    if (_cacheable(options) &&
        !_isInnerRetry(options) &&
        NetworkStatus.instance.isOffline) {
      final cached = await _cache.read(_key(options));
      if (cached != null) {
        handler.resolve(_fromCache(options, cached), true);
        return;
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) async {
    if (response.extra['fromCache'] != true) {
      NetworkStatus.instance.reportSuccess(_elapsed(response.requestOptions));
      final status = response.statusCode ?? 0;
      if (_cacheable(response.requestOptions) &&
          status >= 200 &&
          status < 300) {
        await _cache.write(_key(response.requestOptions), response.data);
      }
    }
    handler.next(response);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response != null) {
      // Server javob berdi (4xx/5xx) — tarmoq bor.
      NetworkStatus.instance.reportSuccess(_elapsed(err.requestOptions));
    } else if (NetworkStatus.isConnectivityError(err)) {
      NetworkStatus.instance.reportFailure();
      // Ichki qayta urinishda keshga qaytmaymiz — RetryInterceptor barcha
      // urinishlarni tugatgach, tashqi so'rov shu yerga qayta keladi.
      if (_cacheable(err.requestOptions) &&
          !_isInnerRetry(err.requestOptions)) {
        final cached = await _cache.read(_key(err.requestOptions));
        if (cached != null) {
          handler.resolve(_fromCache(err.requestOptions, cached));
          return;
        }
      }
    }
    handler.next(err);
  }

  static bool _isInnerRetry(RequestOptions o) =>
      o.extra[RetryInterceptor.innerFlag] == true;

  bool _cacheable(RequestOptions o) =>
      o.method.toUpperCase() == 'GET' &&
      o.extra['noCache'] != true &&
      o.responseType == ResponseType.json;

  Duration _elapsed(RequestOptions o) {
    final started = o.extra[_started];
    if (started is! int) return Duration.zero;
    return Duration(
      milliseconds: DateTime.now().millisecondsSinceEpoch - started,
    );
  }

  Response<dynamic> _fromCache(RequestOptions o, CachedResponse cached) {
    return Response<dynamic>(
      requestOptions: o,
      data: cached.data,
      statusCode: 200,
      extra: {'fromCache': true, 'cachedAt': cached.savedAt},
    );
  }

  static String _key(RequestOptions o) =>
      '${o.method} ${o.uri} ${_subject(o.headers['Authorization'])}';

  /// JWT `sub` (token har 15 daqiqada yangilanadi — tokenning o'zi emas).
  static String _subject(Object? authHeader) {
    if (authHeader is! String || !authHeader.startsWith('Bearer ')) {
      return 'anon';
    }
    try {
      final parts = authHeader.substring(7).split('.');
      if (parts.length != 3) return 'anon';
      final payload = utf8.decode(
        base64Url.decode(base64Url.normalize(parts[1])),
      );
      final map = jsonDecode(payload) as Map<String, dynamic>;
      return (map['sub'] ?? 'anon').toString();
    } on Object {
      return 'anon';
    }
  }
}
