import 'package:app_core/src/config/app_config.dart';
import 'package:app_core/src/network/interceptors/auth_interceptor.dart';
import 'package:app_core/src/network/interceptors/idempotency_interceptor.dart';
import 'package:app_core/src/network/interceptors/offline_cache_interceptor.dart';
import 'package:app_core/src/network/interceptors/retry_interceptor.dart';
import 'package:app_core/src/network/network_status.dart';
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
        // Sekin mobil internet: ulanish 15s, javob 30s, yuklash (rasm/ovoz)
        // 90s. Qisqa vaqtinchalik uzilishlarni RetryInterceptor yopadi.
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(seconds: 90),
        contentType: 'application/json',
      ),
    );
    NetworkStatus.instance.configure(baseUrl: AppConfig.apiBaseUrl);

    // TARTIB MUHIM:
    //  1. Idempotency — har yozuvga kalit (retry'larda o'sha kalit).
    //  2. Auth — token; 401 → refresh (tarmoq xatosida logout QILMAYDI).
    //  3. Retry — vaqtinchalik xatoda qayta urinish (avval qayta urinamiz…)
    //  4. OfflineCache — …so'ng baribir o'tmasa keshdagi javob; holat
    //     (online/sekin/oflayn) shu yerda yangilanadi.
    //  5. Logging, 6. FriendlyError — xom xato o'rniga o'zbekcha matn.
    dio.interceptors.addAll([
      IdempotencyInterceptor(),
      AuthInterceptor(),
      RetryInterceptor(dio),
      OfflineCacheInterceptor(),
      LoggingInterceptor(),
      FriendlyErrorInterceptor(),
    ]);
  }

  late final Dio dio;
}
