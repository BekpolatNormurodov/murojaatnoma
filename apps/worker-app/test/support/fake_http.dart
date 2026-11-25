import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// Tarmoqsiz Dio adapteri: har so'rov [handler]ga beriladi.
class FakeHttp implements HttpClientAdapter {
  FakeHttp(this.handler);

  FutureOr<ResponseBody> Function(RequestOptions options) handler;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    // Tana to'liq o'qiladi (FormData bir martagina yuboriladi).
    await requestStream?.drain<void>();
    return handler(options);
  }

  @override
  void close({bool force = false}) {}

  Dio dio() =>
      Dio(BaseOptions(baseUrl: 'http://test.local/api'))
        ..httpClientAdapter = this;
}

ResponseBody json(Object? body, [int status = 200]) => ResponseBody.fromString(
  jsonEncode(body),
  status,
  headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  },
);

ResponseBody offline(RequestOptions options) => throw DioException(
  requestOptions: options,
  type: DioExceptionType.connectionError,
);
