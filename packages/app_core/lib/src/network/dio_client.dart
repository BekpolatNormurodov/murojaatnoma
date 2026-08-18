import 'package:app_core/src/config/app_config.dart';
import 'package:app_core/src/network/interceptors/auth_interceptor.dart';
import 'package:app_core/src/network/interceptors/friendly_error_interceptor.dart';
import 'package:app_core/src/network/interceptors/logging_interceptor.dart';
import 'package:dio/dio.dart';

/// Markazlashtirilgan Dio mijozi. `baseUrl` [AppConfig.apiBaseUrl] dan
/// olinadi.
class DioClient {
  DioClient() {
    dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 20),
        contentType: 'application/json',
      ),
    );

    // FriendlyErrorInterceptor OXIRIDA: Logging xom xatoni loglab bo'lgach,
    // foydalanuvchiga boradigan `message`ni toza o'zbekcha matnga almashtiradi
    // (hech bir ekranda xom Dio/exception matni ko'rinmaydi).
    dio.interceptors.addAll([
      AuthInterceptor(),
      LoggingInterceptor(),
      FriendlyErrorInterceptor(),
    ]);
  }

  /// Konfiguratsiya qilingan Dio nusxasi.
  late final Dio dio;
}
