import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class _Server implements HttpClientAdapter {
  _Server(this.body, [this.status = 200]);

  final Object body;
  final int status;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async => ResponseBody.fromString(
    jsonEncode(body),
    status,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );

  @override
  void close({bool force = false}) {}
}

class _Bytes implements HttpClientAdapter {
  _Bytes(this.bytes);

  final List<int> bytes;
  int requests = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests++;
    return ResponseBody.fromBytes(
      bytes,
      200,
      headers: {
        Headers.contentLengthHeader: ['${bytes.length}'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _FakeInstaller extends UpdateInstaller {
  Completer<File> done = Completer<File>();
  void Function(double)? report;
  int installed = 0;

  @override
  Future<File> download(
    AppRelease release, {
    void Function(double progress)? onProgress,
    CancelToken? cancel,
  }) {
    report = onProgress;
    return done.future;
  }

  @override
  Future<bool> install(File file) async {
    installed++;
    return true;
  }
}

UpdateChecker _checker(Object body, {int current = 21, int status = 200}) =>
    UpdateChecker(
      appKey: 'worker',
      manifest: Uri.parse('https://example.test/downloads/manifest.json'),
      dio: Dio()..httpClientAdapter = _Server(body, status),
      currentBuild: () async => current,
    );

Map<String, Object> _manifest(int build) => {
  'apps': {
    'worker': {'version': '1.4.0', 'build': build, 'file': 'xodim+22.apk'},
  },
};

void main() {
  test('only a newer build is offered, with its download address', () async {
    final release = await _checker(_manifest(22)).check();
    expect(release?.version, '1.4.0');
    expect(
      release?.url.toString(),
      'https://example.test/downloads/xodim%2B22.apk',
    );
    expect(await _checker(_manifest(21)).check(), isNull);
  });

  test('a missing or broken manifest is not an update', () async {
    expect(await _checker('<html>', status: 404).check(), isNull);
    expect(await _checker({'apps': <String, Object>{}}).check(), isNull);
  });

  test('notes, size and the minimum supported build are read', () async {
    final release = await _checker({
      'apps': {
        'worker': {
          'version': '1.4.0',
          'build': 25,
          'file': 'a.apk',
          'size': 10,
          'notes': ['Yangi', 5],
          'minBuild': 22,
        },
      },
    }).check();
    expect(release?.notes, ['Yangi']);
    expect(release?.size, 10);
    expect(release?.required, isTrue);
    expect((await _checker(_manifest(22)).check())?.required, isFalse);
  });

  group('installer', () {
    late Directory temp;
    final bytes = utf8.encode('apk-bytes');

    setUp(() => temp = Directory.systemTemp.createTempSync('update'));
    tearDown(() => temp.deleteSync(recursive: true));

    AppRelease release({int? size, String? hash}) => AppRelease(
      version: '1.4.0',
      build: 22,
      url: Uri.parse('https://example.test/a.apk'),
      size: size ?? bytes.length,
      sha256: hash ?? sha256.convert(bytes).toString(),
    );

    UpdateInstaller installer(_Bytes server) => UpdateInstaller(
      dio: Dio()..httpClientAdapter = server,
      directory: () async => temp,
    );

    test('a checked file is kept and not downloaded twice', () async {
      final server = _Bytes(bytes);
      final progress = <double>[];
      final file = await installer(
        server,
      ).download(release(), onProgress: progress.add);
      await installer(server).download(release());

      expect(file.readAsBytesSync(), bytes);
      expect(progress.last, 1);
      expect(server.requests, 1);
    });

    test('a damaged download is rejected and removed', () async {
      await expectLater(
        installer(_Bytes(bytes)).download(release(hash: 'abc')),
        throwsA(isA<DamagedUpdate>()),
      );
      expect(temp.listSync(recursive: true).whereType<File>(), isEmpty);
    });
  });

  testWidgets('update downloads, shows progress and opens the installer', (
    tester,
  ) async {
    final installer = _FakeInstaller();
    await tester.pumpWidget(
      MaterialApp(
        home: UpdateGate(
          checker: _checker(_manifest(22)),
          installer: installer,
          child: const Text('ilova'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Yangilash'));
    await tester.pump();
    installer.report!(0.4);
    await tester.pump();
    expect(find.textContaining('40%'), findsOneWidget);

    installer.done.complete(File('x.apk'));
    await tester.pumpAndSettle();
    expect(installer.installed, 1);
    expect(find.text('O‘rnatish'), findsOneWidget);
  });

  testWidgets('a failed download offers retry and the browser', (tester) async {
    final installer = _FakeInstaller();
    final opened = <Uri>[];
    await tester.pumpWidget(
      MaterialApp(
        home: UpdateGate(
          checker: _checker(_manifest(22)),
          installer: installer,
          openInBrowser: (url) async => opened.add(url),
          child: const Text('ilova'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yangilash'));
    await tester.pump();
    installer.done.completeError(const DamagedUpdate());
    await tester.pumpAndSettle();

    expect(find.text('Qayta urinish'), findsOneWidget);
    await tester.tap(find.text('Brauzerda yuklab olish'));
    expect(opened, hasLength(1));

    await tester.tap(find.text('Keyinroq'));
    await tester.pump();
    expect(find.byKey(const Key('app_update_card')), findsNothing);
  });

  testWidgets('a required update cannot be postponed', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: UpdateGate(
          checker: _checker({
            'apps': {
              'worker': {
                'version': '2.0.0',
                'build': 30,
                'file': 'a.apk',
                'minBuild': 30,
              },
            },
          }),
          installer: _FakeInstaller(),
          child: const Text('ilova'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Ilovani yangilash kerak'), findsOneWidget);
    expect(find.text('Keyinroq'), findsNothing);
  });
}
