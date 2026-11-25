import 'package:app_core/app_core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/features/registration/data/datasources/registration_local_data_source.dart';
import 'package:user_app/features/registration/data/repositories/registration_repository_impl.dart';
import 'package:user_app/features/requests/data/datasources/citizen_requests_remote_data_source.dart';

import '../../support/app_harness.dart';
import '../../support/fake_dio.dart';

class _NoProfile implements RegistrationLocalDataSource {
  @override
  dynamic noSuchMethod(Invocation invocation) => Future<void>.value();
}

CitizenRequestsApiImpl _source(FakeHandler handler) => CitizenRequestsApiImpl(
  fakeDioClient(handler),
  authRepository: FakeAuthRepository(),
  registrationRepository: RegistrationRepositoryImpl(local: _NoProfile()),
);

const _application = <String, Object?>{
  'id': 'app1',
  'subject': '[ARIZA|Kommunal] Chiroq',
  'description': 'Chiroq yonmayapti',
  'status': 'NEW',
  'createdAt': '2026-11-20T05:30:00.000Z',
};

void main() {
  test('the list response names the assignee without any history', () async {
    // `FakeAuthRepository` sessiyasiz — telefon bo'yicha filtr o'chiq.
    final source = _source(
      (_) => (
        200,
        {
          'data': [
            {
              ..._application,
              'assignedEmployee': {
                'id': 'e1',
                'fullName': 'Karimov Anvar',
                'avatarUrl': null,
              },
            },
          ],
          'total': 1,
          'page': 1,
          'limit': 100,
        },
      ),
    );

    final request = (await source.list()).single;

    expect(request.assigneeName, 'Karimov Anvar');
  });

  test('assigning to a department does not name the admin', () async {
    final source = _source(
      (o) => switch (o.path) {
        '/applications/app1' => (200, _application),
        '/applications/app1/events' => (
          200,
          [
            {
              'type': 'ASSIGNED',
              'createdAt': '2026-11-21T05:30:00.000Z',
              'actorName': 'Admin Adminov',
              'toEmployeeName': null,
              'departmentName': 'Kommunal',
            },
          ],
        ),
        _ => (200, <Object?>[]),
      },
    );

    expect((await source.getById('app1')).assigneeName, isNull);
  });

  test('a missing murojaat is reported in Uzbek', () async {
    final source = _source(
      (_) => (404, {'message': 'Application x not found'}),
    );

    await expectLater(
      source.getById('x'),
      throwsA(
        isA<ServerException>().having(
          (e) => e.message,
          'message',
          'Murojaat topilmadi',
        ),
      ),
    );
  });
}
