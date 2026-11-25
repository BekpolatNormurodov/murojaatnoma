import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/features/requests/data/datasources/applications_remote_data_source.dart';
import 'package:worker_app/features/requests/domain/attachment_type_resolver.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';

import '../../support/fake_http.dart';

class _Client implements DioClient {
  _Client(this.dio);

  @override
  Dio dio;
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('attachment type follows the extension', () {
    expect(attachmentTypeFor('/uploads/a.JPG'), AttachmentType.image);
    expect(attachmentTypeFor('/uploads/a.pdf'), AttachmentType.file);
    expect(attachmentTypeFor('/uploads/a.m4a?x=1'), AttachmentType.voice);
    expect(attachmentTypeFor('/uploads/a.mp4'), AttachmentType.video);
  });

  test('a failed extra document leaves the murojaat unresolved', () async {
    final dir = Directory.systemTemp.createTempSync('reply');
    addTearDown(() => dir.deleteSync(recursive: true));
    AttachmentRef doc(String name) => AttachmentRef(
      type: AttachmentType.file,
      path: (File('${dir.path}/$name')..writeAsStringSync('x')).path,
      name: name,
    );
    var uploads = 0;
    final posted = <String>[];
    final http = FakeHttp((o) {
      if (o.path == '/uploads/document') {
        return json({'url': '/uploads/${++uploads}.pdf'});
      }
      posted.add(o.path);
      return json({'message': 'xato'}, 400);
    });
    final source = ApplicationsRemoteDataSourceApiImpl(_Client(http.dio()));

    await expectLater(
      source.respond(
        '1',
        ApplicationResponse(
          text: 'Javob',
          attachments: [doc('a.pdf'), doc('b.pdf')],
          respondedAt: '2026-11-25T00:00:00Z',
        ),
      ),
      throwsA(isA<ServerException>()),
    );

    expect(posted, ['/applications/1/messages']);
  });

  test('every extra document in a reply reaches the thread', () async {
    final dir = Directory.systemTemp.createTempSync('reply');
    addTearDown(() => dir.deleteSync(recursive: true));
    AttachmentRef doc(String name) => AttachmentRef(
      type: AttachmentType.file,
      path: (File('${dir.path}/$name')..writeAsStringSync('x')).path,
      name: name,
    );
    var uploads = 0;
    final sent = <(String, Object?)>[];
    final http = FakeHttp((o) {
      if (o.path == '/uploads/document') {
        return json({'url': '/uploads/${++uploads}.pdf'});
      }
      if (o.method == 'POST') {
        sent.add((o.path, (o.data as Map)['attachmentUrl']));
        return json(<String, dynamic>{});
      }
      if (o.path == '/applications/1') {
        return json({
          'id': '1',
          'subject': 's',
          'description': 'd',
          'status': 'RESOLVED',
          'createdAt': '2026-11-25T00:00:00Z',
          'applicantFullName': 'n',
          'applicantPhone': 'p',
        });
      }
      return json(<dynamic>[]);
    });
    final source = ApplicationsRemoteDataSourceApiImpl(_Client(http.dio()));
    await source.respond(
      '1',
      ApplicationResponse(
        text: 'Javob',
        attachments: [doc('a.pdf'), doc('b.pdf')],
        respondedAt: '2026-11-25T00:00:00Z',
      ),
    );
    // The final reply goes LAST: the app shows the newest staff message as
    // the answer, and nothing is resolved before every document is posted.
    expect(sent.map((s) => s.$1), [
      '/applications/1/messages',
      '/applications/1/reply',
    ]);
    expect('${sent[0].$2}', endsWith('/uploads/2.pdf'));
    expect('${sent[1].$2}', endsWith('/uploads/1.pdf'));

    sent.clear();
    await expectLater(
      source.respond(
        '1',
        const ApplicationResponse(
          text: 'J',
          attachments: [
            AttachmentRef(
              type: AttachmentType.file,
              path: '/missing.pdf',
              name: 'missing.pdf',
            ),
          ],
          respondedAt: '2026-11-25T00:00:00Z',
        ),
      ),
      throwsA(isA<ServerException>()),
    );
    expect(sent, isEmpty);
  });
}
