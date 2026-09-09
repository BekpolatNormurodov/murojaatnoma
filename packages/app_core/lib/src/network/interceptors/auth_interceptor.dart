import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Har bir so'rovga `Authorization` sarlavhasini qo'shuvchi interceptor va
/// 401'da access tokenni AVTOMATIK yangilovchi (refresh) mexanizm.
///
/// Access token qisqa umrli (backend'da ~15 daqiqa). Ilgari 401 kelganda
/// token shunchaki o'chirilar edi — foydalanuvchi 15 daqiqada bir
/// "Unauthorized" holatiga tushardi. Endi 401'da saqlangan refresh token bilan
/// `POST
/// /auth/refresh` chaqiriladi, yangi juftlik saqlanadi va ASL so'rov qayta
/// yuboriladi. Faqat refresh token ham yaroqsiz bo'lsagina tokenlar tozalanadi.
///
/// Tokenlar `SharedPreferences`da saqlanadi: access — [tokenKey], refresh —
/// [refreshTokenKey] (ilova qatlamidagi repozitoriy login/verify paytida yozadi).
class AuthInterceptor extends Interceptor {
  /// Access token saqlanadigan `SharedPreferences` kaliti.
  static const String tokenKey = 'auth_token';

  /// Refresh token saqlanadigan `SharedPreferences` kaliti.
  static const String refreshTokenKey = 'auth_refresh_token';

  /// Cheksiz sikldan himoya — qayta yuborilgan so'rov belgisi.
  static const String _retriedFlag = '__auth_retried__';

  /// Bir vaqtning o'zida faqat BITTA refresh bajariladi — parallel 401'lar shu
  /// Future'ni baham ko'radi (refresh token rotatsiya qilingani uchun uni ikki
  /// marta ishlatib bo'lmaydi).
  Future<String?>? _refreshing;

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
    final options = err.requestOptions;
    final isAuthRefresh = options.path.contains('/auth/refresh');
    final alreadyRetried = options.extra[_retriedFlag] == true;

    // 401 EMAS — yoki refresh so'rovining o'zi, yoki qayta urinilgan.
    final is401 = err.response?.statusCode == 401;
    if (!is401 || isAuthRefresh || alreadyRetried) {
      if (is401 && (isAuthRefresh || alreadyRetried)) {
        // Refresh ham 401 qaytardi — sessiya haqiqatan tugagan.
        await _clearTokens();
      }
      handler.next(err);
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    final refreshToken = prefs.getString(refreshTokenKey);
    if (refreshToken == null || refreshToken.isEmpty) {
      await _clearTokens();
      handler.next(err);
      return;
    }

    // Yangi access token olamiz (bir vaqtda faqat bitta refresh).
    final newAccess = await (_refreshing ??=
        _performRefresh(options.baseUrl, refreshToken)
            .whenComplete(() => _refreshing = null));

    if (newAccess == null || newAccess.isEmpty) {
      await _clearTokens();
      handler.next(err);
      return;
    }

    // Asl so'rovni yangi token bilan qayta yuboramiz (interceptorlarsiz Dio —
    // rekursiyani oldini olish uchun).
    try {
      options.headers['Authorization'] = 'Bearer $newAccess';
      options.extra[_retriedFlag] = true;
      final retryDio = Dio(BaseOptions(baseUrl: options.baseUrl));
      final retried = await retryDio.fetch<dynamic>(options);
      handler.resolve(retried);
    } on DioException catch (e) {
      handler.next(e);
    } on Object {
      handler.next(err);
    }
  }

  /// `POST /auth/refresh` — yangi juftlikni oladi, `SharedPreferences`ga
  /// saqlaydi va yangi access tokenni qaytaradi (har qanday xatoda `null`).
  Future<String?> _performRefresh(String baseUrl, String refreshToken) async {
    try {
      final bare = Dio(
        BaseOptions(baseUrl: baseUrl, contentType: 'application/json'),
      );
      final res = await bare.post<dynamic>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final data = res.data;
      if (data is! Map) return null;
      final access = data['accessToken'] as String?;
      final newRefresh = data['refreshToken'] as String?;
      if (access == null || access.isEmpty) return null;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(tokenKey, access);
      if (newRefresh != null && newRefresh.isNotEmpty) {
        await prefs.setString(refreshTokenKey, newRefresh);
      }
      return access;
    } on Object {
      return null;
    }
  }

  Future<void> _clearTokens() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(tokenKey);
    await prefs.remove(refreshTokenKey);
  }
}
