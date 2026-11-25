import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// `app_core`dagi [AuthInterceptor] o'rnini bosuvchi fuqaro interceptor'i.
///
/// Backend refresh tokenni BIR MARTALIK qilgan (har yangilanishda yangisi
/// beriladi), shuning uchun:
///  * yangilash yagona (single-flight): parallel 401'lar — fayl yuklash ham —
///    bitta `POST /auth/refresh`ni kutadi; kechikib kelgan 401 allaqachon
///    yangilangan token bilan shunchaki qayta yuboriladi;
///  * yangi `refreshToken` doim saqlanadi (access tokendan oldin);
///  * har so'rov o'zi boshlangan SESSIYA raqami bilan belgilanadi. Chiqish
///    yoki yangi kirishdan oldin boshlangan so'rovning 401'i yangi sessiyani
///    o'chirmaydi, uning tokeni bilan qayta yuborilmaydi va kechikib kelgan
///    refresh javobi o'chirilgan sessiyani "tiriltirmaydi";
///  * multipart tana qayta yuborishdan oldin klonlanadi;
///  * faqat server tokenni RAD ETSA (400/401/403) sessiya tugaydi — tarmoq
///    xatosi yoki 5xx/429 fuqaroni tizimdan chiqarmaydi.
class SessionAuthInterceptor extends Interceptor {
  SessionAuthInterceptor(
    this._dio, {
    Duration retryDelay = const Duration(milliseconds: 700),
  }) : _retryDelay = retryDelay;

  /// [client]dagi umumiy [AuthInterceptor]ni shu interceptor bilan
  /// almashtiradi (tartib saqlanadi) va uni qaytaradi.
  static SessionAuthInterceptor install(DioClient client) {
    final interceptors = client.dio.interceptors;
    final replacement = SessionAuthInterceptor(client.dio);
    final index = interceptors.indexWhere((i) => i is AuthInterceptor);
    if (index < 0) {
      interceptors.add(replacement);
    } else {
      interceptors[index] = replacement;
    }
    return replacement;
  }

  /// [client]ga o'rnatilgan interceptor (bo'lmasa `null`).
  static SessionAuthInterceptor? of(DioClient client) =>
      client.dio.interceptors.whereType<SessionAuthInterceptor>().firstOrNull;

  static const _sessionFlag = '__session__';
  static const _retriedFlag = '__session_retried__';

  final Dio _dio;
  final Duration _retryDelay;
  final _expired = StreamController<void>.broadcast();

  int _session = 0;
  Future<_Refresh>? _refreshing;
  String? _refreshingToken;

  bool _closing = false;

  /// Javobi yo'qolgan refresh keyingi safar — ilova qayta ishga tushgandan
  /// keyin ham — XUDDI SHU kalit bilan yuboriladi: server o'sha yangi
  /// juftlikni qayta beradi (token allaqachon sarflangan).
  static const _attemptKey = 'auth_refresh_attempt';

  /// Server sessiyani rad etdi — ilova login ekraniga o'tishi kerak.
  Stream<void> get sessionExpired => _expired.stream;

  /// Kirish/chiqish chegarasi: bundan oldin boshlangan so'rovlar eskirgan.
  void newSession() => _session++;

  /// Chiqishni o'rab oladi: [signOut] davomida (server javobi ≤5 s) ham,
  /// undan keyin ham eski token yangilanmaydi va sessiya "tiriltirilmaydi".
  Future<void> endSession(Future<void> Function() signOut) async {
    newSession();
    _closing = true;
    try {
      await signOut();
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_attemptKey);
    } finally {
      newSession();
      _closing = false;
    }
  }

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Birinchi `await`dan OLDIN: so'rov qaysi sessiyada boshlangani.
    final stamp = options.extra.putIfAbsent(_sessionFlag, () => _session);
    final prefs = await SharedPreferences.getInstance();
    if (stamp != _session) {
      // Eski sessiya so'rovining qayta urinishi yangi tokenni olmasin.
      handler.reject(
        DioException(
          requestOptions: options,
          type: DioExceptionType.cancel,
          message: 'session ended',
        ),
        true,
      );
      return;
    }
    final token = prefs.getString(AuthInterceptor.tokenKey);
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    } else {
      options.headers.remove('Authorization');
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final options = err.requestOptions;
    final sent = options.headers['Authorization'];
    if (_closing ||
        err.response?.statusCode != 401 ||
        options.path.startsWith('/auth/') ||
        sent is! String ||
        options.extra[_sessionFlag] != _session) {
      handler.next(err);
      return;
    }

    final session = _session;
    final prefs = await SharedPreferences.getInstance();
    final access = prefs.getString(AuthInterceptor.tokenKey);
    if (session != _session || access == null || access.isEmpty) {
      handler.next(err);
      return;
    }

    if (sent == 'Bearer $access') {
      final refreshToken = prefs.getString(AuthInterceptor.refreshTokenKey);
      // Yangi token bilan ham 401 — sessiya haqiqatan tugagan.
      if (options.extra[_retriedFlag] == true ||
          refreshToken == null ||
          refreshToken.isEmpty) {
        await _expire(prefs);
        handler.next(err);
        return;
      }
      final result = await _singleFlight(
        options.baseUrl,
        refreshToken,
        session,
      );
      if (session != _session) {
        handler.next(err);
        return;
      }
      switch (result) {
        case _Refresh.renewed:
          break;
        case _Refresh.rejected:
          final stored = prefs.getString(AuthInterceptor.refreshTokenKey);
          if (stored == refreshToken) await _expire(prefs);
          // Tokenlar o'chirilgan (parallel so'rov sessiyani yopgan) —
          // tokensiz qayta yuborishdan foyda yo'q.
          if (!prefs.containsKey(AuthInterceptor.tokenKey)) {
            handler.next(err);
            return;
          }
        case _Refresh.unavailable:
          // Sessiya hali haqiqiy — "ruxsat yo'q" emas, aloqa xatosi.
          options.extra['noRetry'] = true;
          handler.next(
            DioException(
              requestOptions: options,
              type: DioExceptionType.connectionError,
              message: 'session refresh unavailable',
            ),
          );
          return;
      }
    }

    if (options.extra[_retriedFlag] == true) {
      handler.next(err);
      return;
    }
    final data = options.data;
    if (data is Stream) {
      handler.next(err); // oqimni qayta yuborib bo'lmaydi
      return;
    }
    try {
      final retry = options.copyWith(
        data: data is FormData ? data.clone() : data,
        headers: {...options.headers},
        extra: {
          ...options.extra,
          _retriedFlag: true,
          // Qayta urinish/kesh qarorini tashqi so'rov qabul qiladi.
          RetryInterceptor.innerFlag: true,
        },
      );
      handler.resolve(await _dio.fetch<dynamic>(retry));
    } on DioException catch (e) {
      handler.next(e.copyWith(requestOptions: options));
    } on Object {
      handler.next(err); // masalan, yuklanayotgan fayl o'chib ketgan
    }
  }

  Future<void> _expire(SharedPreferences prefs) async {
    final had = prefs.containsKey(AuthInterceptor.tokenKey);
    // Ikkalasi ham xotiradan darhol o'chadi (orada `await` yo'q).
    final removals = [
      prefs.remove(AuthInterceptor.tokenKey),
      prefs.remove(AuthInterceptor.refreshTokenKey),
    ];
    if (had) _expired.add(null);
    await Future.wait(removals);
  }

  Future<_Refresh> _singleFlight(String baseUrl, String token, int session) {
    final running = _refreshing;
    if (running != null && _refreshingToken == token) return running;
    _refreshingToken = token;
    late final Future<_Refresh> started;
    started = _refresh(baseUrl, token, session).whenComplete(() {
      if (identical(_refreshing, started)) _refreshing = null;
    });
    return _refreshing = started;
  }

  Future<_Refresh> _refresh(String baseUrl, String token, int session) async {
    final key = await _refreshKey(token);
    // Interceptorlarsiz Dio — rekursiya bo'lmasin.
    final bare = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        contentType: 'application/json',
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 20),
        headers: {IdempotencyInterceptor.header: key},
      ),
    )..httpClientAdapter = _dio.httpClientAdapter;

    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        final res = await bare.post<dynamic>(
          '/auth/refresh',
          data: {'refreshToken': token},
        );
        final data = res.data;
        if (data is! Map) return _Refresh.unavailable;
        final access = data['accessToken'];
        final next = data['refreshToken'];
        if (access is! String || access.isEmpty) return _Refresh.unavailable;
        final prefs = await SharedPreferences.getInstance();
        if (session != _session ||
            prefs.getString(AuthInterceptor.refreshTokenKey) != token) {
          // Orada chiqildi/qayta kirildi: yangi juftlik kerak emas.
          if (next is String) unawaited(_revoke(bare, next));
          return _Refresh.rejected;
        }
        // Tekshiruv va yozish orasida `await` yo'q. Avval refresh token:
        // ilova shu yerda yopilsa ham sarflangan token qolib ketmaydi.
        await Future.wait([
          if (next is String && next.isNotEmpty)
            prefs.setString(AuthInterceptor.refreshTokenKey, next),
          prefs.setString(AuthInterceptor.tokenKey, access),
        ]);
        return _Refresh.renewed;
      } on DioException catch (e) {
        final status = e.response?.statusCode;
        if (status == 400 || status == 401 || status == 403) {
          return _Refresh.rejected;
        }
        final transient =
            NetworkStatus.isConnectivityError(e) ||
            status == 502 ||
            status == 503 ||
            status == 504;
        if (!transient || attempt == 2) return _Refresh.unavailable;
        await Future<void>.delayed(_retryDelay * (attempt + 1));
      } on Object {
        return _Refresh.unavailable;
      }
    }
    return _Refresh.unavailable;
  }

  /// [token] uchun `Idempotency-Key` — so'rovdan OLDIN diskka yoziladi.
  Future<String> _refreshKey(String token) async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_attemptKey)?.split('\n');
    if (saved != null && saved.length == 2 && saved[1] == token) {
      return saved[0];
    }
    final key = IdempotencyInterceptor.newKey();
    await prefs.setString(_attemptKey, '$key\n$token');
    return key;
  }

  Future<void> _revoke(Dio bare, String refreshToken) async {
    try {
      await bare.post<dynamic>(
        '/auth/logout',
        data: {'refreshToken': refreshToken},
      );
    } on Object {
      // best-effort
    }
  }
}

enum _Refresh { renewed, rejected, unavailable }
