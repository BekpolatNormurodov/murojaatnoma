import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:user_app/features/news/data/datasources/news_remote_data_source.dart';
import 'package:user_app/features/registration/domain/repositories/registration_repository.dart';
import 'package:user_app/features/requests/data/datasources/citizen_requests_remote_data_source.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/repositories/citizen_requests_repository.dart';
import 'package:user_app/features/requests/domain/usecases/submit_citizen_request.dart';
import 'package:user_app/features/requests/presentation/bloc/submit_request_cubit.dart';

import '../../support/fake_dio.dart';

class _Repo extends Mock implements CitizenRequestsRepository {}

class _Auth extends Mock implements AuthRepository {}

class _Registration extends Mock implements RegistrationRepository {}

const _photo = RequestAttachment(
  type: RequestAttachmentType.image,
  path: '/tmp/a.jpg',
  name: 'a.jpg',
);
const _photo2 = RequestAttachment(
  type: RequestAttachmentType.image,
  path: '/tmp/b.png',
  name: 'b.png',
);
const _draft = CitizenRequest(
  id: '',
  kind: RequestKind.ariza,
  category: 'c',
  title: 'title',
  body: 'body body body',
  status: RequestStatus.yuborilgan,
  createdAt: '2026-11-01T10:00:00',
  attachments: [_photo, _photo2],
);
const _created = CitizenRequest(
  id: 'A1',
  kind: RequestKind.ariza,
  category: 'c',
  title: 'title',
  body: 'body body body',
  status: RequestStatus.yuborilgan,
  createdAt: '2026-11-01T10:00:00',
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    registerFallbackValue(_draft);
    registerFallbackValue(_photo);
  });

  group('SubmitRequestCubit', () {
    late _Repo repo;
    late SubmitRequestCubit cubit;

    setUp(() {
      repo = _Repo();
      when(() => repo.submit(any())).thenAnswer((_) async {
        return const Right(_created);
      });
      cubit = SubmitRequestCubit(
        submitCitizenRequest: SubmitCitizenRequest(repo),
        registrationRepository: _Registration(),
        repository: repo,
      );
    });

    tearDown(() => cubit.close());

    test('uploads every photo to the created application', () async {
      when(
        () => repo.uploadAttachment(any(), any()),
      ).thenAnswer((_) async => const Right(unit));

      await cubit.submit(_draft);

      verify(() => repo.uploadAttachment('A1', _photo)).called(1);
      verify(() => repo.uploadAttachment('A1', _photo2)).called(1);
      expect(cubit.state, const SubmitRequestSuccess(_created));
    });

    test('partial failure: retry resends only the failed file and never '
        'creates a second application', () async {
      var failSecond = true;
      when(() => repo.uploadAttachment(any(), any())).thenAnswer((i) async {
        if (i.positionalArguments[1] == _photo2 && failSecond) {
          return const Left(ServerFailure('tarmoq'));
        }
        return const Right(unit);
      });

      await cubit.submit(_draft);
      final state = cubit.state as SubmitRequestAttachmentsFailed;
      expect(state.failed, [_photo2]);
      await cubit.submit(_draft); // e'tiborsiz

      failSecond = false;
      await cubit.retryAttachments();

      expect(cubit.state, const SubmitRequestSuccess(_created));
      verify(() => repo.submit(any())).called(1);
      verify(() => repo.uploadAttachment('A1', _photo)).called(1);
      verify(() => repo.uploadAttachment('A1', _photo2)).called(2);
    });

    test('can finish without the failed files', () async {
      when(
        () => repo.uploadAttachment(any(), any()),
      ).thenAnswer((_) async => const Left(ServerFailure('x')));

      await cubit.submit(_draft);
      cubit.finishWithoutAttachments();

      expect(cubit.state, const SubmitRequestSuccess(_created));
    });
  });

  group('CitizenRequestsApiImpl', () {
    CitizenRequestsApiImpl api(FakeHandler handler, List<RequestOptions> log) =>
        CitizenRequestsApiImpl(
          fakeDioClient(handler, log),
          authRepository: _Auth(),
          registrationRepository: _Registration(),
        );

    test(
      'uploads multipart field "file" with an explicit image type',
      () async {
        final file = File('${Directory.systemTemp.path}/upload_test.png')
          ..writeAsBytesSync([1, 2, 3]);
        addTearDown(file.deleteSync);
        final log = <RequestOptions>[];

        await api((_) => (201, <String, Object>{}), log).uploadAttachment(
          'A1',
          RequestAttachment(
            type: RequestAttachmentType.image,
            path: file.path,
            name: 'photo.png',
          ),
        );

        expect(log.single.path, '/applications/A1/attachments/upload');
        final form = log.single.data as FormData;
        expect(form.files.single.key, 'file');
        expect(form.files.single.value.contentType.toString(), 'image/png');
      },
    );

    test('getById returns the server attachments', () async {
      final request = await api((o) {
        if (o.path.endsWith('/attachments')) {
          return (
            200,
            [
              {
                'url': 'https://x/u/1.jpg',
                'type': 'PHOTO',
                'fileName': '1.jpg',
              },
              {
                'url': 'https://x/u/2.m4a',
                'type': 'VIDEO',
                'mimeType': 'audio/mp4',
              },
            ],
          );
        }
        if (o.path.endsWith('/events')) return (200, <Object>[]);
        return (200, {'id': 'A1', 'subject': 's', 'status': 'NEW'});
      }, []).getById('A1');

      expect(request.attachmentsFailed, isFalse);
      expect(request.attachments.map((a) => a.type), [
        RequestAttachmentType.image,
        RequestAttachmentType.voice,
      ]);
    });

    test('a failed attachment list is flagged, not shown as empty', () async {
      final request = await api((o) {
        if (o.path.endsWith('/attachments')) return (500, <String, Object>{});
        if (o.path.endsWith('/events')) return (200, <Object>[]);
        return (200, {'id': 'A1', 'subject': 's', 'status': 'NEW'});
      }, []).getById('A1');

      expect(request.attachmentsFailed, isTrue);
    });
  });

  test(
    'news: a 403 for citizens is an empty section, 500 is an error',
    () async {
      final forbidden = NewsApiImpl(
        fakeDioClient((_) => (403, {'message': 'Forbidden'})),
      );
      expect(await forbidden.list(), isEmpty);

      final broken = NewsApiImpl(fakeDioClient((_) => (500, {'message': 'x'})));
      await expectLater(broken.list(), throwsA(isA<ServerException>()));
    },
  );
}
