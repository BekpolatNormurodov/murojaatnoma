import 'dart:developer' as developer;

import 'package:dio/dio.dart';

/// So'rov/javoblarni konsolga log qiluvchi interceptor
/// (faqat debug rejimda foydali).
class LoggingInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    developer.log('-> ${options.method} ${options.uri}', name: 'DIO');
    if (options.data != null) {
      developer.log('   body: ${options.data}', name: 'DIO');
    }
    handler.next(options);
  }

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    developer.log(
      '<- ${response.statusCode} ${response.requestOptions.uri}',
      name: 'DIO',
    );
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    developer.log(
      'x ${err.response?.statusCode} ${err.requestOptions.uri} '
      '— ${err.message}',
      name: 'DIO',
      error: err,
    );
    handler.next(err);
  }
}
