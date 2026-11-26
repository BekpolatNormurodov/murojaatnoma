import 'dart:convert';

import 'package:app_core/app_core.dart';
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

  testWidgets('download opens the file, later hides the card', (tester) async {
    final opened = <Uri>[];
    await tester.pumpWidget(
      MaterialApp(
        home: UpdateGate(
          checker: _checker(_manifest(22)),
          open: (url) async => opened.add(url),
          child: const Text('ilova'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Yuklab olish'));
    expect(opened, hasLength(1));

    await tester.tap(find.text('Keyinroq'));
    await tester.pump();
    expect(find.byKey(const Key('app_update_card')), findsNothing);
    expect(find.text('ilova'), findsOneWidget);
  });
}
