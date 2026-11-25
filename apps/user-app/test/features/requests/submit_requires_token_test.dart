import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/features/news/data/datasources/news_remote_data_source.dart';
import 'package:user_app/features/registration/data/datasources/registration_local_data_source.dart';
import 'package:user_app/features/registration/data/repositories/registration_repository_impl.dart';
import 'package:user_app/features/requests/data/datasources/citizen_requests_remote_data_source.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';

import '../../support/app_harness.dart';
import '../../support/fake_dio.dart';

class _NoProfile implements RegistrationLocalDataSource {
  @override
  dynamic noSuchMethod(Invocation invocation) => Future<void>.value();
}

void main() {
  test('POST /applications is never sent without a session', () async {
    final log = <RequestOptions>[];
    final source = CitizenRequestsApiImpl(
      fakeDioClient((_) => (201, <String, Object?>{}), log),
      authRepository: FakeAuthRepository(),
      registrationRepository: RegistrationRepositoryImpl(local: _NoProfile()),
    );

    await expectLater(
      source.submit(
        const CitizenRequest(
          id: '',
          kind: RequestKind.ariza,
          category: 'c',
          title: 't',
          body: 'b',
          status: RequestStatus.yuborilgan,
          createdAt: '2026-11-25T00:00:00',
        ),
      ),
      throwsA(isA<ServerException>()),
    );
    expect(log, isEmpty);
  });

  test('news: the real GET /news response (bare array) is parsed', () async {
    // Shakli backend `NewsItem` modeliga mos.
    final source = NewsApiImpl(
      fakeDioClient(
        (_) => (
          200,
          [
            {
              'id': 'n1',
              'title': 'Sarlavha',
              'excerpt': 'Qisqa',
              'body': 'Matn',
              'category': 'ogohlantirish',
              'status': 'published',
              'cover': 'https://example.invalid/c.jpg',
              'author': 'Matbuot xizmati',
              'publishedAt': '2026-11-20T05:30:00.000Z',
              'views': 12,
              'featured': true,
            },
          ],
        ),
      ),
    );

    final item = (await source.list()).single;

    expect(item.isPublished, isTrue);
    expect(item.publishedAtDate, DateTime.utc(2026, 11, 20, 5, 30));
    expect(item.views, 12);
    expect(item.featured, isTrue);
  });
}
