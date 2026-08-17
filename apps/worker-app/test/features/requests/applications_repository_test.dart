import 'dart:convert';

import 'package:app_core/app_core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/requests/data/datasources/applications_remote_data_source.dart';
import 'package:worker_app/features/requests/data/repositories/applications_repository_impl.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';

/// Xotirada ishlaydigan soxta (fake) masofaviy manba. `*Error` maydonlari
/// orqali datasource (tarmoq/server) xatoliklarini simulyatsiya
/// qiladi — `attendance_repository_test.dart`dagi
/// `_FakeAttendanceRemoteDataSource`ning `checkInError`/`historyError`
/// uslubiga o'xshash.
class _FakeApplicationsRemoteDataSource
    implements ApplicationsRemoteDataSource {
  List<Application>? listResult;
  Application? getByIdResult;
  Application? respondResult;
  Application? rateResult;
  Exception? listError;
  Exception? getByIdError;
  Exception? respondError;
  Exception? rateError;

  @override
  Future<List<Application>> list({
    bool assignedOnly = false,
    ApplicationStatus? status,
    String? query,
  }) async {
    final err = listError;
    if (err != null) throw err;
    return listResult!;
  }

  @override
  Future<Application> getById(String id) async {
    final err = getByIdError;
    if (err != null) throw err;
    return getByIdResult!;
  }

  @override
  Future<Application> respond(String id, ApplicationResponse response) async {
    final err = respondError;
    if (err != null) throw err;
    return respondResult!;
  }

  @override
  Future<Application> rate(String id, int points) async {
    final err = rateError;
    if (err != null) throw err;
    return rateResult!;
  }
}

void main() {
  group(ApplicationsRepositoryImpl, () {
    late _FakeApplicationsRemoteDataSource remote;
    late ApplicationsRepositoryImpl subject;

    const app = Application(
      id: 'ARZ-2001',
      title: 'Sinov arizasi',
      description: 'Tavsif matni',
      category: 'Sinov',
      status: ApplicationStatus.yangi,
      priority: ApplicationPriority.orta,
      createdAt: '2026-07-24T08:00:00',
      assignedToMe: true,
      points: 0,
      citizenName: 'Fuqaro',
      citizenPhone: '+998 90 000 00 00',
    );

    const response = ApplicationResponse(
      text: 'Javob matni',
      attachments: [],
      respondedAt: '2026-07-24T09:00:00',
    );

    setUp(() {
      remote = _FakeApplicationsRemoteDataSource();
      subject = ApplicationsRepositoryImpl(remote: remote);
    });

    group('list', () {
      test('datasource success -> Right(List<Application>)', () async {
        remote.listResult = [app];

        final result = await subject.list();

        result.fold(
          (l) => fail('expected Right(List<Application>), got Left: $l'),
          (r) => expect(r, [app]),
        );
      });

      test(
        'datasource throws ServerException -> Left(ServerFailure) '
        'carrying its message',
        () async {
          remote.listError = ServerException('backend nosoz ishladi');

          final result = await subject.list();

          result.fold((l) {
            expect(l, isA<ServerFailure>());
            expect(l.message, 'backend nosoz ishladi');
          }, (r) => fail('expected Left(ServerFailure), got Right: $r'));
        },
      );

      test(
        'datasource throws a generic Exception -> Left(ServerFailure) '
        'via the fallback branch (never escapes uncaught)',
        () async {
          remote.listError = Exception('kutilmagan xato');

          final result = await subject.list();

          result.fold(
            (l) => expect(l, isA<ServerFailure>()),
            (r) => fail('expected Left(ServerFailure), got Right: $r'),
          );
        },
      );
    });

    group('respond', () {
      test('datasource success -> Right(Application)', () async {
        remote.respondResult = app;

        final result = await subject.respond(app.id, response);

        result.fold(
          (l) => fail('expected Right(Application), got Left: $l'),
          (r) => expect(r, app),
        );
      });

      test(
        'datasource throws ServerException -> Left(ServerFailure) '
        'carrying its message',
        () async {
          remote.respondError = ServerException('javob saqlanmadi');

          final result = await subject.respond(app.id, response);

          result.fold((l) {
            expect(l, isA<ServerFailure>());
            expect(l.message, 'javob saqlanmadi');
          }, (r) => fail('expected Left(ServerFailure), got Right: $r'));
        },
      );

      test(
        'datasource throws a generic Exception -> Left(ServerFailure) '
        'via the fallback branch (never escapes uncaught)',
        () async {
          remote.respondError = Exception('kutilmagan xato');

          final result = await subject.respond(app.id, response);

          result.fold(
            (l) => expect(l, isA<ServerFailure>()),
            (r) => fail('expected Left(ServerFailure), got Right: $r'),
          );
        },
      );
    });

    group('rate', () {
      test('datasource success -> Right(Application)', () async {
        remote.rateResult = app;

        final result = await subject.rate(app.id, 10);

        result.fold(
          (l) => fail('expected Right(Application), got Left: $l'),
          (r) => expect(r, app),
        );
      });

      test(
        'datasource throws ServerException -> Left(ServerFailure) '
        'carrying its message',
        () async {
          remote.rateError = ServerException('ball saqlanmadi');

          final result = await subject.rate(app.id, 10);

          result.fold((l) {
            expect(l, isA<ServerFailure>());
            expect(l.message, 'ball saqlanmadi');
          }, (r) => fail('expected Left(ServerFailure), got Right: $r'));
        },
      );

      test(
        'datasource throws a generic Exception -> Left(ServerFailure) '
        'via the fallback branch (never escapes uncaught)',
        () async {
          remote.rateError = Exception('kutilmagan xato');

          final result = await subject.rate(app.id, 10);

          result.fold(
            (l) => expect(l, isA<ServerFailure>()),
            (r) => fail('expected Left(ServerFailure), got Right: $r'),
          );
        },
      );
    });
  });

  group('Application JSON', () {
    test(
      'fromJson(toJson(x)) round-trips through real JSON encode/decode, '
      'preserving int-typed fields (points/size_bytes/duration_ms)',
      () {
        const original = Application(
          id: 'ARZ-9001',
          title: 'Test ariza',
          description: 'Tavsif',
          category: 'Sinov',
          status: ApplicationStatus.jarayonda,
          priority: ApplicationPriority.orta,
          createdAt: '2026-07-24T10:00:00',
          deadline: '2026-07-30',
          assignedToMe: true,
          points: 15,
          attachments: [
            AttachmentRef(
              type: AttachmentType.voice,
              path: '/tmp/a.m4a',
              name: 'a.m4a',
              sizeBytes: 2048,
              durationMs: 5000,
            ),
          ],
          response: ApplicationResponse(
            text: 'Javob matni',
            attachments: [],
            respondedAt: '2026-07-25T09:00:00',
          ),
          citizenName: 'Test Fuqaro',
          citizenPhone: '+998 90 000 00 00',
        );

        // Haqiqiy JSON kodlash/dekodlashdan o'tkazib, sonlar `int` sifatida
        // qaytishini ta'minlaydi (`dart:convert` butun sonlarni `int`
        // qilib dekodlaydi) — `(x as num).toInt()` xavfsizligini sinaydi.
        final jsonString = jsonEncode(original.toJson());
        final decodedMap = jsonDecode(jsonString) as Map<String, dynamic>;
        final rebuilt = Application.fromJson(decodedMap);

        expect(rebuilt, original);
        expect(decodedMap['points'], isA<int>());
        expect(rebuilt.points, 15);
        expect(rebuilt.attachments.single.sizeBytes, 2048);
        expect(rebuilt.attachments.single.durationMs, 5000);
        expect(rebuilt.response?.text, 'Javob matni');
      },
    );

    test(
      'fromJson handles null-safe optional fields and empty attachments',
      () {
        final json = <String, dynamic>{
          'id': 'ARZ-9002',
          'title': 'Boshqa ariza',
          'description': 'Tavsif',
          'category': 'Sinov',
          'status': 'yangi',
          'priority': 'past',
          'created_at': '2026-07-24',
          'deadline': null,
          'assigned_to_me': false,
          'points': 0,
          'attachments': <dynamic>[],
          'response': null,
          'citizen_name': 'Fuqaro',
          'citizen_phone': '+998 90 000 00 00',
        };

        final app = Application.fromJson(json);

        expect(app.deadline, isNull);
        expect(app.response, isNull);
        expect(app.attachments, isEmpty);
        expect(app.points, 0);
      },
    );
  });
}
