import 'dart:convert';

import 'package:app_core/app_core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/meetings/data/datasources/meetings_remote_data_source.dart';
import 'package:worker_app/features/meetings/data/repositories/meetings_repository_impl.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';

/// Xotirada ishlaydigan soxta (fake) masofaviy manba. `*Error` maydonlari
/// orqali datasource (tarmoq/server) xatoliklarini simulyatsiya
/// qiladi — `applications_repository_test.dart`dagi
/// `_FakeApplicationsRemoteDataSource`ning uslubiga o'xshash.
class _FakeMeetingsRemoteDataSource implements MeetingsRemoteDataSource {
  List<Meeting>? listResult;
  Meeting? getByIdResult;
  Meeting? joinResult;
  Exception? listError;
  Exception? getByIdError;
  Exception? joinError;

  @override
  Future<List<Meeting>> list({MeetingStatus? status}) async {
    final err = listError;
    if (err != null) throw err;
    return listResult!;
  }

  @override
  Future<Meeting> getById(String id) async {
    final err = getByIdError;
    if (err != null) throw err;
    return getByIdResult!;
  }

  @override
  Future<Meeting> join(String id) async {
    final err = joinError;
    if (err != null) throw err;
    return joinResult!;
  }
}

void main() {
  group(MeetingsRepositoryImpl, () {
    late _FakeMeetingsRemoteDataSource remote;
    late MeetingsRepositoryImpl subject;

    const meeting = Meeting(
      id: 'MTG-9001',
      title: 'Sinov majlisi',
      startAt: '2026-07-24T08:00:00',
      durationMin: 30,
      host: 'Sinov Xodim',
      participants: ['Sinov Xodim'],
      status: MeetingStatus.rejalashtirilgan,
    );

    setUp(() {
      remote = _FakeMeetingsRemoteDataSource();
      subject = MeetingsRepositoryImpl(remote: remote);
    });

    group('list', () {
      test('datasource success -> Right(List<Meeting>)', () async {
        remote.listResult = [meeting];

        final result = await subject.list();

        result.fold(
          (l) => fail('expected Right(List<Meeting>), got Left: $l'),
          (r) => expect(r, [meeting]),
        );
      });

      test('datasource throws ServerException -> Left(ServerFailure) '
          'carrying its message', () async {
        remote.listError = ServerException('backend nosoz ishladi');

        final result = await subject.list();

        result.fold((l) {
          expect(l, isA<ServerFailure>());
          expect(l.message, 'backend nosoz ishladi');
        }, (r) => fail('expected Left(ServerFailure), got Right: $r'));
      });

      test('datasource throws a generic Exception -> Left(ServerFailure) '
          'via the fallback branch (never escapes uncaught)', () async {
        remote.listError = Exception('kutilmagan xato');

        final result = await subject.list();

        result.fold(
          (l) => expect(l, isA<ServerFailure>()),
          (r) => fail('expected Left(ServerFailure), got Right: $r'),
        );
      });
    });

    group('getById', () {
      test('datasource success -> Right(Meeting)', () async {
        remote.getByIdResult = meeting;

        final result = await subject.getById(meeting.id);

        result.fold(
          (l) => fail('expected Right(Meeting), got Left: $l'),
          (r) => expect(r, meeting),
        );
      });

      test('datasource throws ServerException -> Left(ServerFailure) '
          'carrying its message', () async {
        remote.getByIdError = ServerException('majlis topilmadi');

        final result = await subject.getById(meeting.id);

        result.fold((l) {
          expect(l, isA<ServerFailure>());
          expect(l.message, 'majlis topilmadi');
        }, (r) => fail('expected Left(ServerFailure), got Right: $r'));
      });
    });

    group('join', () {
      test('datasource success -> Right(Meeting)', () async {
        remote.joinResult = meeting;

        final result = await subject.join(meeting.id);

        result.fold(
          (l) => fail('expected Right(Meeting), got Left: $l'),
          (r) => expect(r, meeting),
        );
      });

      test('datasource throws ServerException -> Left(ServerFailure) '
          'carrying its message', () async {
        remote.joinError = ServerException("majlisga qo'shilib bo'lmadi");

        final result = await subject.join(meeting.id);

        result.fold((l) {
          expect(l, isA<ServerFailure>());
          expect(l.message, "majlisga qo'shilib bo'lmadi");
        }, (r) => fail('expected Left(ServerFailure), got Right: $r'));
      });

      test('datasource throws a generic Exception -> Left(ServerFailure) '
          'via the fallback branch (never escapes uncaught)', () async {
        remote.joinError = Exception('kutilmagan xato');

        final result = await subject.join(meeting.id);

        result.fold(
          (l) => expect(l, isA<ServerFailure>()),
          (r) => fail('expected Left(ServerFailure), got Right: $r'),
        );
      });
    });
  });

  group('Meeting JSON', () {
    test('fromJson(toJson(x)) round-trips through real JSON encode/decode, '
        'preserving int-typed fields (duration_min)', () {
      const original = Meeting(
        id: 'MTG-9002',
        title: 'Test majlisi',
        description: 'Test tavsifi',
        startAt: '2026-07-24T10:00:00',
        durationMin: 45,
        host: 'Test Boshqaruvchi',
        participants: ['Test Xodim 1', 'Test Xodim 2'],
        status: MeetingStatus.jonli,
        joinUrl: 'https://meet.hokimiyat.uz/MTG-9002',
      );

      // Haqiqiy JSON kodlash/dekodlashdan o'tkazib, sonlar `int` sifatida
      // qaytishini ta'minlaydi (`dart:convert` butun sonlarni `int`
      // qilib dekodlaydi) — `(x as num).toInt()` xavfsizligini sinaydi.
      final jsonString = jsonEncode(original.toJson());
      final decodedMap = jsonDecode(jsonString) as Map<String, dynamic>;
      final rebuilt = Meeting.fromJson(decodedMap);

      expect(rebuilt, original);
      expect(decodedMap['duration_min'], isA<int>());
      expect(rebuilt.durationMin, 45);
      expect(rebuilt.participants, ['Test Xodim 1', 'Test Xodim 2']);
    });

    test('fromJson handles null-safe optional fields', () {
      final json = <String, dynamic>{
        'id': 'MTG-9003',
        'title': 'Boshqa majlis',
        'description': null,
        'start_at': '2026-07-24T11:00:00',
        'duration_min': 15,
        'host': 'Xodim',
        'participants': <dynamic>[],
        'status': 'tugagan',
        'join_url': null,
      };

      final meeting = Meeting.fromJson(json);

      expect(meeting.description, isNull);
      expect(meeting.joinUrl, isNull);
      expect(meeting.participants, isEmpty);
      expect(meeting.status, MeetingStatus.tugagan);
    });
  });
}
