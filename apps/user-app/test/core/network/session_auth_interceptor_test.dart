import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:user_app/core/network/session_auth_interceptor.dart';
import 'package:user_app/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:user_app/features/auth/data/repositories/auth_repository_impl.dart';

/// Soxta backend: access tokenlar va BIR MARTALIK refresh tokenlar.
class _Server implements HttpClientAdapter {
  String access = 'a2';
  String refresh = 'r1';
  int issued = 1;
  final log = <RequestOptions>[];
  final bodies = <String>[];

  /// Berilsa — refresh javobi shu tugaguncha kutadi.
  Completer<void>? refreshGate;

  /// Berilsa — `/slow` javobi shu tugaguncha kutadi.
  Completer<void>? slowGate;

  /// Refresh uchun majburiy status (masalan 500).
  int? refreshStatus;

  /// Berilsa — `/auth/logout` javobi shu tugaguncha kutadi.
  Completer<void>? logoutGate;

  /// `true` — refresh bajariladi, lekin javobi yo'qoladi.
  bool dropRefreshReply = false;

  /// Shu yo'l yangi token bilan ham 401 qaytaradi.
  String? alwaysDenied;

  int get refreshCalls => log.where((o) => o.path == '/auth/refresh').length;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final bytes = <int>[];
    await requestStream?.forEach(bytes.addAll);
    log.add(options);
    bodies.add(utf8.decode(bytes, allowMalformed: true));
    ResponseBody reply(int status, Object body) => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
    if (options.path == '/auth/logout') {
      await logoutGate?.future;
      return reply(200, {'ok': true});
    }
    if (options.path == '/auth/refresh') {
      final sent = (options.data as Map)['refreshToken'];
      await refreshGate?.future;
      final forced = refreshStatus;
      if (forced != null) return reply(forced, {'message': 'x'});
      if (dropRefreshReply) {
        throw DioException.connectionError(
          requestOptions: options,
          reason: 'lost',
        );
      }
      if (sent != refresh) return reply(401, {'message': 'spent'});
      issued++;
      access = 'a${issued + 1}';
      refresh = 'r$issued';
      return reply(201, {'accessToken': access, 'refreshToken': refresh});
    }
    final auth = options.headers['Authorization'];
    if (options.path == '/slow') await slowGate?.future;
    if (auth != 'Bearer $access' || options.path == alwaysDenied) {
      return reply(401, {'message': 'expired'});
    }
    return reply(200, {'ok': true});
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late _Server server;
  late DioClient client;
  late SessionAuthInterceptor interceptor;
  late SharedPreferences prefs;
  late int expirations;

  setUp(() async {
    // Saqlangan access token eskirgan (`a1`), server `a2`ni kutadi.
    SharedPreferences.setMockInitialValues({
      AuthInterceptor.tokenKey: 'a1',
      AuthInterceptor.refreshTokenKey: 'r1',
    });
    prefs = await SharedPreferences.getInstance();
    server = _Server();
    client = DioClient();
    client.dio.httpClientAdapter = server;
    client.dio.interceptors.removeWhere((i) => i is LogInterceptor);
    interceptor = SessionAuthInterceptor.install(client);
    expirations = 0;
    interceptor.sessionExpired.listen((_) => expirations++);
  });

  Future<void> settle() =>
      Future<void>.delayed(const Duration(milliseconds: 20));

  test('replaces the shared AuthInterceptor in place', () {
    expect(client.dio.interceptors.whereType<AuthInterceptor>(), isEmpty);
    expect(SessionAuthInterceptor.of(client), same(interceptor));
  });

  test('parallel 401s share one refresh and persist the new token', () async {
    final responses = await Future.wait([
      client.dio.get<dynamic>('/applications'),
      client.dio.get<dynamic>('/notifications/citizen'),
      client.dio.post<dynamic>('/applications', data: {'a': 1}),
    ]);

    expect(responses.map((r) => r.statusCode), everyElement(200));
    expect(server.refreshCalls, 1);
    expect(prefs.getString(AuthInterceptor.tokenKey), server.access);
    expect(prefs.getString(AuthInterceptor.refreshTokenKey), 'r2');
    expect(expirations, 0);
  });

  test('the next expiry spends the rotated token, not the old one', () async {
    await client.dio.get<dynamic>('/applications');
    server.access = 'later';
    // Server yangi access beradi; r2 yuborilmasa 401 bo'lardi.
    await client.dio.get<dynamic>('/applications');

    expect(server.refreshCalls, 2);
    expect(prefs.getString(AuthInterceptor.refreshTokenKey), 'r3');
  });

  test('a late 401 reuses the already renewed token', () async {
    server.slowGate = Completer<void>();
    final slow = client.dio.get<dynamic>('/slow');
    await settle();
    await client.dio.get<dynamic>('/applications');
    server.slowGate!.complete();

    expect((await slow).statusCode, 200);
    expect(server.refreshCalls, 1);
  });

  test('an upload hit by 401 is re-sent with its whole body', () async {
    final dir = await Directory.systemTemp.createTemp('up');
    addTearDown(() => dir.delete(recursive: true));
    final file = File('${dir.path}/a.jpg')..writeAsStringSync('PHOTO-BYTES');
    Future<Response<dynamic>> upload() async => client.dio.post<dynamic>(
      '/applications/1/attachments/upload',
      data: FormData.fromMap({
        'file': await MultipartFile.fromFile(file.path, filename: 'a.jpg'),
      }),
    );

    final responses = await Future.wait([upload(), upload()]);

    expect(responses.map((r) => r.statusCode), everyElement(200));
    expect(server.refreshCalls, 1);
    final uploads = [
      for (var i = 0; i < server.log.length; i++)
        if (server.log[i].path.endsWith('upload')) server.bodies[i],
    ];
    expect(uploads, hasLength(4));
    expect(uploads, everyElement(contains('PHOTO-BYTES')));
  });

  test('401 even with the renewed token ends the session', () async {
    server.alwaysDenied = '/applications';
    await expectLater(
      client.dio.get<dynamic>('/applications', options: _noCache),
      throwsA(isA<DioException>()),
    );
    await settle();

    expect(server.refreshCalls, 1);
    expect(server.log.where((o) => o.path == '/applications'), hasLength(2));
    expect(expirations, 1);
  });

  test('a request without a token neither refreshes nor expires', () async {
    await prefs.remove(AuthInterceptor.tokenKey);
    await expectLater(
      client.dio.get<dynamic>('/applications', options: _noCache),
      throwsA(isA<DioException>()),
    );
    await settle();

    expect(server.refreshCalls, 0);
    expect(expirations, 0);
  });

  test('a rejected refresh token ends the session once', () async {
    server.refresh = 'someone-else';
    await Future.wait([
      for (var i = 0; i < 3; i++)
        expectLater(
          client.dio.get<dynamic>('/applications'),
          throwsA(isA<DioException>()),
        ),
    ]);
    await settle();

    expect(expirations, 1);
    expect(prefs.getString(AuthInterceptor.tokenKey), isNull);
    expect(prefs.getString(AuthInterceptor.refreshTokenKey), isNull);
  });

  test('a server error during refresh keeps the citizen signed in', () async {
    server.refreshStatus = 500;
    await expectLater(
      client.dio.get<dynamic>('/applications', options: _noCache),
      throwsA(
        isA<DioException>().having(
          (e) => e.type,
          'type',
          DioExceptionType.connectionError,
        ),
      ),
    );
    await settle();

    expect(expirations, 0);
    expect(prefs.getString(AuthInterceptor.refreshTokenKey), 'r1');
  });

  test('a 401 from before logout does not touch the new session', () async {
    server.slowGate = Completer<void>();
    final stale = client.dio.get<dynamic>('/slow', options: _noCache);
    final staleResult = expectLater(stale, throwsA(isA<DioException>()));
    await settle();

    // Chiqish va boshqa fuqaroning kirishi.
    interceptor.newSession();
    await prefs.setString(AuthInterceptor.tokenKey, 'other-access');
    await prefs.setString(AuthInterceptor.refreshTokenKey, 'other-refresh');
    server.slowGate!.complete();
    await staleResult;
    await settle();

    expect(server.refreshCalls, 0);
    expect(server.log.where((o) => o.path == '/slow'), hasLength(1));
    expect(expirations, 0);
    expect(prefs.getString(AuthInterceptor.tokenKey), 'other-access');
    expect(prefs.getString(AuthInterceptor.refreshTokenKey), 'other-refresh');
  });

  test('a refresh finishing after logout does not revive it', () async {
    server.refreshGate = Completer<void>();
    final repository = AuthRepositoryImpl(
      remote: AuthRemoteDataSourceMockImpl(),
      prefs: prefs,
      client: client,
    );
    final request = expectLater(
      client.dio.get<dynamic>('/applications', options: _noCache),
      throwsA(isA<DioException>()),
    );
    await settle();
    await repository.logout();
    server.refreshGate!.complete();
    await request;
    await settle();

    expect(prefs.getString(AuthInterceptor.tokenKey), isNull);
    expect(prefs.getString(AuthInterceptor.refreshTokenKey), isNull);
    expect(expirations, 0);
    // Server bergan yangi juftlik ham bekor qilindi.
    final revoked = server.log
        .where((o) => o.path == '/auth/logout')
        .map((o) => (o.data as Map)['refreshToken']);
    expect(revoked, containsAll(<String>['r1', 'r2']));
  });

  test('a 401 while logout is waiting does not rotate the token', () async {
    server.logoutGate = Completer<void>();
    final repository = AuthRepositoryImpl(
      remote: AuthRemoteDataSourceMockImpl(),
      prefs: prefs,
      client: client,
    );
    final signOut = repository.logout();
    await settle();
    await expectLater(
      client.dio.get<dynamic>('/applications', options: _noCache),
      throwsA(isA<DioException>()),
    );
    server.logoutGate!.complete();
    await signOut;
    await settle();

    expect(server.refreshCalls, 0);
    expect(expirations, 0);
    expect(prefs.getString(AuthInterceptor.refreshTokenKey), isNull);
  });

  test('a lost refresh reply is retried with the same key after a restart',
      () async {
    server.dropRefreshReply = true;
    await expectLater(
      client.dio.get<dynamic>('/applications', options: _noCache),
      throwsA(isA<DioException>()),
    );
    // Ilova qayta ishga tushdi: yangi mijoz va interceptor.
    final restarted = DioClient();
    restarted.dio.httpClientAdapter = server;
    SessionAuthInterceptor.install(restarted);
    server.dropRefreshReply = false;
    await restarted.dio.get<dynamic>('/applications', options: _noCache);

    final keys = server.log
        .where((o) => o.path == '/auth/refresh')
        .map((o) => o.headers[IdempotencyInterceptor.header])
        .toSet();
    expect(keys, hasLength(1));
    expect(prefs.getString(AuthInterceptor.refreshTokenKey), 'r2');
  });
}

final _noCache = Options(extra: {'noCache': true});
