import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Scripted adapter: each call pops the next behaviour.
class _ScriptAdapter implements HttpClientAdapter {
  _ScriptAdapter(this.script);
  final List<Object> script; // ResponseBody | DioExceptionType
  final List<RequestOptions> seen = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    seen.add(options);
    final next = script.isEmpty ? DioExceptionType.connectionError : script.removeAt(0);
    if (next is DioExceptionType) {
      throw DioException(requestOptions: options, type: next, error: const SocketException('down'));
    }
    return next as ResponseBody;
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(Object body, [int status = 200]) => ResponseBody.fromString(
  jsonEncode(body),
  status,
  headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  },
);

Dio _dio(_ScriptAdapter adapter, ResponseCache cache) {
  final dio = Dio(BaseOptions(baseUrl: 'https://api.test'))
    ..httpClientAdapter = adapter;
  dio.interceptors.addAll([
    IdempotencyInterceptor(),
    RetryInterceptor(dio),
    OfflineCacheInterceptor(cache: cache),
  ]);
  return dio;
}

void main() {
  // No TestWidgetsFlutterBinding: it fakes every HttpClient call as a 400,
  // which would hide real connection failures from the refresh test.
  late Directory tmp;
  late ResponseCache cache;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    tmp = Directory.systemTemp.createTempSync('rc');
    cache = ResponseCache(directory: tmp);
    NetworkStatus.instance.reportSuccess(Duration.zero);
  });
  tearDown(() => tmp.deleteSync(recursive: true));

  test('GET is retried through transient failures and succeeds', () async {
    final adapter = _ScriptAdapter([
      DioExceptionType.connectionTimeout,
      DioExceptionType.connectionError,
      _json({'ok': true}),
    ]);
    final res = await _dio(adapter, cache).get<dynamic>('/items');
    expect(res.data, {'ok': true});
    expect(adapter.seen, hasLength(3));
  });

  test('a write is retried with the SAME Idempotency-Key', () async {
    final adapter = _ScriptAdapter([
      DioExceptionType.receiveTimeout,
      _json({'id': 'm1'}, 201),
    ]);
    await _dio(adapter, cache).post<dynamic>('/messages', data: {'t': 'hi'});
    final keys = adapter.seen.map((o) => o.headers[IdempotencyInterceptor.header]).toSet();
    expect(adapter.seen, hasLength(2));
    expect(keys, hasLength(1));
    expect(keys.single, isNotNull);
  });

  test('offline: GET falls back to the last cached response', () async {
    final online = _ScriptAdapter([_json([1, 2, 3])]);
    await _dio(online, cache).get<dynamic>('/requests');

    final offline = _ScriptAdapter([]); // every call: connectionError
    final res = await _dio(offline, cache).get<dynamic>('/requests');
    expect(res.data, [1, 2, 3]);
    expect(res.extra['fromCache'], isTrue);
    expect(NetworkStatus.instance.isOffline, isTrue);
  });

  test('4xx is not retried and not served from cache', () async {
    final adapter = _ScriptAdapter([_json({'message': 'yo‘q'}, 404)]);
    await expectLater(
      _dio(adapter, cache).get<dynamic>('/missing'),
      throwsA(isA<DioException>()),
    );
    expect(adapter.seen, hasLength(1));
  });

  test('a 401 whose refresh fails on the NETWORK keeps the tokens', () async {
    SharedPreferences.setMockInitialValues({
      AuthInterceptor.tokenKey: 'old-access',
      AuthInterceptor.refreshTokenKey: 'rt',
    });
    final dio = Dio(BaseOptions(baseUrl: 'http://127.0.0.1:9')) // nothing listens
      ..httpClientAdapter = _ScriptAdapter([_json({'message': 'exp'}, 401)]);
    dio.interceptors.add(AuthInterceptor());
    await expectLater(dio.get<dynamic>('/me'), throwsA(isA<DioException>()));
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString(AuthInterceptor.tokenKey), 'old-access');
    expect(prefs.getString(AuthInterceptor.refreshTokenKey), 'rt');
  }, timeout: const Timeout(Duration(seconds: 60)));
}
