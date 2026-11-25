import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Refresh urinishining natijasi.
enum _Refresh { refreshed, rejected, unavailable, superseded }

/// Xodim ilovasining auth interceptor'i (umumiy [AuthInterceptor] o'rnida).
///
/// Farqlari:
///  * sessiya FAQAT `/auth/refresh` 400/401/403 qaytarsa tugaydi — backend
///    qayta ishga tushayotganda (502/503/500/429) xodim chiqarib
///    yuborilmaydi;
///  * refresh'dan keyin `FormData` klonlanib qayta yuboriladi (yuklashlar);
///  * logout paytida tugagan refresh eski xodim tokenlarini "tiriltirmaydi";
///  * [sessionExpired] access YOKI refresh token mavjud bo'lsa xabar beradi.
class WorkerAuthInterceptor extends Interceptor {
  WorkerAuthInterceptor({
    Dio Function(String baseUrl)? bareDio,
    this.retryDelay = const Duration(milliseconds: 700),
  }) : _bareDio = bareDio ?? _defaultBareDio;

  final Dio Function(String baseUrl) _bareDio;
  final Duration retryDelay;

  static const String _retriedFlag = '__auth_retried__';

  /// Tugallanmagan refresh'ning idempotentlik kaliti: `[token izi, kalit]`.
  static const String refreshAttemptKey = 'auth_refresh_attempt_v1';

  static final StreamController<void> _expired =
      StreamController<void>.broadcast();

  /// Server sessiyani RAD ETDI — ilova login ekraniga o'tishi kerak.
  static Stream<void> get sessionExpired => _expired.stream;

  Future<_Refresh>? _refreshing;

  /// [dio]dagi umumiy [AuthInterceptor]ni shu sinf bilan almashtiradi
  /// (tartib saqlanadi).
  static void install(Dio dio, {WorkerAuthInterceptor? interceptor}) {
    final replacement = interceptor ?? WorkerAuthInterceptor();
    final index = dio.interceptors.indexWhere((i) => i is AuthInterceptor);
    if (index < 0) {
      dio.interceptors.insert(0, replacement);
    } else {
      dio.interceptors[index] = replacement;
    }
  }

  static Dio _defaultBareDio(String baseUrl) => Dio(
    BaseOptions(
      baseUrl: baseUrl,
      contentType: 'application/json',
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
    ),
  );

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(AuthInterceptor.tokenKey);
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  static bool _isAuthEndpoint(String path) =>
      path.contains('/auth/refresh') ||
      path.contains('/auth/logout') ||
      path.contains('login');

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final options = err.requestOptions;
    if (err.response?.statusCode != 401 || _isAuthEndpoint(options.path)) {
      handler.next(err);
      return;
    }
    if (options.extra[_retriedFlag] == true) {
      await _expire();
      handler.next(err);
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    final refreshToken = prefs.getString(AuthInterceptor.refreshTokenKey);
    if (refreshToken == null || refreshToken.isEmpty) {
      await _expire();
      handler.next(err);
      return;
    }

    final outcome = await (_refreshing ??= _performRefresh(
      options.baseUrl,
      refreshToken,
    ).whenComplete(() => _refreshing = null));

    if (outcome == _Refresh.rejected) {
      // Faqat rad etilgan token HALI saqlangan bo'lsa (logout/yangi login
      // oradan o'tmagan bo'lsa) sessiyani tugatamiz.
      if (prefs.getString(AuthInterceptor.refreshTokenKey) == refreshToken) {
        await _expire();
      }
      handler.next(err);
      return;
    }
    final access = prefs.getString(AuthInterceptor.tokenKey);
    if (outcome != _Refresh.refreshed || access == null) {
      handler.next(err);
      return;
    }

    try {
      options.headers['Authorization'] = 'Bearer $access';
      options.extra[_retriedFlag] = true;
      final data = options.data;
      // Bir marta yuborilgan `FormData`ni qayta yuborib bo'lmaydi.
      if (data is FormData) options.data = data.clone();
      final retried = await _bareDio(options.baseUrl).fetch<dynamic>(options);
      handler.resolve(retried);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) await _expire();
      handler.next(e);
    } on Object catch (e) {
      debugPrint('[auth] retry after refresh failed: $e');
      handler.next(err);
    }
  }

  Future<_Refresh> _performRefresh(String baseUrl, String refreshToken) async {
    final bare = _bareDio(baseUrl);
    // Bir xil kalit bilan qayta urinish: javob yo'qolsa server o'sha yangi
    // juftlikni qaytaradi.
    final key = await _attemptKey(refreshToken);
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        final res = await bare.post<dynamic>(
          '/auth/refresh',
          data: {'refreshToken': refreshToken},
          options: Options(headers: {IdempotencyInterceptor.header: key}),
        );
        final data = res.data;
        if (data is! Map) return _Refresh.unavailable;
        final access = data['accessToken'];
        final next = data['refreshToken'];
        if (access is! String || access.isEmpty) return _Refresh.unavailable;
        final prefs = await SharedPreferences.getInstance();
        if (prefs.getString(AuthInterceptor.refreshTokenKey) != refreshToken) {
          // Oradan logout / boshqa login o'tdi — yangi juftlikni saqlamaymiz
          // va serverda bekor qilamiz.
          if (next is String) unawaited(_revoke(bare, next));
          return _Refresh.superseded;
        }
        await prefs.setString(AuthInterceptor.tokenKey, access);
        if (next is String && next.isNotEmpty) {
          await prefs.setString(AuthInterceptor.refreshTokenKey, next);
        }
        await prefs.remove(refreshAttemptKey);
        return _Refresh.refreshed;
      } on DioException catch (e) {
        final status = e.response?.statusCode;
        if (status == 400 || status == 401 || status == 403) {
          return _Refresh.rejected;
        }
        if (e.response != null || !NetworkStatus.isConnectivityError(e)) {
          return _Refresh.unavailable;
        }
        await Future<void>.delayed(retryDelay * (attempt + 1));
      } on Object {
        return _Refresh.unavailable;
      }
    }
    return _Refresh.unavailable;
  }

  /// Shu refresh token uchun saqlangan kalit (bo'lmasa yangisi). Javob
  /// yo'qolib, urinishlar tugasa yoki ilova yopilsa ham keyingi urinish
  /// AYNAN shu kalit bilan ketadi — aks holda server allaqachon almashtirilgan
  /// tokenni rad etib, xodim tizimdan chiqib qolardi.
  Future<String> _attemptKey(String refreshToken) async {
    final prefs = await SharedPreferences.getInstance();
    // JWT imzosining oxiri — tokenning o'zini ikkinchi marta saqlamaymiz.
    final mark = refreshToken.length > 24
        ? refreshToken.substring(refreshToken.length - 24)
        : refreshToken;
    final saved = prefs.getStringList(refreshAttemptKey);
    if (saved != null && saved.length == 2 && saved[0] == mark) {
      return saved[1];
    }
    final key = IdempotencyInterceptor.newKey();
    await prefs.setStringList(refreshAttemptKey, [mark, key]);
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

  Future<void> _expire() async {
    final prefs = await SharedPreferences.getInstance();
    final had =
        prefs.getString(AuthInterceptor.tokenKey) != null ||
        prefs.getString(AuthInterceptor.refreshTokenKey) != null;
    await prefs.remove(AuthInterceptor.tokenKey);
    await prefs.remove(AuthInterceptor.refreshTokenKey);
    await prefs.remove(refreshAttemptKey);
    if (had) _expired.add(null);
  }
}
