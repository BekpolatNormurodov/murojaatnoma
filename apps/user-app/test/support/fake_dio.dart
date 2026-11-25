import 'dart:convert';
import 'dart:typed_data';

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';

typedef FakeHandler = (int, Object?) Function(RequestOptions options);

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler, this.log);

  final FakeHandler handler;
  final List<RequestOptions> log;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    await requestStream?.drain<void>();
    log.add(options);
    final (status, body) = handler(options);
    return ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// Interceptorlarsiz `DioClient`, javoblar [handler]dan.
DioClient fakeDioClient(FakeHandler handler, [List<RequestOptions>? log]) {
  final client = DioClient();
  client.dio.interceptors.clear();
  client.dio.httpClientAdapter = _Adapter(handler, log ?? []);
  return client;
}
