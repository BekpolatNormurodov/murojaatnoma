import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/core/network/worker_auth_interceptor.dart';

import '../../support/fake_http.dart';

void main() {
  late SharedPreferences prefs;
  late int expiries;
  late StreamSubscription<void> sub;

  setUp(() async {
    SharedPreferences.setMockInitialValues({
      AuthInterceptor.tokenKey: 'old',
      AuthInterceptor.refreshTokenKey: 'r1',
    });
    prefs = await SharedPreferences.getInstance();
    expiries = 0;
    sub = WorkerAuthInterceptor.sessionExpired.listen((_) => expiries++);
  });

  tearDown(() => sub.cancel());

  /// API `old` tokenni 401 qiladi; refresh javobini [refresh] beradi.
  (Dio, FakeHttp) build(
    FutureOr<ResponseBody> Function(RequestOptions) refresh,
  ) {
    final http = FakeHttp((o) {
      if (o.path.contains('/auth/refresh')) return refresh(o);
      if (o.path.contains('/auth/logout')) return json(null);
      return o.headers['Authorization'] == 'Bearer new'
          ? json({'ok': true})
          : json({'message': 'expired'}, 401);
    });
    final dio = http.dio()
      ..interceptors.add(
        WorkerAuthInterceptor(
          bareDio: (_) => http.dio(),
          retryDelay: Duration.zero,
        ),
      );
    return (dio, http);
  }

  for (final status in [500, 502, 503, 429, 404]) {
    test('refresh $status keeps the session (no logout)', () async {
      final (dio, _) = build((_) => json({'message': 'x'}, status));
      await expectLater(dio.get<dynamic>('/x'), throwsA(isA<DioException>()));
      await pumpEventQueue();
      expect(prefs.getString(AuthInterceptor.tokenKey), 'old');
      expect(prefs.getString(AuthInterceptor.refreshTokenKey), 'r1');
      expect(expiries, 0);
    });
  }

  test('refresh 401 ends the session exactly once', () async {
    final (dio, _) = build((_) => json({'message': 'no'}, 401));
    await expectLater(dio.get<dynamic>('/x'), throwsA(isA<DioException>()));
    await pumpEventQueue();
    expect(prefs.getString(AuthInterceptor.tokenKey), isNull);
    expect(prefs.getString(AuthInterceptor.refreshTokenKey), isNull);
    expect(expiries, 1);
  });

  test('401 with only a refresh token left still announces expiry', () async {
    await prefs.remove(AuthInterceptor.tokenKey);
    final (dio, _) = build((_) => json({'message': 'no'}, 403));
    await expectLater(dio.get<dynamic>('/x'), throwsA(isA<DioException>()));
    await pumpEventQueue();
    expect(expiries, 1);
  });

  test('a multipart upload is re-sent after the refresh', () async {
    final (dio, http) = build(
      (_) => json({'accessToken': 'new', 'refreshToken': 'r2'}),
    );
    final response = await dio.post<dynamic>(
      '/uploads',
      data: FormData.fromMap({
        'file': MultipartFile.fromString('abc', filename: 'a.txt'),
      }),
    );
    expect(response.statusCode, 200);
    expect(prefs.getString(AuthInterceptor.refreshTokenKey), 'r2');
    expect(
      http.requests.where((r) => r.path.contains('/uploads')),
      hasLength(2),
    );
    expect(expiries, 0);
  });

  test('a refresh finishing after logout does not restore tokens', () async {
    final gate = Completer<void>();
    final (dio, http) = build((_) async {
      await gate.future;
      return json({'accessToken': 'new', 'refreshToken': 'r2'});
    });
    final pending = expectLater(
      dio.get<dynamic>('/x'),
      throwsA(isA<DioException>()),
    );
    await pumpEventQueue();
    // Logout.
    await prefs.remove(AuthInterceptor.tokenKey);
    await prefs.remove(AuthInterceptor.refreshTokenKey);
    gate.complete();
    await pending;
    await pumpEventQueue();
    expect(prefs.getString(AuthInterceptor.tokenKey), isNull);
    expect(prefs.getString(AuthInterceptor.refreshTokenKey), isNull);
    // The orphaned pair is revoked on the server.
    expect(
      http.requests.where((r) => r.path.contains('/auth/logout')),
      hasLength(1),
    );
  });

  test('install replaces the shared AuthInterceptor in place', () {
    final dio = Dio()..interceptors.add(AuthInterceptor());
    WorkerAuthInterceptor.install(dio);
    expect(dio.interceptors.whereType<AuthInterceptor>(), isEmpty);
    expect(dio.interceptors.whereType<WorkerAuthInterceptor>(), hasLength(1));
  });
}
