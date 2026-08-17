import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Har bir so'rovga `Authorization` sarlavhasini qo'shuvchi interceptor.
///
/// JWT token `SharedPreferences` ichida [tokenKey] kaliti ostida
/// saqlanadi.
class AuthInterceptor extends Interceptor {
  /// Token saqlanadigan `SharedPreferences` kaliti.
  static const String tokenKey = 'auth_token';

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(tokenKey);
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401) {
      // Token eskirgan — tozalash (real ilovada refresh qilinadi).
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(tokenKey);
    }
    handler.next(err);
  }
}
